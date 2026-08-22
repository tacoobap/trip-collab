import { useState } from 'react'
import { Link2, Loader2, Check } from 'lucide-react'
import { useShareLink, shareUrlFor } from '@/hooks/useShareLink'

interface ShareLinkButtonProps {
  tripId: string
  /** Token already on the trip doc, if sharing is on. */
  shareToken: string | null
  getIdToken: () => Promise<string | null>
}

/**
 * One-tap "copy a public link to this itinerary". Turning sharing back off
 * lives in trip settings — this stays a single button so the toolbar doesn't
 * grow a URL after every click.
 */
export function ShareLinkButton({ tripId, shareToken, getIdToken }: ShareLinkButtonProps) {
  const { token, busy, error, enable } = useShareLink(tripId, shareToken, getIdToken)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const active = token ?? (await enable())
    if (!active) return
    try {
      await navigator.clipboard.writeText(shareUrlFor(active))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the link is always available in trip settings
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        disabled={busy}
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all disabled:opacity-50 touch-manipulation max-sm:min-h-[44px] max-sm:w-full"
        title="Copy a link anyone can open without signing in"
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
            <Link2 className="w-3.5 h-3.5" /> Share link
          </>
        )}
      </button>

      {error && <p className="basis-full text-[10px] text-destructive/90 text-center">{error}</p>}
    </>
  )
}
