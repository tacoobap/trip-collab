import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    user,
    loading: authLoading,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    authError,
    clearAuthError,
  } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const redirectTo = (() => {
    const params = new URLSearchParams(location.search)
    return params.get('from') || '/home'
  })()

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true })
  }, [user, navigate, redirectTo])

  // Don't show sign-in UI until auth has finished initializing (avoids flash on refresh)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden />
      </div>
    )
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAuthError()
    if (!email.trim() || !password) return
    setSigningIn(true)
    try {
      if (isSignUp) {
        await signUpWithEmailPassword(email, password)
      } else {
        await signInWithEmailPassword(email, password)
      }
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

        <Button
          type="button"
          size="lg"
          className="w-full max-sm:min-h-[48px] mb-3"
          onClick={handleSignInWithGoogle}
          disabled={signingIn}
        >
          Sign in with Google
        </Button>

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or continue with email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

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
            variant="secondary"
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
          className="text-sm text-muted-foreground hover:text-foreground underline mb-2"
          disabled={signingIn}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground underline">Privacy</Link>
          {' · '}
          <Link to="/terms" className="hover:text-foreground underline">Terms</Link>
        </footer>
      </motion.div>
    </div>
  )
}
