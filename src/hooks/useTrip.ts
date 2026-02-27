import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { Trip, Day, Slot, Proposal, DayWithSlots } from '@/types/database'

export function useTrip(slug: string | undefined, currentUid?: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<DayWithSlots[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return

    let cancelled = false
    let unsubTrip: (() => void) | null = null
    let unsubDays: (() => void) | null = null
    let unsubSlots: (() => void) | null = null
    let unsubProposals: (() => void) | null = null

    const authUid = auth.currentUser?.uid ?? null
    const effectiveUid = currentUid ?? authUid

    if (!effectiveUid) {
      setError('Sign in to view this trip.')
      setLoading(false)
      return
    }

    // We have a UID – clear any previous auth-related errors and show loading
    setError('')
    setLoading(true)

    const tripsCol = collection(db, 'trips')
    getDocs(query(tripsCol, where('slug', '==', slug)))
      .then((snap) => {
        if (cancelled) return

        if (snap.empty) {
          setError('Trip not found.')
          setLoading(false)
          return
        }

        const docSnap = snap.docs[0]
        const selectedId = docSnap.id
        const selectedData = docSnap.data()

        const ownerUid = selectedData?.owner_uid
        const memberUids = selectedData?.member_uids

        const tripData = { id: selectedId, ...selectedData } as Trip
        setTrip(tripData)

        // Subscribe to trip doc so updates (e.g. vibe_heading, vibe_tags) flow to UI
        unsubTrip = onSnapshot(
          doc(db, 'trips', selectedId),
          (snap) => {
            if (cancelled) return
            const next = { id: snap.id, ...snap.data() } as Trip
            setTrip(next)
          },
          (err) => {
            if (cancelled) return
            console.error('useTrip trip snapshot error:', err)
            setError(
              err?.code === 'permission-denied'
                ? "You don't have access to this trip."
                : 'Failed to load trip.'
            )
            setLoading(false)
          }
        )

        // Mutable maps shared by all snapshot callbacks in this effect invocation
        const liveSlots = new Map<string, Slot>()
        const liveProposals = new Map<string, Proposal>()
        let liveDays: Day[] = []
        let currentSlotIds: string[] = []

        const ensureLegacyLockedProposals = async () => {
          const lockedIds = new Set<string>()
          liveSlots.forEach((slot) => {
            if (slot.locked_proposal_id) lockedIds.add(slot.locked_proposal_id)
          })

          const toFetch = [...lockedIds].filter((id) => !liveProposals.has(id))
          if (toFetch.length === 0) return

          const results = await Promise.all(
            toFetch.map(async (id) => {
              try {
                const snap = await getDoc(doc(db, 'proposals', id))
                if (!snap.exists()) {
                  return { id, found: false as const }
                }
                const proposal = { id: snap.id, ...snap.data() } as Proposal
                liveProposals.set(id, proposal)
                return { id, found: true as const }
              } catch {
                return { id, found: false as const }
              }
            })
          )

          if (results.some((r) => r.found)) {
            rebuild()
          }
        }

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
          query(collection(db, 'days'), where('trip_id', '==', selectedId)),
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
                slotsSnap.docs.forEach((d) => {
                  const slot = { id: d.id, ...d.data() } as Slot
                  liveSlots.set(d.id, slot)
                })
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
                    where('trip_id', '==', selectedId)
                  ),
                  (propsSnap) => {
                    if (cancelled) return
                    liveProposals.clear()
                    propsSnap.docs.forEach((d) =>
                      liveProposals.set(d.id, { id: d.id, ...d.data() } as Proposal)
                    )

                    rebuild()
                    void ensureLegacyLockedProposals()
                  }
                )
              }
            )
          }
        )
      })
      .catch((err) => {
        if (cancelled) return
        console.error('useTrip error:', err)
        const msg =
          err?.code === 'permission-denied'
            ? "You don't have access to this trip. If you were just added, check that your UID is in the trip's member_uids (as an array of strings) in Firestore."
            : 'Failed to load trip.'
        setError(msg)
        setLoading(false)
      })

    return () => {
      cancelled = true
      unsubTrip?.()
      unsubDays?.()
      unsubSlots?.()
      unsubProposals?.()
    }
  }, [slug, currentUid])

  const travelers = useMemo(() => {
    const names = new Set<string>()
    days.forEach((day) =>
      day.slots.forEach((slot) =>
        slot.proposals.forEach((p) => names.add(p.proposer_name))
      )
    )
    return [...names]
  }, [days])

  const isMember = useMemo(() => {
    if (!trip || !currentUid) return null
    const members = trip.member_uids
    if (!Array.isArray(members)) return false
    return members.includes(currentUid)
  }, [trip, currentUid])

  return { trip, days, travelers, loading, error, isMember }
}
