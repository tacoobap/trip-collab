import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Display name from the signed-in user (Google displayName, email prefix, or "Traveler").
 * Auth-only; no guest name flow.
 */
export function useDisplayName() {
  const { user } = useAuth()

  const displayName = useMemo(() => {
    if (!user) return null
    return (
      user.displayName?.trim() ||
      user.email?.split('@')[0] ||
      'Traveler'
    )
  }, [user])

  return {
    displayName,
    isSignedIn: !!user,
  }
}
