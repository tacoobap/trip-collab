import type { DayWithSlots, Proposal, SlotWithProposals } from '@/types/database'
import { parseTimeToMinutes, minutesToTimeLabel } from './timeUtils'

/**
 * Geometry and time maths for the planning time grid. All times are minutes
 * from midnight; all pixel values assume `HOUR_PX` pixels per hour.
 */

export const HOUR_PX = 52
export const SNAP_MIN = 15
export const GRID_END_MIN = 24 * 60
/** Where the grid renders from when the trip has nothing scheduled yet. */
export const DEFAULT_GRID_START_MIN = 6 * 60
/** However late the first event is, never open later than this. */
export const MAX_AUTO_GRID_START_MIN = 9 * 60
export const MIN_DURATION_MIN = 30
export const DEFAULT_DURATION_MIN = 60
/** Where the grid stops when the trip has nothing scheduled yet. */
export const DEFAULT_GRID_END_MIN = 22 * 60
/** However early the last event ends, never close earlier than this. */
export const MIN_AUTO_GRID_END_MIN = 21 * 60
/** Duration given to a shelf item when it's dragged onto the timeline. */
export const SHELF_DROP_DURATION_MIN = 90
/**
 * How far one day's extreme has to sit beyond every other day's before the
 * grid stops stretching to reach it. A single 11:30 PM flight shouldn't cost
 * all seven days three empty evening hours — it goes behind the edge toggle,
 * which names it, instead.
 */
export const EDGE_OUTLIER_GAP_MIN = 2 * 60
/** Fixed day-header height — identical across columns so timelines align. */
export const DAY_HEADER_PX = 156

export function lockedProposalOf(slot: SlotWithProposals): Proposal | null {
  if (!slot.locked_proposal_id) return null
  return slot.proposals.find((p) => p.id === slot.locked_proposal_id) ?? null
}

/**
 * Canonical start time. Slots written by the grid carry `start_minutes`
 * (possibly null = deliberately unscheduled, i.e. on the day shelf); legacy
 * slots fall back to parsing whatever time they display today.
 */
export function slotStartMinutes(slot: SlotWithProposals): number | null {
  if (slot.start_minutes !== undefined) return slot.start_minutes
  const locked = lockedProposalOf(slot)
  const parsed = parseTimeToMinutes(
    locked?.exact_time ?? locked?.narrative_time ?? slot.time_label
  )
  return parsed === Infinity ? null : parsed
}

export function slotTitle(slot: SlotWithProposals): string {
  return lockedProposalOf(slot)?.title ?? slot.proposals[0]?.title ?? 'Open slot'
}

export function slotDurationMinutes(slot: SlotWithProposals): number {
  return slot.duration_minutes ?? DEFAULT_DURATION_MIN
}

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MIN) * SNAP_MIN
}

export function clampMinutes(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

/** "9:00 – 10:30 AM", collapsing the meridiem when both ends share it. */
export function formatMinuteRange(start: number, duration: number): string {
  const a = minutesToTimeLabel(start)
  // Deliberately unclamped: an 11:30 PM flight that lands at 2 AM has to say
  // 2 AM. `minutesToTimeLabel` wraps past midnight on its own.
  const b = minutesToTimeLabel(start + duration)
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`
}

/** Each day's own first start and last end, for the outlier test per edge. */
function perDayExtremes(days: DayWithSlots[]): { starts: number[]; ends: number[] } {
  const starts: number[] = []
  const ends: number[] = []
  for (const day of days) {
    let first: number | null = null
    let last: number | null = null
    for (const slot of day.slots) {
      const s = slotStartMinutes(slot)
      if (s === null) continue
      const end = s + slotDurationMinutes(slot)
      if (first === null || s < first) first = s
      if (last === null || end > last) last = end
    }
    if (first !== null) starts.push(first)
    if (last !== null) ends.push(last)
  }
  return { starts, ends }
}

/**
 * The extreme actually worth stretching the shared scale to reach.
 *
 * The scale is shared by every day column, so the plain min/max lets one day
 * tax all the others: a single 11:30 PM landing, with nothing else past 8 PM,
 * costs all seven days three empty evening hours. When the outermost day sits
 * EDGE_OUTLIER_GAP_MIN or more beyond the next one, it's left out of the
 * window and the edge toggle names it instead — two such days aren't an
 * outlier any more, and the window grows to cover them.
 */
function bulkExtreme(values: number[], dir: 'min' | 'max'): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  if (dir === 'max') {
    const top = sorted[sorted.length - 1]
    const next = sorted[sorted.length - 2]
    return top - next >= EDGE_OUTLIER_GAP_MIN ? next : top
  }
  return sorted[1] - sorted[0] >= EDGE_OUTLIER_GAP_MIN ? sorted[1] : sorted[0]
}

/**
 * Where the grid starts for this trip. Nothing scheduled yet: the 6 AM
 * default. Otherwise the hour before the trip's earliest event, so the board
 * doesn't open on a screenful of empty small hours — the common complaint
 * when the first thing anyone plans is a 10 AM coffee.
 *
 * Capped at MAX_AUTO_GRID_START_MIN so a trip that currently only has evening
 * plans still shows a morning to drop things into; the gutter toggle reveals
 * everything back to midnight either way.
 */
export function computeGridStartMin(days: DayWithSlots[]): number {
  const earliest = bulkExtreme(perDayExtremes(days).starts, 'min')
  if (earliest === null) return DEFAULT_GRID_START_MIN
  return clampMinutes(Math.floor(earliest / 60) * 60 - 60, 0, MAX_AUTO_GRID_START_MIN)
}

/**
 * Where the grid stops for this trip: an hour past the last thing anyone has
 * planned, so the board isn't mostly empty evening and a day takes fewer
 * screens to read.
 *
 * Floored at MIN_AUTO_GRID_END_MIN so there is always an evening left to drop
 * dinner into; the gutter toggle reveals everything to midnight either way.
 */
export function computeGridEndMin(days: DayWithSlots[]): number {
  const latest = bulkExtreme(perDayExtremes(days).ends, 'max')
  if (latest === null) return DEFAULT_GRID_END_MIN
  return clampMinutes(
    Math.ceil(latest / 60) * 60 + 60,
    MIN_AUTO_GRID_END_MIN,
    GRID_END_MIN
  )
}

/**
 * Where the grid ends once the late hours are revealed: midnight, or later
 * still when something genuinely runs past it — a flight boarding at 11:30 PM
 * and landing at 2 AM is one block on its own day, not a stub cut at 12:00.
 */
export function computeGridMaxEndMin(days: DayWithSlots[]): number {
  let latest = GRID_END_MIN
  for (const day of days) {
    for (const slot of day.slots) {
      const s = slotStartMinutes(slot)
      if (s === null) continue
      const end = Math.ceil((s + slotDurationMinutes(slot)) / 60) * 60 + 60
      if (end > latest) latest = end
    }
  }
  return latest
}

export type EdgeSummary = { count: number; minutes: number; title: string }

/** The events above the visible window, for the morning toggle to name. */
export function hiddenBefore(days: DayWithSlots[], gridStart: number): EdgeSummary | null {
  let count = 0
  let best: { at: number; slot: SlotWithProposals } | null = null
  for (const day of days) {
    for (const slot of day.slots) {
      const s = slotStartMinutes(slot)
      if (s === null || s >= gridStart) continue
      count++
      if (best === null || s < best.at) best = { at: s, slot }
    }
  }
  return best === null ? null : { count, minutes: best.at, title: slotTitle(best.slot) }
}

/** The events below the visible window, for the evening toggle to name. */
export function hiddenAfter(days: DayWithSlots[], gridEnd: number): EdgeSummary | null {
  let count = 0
  let best: { at: number; slot: SlotWithProposals } | null = null
  for (const day of days) {
    for (const slot of day.slots) {
      const s = slotStartMinutes(slot)
      if (s === null || s < gridEnd) continue
      count++
      if (best === null || s > best.at) best = { at: s, slot }
    }
  }
  return best === null ? null : { count, minutes: best.at, title: slotTitle(best.slot) }
}

export type GridPlacement = { col: number; cols: number }

/**
 * Assign side-by-side columns to overlapping items, Google Calendar style:
 * items in one overlapping cluster split the width evenly.
 */
export function layoutOverlaps<T extends { start: number; duration: number }>(
  items: T[]
): Map<T, GridPlacement> {
  const sorted = [...items].sort((a, b) => a.start - b.start)
  const out = new Map<T, GridPlacement>()
  let cluster: { item: T; col: number }[] = []
  let active: { item: T; col: number }[] = []

  const flush = () => {
    const cols = Math.max(...cluster.map((c) => c.col)) + 1
    cluster.forEach((c) => out.set(c.item, { col: c.col, cols }))
    cluster = []
  }

  for (const item of sorted) {
    active = active.filter((a) => a.item.start + a.item.duration > item.start)
    if (active.length === 0 && cluster.length > 0) flush()
    const used = new Set(active.map((a) => a.col))
    let col = 0
    while (used.has(col)) col++
    const entry = { item, col }
    active.push(entry)
    cluster.push(entry)
  }
  if (cluster.length > 0) flush()
  return out
}
