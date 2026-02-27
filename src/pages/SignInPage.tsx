import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export function SignInPage() {
  const { signInWithGoogle, authError, clearAuthError } = useAuth()
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
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
        <p className="text-muted-foreground text-sm mb-8">
          Sign in with Google to see your trips and create new ones.
        </p>

        {authError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </motion.div>
        )}

        <Button
          size="lg"
          className="w-full max-sm:min-h-[48px]"
          onClick={handleSignIn}
          disabled={signingIn}
        >
          {signingIn ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in with Google'
          )}
        </Button>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground underline">Privacy</Link>
          {' · '}
          <Link to="/terms" className="hover:text-foreground underline">Terms</Link>
        </footer>
      </motion.div>
    </div>
  )
}
