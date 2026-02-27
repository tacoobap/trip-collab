import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProposerName } from '@/hooks/useProposerName'

/**
 * Single source of display name: signed-in user (from Google) or localStorage (guest).
 * When signed in, NamePrompt is not shown; when not, NamePrompt sets the guest name.
 */
export function useDisplayName() {
  const { user } = useAuth()
  const { name, setName, clearName, namesUsed } = useProposerName()

  const displayName = useMemo(() => {
    if (user) {
      return (
        user.displayName?.trim() ||
        user.email?.split('@')[0] ||
        'Traveler'
      )
    }
    return name
  }, [user, name])

  return {
    displayName: displayName ?? null,
    setName,
    clearName,
    namesUsed,
    isSignedIn: !!user,
  }
}
