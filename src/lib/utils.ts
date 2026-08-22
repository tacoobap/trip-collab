import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize a user-provided URL before persisting to Firestore.
 *
 * - Returns null for empty / whitespace input.
 * - Throws for dangerous schemes (javascript:, data:, file:, vbscript:).
 * - Auto-prepends https:// when the value looks like a bare domain (no scheme).
 * - Returns the cleaned URL string otherwise.
 */
export function sanitizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()
  const BLOCKED = ['javascript:', 'data:', 'file:', 'vbscript:']
  if (BLOCKED.some((scheme) => lower.startsWith(scheme))) {
    throw new Error('Invalid URL: unsupported scheme.')
  }

  // Auto-prefix bare domains so users can paste "airbnb.com/..." directly
  const withScheme =
    lower.startsWith('http://') || lower.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`

  try {
    new URL(withScheme)
  } catch {
    throw new Error('Invalid URL — please include a full link (e.g. https://…)')
  }

  return withScheme
}

/** Format a YYYY-MM-DD date string for display. Returns null when dateStr is falsy. */
export function formatTripDate(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string | null {
  if (!dateStr) return null
  // A bare YYYY-MM-DD is parsed as UTC midnight, which then renders as the
  // *previous* day for anyone west of UTC. Pin it to local midnight instead,
  // matching how day dates are parsed elsewhere.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00` : dateStr
  return new Date(iso).toLocaleDateString('en-US', options)
}
