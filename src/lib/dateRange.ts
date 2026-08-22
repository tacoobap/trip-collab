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

/** Today as `YYYY-MM-DD` in the viewer's own timezone. */
export function todayISO(): string {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/**
 * A trip is past once its last day is behind us. Comparison is on the
 * `YYYY-MM-DD` strings directly — parsing them into Dates reintroduces the
 * UTC-vs-local off-by-one these fields keep attracting.
 *
 * A trip running right now counts as upcoming, and one with no dates yet is
 * still being planned, so it isn't past either.
 */
export function isPastTrip(
  start: string | null | undefined,
  end: string | null | undefined,
  today = todayISO()
): boolean {
  const last = end || start
  return !!last && last < today
}
