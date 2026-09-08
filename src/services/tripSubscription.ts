import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Trip, Day, Slot, Proposal, DayWithSlots } from '@/types/database'
import { getTripBySlug } from '@/services/tripService'

/**
 * Membership as `firestore.rules` decides it, so the client stops before making
 * a read the rules would refuse.
 */
function isMemberOfTrip(
  trip: Pick<Trip, 'owner_uid' | 'member_uids'>,
  uid: string
): boolean {
  return trip.owner_uid === uid || (trip.member_uids ?? []).includes(uid)
}

export type TripSubscriptionCallbacks = {
  setTrip: (trip: Trip | null) => void
  setDays: (days: DayWithSlots[]) => void
  setError: (error: string) => void
  setLoading: (loading: boolean) => void
}

/**
 * Subscribe to a trip and its days/slots/proposals. Calls the provided setters
 * as data changes. Returns a cleanup function that unsubscribes and cancels
 * any in-flight work.
 */
export function subscribeToTrip(
  slug: string,
  currentUid: string | null | undefined,
  callbacks: TripSubscriptionCallbacks
): () => void {
  const { setTrip, setDays, setError, setLoading } = callbacks
  let cancelled = false
  const unsubs: (() => void)[] = []

  const cleanup = () => {
    cancelled = true
    unsubs.forEach((u) => u())
  }

  if (!currentUid) {
    setError('Sign in to view this trip.')
    setLoading(false)
    return cleanup
  }

  setError('')
  setLoading(true)

  getTripBySlug(slug, currentUid)
    .then((result) => {
      if (cancelled) return

      if (result === null) {
        setError('Trip not found.')
        setLoading(false)
        return
      }

      const { id: selectedId, trip: tripData } = result
      setTrip(tripData)

      unsubs.push(
        onSnapshot(
          doc(db, 'trips', selectedId),
          // Metadata changes included so the server's acknowledgement of a join
          // arrives as its own snapshot. Without it Firestore delivers only the
          // optimistic local write — the document data doesn't change when the
          // server confirms it — and the itinerary below would never open.
          { includeMetadataChanges: true },
          (snap) => {
            if (cancelled) return
            const data = snap.data()
            const next: Trip = {
              id: snap.id,
              ...data,
              destinations: Array.isArray(data?.destinations) ? data.destinations : [],
            } as Trip
            setTrip(next)
            // Joining shows up here: this snapshot is the only thing that fires
            // when member_uids changes, so it's what opens the itinerary for
            // someone who arrived on an invite link.
            //
            // It has to be the server's copy. Firestore fires this listener
            // optimistically off the local write the moment `joinTrip` is
            // called, and a listener opened on that snapshot races the write to
            // the server, gets refused by rules that still see the old
            // member_uids, and stays dead — the board would then stay empty
            // until a reload.
            if (!snap.metadata.hasPendingWrites && isMemberOfTrip(next, currentUid)) {
              subscribeItinerary()
            }
          },
          (err) => {
            if (cancelled) return
            console.error('tripSubscription trip snapshot error:', err)
            setError(
              err?.code === 'permission-denied'
                ? "You don't have access to this trip."
                : 'Failed to load trip.'
            )
            setLoading(false)
          }
        )
      )

      let itinerarySubscribed = false
      let subscribeItinerary = () => {}

      const liveSlots = new Map<string, Slot>()
      const liveProposals = new Map<string, Proposal>()
      let liveDays: Day[] = []

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

      subscribeItinerary = () => {
        if (itinerarySubscribed) return
        itinerarySubscribed = true

        // Three flat listeners on the same trip. Every one filters on
        // `trip_id`, which is the field `firestore.rules` checks: a query
        // filtering on anything else — the day a slot sits on, say — is refused
        // outright, and costs the rule one document read per value besides.
        let daysLoaded = false
        let slotsLoaded = false
        const rebuildWhenReady = () => {
          // Days and slots are drawn together; holding the first paint until
          // both have arrived avoids a frame of days with no events on them.
          if (daysLoaded && slotsLoaded) rebuild()
        }

        const onItineraryError = (err: { code?: string }) => {
          if (cancelled) return
          // Let a refusal be retried by the next trip snapshot rather than
          // leaving a dead listener behind: this is reachable while a join is
          // still settling. The board is gated on `isMember` either way, so
          // the page shows the join screen rather than an empty itinerary.
          itinerarySubscribed = false
          if (err?.code !== 'permission-denied') {
            console.error('tripSubscription itinerary snapshot error:', err)
            setError('Failed to load trip.')
          }
          setLoading(false)
        }

        unsubs.push(
          onSnapshot(
            query(collection(db, 'days'), where('trip_id', '==', selectedId)),
            (snap) => {
              if (cancelled) return
              liveDays = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Day))
              daysLoaded = true
              rebuildWhenReady()
            },
            onItineraryError
          )
        )

        unsubs.push(
          onSnapshot(
            query(collection(db, 'slots'), where('trip_id', '==', selectedId)),
            (snap) => {
              if (cancelled) return
              liveSlots.clear()
              snap.docs.forEach((d) =>
                liveSlots.set(d.id, { id: d.id, ...d.data() } as Slot)
              )
              slotsLoaded = true
              rebuildWhenReady()
            },
            onItineraryError
          )
        )

        unsubs.push(
          onSnapshot(
            query(collection(db, 'proposals'), where('trip_id', '==', selectedId)),
            (snap) => {
              if (cancelled) return
              liveProposals.clear()
              snap.docs.forEach((d) =>
                liveProposals.set(d.id, { id: d.id, ...d.data() } as Proposal)
              )
              rebuildWhenReady()
              void ensureLegacyLockedProposals()
            },
            onItineraryError
          )
        )
      }

      // Days, slots and proposals are members-only. Someone arriving on an
      // invite link can read the trip but not its itinerary, so subscribing
      // would only earn a permission-denied and leave the page loading
      // forever — TripPage wants an empty board and `isMember === false`, which
      // is what draws the join screen. The trip snapshot above starts the
      // itinerary the moment they join.
      if (isMemberOfTrip(tripData, currentUid)) {
        subscribeItinerary()
      } else {
        setDays([])
        setLoading(false)
      }
    })
    .catch((err) => {
      if (cancelled) return
      console.error('tripSubscription error:', err)
      const msg =
        err?.code === 'permission-denied'
          ? "You don't have access to this trip. If you were just added, check that your UID is in the trip's member_uids (as an array of strings) in Firestore."
          : 'Failed to load trip.'
      setError(msg)
      setLoading(false)
    })

  return cleanup
}
