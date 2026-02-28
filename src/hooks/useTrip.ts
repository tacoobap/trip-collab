import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { Trip, Day, Slot, Proposal, DayWithSlots } from '@/types/database'
import { getTripBySlug } from '@/services/tripService'

/** Firestore 'in' queries support at most 10 values. */
const IN_QUERY_MAX = 10

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

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

    getTripBySlug(slug)
      .then((result) => {
        if (cancelled) return

        if (result === null) {
          setError('Trip not found.')
          setLoading(false)
          return
        }

        const { id: selectedId, trip: tripData } = result
        setTrip(tripData)

        // Subscribe to trip doc so updates (e.g. destinations, dates) flow to UI
        unsubTrip = onSnapshot(
          doc(db, 'trips', selectedId),
          (snap) => {
            if (cancelled) return
            const data = snap.data()
            const next: Trip = {
              id: snap.id,
              ...data,
              destinations: Array.isArray(data?.destinations) ? data.destinations : [],
            } as Trip
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

            const dayChunks = chunk(dayIds, IN_QUERY_MAX)
            const slotDocsByChunk: (Slot[] | null)[] = dayChunks.map(() => null)
            const unsubChunks: (() => void)[] = []

            const onSlotsMerged = () => {
              if (cancelled) return
              liveSlots.clear()
              for (const docs of slotDocsByChunk) {
                if (docs) for (const s of docs) liveSlots.set(s.id, s)
              }
              const newSlotIds = [...liveSlots.keys()].sort()
              const slotIdsChanged =
                JSON.stringify(newSlotIds) !== JSON.stringify(currentSlotIds)
              currentSlotIds = newSlotIds
              if (!slotIdsChanged) {
                rebuild()
                return
              }
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

            for (let i = 0; i < dayChunks.length; i++) {
              const chunkIds = dayChunks[i]
              const unsub = onSnapshot(
                query(collection(db, 'slots'), where('day_id', 'in', chunkIds)),
                (snap) => {
                  if (cancelled) return
                  slotDocsByChunk[i] = snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                  } as Slot))
                  onSlotsMerged()
                }
              )
              unsubChunks.push(unsub)
            }

            unsubSlots = () => unsubChunks.forEach((u) => u())
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

  const isOwner = useMemo(() => {
    if (!trip || !currentUid) return false
    return trip.owner_uid === currentUid
  }, [trip, currentUid])

  return { trip, days, travelers, loading, error, isMember, isOwner }
}
