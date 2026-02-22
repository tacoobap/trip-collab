import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Trip, Day, Slot, Proposal, DayWithSlots, SlotWithProposals } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanningBoard } from '@/components/planning/PlanningBoard'
import { NamePrompt } from './NamePrompt'
import { useProposerName } from '@/hooks/useProposerName'
import { Loader2 } from 'lucide-react'

export function TripPage() {
  const { slug } = useParams<{ slug: string }>()
  const { name, setName } = useProposerName()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<DayWithSlots[]>([])
  const [travelers, setTravelers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTrip = useCallback(async () => {
    if (!slug) return

    // Load trip by slug
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

    // Load days, sort client-side to avoid composite index requirement
    const daysSnap = await getDocs(
      query(collection(db, 'days'), where('trip_id', '==', tripDoc.id))
    )
    const dayDocs = daysSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Day))
      .sort((a, b) => a.day_number - b.day_number)

    // Load slots for all days in parallel
    const daysWithSlots: DayWithSlots[] = await Promise.all(
      dayDocs.map(async (day) => {
        const slotsSnap = await getDocs(
          query(collection(db, 'slots'), where('day_id', '==', day.id))
        )
        const slotDocs = slotsSnap.docs
          .map((s) => ({ id: s.id, ...s.data() } as Slot))
          .sort((a, b) => a.sort_order - b.sort_order)

        // Load proposals for all slots in parallel
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

    const allNames = new Set<string>()
    daysWithSlots.forEach((day) =>
      day.slots.forEach((slot) =>
        slot.proposals.forEach((p) => allNames.add(p.proposer_name))
      )
    )
    setTravelers([...allNames])
    setLoading(false)
  }, [slug])

  useEffect(() => {
    void loadTrip()
  }, [loadTrip])

  if (!name) {
    return <NamePrompt onSetName={setName} />
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
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground mb-2">
            {error || 'Trip not found'}
          </p>
          <a href="/" className="text-sm text-primary hover:underline">
            ← Back to home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        trip={trip}
        travelers={travelers}
        currentName={name}
        showItineraryLink={true}
      />
      <main className="pt-6">
        {days.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-muted-foreground text-sm">
              No days set up yet. Add days to this trip to get started.
            </p>
          </div>
        ) : (
          <PlanningBoard days={days} currentName={name} onUpdate={loadTrip} />
        )}
      </main>
    </div>
  )
}
