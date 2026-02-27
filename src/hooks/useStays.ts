import { useState, useEffect } from 'react'
import type { Stay } from '@/types/database'
import {
  addStay as addStayService,
  deleteStay as deleteStayService,
  subscribeToStays,
  updateStay as updateStayService,
} from '@/services/staysService'
import type { StayInput } from '@/services/staysService'

export function useStays(tripId: string | undefined) {
  const [stays, setStays] = useState<Stay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tripId) {
      setStays([])
      setLoading(false)
      return
    }

    const unsub = subscribeToStays(tripId, (next) => {
      setStays(next)
      setLoading(false)
    })

    return unsub
  }, [tripId])

  const addStay = async (data: StayInput) => {
    if (!tripId) return
    await addStayService(tripId, data)
  }

  const updateStay = async (stayId: string, data: Partial<StayInput>) => {
    await updateStayService(stayId, data)
  }

  const deleteStay = async (stayId: string) => {
    await deleteStayService(stayId)
  }

  return { stays, loading, addStay, updateStay, deleteStay }
}
