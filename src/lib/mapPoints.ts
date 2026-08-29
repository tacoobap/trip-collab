import type { CollectionItem } from '@/types/database'

/** A collection item that parsed to real coordinates, so it can be pinned. */
export type MappableItem = CollectionItem & { latitude: number; longitude: number }

export function hasCoordinates(item: CollectionItem): item is MappableItem {
  return (
    typeof item.latitude === 'number' &&
    typeof item.longitude === 'number' &&
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude)
  )
}

/**
 * An item that names a place but has no coordinates — a shortened maps link
 * (maps.app.goo.gl/…) carries no lat/lng, so it can't be pinned.
 */
export function hasUnmappableLink(item: CollectionItem): boolean {
  return !!item.google_maps_url?.trim() && !hasCoordinates(item)
}

export interface ProjectedPoint<T> {
  item: T
  x: number
  y: number
}

export interface PointCluster<T> {
  /** Stable across re-renders: the member ids, sorted. */
  key: string
  items: T[]
  x: number
  y: number
}

/**
 * Group points whose pins would overlap on screen.
 *
 * Coordinates come in already projected to pixels at the zoom being drawn, so
 * `radius` is simply "how close is too close" in pins. Greedy and seeded in
 * input order: the first point claims every unclaimed neighbour within the
 * radius, which keeps grouping stable while panning and stops clusters from
 * chaining across the map. O(n²), and a city holds tens of places, not
 * thousands.
 */
export function clusterProjectedPoints<T>(
  points: ProjectedPoint<T>[],
  radius: number,
  keyOf: (item: T) => string
): PointCluster<T>[] {
  const claimed = new Array<boolean>(points.length).fill(false)
  const clusters: PointCluster<T>[] = []
  const radiusSquared = radius * radius

  for (let i = 0; i < points.length; i++) {
    if (claimed[i]) continue
    claimed[i] = true
    const members = [points[i]]

    for (let j = i + 1; j < points.length; j++) {
      if (claimed[j]) continue
      const dx = points[j].x - points[i].x
      const dy = points[j].y - points[i].y
      if (dx * dx + dy * dy <= radiusSquared) {
        claimed[j] = true
        members.push(points[j])
      }
    }

    clusters.push({
      key: members.map((m) => keyOf(m.item)).sort().join('|'),
      items: members.map((m) => m.item),
      x: members.reduce((sum, m) => sum + m.x, 0) / members.length,
      y: members.reduce((sum, m) => sum + m.y, 0) / members.length,
    })
  }

  return clusters
}
