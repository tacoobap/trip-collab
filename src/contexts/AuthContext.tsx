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
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmailPassword: (email: string, password: string) => Promise<void>
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
  authError: string | null
  clearAuthError: () => void
  setAuthError: (message: string) => void
  getSignInMethodsForEmail: (email: string) => Promise<string[]>
  linkEmailPasswordToCurrentUser: (email: string, password: string) => Promise<void>
  /** Redirects to Google sign-in; after return we link the password (for Add password flow). */
  signInWithGoogleRedirectToAddPassword: (email: string, password: string) => void
}

const ADD_PASSWORD_STORAGE_KEY = 'trip-collab-add-password'

function getAuthErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code
    const message = (err as { message?: string }).message ?? ''
    if (code === 'auth/email-already-in-use') return 'This email is already in use. Sign in instead.'
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.'
    if (code === 'auth/weak-password') return 'Please choose a password with at least 6 characters.'
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Invalid email or password. If you usually sign in with Google, use "Sign in with Google" instead.'
    if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later.'
    if (message) return message
  }
  return err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
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
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result?.user) return
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ADD_PASSWORD_STORAGE_KEY) : null
        if (!raw) return
        try {
          const { email, password } = JSON.parse(raw) as { email: string; password: string }
          await linkWithCredential(result.user, EmailAuthProvider.credential(email.trim(), password))
        } catch (err) {
          const message =
            err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'auth/weak-password'
              ? 'Please choose a password with at least 6 characters.'
              : err instanceof Error ? err.message : 'Add password failed. Please try again.'
          setAuthError(message)
        }
        sessionStorage.removeItem(ADD_PASSWORD_STORAGE_KEY)
      })
      .catch(() => {})

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

  const signInWithEmailPassword = useCallback(async (email: string, password: string) => {
    setAuthError(null)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setAuthError(getAuthErrorMessage(err))
      throw err
    }
  }, [])

  const signUpWithEmailPassword = useCallback(async (email: string, password: string) => {
    setAuthError(null)
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setAuthError(getAuthErrorMessage(err))
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

  const setAuthErrorMessage = useCallback((message: string) => setAuthError(message), [])

  const getSignInMethodsForEmail = useCallback(async (email: string) => {
    return fetchSignInMethodsForEmail(auth, email.trim())
  }, [])

  const linkEmailPasswordToCurrentUser = useCallback(async (email: string, password: string) => {
    setAuthError(null)
    const u = auth.currentUser
    if (!u) {
      setAuthError('Please sign in with Google first, then add a password.')
      throw new Error('No current user')
    }
    try {
      await linkWithCredential(u, EmailAuthProvider.credential(email.trim(), password))
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'auth/weak-password'
          ? 'Please choose a password with at least 6 characters.'
          : err instanceof Error ? err.message : 'Add password failed. Please try again.'
      setAuthError(message)
      throw err
    }
  }, [])

  const signInWithGoogleRedirectToAddPassword = useCallback((email: string, password: string) => {
    setAuthError(null)
    try {
      sessionStorage.setItem(ADD_PASSWORD_STORAGE_KEY, JSON.stringify({ email: email.trim(), password }))
      // #region agent log
      fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97004e'},body:JSON.stringify({sessionId:'97004e',location:'AuthContext.tsx:signInWithGoogleRedirectToAddPassword',message:'Storage set, calling redirect',data:{email:email.trim()},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      signInWithRedirect(auth, new GoogleAuthProvider())
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not start sign-in.')
    }
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signOut,
    getIdToken,
    authError,
    clearAuthError,
    setAuthError: setAuthErrorMessage,
    getSignInMethodsForEmail,
    linkEmailPasswordToCurrentUser,
    signInWithGoogleRedirectToAddPassword,
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
