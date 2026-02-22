import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Trip, Day, Slot, Proposal, DayWithSlots, SlotWithProposals } from '@/types/database'
import { DaySection } from '@/components/itinerary/DaySection'
import { CityDivider } from '@/components/layout/CityDivider'
import { Loader2, ArrowLeft, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

export function ItineraryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<DayWithSlots[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const loadTrip = useCallback(async () => {
    if (!slug) return

    const tripSnap = await getDocs(
      query(collection(db, 'trips'), where('slug', '==', slug))
    )
    if (tripSnap.empty) {
      setError('Trip not found.')
      setLoading(false)
      return
    }
    const tripDoc = tripSnap.docs[0]
    const tripData = { id: tripDoc.id, ...tripDoc.data() } as Trip
    setTrip(tripData)

    const daysSnap = await getDocs(
      query(collection(db, 'days'), where('trip_id', '==', tripDoc.id))
    )
    const dayDocs = daysSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Day))
      .sort((a, b) => a.day_number - b.day_number)

    const daysWithSlots: DayWithSlots[] = await Promise.all(
      dayDocs.map(async (day) => {
        const slotsSnap = await getDocs(
          query(collection(db, 'slots'), where('day_id', '==', day.id))
        )
        const slotDocs = slotsSnap.docs
          .map((s) => ({ id: s.id, ...s.data() } as Slot))
          .sort((a, b) => a.sort_order - b.sort_order)

        const slotsWithProposals: SlotWithProposals[] = await Promise.all(
          slotDocs.map(async (slot) => {
            const propsSnap = await getDocs(
              query(collection(db, 'proposals'), where('slot_id', '==', slot.id))
            )
            const proposals = propsSnap.docs.map(
              (p) => ({ id: p.id, ...p.data() } as Proposal)
            )
            return { ...slot, proposals }
          })
        )
        return { ...day, slots: slotsWithProposals }
      })
    )

    setDays(daysWithSlots)
    setLoading(false)
  }, [slug])

  useEffect(() => {
    void loadTrip()
  }, [loadTrip])

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fallback */
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <p className="text-muted-foreground">{error || 'Trip not found'}</p>
      </div>
    )
  }

  let lastCity = ''

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <Link
            to={`/trip/${slug}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to planning
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Final Itinerary
              </p>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
                {trip.name}
              </h1>
              {trip.destinations.length > 0 && (
                <p className="text-muted-foreground mt-2">
                  {trip.destinations.join(' · ')}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleShare} className="shrink-0">
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              {copied ? 'Copied!' : 'Share'}
            </Button>
          </div>
        </motion.div>

        <div>
          {days.map((day, i) => {
            const showDivider = day.city !== lastCity
            lastCity = day.city
            return (
              <div key={day.id}>
                {showDivider && <CityDivider city={day.city} />}
                <div className="mt-6">
                  <DaySection day={day} dayIndex={i} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
