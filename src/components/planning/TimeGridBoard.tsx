import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'
import type { DayWithSlots, SlotWithProposals, Trip } from '@/types/database'
import { addLockedSlot, updateSlotSchedule } from '@/services/planningService'
import { minutesToTimeLabel } from '@/lib/timeUtils'
import {
  HOUR_PX,
  MIN_DURATION_MIN,
  DEFAULT_DURATION_MIN,
  SHELF_DROP_DURATION_MIN,
  DAY_HEADER_PX,
  slotStartMinutes,
  slotDurationMinutes,
  slotTitle,
  snapMinutes,
  clampMinutes,
  formatMinuteRange,
  computeGridStartMin,
  computeGridEndMin,
  computeGridMaxEndMin,
  hiddenBefore,
  hiddenAfter,
  type EdgeSummary,
  layoutOverlaps,
} from '@/lib/timeGrid'
import { usePlanningHistory } from '@/hooks/usePlanningHistory'
import { TimeGridCard } from './TimeGridCard'
import { TimeGridDayHeader } from './TimeGridDayHeader'
import { cn } from '@/lib/utils'

/**
 * Touch only: how long a finger must rest on a card before it lifts for
 * dragging. Below the threshold the browser keeps the gesture and scrolls the
 * board, which is what a swipe across a card almost always means.
 */
/**
 * What an edge toggle promises. When the trim has left real events outside the
 * window it names the nearest one, so a collapsed evening never silently
 * swallows the 11:30 PM flight it was collapsed to avoid showing.
 */
function edgeHint(
  dir: 'up' | 'down',
  hidden: EdgeSummary | null,
  edge: number
): string {
  const at = (m: number) => minutesToTimeLabel(m).replace(':00 ', ' ')
  if (hidden) {
    const more = hidden.count > 1 ? ` (+${hidden.count - 1} more)` : ''
    return `${at(hidden.minutes)} · ${hidden.title}${more} — tap to show`
  }
  return dir === 'up' ? `Show 12 AM – ${at(edge)}` : `Show ${at(edge)} – 12 AM`
}

const LIFT_DELAY_MS = 350
/** Movement before the lift fires proves the finger meant to scroll. */
const LIFT_TOLERANCE_PX = 8

/** How far a touch travels before the board judges which axis it meant. */
const SWIPE_AXIS_PX = 12
/**
 * How much more sideways than vertical that travel has to be to page days —
 * about 35° off horizontal. Anything steeper scrolls the hours instead.
 */
const SWIPE_AXIS_RATIO = 1.4
/** How much of a column a sideways swipe must cover to commit to the next day. */
const SWIPE_COMMIT_FRACTION = 0.25
/** …or the flick speed, in px/ms, that commits regardless of distance. */
const SWIPE_COMMIT_SPEED = 0.4

/**
 * The day columns as the wrapper's x scroll sees them: which one it sits
 * nearest, and where any of them comes to rest — just right of the sticky hour
 * gutter, which is where the first one already sits and what `scroll-ml`
 * restates in CSS.
 */
function dayColumns(wrap: HTMLElement, root: HTMLElement) {
  const cols = [...root.querySelectorAll<HTMLElement>('[data-day-col]')]
  const rest = cols[0]?.offsetLeft ?? 0
  const count = cols.length
  const at = (i: number) => {
    const col = cols[Math.min(Math.max(i, 0), count - 1)]
    return Math.max(0, (col?.offsetLeft ?? rest) - rest)
  }
  let idx = 0
  let off = Infinity
  for (let i = 0; i < count; i++) {
    const d = Math.abs(at(i) - wrap.scrollLeft)
    if (d < off) {
      off = d
      idx = i
    }
  }
  return { idx, at, count, width: cols[0]?.offsetWidth ?? 1 }
}

interface TimeGridBoardProps {
  trip: Trip
  days: DayWithSlots[]
  currentName: string
  getToken?: () => Promise<string | null>
  canEdit: boolean
  onSlotClick: (slot: SlotWithProposals, dayLabel: string) => void
  onEditDay?: (day: DayWithSlots) => void
}

type Preview =
  | { kind: 'create'; dayIdx: number; start: number; duration: number }
  | { kind: 'move'; slotId: string; dayIdx: number; start: number }
  | { kind: 'resize'; slotId: string; duration: number }
  | { kind: 'chip'; slotId: string; dayIdx: number; start: number }

type Gesture = {
  mode: 'create' | 'tap' | 'move' | 'resize' | 'chip'
  slot?: SlotWithProposals
  dayIdx?: number
  dayIdx0?: number
  /** Touch/pen, where a drag has to be earned with a long press first. */
  touch: boolean
  /** Whether the gesture may drag yet. Mouse: immediately. Touch: on lift. */
  armed: boolean
  liftTimer?: number
  x0: number
  y0: number
  anchor?: number
  start0?: number
  dur0?: number
  moved: boolean
  swallow?: boolean
  lastStart?: number
  lastDur?: number
  lastDayIdx?: number
  toShelf?: number | null
  rects: { canvases: DOMRect[]; shelves: DOMRect[] }
}

/**
 * The planning board as a time grid: separated day columns sharing one
 * vertical hour scale. Drag on empty space to add a slot, drag cards to move
 * them (onto a day shelf to unschedule), stretch the bottom edge to resize.
 */
export function TimeGridBoard({
  trip,
  days,
  currentName,
  getToken,
  canEdit,
  onSlotClick,
  onEditDay,
}: TimeGridBoardProps) {
  const history = usePlanningHistory()
  const wrapRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  /** The in-flight day swipe: where it started, and what it has committed to. */
  const swipe = useRef<{
    x: number
    y: number
    left: number
    day: number
    dir: 'x' | 'y' | null
    dx: number
    vx: number
    lastX: number
    lastT: number
  } | null>(null)

  const [preview, setPreview] = useState<Preview | null>(null)
  const [shelfTarget, setShelfTarget] = useState<number | null>(null)
  const [liftedChipId, setLiftedChipId] = useState<string | null>(null)
  /** Card/chip a long press has lifted, ready to drag. Touch only. */
  const [armedId, setArmedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ dayIdx: number; start: number; duration: number } | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [nightOpen, setNightOpen] = useState(false)
  const [eveningOpen, setEveningOpen] = useState(false)
  const [activeDayIndex, setActiveDayIndex] = useState(0)

  const gridStartAuto = useMemo(() => computeGridStartMin(days), [days])
  const gridEndAuto = useMemo(() => computeGridEndMin(days), [days])
  const gridEndMax = useMemo(() => computeGridMaxEndMin(days), [days])
  const gridStart = nightOpen ? 0 : gridStartAuto
  const gridEnd = eveningOpen ? gridEndMax : gridEndAuto
  // What the trimmed window is leaving out, so the toggles can name it rather
  // than hide it behind a bare arrow.
  const hiddenEarly = useMemo(() => hiddenBefore(days, gridStart), [days, gridStart])
  const hiddenLate = useMemo(() => hiddenAfter(days, gridEnd), [days, gridEnd])
  const canvasH = ((gridEnd - gridStart) / 60) * HOUR_PX

  // Window-level drag handlers live outside React's render cycle; feed them
  // the latest props/state through refs, synced after each commit.
  const daysRef = useRef(days)
  const tripRef = useRef(trip)
  const currentNameRef = useRef(currentName)
  const canEditRef = useRef(canEdit)
  const gridStartRef = useRef(gridStart)
  const gridEndRef = useRef(gridEnd)
  const onSlotClickRef = useRef(onSlotClick)
  const draftRef = useRef(draft)
  const draftTitleRef = useRef(draftTitle)
  const historyRef = useRef(history)
  useEffect(() => {
    daysRef.current = days
    tripRef.current = trip
    currentNameRef.current = currentName
    canEditRef.current = canEdit
    gridStartRef.current = gridStart
    gridEndRef.current = gridEnd
    onSlotClickRef.current = onSlotClick
    draftRef.current = draft
    draftTitleRef.current = draftTitle
    historyRef.current = history
  })

  // ── Per-day layout, with the in-flight drag applied on top ─────────────
  const { timedByDay, untimedByDay, placements } = useMemo(() => {
    type Item = { slot: SlotWithProposals; start: number; duration: number; held: boolean }
    const timedByDay: Item[][] = days.map(() => [])
    const untimedByDay: SlotWithProposals[][] = days.map(() => [])

    days.forEach((day, i) => {
      for (const slot of day.slots) {
        let start = slotStartMinutes(slot)
        let duration = slotDurationMinutes(slot)
        let dayIdx = i
        let held = false
        if (preview?.kind === 'move' && preview.slotId === slot.id) {
          start = preview.start
          dayIdx = preview.dayIdx
          held = true
        } else if (preview?.kind === 'resize' && preview.slotId === slot.id) {
          duration = preview.duration
          held = true
        }
        if (start === null) untimedByDay[i].push(slot)
        else timedByDay[dayIdx]?.push({ slot, start, duration, held })
      }
    })

    const placements = timedByDay.map((items) => layoutOverlaps(items))
    return { timedByDay, untimedByDay, placements }
  }, [days, preview])

  // ── Draft (inline "what's planned?" card) ──────────────────────────────
  const commitDraft = useCallback(async () => {
    const d = draftRef.current
    const title = draftTitleRef.current.trim()
    setDraft(null)
    setDraftTitle('')
    if (!d || !title) return
    const day = daysRef.current[d.dayIdx]
    if (!day) return
    await addLockedSlot({
      day_id: day.id,
      trip_id: tripRef.current.id,
      time_label: minutesToTimeLabel(d.start),
      sort_order: day.slots.length,
      proposer_name: currentNameRef.current,
      title,
      start_minutes: d.start,
      duration_minutes: d.duration,
    })
  }, [])

  const cancelDraft = useCallback(() => {
    setDraft(null)
    setDraftTitle('')
  }, [])

  const addUntimed = useCallback(async (dayIdx: number, title: string) => {
    const day = daysRef.current[dayIdx]
    if (!day) return
    await addLockedSlot({
      day_id: day.id,
      trip_id: tripRef.current.id,
      time_label: '',
      sort_order: day.slots.length,
      proposer_name: currentNameRef.current,
      title,
      start_minutes: null,
      duration_minutes: SHELF_DROP_DURATION_MIN,
    })
  }, [])

  // ── Gesture start (delegated) ──────────────────────────────────────────
  const startGesture = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.target as HTMLElement
    if (target.closest('[data-grid-ignore]') || target.closest('[data-draft]')) return

    const hadDraft = !!draftRef.current
    if (hadDraft) void commitDraft()

    const cardEl = target.closest<HTMLElement>('[data-slot-id]')
    const chipEl = target.closest<HTMLElement>('[data-chip-id]')
    const canvasEl = target.closest<HTMLElement>('[data-canvas-idx]')
    if (!cardEl && !chipEl && !canvasEl) return

    const root = boardRef.current
    if (!root) return
    const rects = {
      canvases: [...root.querySelectorAll<HTMLElement>('[data-canvas-idx]')].map((el) =>
        el.getBoundingClientRect()
      ),
      shelves: [...root.querySelectorAll<HTMLElement>('[data-shelf]')].map((el) =>
        el.getBoundingClientRect()
      ),
    }

    const findSlot = (id: string) => {
      for (let i = 0; i < daysRef.current.length; i++) {
        const slot = daysRef.current[i].slots.find((s) => s.id === id)
        if (slot) return { slot, dayIdx: i }
      }
      return null
    }

    // A touch drag has to be earned with a long press; until then the browser
    // owns the gesture so the board scrolls as it should.
    const touch = e.pointerType !== 'mouse'

    if (cardEl) {
      const found = findSlot(cardEl.dataset.slotId ?? '')
      if (!found) return
      const start = slotStartMinutes(found.slot)
      if (start === null) return
      gesture.current = {
        // The resize strip is 8px tall — a mouse affordance, not a touch one.
        // On touch the whole card moves and the drawer edits exact times.
        mode: !touch && target.closest('[data-resize]') ? 'resize' : 'move',
        slot: found.slot,
        dayIdx0: found.dayIdx,
        touch,
        armed: !touch,
        x0: e.clientX,
        y0: e.clientY,
        start0: start,
        dur0: slotDurationMinutes(found.slot),
        moved: false,
        rects,
      }
    } else if (chipEl) {
      const found = findSlot(chipEl.dataset.chipId ?? '')
      if (!found) return
      gesture.current = {
        mode: 'chip',
        slot: found.slot,
        dayIdx0: found.dayIdx,
        touch,
        armed: !touch,
        x0: e.clientX,
        y0: e.clientY,
        moved: false,
        rects,
      }
    } else if (canvasEl) {
      if (!canEditRef.current) return
      const dayIdx = Number(canvasEl.dataset.canvasIdx)
      const y = e.clientY
      const anchor = clampMinutes(
        snapMinutes(gridStartRef.current + ((y - rects.canvases[dayIdx].top) / HOUR_PX) * 60),
        gridStartRef.current,
        gridEndRef.current
      )
      gesture.current = {
        mode: touch ? 'tap' : 'create',
        dayIdx,
        touch,
        armed: true,
        x0: e.clientX,
        y0: e.clientY,
        anchor,
        moved: false,
        swallow: hadDraft,
        rects,
      }
    }

    // Hold still on a card or chip and it lifts, with a nudge of haptics where
    // the device offers them, so the drag is something you feel you started.
    const pending = gesture.current
    if (pending && !pending.armed) {
      pending.liftTimer = window.setTimeout(() => {
        if (gesture.current !== pending) return
        pending.armed = true
        navigator.vibrate?.(8)
        setArmedId(pending.slot?.id ?? null)
      }, LIFT_DELAY_MS)
    }

    // Keep receiving events even if the pointer leaves the window; the board
    // element outlives mid-drag re-renders, unlike the card nodes themselves.
    if (gesture.current && e.pointerType === 'mouse') {
      try {
        root.setPointerCapture(e.pointerId)
      } catch {
        // capture is best-effort
      }
    }
  }

  // ── Window-level move/up/cancel ────────────────────────────────────────
  useEffect(() => {
    const yToMin = (rects: Gesture['rects'], dayIdx: number, y: number) =>
      clampMinutes(
        snapMinutes(
          gridStartRef.current + ((y - rects.canvases[dayIdx].top) / HOUR_PX) * 60
        ),
        gridStartRef.current,
        gridEndRef.current
      )
    const dayAt = (rects: Gesture['rects'], x: number) => {
      for (let i = 0; i < rects.canvases.length; i++) {
        const r = rects.canvases[i]
        if (x >= r.left && x < r.right) return i
      }
      return null
    }
    const shelfAt = (rects: Gesture['rects'], x: number, y: number) => {
      for (let i = 0; i < rects.shelves.length; i++) {
        const r = rects.shelves[i]
        if (x >= r.left - 8 && x < r.right + 8 && y >= r.top - 8 && y < r.bottom + 8) return i
      }
      return null
    }

    const cancelLift = (p: Gesture) => {
      if (p.liftTimer !== undefined) window.clearTimeout(p.liftTimer)
      p.liftTimer = undefined
    }

    const onMove = (e: PointerEvent) => {
      const p = gesture.current
      if (!p) return
      if (!canEditRef.current) return
      const dx = e.clientX - p.x0
      const dy = e.clientY - p.y0
      if (!p.armed) {
        // The finger moved before the card lifted, so this was a scroll all
        // along: drop the gesture and leave the board to the browser.
        if (Math.hypot(dx, dy) > LIFT_TOLERANCE_PX) {
          cancelLift(p)
          gesture.current = null
          setArmedId(null)
        }
        return
      }
      if (!p.moved && Math.hypot(dx, dy) < 4) return
      if (!p.moved) {
        p.moved = true
        document.body.style.userSelect = 'none'
        if (p.mode === 'chip' && p.slot) setLiftedChipId(p.slot.id)
      }

      if (p.mode === 'create') {
        const cur = yToMin(p.rects, p.dayIdx!, e.clientY)
        const start = Math.min(p.anchor!, cur)
        const duration = Math.max(MIN_DURATION_MIN, Math.abs(cur - p.anchor!))
        p.lastStart = start
        p.lastDur = duration
        setPreview({ kind: 'create', dayIdx: p.dayIdx!, start, duration })
      } else if (p.mode === 'move') {
        const shelf = shelfAt(p.rects, e.clientX, e.clientY)
        p.toShelf = shelf
        setShelfTarget(shelf)
        const dayIdx = dayAt(p.rects, e.clientX) ?? p.lastDayIdx ?? p.dayIdx0!
        const start = clampMinutes(
          snapMinutes(p.start0! + (dy / HOUR_PX) * 60),
          gridStartRef.current,
          gridEndRef.current - p.dur0!
        )
        p.lastStart = start
        p.lastDayIdx = dayIdx
        setPreview({ kind: 'move', slotId: p.slot!.id, dayIdx, start })
      } else if (p.mode === 'resize') {
        const duration = clampMinutes(
          snapMinutes(p.dur0! + (dy / HOUR_PX) * 60),
          MIN_DURATION_MIN,
          gridEndRef.current - p.start0!
        )
        p.lastDur = duration
        setPreview({ kind: 'resize', slotId: p.slot!.id, duration })
      } else if (p.mode === 'chip') {
        const dayIdx = dayAt(p.rects, e.clientX)
        const over = dayIdx !== null && e.clientY > p.rects.canvases[dayIdx].top
        if (over) {
          const duration = slotDurationMinutes(p.slot!)
          const start = clampMinutes(
            yToMin(p.rects, dayIdx!, e.clientY),
            gridStartRef.current,
            gridEndRef.current - duration
          )
          p.lastStart = start
          p.lastDayIdx = dayIdx!
          setPreview({ kind: 'chip', slotId: p.slot!.id, dayIdx: dayIdx!, start })
        } else {
          p.lastStart = undefined
          p.lastDayIdx = undefined
          setPreview(null)
        }
      }
    }

    const onUp = () => {
      const p = gesture.current
      if (!p) return
      cancelLift(p)
      gesture.current = null
      document.body.style.userSelect = ''
      setShelfTarget(null)
      setLiftedChipId(null)
      setArmedId(null)
      const clearPreview = () => setPreview(null)
      const days = daysRef.current
      // Where it was, captured before the write — see usePlanningHistory.
      const recordUndo = (slot: SlotWithProposals) => {
        const before = {
          slotId: slot.id,
          day_id: slot.day_id,
          start_minutes: slotStartMinutes(slot),
          duration_minutes: slotDurationMinutes(slot),
          lockedProposalId: slot.locked_proposal_id,
        }
        historyRef.current.record(slotTitle(slot), () => updateSlotSchedule(before))
      }
      const dayLabelOf = (idx: number | undefined) =>
        `Day ${idx !== undefined ? days[idx]?.day_number ?? '' : ''}`

      if (p.mode === 'create' || p.mode === 'tap') {
        setPreview(null)
        if (!canEditRef.current) return
        if (p.mode === 'create' && p.moved && p.lastStart !== undefined) {
          setDraft({ dayIdx: p.dayIdx!, start: p.lastStart, duration: p.lastDur! })
          setDraftTitle('')
        } else if (!p.moved && !p.swallow) {
          const start = clampMinutes(
            p.anchor!,
            gridStartRef.current,
            gridEndRef.current - DEFAULT_DURATION_MIN
          )
          setDraft({ dayIdx: p.dayIdx!, start, duration: DEFAULT_DURATION_MIN })
          setDraftTitle('')
        }
        return
      }

      if (p.mode === 'move' || p.mode === 'resize') {
        const slot = p.slot!
        if (!p.moved) {
          setPreview(null)
          onSlotClickRef.current(slot, dayLabelOf(p.dayIdx0))
          return
        }
        if (p.mode === 'move' && p.toShelf != null) {
          const target = days[p.toShelf]
          recordUndo(slot)
          void updateSlotSchedule({
            slotId: slot.id,
            start_minutes: null,
            duration_minutes: slotDurationMinutes(slot),
            day_id: target && target.id !== slot.day_id ? target.id : undefined,
            lockedProposalId: slot.locked_proposal_id,
          }).finally(clearPreview)
        } else if (p.mode === 'move' && p.lastStart !== undefined) {
          const target = days[p.lastDayIdx!]
          recordUndo(slot)
          void updateSlotSchedule({
            slotId: slot.id,
            start_minutes: p.lastStart,
            duration_minutes: slotDurationMinutes(slot),
            day_id: target && target.id !== slot.day_id ? target.id : undefined,
            lockedProposalId: slot.locked_proposal_id,
          }).finally(clearPreview)
        } else if (p.mode === 'resize' && p.lastDur !== undefined) {
          recordUndo(slot)
          void updateSlotSchedule({
            slotId: slot.id,
            start_minutes: slotStartMinutes(slot),
            duration_minutes: p.lastDur,
            lockedProposalId: slot.locked_proposal_id,
          }).finally(clearPreview)
        } else {
          setPreview(null)
        }
        return
      }

      if (p.mode === 'chip') {
        const chip = p.slot!
        if (!p.moved) {
          setPreview(null)
          onSlotClickRef.current(chip, dayLabelOf(p.dayIdx0))
          return
        }
        if (p.lastStart !== undefined && p.lastDayIdx !== undefined) {
          const target = days[p.lastDayIdx]
          recordUndo(chip)
          void updateSlotSchedule({
            slotId: chip.id,
            start_minutes: p.lastStart,
            duration_minutes: slotDurationMinutes(chip),
            day_id: target && target.id !== chip.day_id ? target.id : undefined,
            lockedProposalId: chip.locked_proposal_id,
          }).finally(clearPreview)
        } else {
          setPreview(null)
        }
      }
    }

    const onCancel = () => {
      const p = gesture.current
      if (!p) return
      cancelLift(p)
      gesture.current = null
      document.body.style.userSelect = ''
      setPreview(null)
      setShelfTarget(null)
      setLiftedChipId(null)
      setArmedId(null)
    }

    // Cards are scrollable until they lift, so the only way to take the
    // gesture back from the browser mid-touch is to preventDefault here —
    // which works because a lifted finger has, by definition, not moved yet.
    const onTouchMove = (e: TouchEvent) => {
      const p = gesture.current
      if (p?.armed && p.touch && p.mode !== 'tap') e.preventDefault()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
      document.body.style.userSelect = ''
    }
  }, [])

  // ── Scroll: stay put when the visible range grows ────────────────────
  // Nothing scrolls the board on mount any more: computeGridStartMin already
  // opens it an hour before the trip's first event. That also survives slots
  // arriving after the days do, which a one-shot mount scroll did not.
  const prevGridStart = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (prevGridStart.current !== null && wrapRef.current) {
      const delta = ((prevGridStart.current - gridStart) / 60) * HOUR_PX
      if (delta !== 0) wrapRef.current.scrollTop += delta
    }
    prevGridStart.current = gridStart
  }, [gridStart])

  // ── Day swipe ──────────────────────────────────────────────────────────
  // Paging is ours, not the browser's: below `sm` the wrapper is `touch-pan-y`,
  // so a touch can only ever scroll the hours natively and no amount of
  // sideways drift in a vertical swipe can carry the snap fling onto the next
  // day. A swipe judged sideways moves the column under the finger instead,
  // and settles onto a day when the finger lifts.
  const beginSwipe = (e: ReactTouchEvent) => {
    const wrap = wrapRef.current
    const root = boardRef.current
    // A second finger landing mid-drag ends it here rather than in `endSwipe`,
    // so restore snapping from both.
    if (wrap) wrap.style.scrollSnapType = ''
    // Phones only: above `sm` the columns scroll freely, several at a time.
    if (!wrap || !root || e.touches.length !== 1 || wrap.clientWidth >= 600) {
      swipe.current = null
      return
    }
    const t = e.touches[0]
    swipe.current = {
      x: t.clientX,
      y: t.clientY,
      left: wrap.scrollLeft,
      day: dayColumns(wrap, root).idx,
      dir: null,
      dx: 0,
      vx: 0,
      lastX: t.clientX,
      lastT: e.timeStamp,
    }
  }

  const trackSwipe = (e: ReactTouchEvent) => {
    const s = swipe.current
    const wrap = wrapRef.current
    const root = boardRef.current
    if (!s || !wrap || !root || e.touches.length !== 1) return
    // A lifted card owns the finger — let it drag rather than paging under it.
    if (gesture.current?.armed && gesture.current.touch) return
    const t = e.touches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (!s.dir) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_AXIS_PX) return
      s.dir = Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO ? 'x' : 'y'
      // Snapping would fight every frame of the drag; it comes back on release.
      if (s.dir === 'x') wrap.style.scrollSnapType = 'none'
    }
    if (s.dir !== 'x') return
    const dt = e.timeStamp - s.lastT
    if (dt > 0) {
      s.vx = (t.clientX - s.lastX) / dt
      s.lastX = t.clientX
      s.lastT = e.timeStamp
    }
    s.dx = dx
    const cols = dayColumns(wrap, root)
    wrap.scrollLeft = Math.min(Math.max(s.left - dx, cols.at(0)), cols.at(cols.count - 1))
  }

  const endSwipe = () => {
    const s = swipe.current
    const wrap = wrapRef.current
    const root = boardRef.current
    swipe.current = null
    if (!s || s.dir !== 'x' || !wrap || !root) return
    wrap.style.scrollSnapType = ''
    const cols = dayColumns(wrap, root)
    const committed =
      Math.abs(s.dx) > cols.width * SWIPE_COMMIT_FRACTION ||
      Math.abs(s.vx) > SWIPE_COMMIT_SPEED
    const day = s.day + (committed ? (s.dx < 0 ? 1 : -1) : 0)
    wrap.scrollTo({ left: cols.at(day), behavior: 'smooth' })
  }

  // ── Mobile day pills ───────────────────────────────────────────────────
  const handleWrapScroll = () => {
    const wrap = wrapRef.current
    const root = boardRef.current
    if (!wrap || !root) return
    const cols = [...root.querySelectorAll<HTMLElement>('[data-day-col]')]
    // A column comes to rest just right of the sticky hour gutter — which is
    // where the first one already sits, and what `scroll-ml` restates in CSS.
    const rest = cols[0]?.offsetLeft ?? 0
    let idx = 0
    let nearest = Infinity
    for (let i = 0; i < cols.length; i++) {
      const off = Math.abs(cols[i].offsetLeft - rest - wrap.scrollLeft)
      if (off < nearest) {
        nearest = off
        idx = i
      }
    }
    setActiveDayIndex(idx)
  }

  const scrollToDay = (index: number) => {
    const wrap = wrapRef.current
    const root = boardRef.current
    if (!wrap || !root) return
    const cols = root.querySelectorAll<HTMLElement>('[data-day-col]')
    const col = cols[index]
    if (!col) return
    const rest = cols[0]?.offsetLeft ?? 0
    wrap.scrollTo({ left: Math.max(0, col.offsetLeft - rest), behavior: 'smooth' })
  }

  const hourLabels = useMemo(() => {
    const out: { top: number; text: string }[] = []
    for (let h = gridStart / 60 + 1; h < gridEnd / 60; h++) {
      // h can exceed 24 once a late event opens the small hours.
      const hh = h % 24
      out.push({
        top: ((h * 60 - gridStart) / 60) * HOUR_PX,
        text: hh === 0 ? '12 AM' : hh < 12 ? `${hh} AM` : hh === 12 ? '12 PM' : `${hh - 12} PM`,
      })
    }
    return out
  }, [gridStart, gridEnd])

  /**
   * Phones show one day per screen and page between them: 6.25rem of the
   * viewport is the left page gutter (1.25rem), the hour gutter (2.25rem), the
   * column gap (1rem) and 1.75rem of air on the right, which is what keeps a
   * card off the edge of the screen. `scroll-ml` matches the hour gutter + gap
   * so a day lands flush against it; `dayColumns` reads that same offset back
   * off column 0. Snapping is only how a swipe or a pill tap settles —
   * `beginSwipe` drives the paging itself, so a vertical scroll can't trip it.
   */
  const canvasStyle = {
    height: canvasH,
    backgroundImage:
      'linear-gradient(to bottom, hsl(var(--border) / 0.45) 1px, transparent 1px)',
    backgroundSize: `100% ${HOUR_PX}px`,
  }

  const ghost =
    preview && (preview.kind === 'create' || preview.kind === 'chip') ? preview : null
  const ghostSlot =
    ghost?.kind === 'chip'
      ? days.flatMap((d) => d.slots).find((s) => s.id === ghost.slotId)
      : undefined
  const ghostDuration =
    ghost?.kind === 'create'
      ? ghost.duration
      : ghostSlot
        ? slotDurationMinutes(ghostSlot)
        : SHELF_DROP_DURATION_MIN

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile: day pills for quick navigation — hidden on sm and up */}
      <div className="sm:hidden relative pb-2 -mx-1 px-1 shrink-0">
        <div
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-2 min-w-max pr-2">
            {days.map((day, i) => (
              <button
                key={day.id}
                type="button"
                onClick={() => scrollToDay(i)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation min-h-[44px]',
                  activeDayIndex === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}
              >
                Day {day.day_number}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        onScroll={handleWrapScroll}
        onTouchStart={beginSwipe}
        onTouchMove={trackSwipe}
        onTouchEnd={endSwipe}
        onTouchCancel={endSwipe}
        className="flex-1 min-h-0 overflow-auto overscroll-contain max-sm:snap-x max-sm:snap-mandatory max-sm:touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          ref={boardRef}
          onPointerDown={startGesture}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const el = (e.target as HTMLElement).closest<HTMLElement>('[data-slot-id],[data-chip-id]')
            const id = el?.dataset.slotId ?? el?.dataset.chipId
            if (!id) return
            for (const day of days) {
              const slot = day.slots.find((s) => s.id === id)
              if (slot) {
                onSlotClick(slot, `Day ${day.day_number}`)
                return
              }
            }
          }}
          className="relative flex w-max gap-6 max-sm:gap-4 pr-4 pb-6"
        >
          {/* Hour gutter — sticky against horizontal scroll */}
          <div className="w-9 sm:w-12 shrink-0 sticky left-0 z-[25] bg-background">
            <div
              className="sticky top-0 z-[5] bg-background flex items-end justify-end pb-1.5 pr-1"
              style={{ height: DAY_HEADER_PX }}
            >
              {gridStart > 0 ? (
                <button
                  type="button"
                  data-grid-ignore
                  onClick={() => setNightOpen(true)}
                  className="touch-target text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors tabular-nums"
                  title={edgeHint('up', hiddenEarly, gridStart)}
                  aria-label={edgeHint('up', hiddenEarly, gridStart)}
                >
                  <span className="sm:hidden">▴ 12a</span>
                  <span className="hidden sm:inline">▴ 12 AM</span>
                  {hiddenEarly && (
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block w-1 h-1 rounded-full bg-primary align-middle"
                    />
                  )}
                </button>
              ) : gridStartAuto > 0 ? (
                <button
                  type="button"
                  data-grid-ignore
                  onClick={() => setNightOpen(false)}
                  className="touch-target text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors tabular-nums"
                  title="Hide the empty early morning"
                >
                  ▾ hide
                </button>
              ) : null}
            </div>
            <div className="relative" style={{ height: canvasH }}>
              {hourLabels.map((l) => (
                <span
                  key={l.top}
                  className="absolute right-1.5 sm:right-2 -translate-y-1/2 text-[10px] text-muted-foreground/60 tabular-nums whitespace-nowrap"
                  style={{ top: l.top }}
                >
                  {l.text}
                </span>
              ))}

              {/* Evening toggle — the mirror of the morning one up top */}
              {gridEnd < gridEndMax ? (
                <button
                  type="button"
                  data-grid-ignore
                  onClick={() => setEveningOpen(true)}
                  className="touch-target absolute right-1.5 sm:right-2 bottom-1 text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors tabular-nums"
                  title={edgeHint('down', hiddenLate, gridEnd)}
                  aria-label={edgeHint('down', hiddenLate, gridEnd)}
                >
                  <span className="sm:hidden">▾ 12a</span>
                  <span className="hidden sm:inline">▾ 12 AM</span>
                  {hiddenLate && (
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block w-1 h-1 rounded-full bg-primary align-middle"
                    />
                  )}
                </button>
              ) : gridEndAuto < gridEndMax ? (
                <button
                  type="button"
                  data-grid-ignore
                  onClick={() => setEveningOpen(false)}
                  className="touch-target absolute right-1.5 sm:right-2 bottom-1 text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors tabular-nums"
                  title="Hide the empty late hours"
                >
                  ▴ hide
                </button>
              ) : null}
            </div>
          </div>

          {days.map((day, i) => (
            <div
              key={day.id}
              data-day-col
              className={cn(
                'shrink-0 flex flex-col snap-start',
                'w-[260px] max-sm:w-[calc(100vw-6.25rem)]',
                'scroll-ml-[3.25rem] sm:scroll-ml-[4.5rem]'
              )}
            >
              <TimeGridDayHeader
                day={day}
                tripId={trip.id}
                untimed={untimedByDay[i]}
                getToken={getToken}
                canEdit={canEdit}
                onEditDay={onEditDay}
                onAddUntimed={canEdit ? (title) => addUntimed(i, title) : undefined}
                liftedChipId={liftedChipId}
                armedChipId={armedId}
                shelfHighlighted={shelfTarget === i}
              />
              <div
                data-canvas-idx={i}
                className={cn('relative', canEdit && 'cursor-crosshair')}
                style={{ ...canvasStyle, touchAction: 'pan-x pan-y' }}
              >
                {timedByDay[i].map((item) => {
                  const placement = placements[i].get(item) ?? { col: 0, cols: 1 }
                  return (
                    <TimeGridCard
                      key={item.slot.id}
                      slot={item.slot}
                      start={item.start}
                      duration={item.duration}
                      top={((item.start - gridStart) / 60) * HOUR_PX}
                      height={Math.max(
                        26,
                        (Math.min(item.duration, gridEnd - item.start) / 60) * HOUR_PX - 3
                      )}
                      col={placement.col}
                      cols={placement.cols}
                      held={item.held}
                      armed={armedId === item.slot.id}
                      fading={item.held && shelfTarget !== null}
                      canEdit={canEdit}
                    />
                  )
                })}

                {/* Create / chip-drop ghost */}
                {ghost && ghost.dayIdx === i && (
                  <div
                    aria-hidden
                    className="absolute left-0 right-1 z-30 pointer-events-none rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5"
                    style={{
                      top: ((ghost.start - gridStart) / 60) * HOUR_PX,
                      height: Math.max(26, (ghostDuration / 60) * HOUR_PX - 3),
                    }}
                  >
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {ghost.kind === 'create'
                        ? formatMinuteRange(ghost.start, ghost.duration)
                        : minutesToTimeLabel(ghost.start)}
                    </span>
                  </div>
                )}

                {/* Inline draft */}
                {draft && draft.dayIdx === i && (
                  <div
                    data-draft
                    className="absolute left-0 right-1 z-40 rounded-lg border border-dashed border-primary/60 bg-background shadow-lg px-3 py-2 overflow-visible"
                    // minHeight, not height: a 30-minute draft is 23px tall at
                    // 52px/hour, and the time label plus the input need more
                    // than that — sized by duration, the text spilled out of
                    // its own dashed box.
                    style={{
                      top: ((draft.start - gridStart) / 60) * HOUR_PX,
                      minHeight: Math.max(26, (draft.duration / 60) * HOUR_PX - 3),
                    }}
                  >
                    <div aria-hidden className="absolute inset-0 rounded-[inherit] bg-primary/5 pointer-events-none" />
                    <div className="relative">
                      <span className="text-xs font-semibold text-primary tabular-nums">
                        {formatMinuteRange(draft.start, draft.duration)}
                      </span>
                      <input
                        autoFocus
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitDraft()
                          if (e.key === 'Escape') cancelDraft()
                        }}
                        onBlur={() => void commitDraft()}
                        placeholder="What's planned?"
                        aria-label="What's planned?"
                        className="mt-0.5 w-full bg-transparent outline-none text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
