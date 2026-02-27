import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore'
import { db, auth, firebaseProjectId } from '@/lib/firebase'
import type { Trip, Day, Slot, Proposal, DayWithSlots } from '@/types/database'

export function useTrip(slug: string | undefined) {
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

    // #region agent log
    const authUid = auth.currentUser?.uid ?? null
    fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dc2e0b'},body:JSON.stringify({sessionId:'dc2e0b',location:'useTrip.ts:effect',message:'trip load start',data:{slug,authUid,projectId:firebaseProjectId},hypothesisId:'A,C',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    getDocs(query(collection(db, 'trips'), where('slug', '==', slug)))
      .then((tripSnap) => {
        if (cancelled) return

        if (tripSnap.empty) {
          setError('Trip not found.')
          setLoading(false)
          return
        }

        const tripDoc = tripSnap.docs[0]
        const d = tripDoc.data()
        // #region agent log
        const ownerUid = d?.owner_uid
        const memberUids = d?.member_uids
        fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dc2e0b'},body:JSON.stringify({sessionId:'dc2e0b',location:'useTrip.ts:then',message:'trip doc received',data:{tripId:tripDoc.id,owner_uid:ownerUid,member_uids:memberUids,member_uids_type:Array.isArray(memberUids)?'array':'other',member_uids_json:JSON.stringify(memberUids)},hypothesisId:'B,E',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const tripData = { id: tripDoc.id, ...d } as Trip
        setTrip(tripData)

        // Subscribe to trip doc so updates (e.g. vibe_heading, vibe_tags) flow to UI
        unsubTrip = onSnapshot(
          doc(db, 'trips', tripDoc.id),
          (snap) => {
            if (cancelled) return
            const next = { id: snap.id, ...snap.data() } as Trip
            setTrip(next)
          },
          (err) => {
            if (cancelled) return
            console.error('useTrip trip snapshot error:', err)
            // #region agent log
            fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dc2e0b'},body:JSON.stringify({sessionId:'dc2e0b',location:'useTrip.ts:onSnapshotTrip',message:'trip doc snapshot error',data:{operation:'onSnapshot_trip',errorCode:err?.code,tripId:tripDoc.id},hypothesisId:'D',timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            setError(err?.code === 'permission-denied' ? "You don't have access to this trip." : 'Failed to load trip.')
            setLoading(false)
          }
        )

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
        console.error('useTrip error:', err)
        // #region agent log
        fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dc2e0b'},body:JSON.stringify({sessionId:'dc2e0b',location:'useTrip.ts:catch',message:'getDocs trips failed',data:{operation:'getDocs_trips',errorCode:err?.code,slug,authUid:auth.currentUser?.uid ?? null},hypothesisId:'D',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
