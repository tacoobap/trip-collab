import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, FileDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { ItineraryHero } from '@/components/itinerary/ItineraryHero'
import { VibeTagsSection } from '@/components/itinerary/VibeTagsSection'
import { AtAGlanceSection } from '@/components/itinerary/AtAGlanceSection'
import { ItineraryDaysList } from '@/components/itinerary/ItineraryDaysList'
import { useItineraryExport } from '@/hooks/useItineraryExport'
import { formatTripDate } from '@/lib/utils'
import type { DayWithSlots, Stay, Trip } from '@/types/database'

type SharedPayload = {
  trip: Trip
  days: DayWithSlots[]
  stays: Stay[]
}

/**
 * Read-only itinerary behind a share link — no account required.
 *
 * Data comes from the `shared-trip` function rather than Firestore directly:
 * the browser here is unauthenticated, and security rules stay closed.
 */
export function SharedItineraryPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  const { exporting, exportPdf } = useItineraryExport(data?.trip.name ?? 'Itinerary')

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (!token) return
      if (showSpinner) setLoading(true)
      try {
        const res = await fetch(
          `/.netlify/functions/shared-trip?token=${encodeURIComponent(token)}`
        )
        if (!res.ok) {
          if (showSpinner) setNotFound(true)
          return
        }
        setData((await res.json()) as SharedPayload)
        setNotFound(false)
      } catch {
        if (showSpinner) setNotFound(true)
      } finally {
        if (showSpinner) setLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    void load(true)
  }, [load])

  // Keep a link that's been left open honest: refresh on return to the tab
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load(false)
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [load])

  // A share link shouldn't turn up in search results
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      document.head.removeChild(meta)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground mb-2">
            This link isn't available
          </p>
          <p className="text-sm text-muted-foreground">
            It may have been turned off, or the address may be incomplete.
          </p>
        </div>
      </div>
    )
  }

  const { trip, days, stays } = data
  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null

  return (
    <div data-print="page" className="min-h-screen bg-background">
      <ItineraryHero
        trip={trip}
        currentHero={trip.image_url}
        heroRef={heroRef}
        dateRange={dateRange}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        data-print="content"
        className="relative -mt-16 pt-4"
      >
        {trip.vibe_tags && trip.vibe_tags.length > 0 && (
          <VibeTagsSection tags={trip.vibe_tags} heading={trip.vibe_heading} />
        )}

        <div
          data-print="hide"
          className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 max-sm:pt-4 max-sm:px-3 flex justify-center"
        >
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all disabled:opacity-50 touch-manipulation max-sm:min-h-[44px]"
            title="Export this itinerary as a PDF"
          >
            {exporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" /> Export PDF
              </>
            )}
          </button>
        </div>

        <ItineraryDaysList slug={trip.slug} days={days} stays={stays} readOnly />

        {days.length > 0 && <AtAGlanceSection days={days} />}
      </motion.div>
    </div>
  )
}
