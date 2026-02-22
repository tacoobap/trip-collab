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
