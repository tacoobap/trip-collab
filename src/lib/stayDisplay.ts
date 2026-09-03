/**
 * How a stay reads — shared by the stays drawer and the pin card on the
 * collection map, so the two never drift apart.
 */
import type { Stay } from '@/types/database'

/** `YYYY-MM-DD` at local midnight, matching how trip dates are compared. */
function atMidnight(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

export function formatStayRange(checkIn: string, checkOut: string): string {
  const fmt = (d: string) =>
    atMidnight(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(checkIn)} – ${fmt(checkOut)}`
}

export function stayNights(checkIn: string, checkOut: string): string {
  const diff = atMidnight(checkOut).getTime() - atMidnight(checkIn).getTime()
  const nights = Math.round(diff / 86_400_000)
  return `${nights} night${nights !== 1 ? 's' : ''}`
}

/**
 * The address a geocoded link came back with, but only when it says something
 * the property name doesn't — for a hotel the two are usually the same string.
 */
export function stayAddress(stay: Pick<Stay, 'name' | 'place_name'>): string | null {
  const address = stay.place_name?.trim()
  if (!address) return null
  return address.toLowerCase() === stay.name.trim().toLowerCase() ? null : address
}
