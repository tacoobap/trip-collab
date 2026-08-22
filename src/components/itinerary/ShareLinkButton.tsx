import { useState } from 'react'
import { Link2, Loader2, Check, X } from 'lucide-react'

interface ShareLinkButtonProps {
  tripId: string
  /** Token already on the trip doc, if sharing is on. */
  shareToken: string | null
  getIdToken: () => Promise<string | null>
}

function shareUrl(token: string): string {
  return `${window.location.origin}/i/${token}`
}

/**
 * Turns on (or off) a public link to this itinerary — no account needed to view.
 * The token is minted server-side by the `share-link` function.
 */
export function ShareLinkButton({ tripId, shareToken, getIdToken }: ShareLinkButtonProps) {
  const [token, setToken] = useState<string | null>(shareToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const call = async (action: 'enable' | 'disable') => {
    setBusy(true)
    setError('')
    try {
      const idToken = await getIdToken()
      if (!idToken) throw new Error('Sign in to share this trip.')
      const res = await fetch('/.netlify/functions/share-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ tripId, action }),
      })
      const data = (await res.json()) as { token?: string | null; error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not update the link.')
      setToken(data.token ?? null)
      return data.token ?? null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    const active = token ?? (await call('enable'))
    if (!active) return
    try {
      await navigator.clipboard.writeText(shareUrl(active))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the link is shown below either way
      setError('')
    }
  }

  return (
    <div className="contents">
      <button
        onClick={handleShare}
        disabled={busy}
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all disabled:opacity-50 touch-manipulation max-sm:min-h-[44px] max-sm:w-full"
        title="Get a link anyone can open without signing in"
      >
        {busy ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…
          </>
        ) : copied ? (
          <>
            <Check className="w-3.5 h-3.5" /> Link copied
          </>
        ) : (
          <>
            <Link2 className="w-3.5 h-3.5" /> {token ? 'Copy share link' : 'Share link'}
          </>
        )}
      </button>

      {token && (
        <div className="basis-full flex flex-col items-center gap-1 mt-1">
          <p className="text-[10px] text-muted-foreground/70 break-all text-center max-w-full">
            {shareUrl(token)}
          </p>
          <button
            onClick={() => call('disable')}
            disabled={busy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors disabled:opacity-50"
          >
            <X className="w-3 h-3" /> Stop sharing
          </button>
        </div>
      )}

      {error && <p className="basis-full text-[10px] text-destructive/90 text-center">{error}</p>}
    </div>
  )
}
