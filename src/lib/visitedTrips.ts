export type TripRecord = {
  slug: string
  name: string
  destinations: string[]
  start_date: string | null
  end_date: string | null
  lastVisited: number
}

const STORAGE_KEY = 'tripboard_visited_trips'
const MAX_TRIPS = 30

export function getVisitedTrips(): TripRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TripRecord[]
  } catch {
    return []
  }
}

export function trackTripVisit(trip: {
  slug: string
  name: string
  destinations: string[]
  start_date: string | null
  end_date: string | null
}) {
  const existing = getVisitedTrips().filter((t) => t.slug !== trip.slug)
  const updated: TripRecord[] = [
    { ...trip, lastVisited: Date.now() },
    ...existing,
  ].slice(0, MAX_TRIPS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
