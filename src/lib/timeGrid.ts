import type { DayWithSlots, Proposal, SlotWithProposals } from '@/types/database'
import { parseTimeToMinutes, minutesToTimeLabel } from './timeUtils'

/**
 * Geometry and time maths for the planning time grid. All times are minutes
 * from midnight; all pixel values assume `HOUR_PX` pixels per hour.
 */

export const HOUR_PX = 64
export const SNAP_MIN = 15
export const GRID_END_MIN = 24 * 60
/** The grid renders from 6 AM by default; earlier hours appear on demand. */
export const DEFAULT_GRID_START_MIN = 6 * 60
export const MIN_DURATION_MIN = 30
export const DEFAULT_DURATION_MIN = 60
/** Duration given to a shelf item when it's dragged onto the timeline. */
export const SHELF_DROP_DURATION_MIN = 90
/** Fixed day-header height — identical across columns so timelines align. */
export const DAY_HEADER_PX = 168

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
  const b = minutesToTimeLabel(Math.min(start + duration, GRID_END_MIN))
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`
}

/**
 * Where the grid starts for this trip: 6 AM, pulled earlier (to the hour)
 * when any slot already lives before it.
 */
export function computeGridStartMin(days: DayWithSlots[]): number {
  let start = DEFAULT_GRID_START_MIN
  for (const day of days) {
    for (const slot of day.slots) {
      const s = slotStartMinutes(slot)
      if (s !== null && s < start) start = Math.floor(s / 60) * 60
    }
  }
  return Math.max(0, start)
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
