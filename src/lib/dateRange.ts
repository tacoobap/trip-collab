/** Guard against a typo'd year creating thousands of day docs. */
export const MAX_TRIP_DAYS = 366

function toUtcMs(iso: string): number {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return NaN
  const [y, m, d] = parts
  return Date.UTC(y, m - 1, d)
}

/**
 * Every `YYYY-MM-DD` from `start` to `end`, inclusive.
 *
 * Arithmetic runs in UTC on purpose. Stepping a local-midnight `Date` and
 * reading `toISOString()` back shifts the result a day earlier for anyone east
 * of UTC, which would silently create the wrong days.
 */
export function enumerateDates(start: string, end: string): string[] {
  const startMs = toUtcMs(start)
  const endMs = toUtcMs(end)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return []
  }

  const DAY_MS = 86_400_000
  const out: string[] = []
  for (let t = startMs; t <= endMs && out.length < MAX_TRIP_DAYS; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/** Day label shown on the board and in the itinerary. */
export function dayLabel(dayNumber: number, city: string): string {
  return city ? `Day ${dayNumber} · ${city}` : `Day ${dayNumber}`
}
