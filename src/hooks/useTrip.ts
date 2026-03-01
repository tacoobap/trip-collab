import { useState, useEffect, useMemo } from 'react'
import { auth } from '@/lib/firebase'
import type { Trip, DayWithSlots } from '@/types/database'
import { subscribeToTrip } from '@/services/tripSubscription'

export function useTrip(slug: string | undefined, currentUid?: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null)
  const [days, setDays] = useState<DayWithSlots[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    const effectiveUid = currentUid ?? auth.currentUser?.uid ?? null
    const cleanup = subscribeToTrip(slug, effectiveUid, {
      setTrip,
      setDays,
      setError,
      setLoading,
    })

    return cleanup
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
