import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DayWithSlots, SlotWithProposals, Trip } from '@/types/database'
import { addLockedSlot, updateSlotSchedule } from '@/services/planningService'
import { minutesToTimeLabel } from '@/lib/timeUtils'
import {
  HOUR_PX,
  GRID_END_MIN,
  MIN_DURATION_MIN,
  DEFAULT_DURATION_MIN,
  SHELF_DROP_DURATION_MIN,
  DAY_HEADER_PX,
  slotStartMinutes,
  slotDurationMinutes,
  snapMinutes,
  clampMinutes,
  formatMinuteRange,
  computeGridStartMin,
  layoutOverlaps,
} from '@/lib/timeGrid'
import { TimeGridCard } from './TimeGridCard'
import { TimeGridDayHeader } from './TimeGridDayHeader'
import { cn } from '@/lib/utils'

const VISIBLE_PILLS_HINT_THRESHOLD = 5

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
  const wrapRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)

  const [preview, setPreview] = useState<Preview | null>(null)
  const [shelfTarget, setShelfTarget] = useState<number | null>(null)
  const [liftedChipId, setLiftedChipId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ dayIdx: number; start: number; duration: number } | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [nightOpen, setNightOpen] = useState(false)
  const [activeDayIndex, setActiveDayIndex] = useState(0)

  const gridStartAuto = useMemo(() => computeGridStartMin(days), [days])
  const gridStart = nightOpen ? 0 : gridStartAuto
  const canvasH = ((GRID_END_MIN - gridStart) / 60) * HOUR_PX

  // Window-level drag handlers live outside React's render cycle; feed them
  // the latest props/state through refs, synced after each commit.
  const daysRef = useRef(days)
  const tripRef = useRef(trip)
  const currentNameRef = useRef(currentName)
  const canEditRef = useRef(canEdit)
  const gridStartRef = useRef(gridStart)
  const onSlotClickRef = useRef(onSlotClick)
  const draftRef = useRef(draft)
  const draftTitleRef = useRef(draftTitle)
  useEffect(() => {
    daysRef.current = days
    tripRef.current = trip
    currentNameRef.current = currentName
    canEditRef.current = canEdit
    gridStartRef.current = gridStart
    onSlotClickRef.current = onSlotClick
    draftRef.current = draft
    draftTitleRef.current = draftTitle
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

    if (cardEl) {
      const found = findSlot(cardEl.dataset.slotId ?? '')
      if (!found) return
      const start = slotStartMinutes(found.slot)
      if (start === null) return
      gesture.current = {
        mode: target.closest('[data-resize]') ? 'resize' : 'move',
        slot: found.slot,
        dayIdx0: found.dayIdx,
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
        GRID_END_MIN
      )
      gesture.current = {
        mode: e.pointerType === 'mouse' ? 'create' : 'tap',
        dayIdx,
        x0: e.clientX,
        y0: e.clientY,
        anchor,
        moved: false,
        swallow: hadDraft,
        rects,
      }
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
        GRID_END_MIN
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

    const onMove = (e: PointerEvent) => {
      const p = gesture.current
      if (!p) return
      if (!canEditRef.current) return
      const dx = e.clientX - p.x0
      const dy = e.clientY - p.y0
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
          GRID_END_MIN - p.dur0!
        )
        p.lastStart = start
        p.lastDayIdx = dayIdx
        setPreview({ kind: 'move', slotId: p.slot!.id, dayIdx, start })
      } else if (p.mode === 'resize') {
        const duration = clampMinutes(
          snapMinutes(p.dur0! + (dy / HOUR_PX) * 60),
          MIN_DURATION_MIN,
          GRID_END_MIN - p.start0!
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
            GRID_END_MIN - duration
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
      gesture.current = null
      document.body.style.userSelect = ''
      setShelfTarget(null)
      setLiftedChipId(null)
      const clearPreview = () => setPreview(null)
      const days = daysRef.current
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
            GRID_END_MIN - DEFAULT_DURATION_MIN
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
          void updateSlotSchedule({
            slotId: slot.id,
            start_minutes: null,
            duration_minutes: slotDurationMinutes(slot),
            day_id: target && target.id !== slot.day_id ? target.id : undefined,
            lockedProposalId: slot.locked_proposal_id,
          }).finally(clearPreview)
        } else if (p.mode === 'move' && p.lastStart !== undefined) {
          const target = days[p.lastDayIdx!]
          void updateSlotSchedule({
            slotId: slot.id,
            start_minutes: p.lastStart,
            duration_minutes: slotDurationMinutes(slot),
            day_id: target && target.id !== slot.day_id ? target.id : undefined,
            lockedProposalId: slot.locked_proposal_id,
          }).finally(clearPreview)
        } else if (p.mode === 'resize' && p.lastDur !== undefined) {
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
      if (!gesture.current) return
      gesture.current = null
      document.body.style.userSelect = ''
      setPreview(null)
      setShelfTarget(null)
      setLiftedChipId(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      document.body.style.userSelect = ''
    }
  }, [])

  // ── Scroll: land near the morning, and stay put when the range grows ──
  const didInitScroll = useRef(false)
  useEffect(() => {
    if (didInitScroll.current || !wrapRef.current) return
    didInitScroll.current = true
    let earliest = 8 * 60
    for (const day of daysRef.current) {
      for (const slot of day.slots) {
        const s = slotStartMinutes(slot)
        if (s !== null && s < earliest) earliest = s
      }
    }
    const target = Math.max(gridStartRef.current, earliest - 15)
    wrapRef.current.scrollTop = ((target - gridStartRef.current) / 60) * HOUR_PX
  }, [])

  const prevGridStart = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (prevGridStart.current !== null && wrapRef.current) {
      const delta = ((prevGridStart.current - gridStart) / 60) * HOUR_PX
      if (delta !== 0) wrapRef.current.scrollTop += delta
    }
    prevGridStart.current = gridStart
  }, [gridStart])

  // ── Mobile day pills ───────────────────────────────────────────────────
  const handleWrapScroll = () => {
    const wrap = wrapRef.current
    const root = boardRef.current
    if (!wrap || !root) return
    const cols = [...root.querySelectorAll<HTMLElement>('[data-day-col]')]
    let idx = 0
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].offsetLeft <= wrap.scrollLeft + 72) idx = i
    }
    setActiveDayIndex(idx)
  }

  const scrollToDay = (index: number) => {
    const wrap = wrapRef.current
    const root = boardRef.current
    if (!wrap || !root) return
    const col = root.querySelectorAll<HTMLElement>('[data-day-col]')[index]
    if (col) wrap.scrollTo({ left: Math.max(0, col.offsetLeft - 56), behavior: 'smooth' })
  }

  const hourLabels = useMemo(() => {
    const out: { top: number; text: string }[] = []
    for (let h = gridStart / 60 + 1; h < 24; h++) {
      out.push({
        top: ((h * 60 - gridStart) / 60) * HOUR_PX,
        text: h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`,
      })
    }
    return out
  }, [gridStart])

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
                  'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors touch-manipulation min-h-[40px]',
                  activeDayIndex === i
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}
              >
                Day {day.day_number}
              </button>
            ))}
            {days.length > VISIBLE_PILLS_HINT_THRESHOLD && (
              <span className="shrink-0 self-center text-xs text-muted-foreground px-2 whitespace-nowrap">
                +{days.length - VISIBLE_PILLS_HINT_THRESHOLD} more
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        onScroll={handleWrapScroll}
        className="flex-1 min-h-0 overflow-auto overscroll-contain"
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
          <div className="w-12 shrink-0 sticky left-0 z-[25] bg-background">
            <div
              className="sticky top-0 z-[5] bg-background flex items-end justify-end pb-1.5 pr-1"
              style={{ height: DAY_HEADER_PX }}
            >
              {gridStart > 0 ? (
                <button
                  type="button"
                  data-grid-ignore
                  onClick={() => setNightOpen(true)}
                  className="text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors tabular-nums"
                  title={`Show 12 AM – ${minutesToTimeLabel(gridStart).replace(':00 ', ' ')}`}
                >
                  ▴ 12 AM
                </button>
              ) : gridStartAuto > 0 ? (
                <button
                  type="button"
                  data-grid-ignore
                  onClick={() => setNightOpen(false)}
                  className="text-[10px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors tabular-nums"
                  title="Hide the empty early morning"
                >
                  ▾ hide
                </button>
              ) : null}
            </div>
            <div className="relative" style={{ height: canvasH }}>
              {hourLabels.map((l) => (
                <span
                  key={l.text}
                  className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground/60 tabular-nums whitespace-nowrap"
                  style={{ top: l.top }}
                >
                  {l.text}
                </span>
              ))}
            </div>
          </div>

          {days.map((day, i) => (
            <div
              key={day.id}
              data-day-col
              className="w-[260px] max-sm:w-[240px] shrink-0 flex flex-col"
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
                        (Math.min(item.duration, GRID_END_MIN - item.start) / 60) * HOUR_PX - 3
                      )}
                      col={placement.col}
                      cols={placement.cols}
                      held={item.held}
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
                    style={{
                      top: ((draft.start - gridStart) / 60) * HOUR_PX,
                      height: Math.max(26, (draft.duration / 60) * HOUR_PX - 3),
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
