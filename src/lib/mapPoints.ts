import { isShortMapsUrl } from '@/lib/parseGoogleMapsUrl'
import type { CollectionItem, Stay } from '@/types/database'

/** A collection item that parsed to real coordinates, so it can be pinned. */
export type MappableItem = CollectionItem & { latitude: number; longitude: number }

/** A stay that parsed to real coordinates, so it can be pinned. */
export type MappableStay = Stay & { latitude: number; longitude: number }

function hasFinitePosition<T extends { latitude?: number | null; longitude?: number | null }>(
  value: T
): value is T & { latitude: number; longitude: number } {
  return (
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  )
}

export function hasCoordinates(item: CollectionItem): item is MappableItem {
  return hasFinitePosition(item)
}

export function hasStayCoordinates(stay: Stay): stay is MappableStay {
  return hasFinitePosition(stay)
}

/** An item that links to a place but has no coordinates, so it can't be pinned. */
export function hasUnmappableLink(item: CollectionItem): boolean {
  return !!item.google_maps_url?.trim() && !hasCoordinates(item)
}

/**
 * Why a city's places are missing from its map. A shortened link has to be
 * followed before it means anything; other links simply never carried a
 * position (a `cid=` link, or a search for a name).
 */
export function countUnmappable(items: CollectionItem[]): {
  shortLinks: number
  linksWithoutPosition: number
  total: number
} {
  let shortLinks = 0
  let linksWithoutPosition = 0
  for (const item of items) {
    if (!hasUnmappableLink(item)) continue
    if (isShortMapsUrl(item.google_maps_url!)) shortLinks += 1
    else linksWithoutPosition += 1
  }
  return { shortLinks, linksWithoutPosition, total: shortLinks + linksWithoutPosition }
}

// ── Web Mercator ────────────────────────────────────────────────────────────
// Clustering works in world pixels at a given zoom, which keeps groups stable
// while panning. Doing the projection here rather than asking the map keeps it
// pure, testable, and independent of the rendering library.

const TILE_SIZE = 512

export function projectToWorld(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom)
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}

export function unprojectFromWorld(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom)
  const n = Math.PI * (1 - (2 * y) / scale)
  return {
    lng: (x / scale) * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
  }
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
