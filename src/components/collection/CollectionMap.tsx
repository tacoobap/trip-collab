import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './collectionMap.css'
import { BedDouble, ChevronLeft, ChevronRight, Heart, Maximize2, MapPin, X } from 'lucide-react'
import {
  clusterProjectedPoints,
  projectToWorld,
  unprojectFromWorld,
  type MappableItem,
  type MappableStay,
  type PointCluster,
} from '@/lib/mapPoints'
import { getProposerColor, getProposerInitial } from '@/lib/proposerColors'
import { formatStayRange, stayAddress, stayNights } from '@/lib/stayDisplay'
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

/**
 * Stays sit outside the category palette on purpose: the place you're sleeping
 * should never read as one more idea on the list.
 */
const STAY_COLOR = '#7c3aed'

/** A stable empty default, so an unset `stays` prop doesn't churn the effects. */
const NO_STAYS: MappableStay[] = []

/** What the detail card is showing — one selection across both kinds of pin. */
type Selection = { kind: 'item'; id: string } | { kind: 'stay'; id: string }

// OpenFreeMap serves OSM vector tiles with no API key and no signup.
//
// Positron and its dark counterpart are deliberately quiet: a neutral grey
// canvas that lets the photo pins carry the colour. Avoid `bright`, which is
// OSM Bright — it paints roads the classic Mapnik yellow (#fea) and orange
// (#fc8) and reads as the raster map this replaced.
const STYLE_URL = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}

/** Pins closer than this (in screen pixels) overlap, so they get grouped. */
const CLUSTER_RADIUS = 46

/**
 * How close the map will zoom when framing places.
 *
 * A lone place has no extent to fit, so `fitBounds` runs straight to the cap —
 * and Positron turns on every side-street name at z15, which is what made a
 * single pin look like a street directory. Stop short of that: major roads and
 * neighbourhood names, no side streets.
 */
function fitOptions(placeCount: number) {
  return { padding: 56, maxZoom: placeCount <= 1 ? 13.5 : 14 }
}

function mapsHref(place: {
  google_maps_url?: string | null
  latitude: number
  longitude: number
}): string {
  return (
    place.google_maps_url?.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
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

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Build one stay: a bed on a violet square rather than a round photo disc, so
 * it reads as home base at a glance without covering the places around it. The
 * name lives on the card that opens when it's clicked.
 */
function buildStayPin(stay: MappableStay): HTMLElement {
  const root = document.createElement('div')
  root.className = 'tc-stay'
  root.style.setProperty('--stay', STAY_COLOR)

  const body = document.createElement('div')
  body.className = 'tc-stay__body'

  const icon = document.createElementNS(SVG_NS, 'svg')
  icon.setAttribute('class', 'tc-stay__icon')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('fill', 'none')
  icon.setAttribute('stroke', 'currentColor')
  icon.setAttribute('stroke-width', '2')
  icon.setAttribute('stroke-linecap', 'round')
  icon.setAttribute('stroke-linejoin', 'round')
  icon.setAttribute('aria-hidden', 'true')
  // lucide's `bed-double`, drawn out because markers are built by hand here.
  for (const d of [
    'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8',
    'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4',
    'M12 4v6',
    'M2 18h20',
  ]) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    icon.appendChild(path)
  }

  const stem = document.createElement('span')
  stem.className = 'tc-stay__stem'

  // The name isn't drawn on the map, so give the pin one for screen readers.
  root.setAttribute('role', 'button')
  root.setAttribute('aria-label', stay.name)

  body.appendChild(icon)
  root.append(body, stem)
  return root
}

export interface CollectionMapProps {
  /** Already filtered to items that parsed to coordinates. */
  items: MappableItem[]
  /** The stays in this city that parsed to coordinates. */
  stays?: MappableStay[]
  currentName: string
  onLike?: (itemId: string) => void
  className?: string
}

export function CollectionMap({
  items,
  stays = NO_STAYS,
  currentName,
  onLike,
  className,
}: CollectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  const pinElementsRef = useRef(new Map<string, HTMLElement>())
  const stayMarkersRef = useRef(new Map<string, maplibregl.Marker>())
  const stayElementsRef = useRef(new Map<string, HTMLElement>())
  // Read by the mount-once effect to frame the city on the very first paint.
  const itemsRef = useRef(items)
  itemsRef.current = items
  const staysRef = useRef(stays)
  staysRef.current = stays

  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState<number | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [styleFailed, setStyleFailed] = useState(false)

  // ── Map lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Frame the city up front. Opening on a world view and then jumping shows
    // a flash of low-zoom relief before the real map arrives.
    const initialBounds = new maplibregl.LngLatBounds()
    for (const item of itemsRef.current) initialBounds.extend([item.longitude, item.latitude])
    for (const stay of staysRef.current) initialBounds.extend([stay.longitude, stay.latitude])
    const initialCount = itemsRef.current.length + staysRef.current.length

    const map = new maplibregl.Map({
      container: el,
      style: document.documentElement.classList.contains('dark')
        ? STYLE_URL.dark
        : STYLE_URL.light,
      bounds: initialBounds.isEmpty() ? undefined : initialBounds,
      fitBoundsOptions: fitOptions(initialCount),
      center: initialBounds.isEmpty() ? [0, 20] : undefined,
      zoom: initialBounds.isEmpty() ? 1 : undefined,
      // The map sits in a scrolling page: plain wheel and one-finger drag stay
      // with the page, ctrl+wheel and two fingers drive the map.
      cooperativeGestures: true,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('error', (e) => {
      // A failed style or tile request otherwise fails silently on the canvas.
      console.error('[collection map]', e.error?.message ?? e)
    })

    const syncZoom = () => setZoom(map.getZoom())
    map.on('moveend', syncZoom)
    map.on('click', () => setSelected(null))
    map.on('load', () => {
      setZoom(map.getZoom())
      setReady(true)
    })

    // The basemap is a third-party service; without this a failure is just a
    // silent grey rectangle.
    const styleTimeout = setTimeout(() => {
      if (!map.isStyleLoaded()) setStyleFailed(true)
    }, 12000)
    map.on('styledata', () => setStyleFailed(false))

    // The panel can mount before the container has its final size.
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(el)

    const markers = markersRef.current
    const pinElements = pinElementsRef.current
    const stayMarkers = stayMarkersRef.current
    const stayElements = stayElementsRef.current
    return () => {
      clearTimeout(styleTimeout)
      observer.disconnect()
      for (const marker of markers.values()) marker.remove()
      markers.clear()
      pinElements.clear()
      for (const marker of stayMarkers.values()) marker.remove()
      stayMarkers.clear()
      stayElements.clear()
      map.remove()
      mapRef.current = null
      setReady(false)
      setZoom(null)
    }
  }, [])

  // ── Framing ──────────────────────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const map = mapRef.current
    if (!map || items.length + stays.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const item of items) bounds.extend([item.longitude, item.latitude])
    // The stay is the anchor you want in frame, so it counts towards the fit.
    for (const stay of stays) bounds.extend([stay.longitude, stay.latitude])
    map.resize()
    map.fitBounds(bounds, { ...fitOptions(items.length + stays.length), animate: false })
  }, [items, stays])

  // Refit only when the set of coordinates actually changes, not on every
  // unrelated edit (a like, a renamed note) that produces a new array.
  const coordinateKey = [...items, ...stays]
    .map((p) => `${p.latitude},${p.longitude}`)
    .join(';')
  useEffect(() => {
    if (ready) fitAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coordinateKey])

  // ── Clustering ───────────────────────────────────────────────────────────
  const clusters = useMemo(() => {
    if (zoom === null || items.length === 0) return []
    const projected = items.map((item) => ({
      item,
      ...projectToWorld(item.latitude, item.longitude, zoom),
    }))
    return clusterProjectedPoints(projected, CLUSTER_RADIUS, (item) => item.id)
  }, [items, zoom])

  // ── Markers ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || zoom === null) return

    for (const marker of markersRef.current.values()) marker.remove()
    markersRef.current.clear()
    pinElementsRef.current.clear()

    for (const cluster of clusters) {
      const { lat, lng } = unprojectFromWorld(cluster.x, cluster.y, zoom)
      const element = buildPin(cluster)
      element.addEventListener('click', (e) => {
        // Keep the map's own click from clearing the selection we just made.
        e.stopPropagation()
        setSelected((current) => {
          const currentId = current?.kind === 'item' ? current.id : null
          const index = cluster.items.findIndex((i) => i.id === currentId)
          // Re-clicking a group steps through it rather than resetting.
          return {
            kind: 'item',
            id:
              index >= 0
                ? cluster.items[(index + 1) % cluster.items.length].id
                : cluster.items[0].id,
          }
        })
      })
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map)
      markersRef.current.set(cluster.key, marker)
      pinElementsRef.current.set(cluster.key, element)
    }
  }, [clusters, ready, zoom])

  // ── Stay markers ─────────────────────────────────────────────────────────
  // Their own layer: a stay never joins a cluster, so it doesn't need
  // rebuilding when the zoom regroups the place pins.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    for (const marker of stayMarkersRef.current.values()) marker.remove()
    stayMarkersRef.current.clear()
    stayElementsRef.current.clear()

    for (const stay of stays) {
      const element = buildStayPin(stay)
      element.addEventListener('click', (e) => {
        e.stopPropagation()
        setSelected({ kind: 'stay', id: stay.id })
      })
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([stay.longitude, stay.latitude])
        .addTo(map)
      stayMarkersRef.current.set(stay.id, marker)
      stayElementsRef.current.set(stay.id, element)
    }
  }, [stays, ready])

  const selectedItemId = selected?.kind === 'item' ? selected.id : null

  // Highlight without rebuilding the markers, so pin images don't flicker.
  useEffect(() => {
    const activeKey = clusters.find((c) => c.items.some((i) => i.id === selectedItemId))?.key
    for (const [key, element] of pinElementsRef.current) {
      element.classList.toggle('tc-pin--active', key === activeKey)
    }
    for (const [id, element] of stayElementsRef.current) {
      element.classList.toggle(
        'tc-stay--active',
        selected?.kind === 'stay' && selected.id === id
      )
    }
    // `stays` is a dependency because a rebuilt plaque starts out unhighlighted.
  }, [clusters, selected, selectedItemId, stays])

  const activeCluster =
    clusters.find((c) => c.items.some((i) => i.id === selectedItemId)) ?? null
  const activeIndex = activeCluster
    ? activeCluster.items.findIndex((i) => i.id === selectedItemId)
    : -1
  const activeItem = activeIndex >= 0 ? activeCluster!.items[activeIndex] : null
  const activeStay =
    selected?.kind === 'stay' ? (stays.find((s) => s.id === selected.id) ?? null) : null

  // Keep the selected pin clear of the detail card, nudging only when it would
  // otherwise sit underneath it.
  const activePoint = activeItem ?? activeStay
  useEffect(() => {
    const map = mapRef.current
    const el = containerRef.current
    if (!map || !el || !activePoint) return
    const point = map.project([activePoint.longitude, activePoint.latitude])
    const inset = { top: 56, right: 24, bottom: 230, left: 24 }
    const dx =
      point.x < inset.left
        ? point.x - inset.left
        : point.x > el.clientWidth - inset.right
          ? point.x - (el.clientWidth - inset.right)
          : 0
    const dy =
      point.y < inset.top
        ? point.y - inset.top
        : point.y > el.clientHeight - inset.bottom
          ? point.y - (el.clientHeight - inset.bottom)
          : 0
    if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 300 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePoint?.id])

  const step = useCallback(
    (delta: number) => {
      if (!activeCluster || activeIndex < 0) return
      const { items: group } = activeCluster
      setSelected({
        kind: 'item',
        id: group[(activeIndex + delta + group.length) % group.length].id,
      })
    },
    [activeCluster, activeIndex]
  )

  useEffect(() => {
    if (!selected) return
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'Escape') setSelected(null)
      else if (activeItem && e.key === 'ArrowRight') step(1)
      else if (activeItem && e.key === 'ArrowLeft') step(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected, activeItem, step])

  const groupSize = activeCluster?.items.length ?? 0

  return (
    <div
      className={cn(
        'tc-map relative overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-sm',
        className
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {styleFailed && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center bg-muted px-6 text-center">
          <p className="text-sm text-muted-foreground">
            The map couldn’t load. Your places are still safe in the list —
            switch back to List view to see them.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={fitAll}
        className="absolute top-2.5 left-2.5 z-[1000] inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:text-foreground"
        aria-label="Fit all places in view"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Fit all
      </button>

      {activeItem && (
        <div className="absolute inset-x-2 bottom-10 z-[1100] sm:inset-x-3">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md">
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
                    onClick={() => setSelected(null)}
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
                      onClick={() => setSelected({ kind: 'item', id: item.id })}
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

      {activeStay && (
        <div className="absolute inset-x-2 bottom-10 z-[1100] sm:inset-x-3">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md">
            <div className="flex gap-3 p-3">
              <div
                className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: STAY_COLOR }}
              >
                <BedDouble className="h-7 w-7" strokeWidth={1.5} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {activeStay.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: STAY_COLOR }}
                  >
                    Stay
                  </span>
                  <span className="text-xs text-muted-foreground">{activeStay.city}</span>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  {formatStayRange(activeStay.check_in, activeStay.check_out)}
                  <span className="mx-1.5 text-border">·</span>
                  {stayNights(activeStay.check_in, activeStay.check_out)}
                </p>

                {stayAddress(activeStay) && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {stayAddress(activeStay)}
                  </p>
                )}

                <div className="mt-1.5">
                  <a
                    href={mapsHref(activeStay)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CollectionMap
