/**
 * Converts a time string into minutes from midnight for sorting.
 * Handles formats like "7:30 PM", "19:30", "7pm", "9:00 AM".
 * Returns Infinity for unparseable values so they sort to the end.
 */
export function parseTimeToMinutes(time: string | null | undefined): number {
  if (!time) return Infinity
  const clean = time.trim().toLowerCase()
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return Infinity
  let h = parseInt(match[1])
  const m = parseInt(match[2] ?? '0')
  const period = match[3]
  if (period === 'pm' && h !== 12) h += 12
  if (period === 'am' && h === 12) h = 0
  return h * 60 + m
}

/**
 * Converts minutes-from-midnight to "H:MM AM/PM".
 */
function minutesToDisplay(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = Math.min(59, Math.max(0, minutes % 60))
  const mm = String(m).padStart(2, '0')
  if (h24 === 0) return `12:${mm} AM`
  if (h24 < 12) return `${h24}:${mm} AM`
  if (h24 === 12) return `12:${mm} PM`
  return `${h24 - 12}:${mm} PM`
}

/**
 * Parses a time string and formats it as "H:MM AM/PM" for consistent display.
 * Accepts: "9", "9am", "9:00", "9:00 AM", "12:30 pm", "14:00" (24h).
 * Returns null if the input cannot be parsed as a time.
 */
export function formatTimeLabel(input: string | null | undefined): string | null {
  if (input == null) return null
  const clean = input.trim()
  if (!clean) return null

  const clampM = (n: number) => Math.min(59, Math.max(0, n))

  // 24-hour format (e.g. 14:00, 09:30) — hour 0–23
  const isoMatch = clean.match(/^(0?[0-9]|1\d|2[0-3]):(\d{2})$/)
  if (isoMatch) {
    const h24 = parseInt(isoMatch[1], 10)
    const m = clampM(parseInt(isoMatch[2], 10))
    return minutesToDisplay(h24 * 60 + m)
  }

  // 12-hour with optional :MM and optional am/pm
  const match = clean.toLowerCase().match(/^(1[0-2]|[1-9])(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return null
  const h12 = parseInt(match[1], 10)
  const m = clampM(parseInt(match[2] ?? '0', 10))
  const period = match[3]

  let h24: number
  if (period === 'pm') {
    h24 = h12 === 12 ? 12 : h12 + 12
  } else if (period === 'am') {
    h24 = h12 === 12 ? 0 : h12
  } else {
    // No period: 1–11 = AM, 12 = PM (noon)
    h24 = h12 === 12 ? 12 : h12
  }
  return minutesToDisplay(h24 * 60 + m)
}
