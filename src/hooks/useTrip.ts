import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Trip, Day, Slot, Proposal, DayWithSlots } from '@/types/database'
import { trackTripVisit } from '@/lib/visitedTrips'

export function useTrip(slug: string | undefined) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<DayWithSlots[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return

    let cancelled = false
    let unsubDays: (() => void) | null = null
    let unsubSlots: (() => void) | null = null
    let unsubProposals: (() => void) | null = null

    getDocs(query(collection(db, 'trips'), where('slug', '==', slug)))
      .then((tripSnap) => {
        if (cancelled) return

        if (tripSnap.empty) {
          setError('Trip not found.')
          setLoading(false)
          return
        }

        const tripDoc = tripSnap.docs[0]
        const tripData = { id: tripDoc.id, ...tripDoc.data() } as Trip
        setTrip(tripData)
        trackTripVisit(tripData)

        // Mutable maps shared by all snapshot callbacks in this effect invocation
        const liveSlots = new Map<string, Slot>()
        const liveProposals = new Map<string, Proposal>()
        let liveDays: Day[] = []
        let currentSlotIds: string[] = []

        const rebuild = () => {
          if (cancelled) return
          const sorted = [...liveDays].sort((a, b) => a.day_number - b.day_number)
          setDays(
            sorted.map((day) => ({
              ...day,
              slots: [...liveSlots.values()]
                .filter((s) => s.day_id === day.id)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((slot) => ({
                  ...slot,
                  proposals: [...liveProposals.values()].filter(
                    (p) => p.slot_id === slot.id
                  ),
                })),
            }))
          )
          setLoading(false)
        }

        unsubDays = onSnapshot(
          query(collection(db, 'days'), where('trip_id', '==', tripDoc.id)),
          (daysSnap) => {
            if (cancelled) return
            liveDays = daysSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Day))
            const dayIds = liveDays.map((d) => d.id)

            // Tear down inner listeners and reset slot state
            unsubSlots?.()
            unsubSlots = null
            unsubProposals?.()
            unsubProposals = null
            liveSlots.clear()
            currentSlotIds = []

            if (dayIds.length === 0) {
              rebuild()
              return
            }

            unsubSlots = onSnapshot(
              query(collection(db, 'slots'), where('day_id', 'in', dayIds)),
              (slotsSnap) => {
                if (cancelled) return
                liveSlots.clear()
                slotsSnap.docs.forEach((d) =>
                  liveSlots.set(d.id, { id: d.id, ...d.data() } as Slot)
                )
                const newSlotIds = [...liveSlots.keys()].sort()
                const slotIdsChanged =
                  JSON.stringify(newSlotIds) !== JSON.stringify(currentSlotIds)
                currentSlotIds = newSlotIds

                if (!slotIdsChanged) {
                  // Slot statuses changed (e.g. a slot was locked) — rebuild immediately
                  rebuild()
                  return
                }

                // Slot structure changed — re-subscribe to proposals
                unsubProposals?.()
                unsubProposals = null

                if (newSlotIds.length === 0) {
                  rebuild()
                  return
                }

                unsubProposals = onSnapshot(
                  query(
                    collection(db, 'proposals'),
                    where('slot_id', 'in', newSlotIds)
                  ),
                  (propsSnap) => {
                    if (cancelled) return
                    liveProposals.clear()
                    propsSnap.docs.forEach((d) =>
                      liveProposals.set(d.id, { id: d.id, ...d.data() } as Proposal)
                    )
                    rebuild()
                  }
                )
              }
            )
          }
        )
      })
      .catch((err) => {
        if (cancelled) return
        console.error(err)
        setError('Failed to load trip.')
        setLoading(false)
      })

    return () => {
      cancelled = true
      unsubDays?.()
      unsubSlots?.()
      unsubProposals?.()
    }
  }, [slug])

  const travelers = useMemo(() => {
    const names = new Set<string>()
    days.forEach((day) =>
      day.slots.forEach((slot) =>
        slot.proposals.forEach((p) => names.add(p.proposer_name))
      )
    )
    return [...names]
  }, [days])

  return { trip, days, travelers, loading, error }
}
