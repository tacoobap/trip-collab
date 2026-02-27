import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
  authError: string | null
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function syncUserProfile(user: User) {
  const displayName =
    user.displayName?.trim() || user.email?.split('@')[0] || 'Traveler'
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  await setDoc(
    ref,
    {
      display_name: displayName,
      email: user.email ?? null,
      photo_url: user.photoURL ?? null,
      ...(snap.exists() ? {} : { created_at: serverTimestamp() }),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        try {
          await syncUserProfile(u)
        } catch (err) {
          console.error('Failed to sync user profile', err)
        }
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
      setAuthError(message)
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    setAuthError(null)
    await firebaseSignOut(auth)
  }, [])

  const getIdToken = useCallback(() => {
    const u = auth.currentUser
    return u ? u.getIdToken() : Promise.resolve(null)
  }, [])

  const clearAuthError = useCallback(() => setAuthError(null), [])

  const value: AuthContextValue = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    getIdToken,
    authError,
    clearAuthError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx == null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
