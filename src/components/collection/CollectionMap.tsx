import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './collectionMap.css'
import { ChevronLeft, ChevronRight, Heart, Maximize2, MapPin, X } from 'lucide-react'
import {
  clusterProjectedPoints,
  type MappableItem,
  type PointCluster,
} from '@/lib/mapPoints'
import { getProposerColor, getProposerInitial } from '@/lib/proposerColors'
import { cn } from '@/lib/utils'
import type { CollectionItemCategory } from '@/types/database'

/** Matches the category chips on the cards. */
const PIN_COLOR: Record<CollectionItemCategory, string> = {
  food: '#d97706',
  activity: '#059669',
  other: '#64748b',
}

const CATEGORY_LABELS: Record<CollectionItemCategory, string> = {
  food: 'Food',
  activity: 'Activity',
  other: 'Other',
}

// Standard OSM tiles: no API key, and low-volume use is within the tile usage
// policy. CARTO's basemaps now stamp "API KEY REQUIRED" over anonymous tiles.
// Dark mode inverts these in CSS rather than swapping providers.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Pins closer than this (in screen pixels) overlap, so they get grouped. */
const CLUSTER_RADIUS = 46

function mapsHref(item: MappableItem): string {
  return (
    item.google_maps_url?.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
  )
}

/**
 * Build one pin. Imperative because Leaflet owns the marker element — text goes
 * in via textContent, never innerHTML, since names come from trip members.
 */
function buildPin(cluster: PointCluster<MappableItem>): HTMLElement {
  const [first] = cluster.items
  const color = PIN_COLOR[first.category] ?? PIN_COLOR.other

  const root = document.createElement('div')
  root.className = cluster.items.length > 1 ? 'tc-pin tc-pin--group' : 'tc-pin'
  root.style.setProperty('--pin', color)

  const disc = document.createElement('div')
  disc.className = 'tc-pin__disc'

  if (first.image_url) {
    const img = document.createElement('img')
    img.className = 'tc-pin__img'
    img.src = first.image_url
    img.alt = ''
    img.loading = 'lazy'
    img.addEventListener('error', () => {
      img.replaceWith(buildPinFallback(first.name))
    })
    disc.appendChild(img)
  } else {
    disc.appendChild(buildPinFallback(first.name))
  }

  if (cluster.items.length > 1) {
    const count = document.createElement('span')
    count.className = 'tc-pin__count'
    count.textContent = String(cluster.items.length)
    disc.appendChild(count)
  }

  const stem = document.createElement('span')
  stem.className = 'tc-pin__stem'

  root.append(disc, stem)
  return root
}

function buildPinFallback(name: string): HTMLElement {
  const fallback = document.createElement('span')
  fallback.className = 'tc-pin__fallback'
  fallback.textContent = name.trim().charAt(0) || '?'
  return fallback
}

export interface CollectionMapProps {
  /** Already filtered to items that parsed to coordinates. */
  items: MappableItem[]
  currentName: string
  onLike?: (itemId: string) => void
  className?: string
}

export function CollectionMap({
  items,
  currentName,
  onLike,
  className,
}: CollectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const pinElementsRef = useRef(new Map<string, HTMLElement>())

  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── Map lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const map = L.map(el, {
      // The map lives inside a scrolling page, so the wheel stays with the page.
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    }).setView([0, 0], 2)

    mapRef.current = map
    markerLayerRef.current = L.layerGroup().addTo(map)
    map.zoomControl.setPosition('topright')

    const syncZoom = () => setZoom(map.getZoom())
    map.on('zoomend', syncZoom)
    map.on('click', () => setSelectedId(null))

    setZoom(map.getZoom())
    setReady(true)

    // The panel can mount before it has a size (collapsed, or off-screen).
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    observer.observe(el)

    const pinElements = pinElementsRef.current
    return () => {
      observer.disconnect()
      map.off()
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      pinElements.clear()
      setReady(false)
      setZoom(null)
    }
  }, [])

  // ── Tiles ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const layer = L.tileLayer(TILE_URL, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map)
    return () => {
      layer.remove()
    }
  }, [ready])

  // ── Framing ──────────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const map = mapRef.current
    if (!map || items.length === 0) return
    map.invalidateSize({ animate: false })
    map.fitBounds(
      L.latLngBounds(items.map((i) => [i.latitude, i.longitude] as L.LatLngTuple)),
      { padding: [48, 48], maxZoom: 15, animate: false }
    )
  }, [items])

  // Refit only when the set of coordinates actually changes, not on every
  // unrelated edit (a like, a renamed note) that produces a new array.
  const coordinateKey = items.map((i) => `${i.latitude},${i.longitude}`).join(';')
  useEffect(() => {
    if (ready) fitAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coordinateKey])

  // ── Clustering ───────────────────────────────────────────────────────────
  const clusters = useMemo(() => {
    const map = mapRef.current
    if (!map || !ready || zoom === null || items.length === 0) return []
    const projected = items.map((item) => {
      const point = map.project([item.latitude, item.longitude], zoom)
      return { item, x: point.x, y: point.y }
    })
    return clusterProjectedPoints(projected, CLUSTER_RADIUS, (item) => item.id)
  }, [items, ready, zoom])

  // ── Markers ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const layer = markerLayerRef.current
    if (!map || !layer || zoom === null) return

    layer.clearLayers()
    pinElementsRef.current.clear()

    for (const cluster of clusters) {
      const marker = L.marker(map.unproject([cluster.x, cluster.y], zoom), {
        icon: L.divIcon({
          html: buildPin(cluster),
          className: 'tc-pin-icon',
          iconSize: [40, 46],
          iconAnchor: [20, 46],
        }),
        riseOnHover: true,
        title:
          cluster.items.length === 1
            ? cluster.items[0].name
            : `${cluster.items.length} places`,
      })
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        setSelectedId((current) => {
          const index = cluster.items.findIndex((i) => i.id === current)
          // Re-clicking a group steps through it rather than resetting.
          return index >= 0
            ? cluster.items[(index + 1) % cluster.items.length].id
            : cluster.items[0].id
        })
      })
      layer.addLayer(marker)
      const element = marker.getElement()
      if (element) pinElementsRef.current.set(cluster.key, element)
    }
  }, [clusters, zoom])

  // Highlight without rebuilding the markers, so pin images don't flicker.
  useEffect(() => {
    const activeKey = clusters.find((c) => c.items.some((i) => i.id === selectedId))?.key
    for (const [key, element] of pinElementsRef.current) {
      element.classList.toggle('tc-pin--active', key === activeKey)
    }
  }, [clusters, selectedId])

  const activeCluster = clusters.find((c) => c.items.some((i) => i.id === selectedId)) ?? null
  const activeIndex = activeCluster
    ? activeCluster.items.findIndex((i) => i.id === selectedId)
    : -1
  const activeItem = activeIndex >= 0 ? activeCluster!.items[activeIndex] : null

  // Keep the selected pin clear of the detail card.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !activeItem) return
    map.panInside([activeItem.latitude, activeItem.longitude], {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, 215],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.id])

  const step = useCallback(
    (delta: number) => {
      if (!activeCluster || activeIndex < 0) return
      const { items: group } = activeCluster
      setSelectedId(group[(activeIndex + delta + group.length) % group.length].id)
    },
    [activeCluster, activeIndex]
  )

  useEffect(() => {
    if (!activeItem) return
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'Escape') setSelectedId(null)
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeItem, step])

  const groupSize = activeCluster?.items.length ?? 0

  return (
    <div
      className={cn(
        'tc-map relative overflow-hidden rounded-xl border border-border/60 bg-muted',
        className
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      <button
        type="button"
        onClick={fitAll}
        className="absolute top-2 left-2 z-[1000] inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
        aria-label="Fit all places in view"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Fit all
      </button>

      {activeItem && (
        <div className="absolute inset-x-2 bottom-6 z-[1100] sm:inset-x-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm">
            <div className="flex gap-3 p-3">
              <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-violet-100 dark:bg-violet-950/40">
                {activeItem.image_url ? (
                  <img
                    src={activeItem.image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-violet-400 dark:text-violet-500/70">
                    <MapPin className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {activeItem.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: PIN_COLOR[activeItem.category] ?? PIN_COLOR.other }}
                  >
                    {CATEGORY_LABELS[activeItem.category]}
                  </span>
                  {onLike ? (
                    <button
                      type="button"
                      onClick={() => onLike(activeItem.id)}
                      className={cn(
                        'inline-flex items-center gap-1 text-xs transition-colors',
                        activeItem.likes.includes(currentName)
                          ? 'text-red-500'
                          : 'text-muted-foreground hover:text-red-500'
                      )}
                      aria-label={
                        activeItem.likes.includes(currentName) ? 'Unlike' : 'Like'
                      }
                    >
                      <Heart
                        className={cn(
                          'h-3.5 w-3.5',
                          activeItem.likes.includes(currentName) && 'fill-current'
                        )}
                      />
                      {activeItem.likes.length > 0 ? activeItem.likes.length : 'Like'}
                    </button>
                  ) : (
                    activeItem.likes.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Heart className="h-3.5 w-3.5 fill-red-500/70" />
                        {activeItem.likes.length}
                      </span>
                    )
                  )}
                  {activeItem.likes.length > 0 && (
                    <span className="flex -space-x-1.5">
                      {activeItem.likes.map((name) => {
                        const color = getProposerColor(name)
                        return (
                          <span
                            key={name}
                            title={name}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold"
                            style={{ backgroundColor: color.bg, color: color.text }}
                          >
                            {getProposerInitial(name)}
                          </span>
                        )
                      })}
                    </span>
                  )}
                </div>

                {activeItem.note && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                    {activeItem.note}
                  </p>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a
                    href={mapsHref(activeItem)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                  {activeItem.url && (
                    <a
                      href={activeItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[45%] truncate text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {activeItem.url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {groupSize > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/40 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  aria-label="Previous place here"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  {activeCluster!.items.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        index === activeIndex
                          ? 'w-4 bg-primary'
                          : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70'
                      )}
                      aria-label={item.name}
                      aria-current={index === activeIndex}
                    />
                  ))}
                  <span className="ml-1.5 text-[11px] tabular-nums text-muted-foreground">
                    {activeIndex + 1} of {groupSize}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  aria-label="Next place here"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CollectionMap
