import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'

export function SignInPage() {
  const {
    user,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    authError,
    clearAuthError,
    getSignInMethodsForEmail,
    linkEmailPasswordToCurrentUser,
  } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [googleAccountAddPassword, setGoogleAccountAddPassword] = useState<{ email: string; password: string } | null>(null)

  // #region agent log
  useEffect(() => {
    if (user) {
      const _e = { sessionId: '9141c3', location: 'SignInPage.tsx:user_set', message: 'SignInPage sees user', data: { uid: user.uid }, hypothesisId: 'E' };
      console.info('[SSO-DEBUG]', _e);
      fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9141c3'},body:JSON.stringify({..._e,timestamp:Date.now()})}).catch(()=>{});
    }
  }, [user]);
  // #endregion

  useEffect(() => {
    if (user) setGoogleAccountAddPassword(null)
  }, [user])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAuthError()
    setGoogleAccountAddPassword(null)
    if (!email.trim() || !password) return
    setSigningIn(true)
    try {
      if (isSignUp) {
        await signUpWithEmailPassword(email, password)
      } else {
        await signInWithEmailPassword(email, password)
      }
    } catch (err) {
      if (!isSignUp && err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
          try {
            const methods = await getSignInMethodsForEmail(email.trim())
            const hasGoogle = methods.includes('google.com')
            const hasPassword = methods.includes('password')
            if (hasGoogle && !hasPassword) {
              setGoogleAccountAddPassword({ email: email.trim(), password })
              clearAuthError()
              return
            }
          } catch {
            // leave authError as set by signInWithEmailPassword
          }
        }
      }
      throw err
    } finally {
      setSigningIn(false)
    }
  }

  const handleSignInWithGoogle = async () => {
    clearAuthError()
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } finally {
      setSigningIn(false)
    }
  }

  const handleAddPasswordToGoogleAccount = async () => {
    if (!googleAccountAddPassword) return
    clearAuthError()
    setSigningIn(true)
    try {
      await signInWithGoogle()
      await linkEmailPasswordToCurrentUser(googleAccountAddPassword.email, googleAccountAddPassword.password)
      setGoogleAccountAddPassword(null)
    } catch {
      // authError set by context; keep googleAccountAddPassword so user can retry
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm w-full"
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-6">
          <Sparkles className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
          Trip Collab
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Sign in to see your trips and create new ones.
        </p>

        {googleAccountAddPassword ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 rounded-xl border border-border bg-muted/30 px-4 py-4 text-left text-sm text-foreground space-y-4"
          >
            {authError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}
            <p>
              This email is linked to Google. You don&apos;t have to create a password — you can sign in with Google below. If you&apos;d like to also sign in with email in the future, you can add a password to this account.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full max-sm:min-h-[48px]"
                onClick={handleSignInWithGoogle}
                disabled={signingIn}
              >
                Sign in with Google
              </Button>
              <Button
                type="button"
                size="lg"
                className="w-full max-sm:min-h-[48px]"
                onClick={handleAddPasswordToGoogleAccount}
                disabled={signingIn}
              >
                {signingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding password…
                  </>
                ) : (
                  'Add password to this account'
                )}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setGoogleAccountAddPassword(null)}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Try a different email
            </button>
          </motion.div>
        ) : (
          <>
            {authError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </motion.div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3 text-left mb-4">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={signingIn}
                className="w-full"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                disabled={signingIn}
                className="w-full"
              />
              <Button
                type="submit"
                size="lg"
                className="w-full max-sm:min-h-[48px]"
                disabled={signingIn || !email.trim() || !password}
              >
                {signingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isSignUp ? 'Creating account…' : 'Signing in…'}
                  </>
                ) : isSignUp ? (
                  'Create account'
                ) : (
                  'Sign in with email'
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => {
                clearAuthError()
                setIsSignUp((prev) => !prev)
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline mb-4"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>

            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full max-sm:min-h-[48px]"
              onClick={handleSignInWithGoogle}
              disabled={signingIn}
            >
              Sign in with Google
            </Button>
          </>
        )}

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground underline">Privacy</Link>
          {' · '}
          <Link to="/terms" className="hover:text-foreground underline">Terms</Link>
        </footer>
      </motion.div>
    </div>
  )
}
