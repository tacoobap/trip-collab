import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link2, Loader2, Check, Copy, Globe, Lock, Pencil, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EditTripModal } from '@/components/trips/EditTripModal'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useTrip } from '@/hooks/useTrip'
import { useDisplayName } from '@/hooks/useDisplayName'
import { useShareLink, shareUrlFor } from '@/hooks/useShareLink'
import { formatTripDate } from '@/lib/utils'

export function TripSettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading: authLoading, getIdToken } = useAuth()
  const { trip, days, loading, isMember } = useTrip(slug, user?.uid)
  const { displayName } = useDisplayName()
  const { token, busy, error, enable, disable } = useShareLink(
    trip?.id,
    trip?.share_token ?? null,
    getIdToken
  )
  const [copied, setCopied] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  /** Both links are on screen in full, so a blocked clipboard is recoverable. */
  const copyText = async (text: string, mark: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      mark(true)
      setTimeout(() => mark(false), 2000)
    } catch {
      // Clipboard blocked — the URL is on screen to copy by hand
    }
  }

  const copy = () => {
    if (!token) return
    void copyText(shareUrlFor(token), setCopied)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">Trip not found.</p>
      </div>
    )
  }

  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric', year: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null
  const inviteUrl =
    typeof window === 'undefined' ? `/trip/${trip.slug}` : `${window.location.origin}/trip/${trip.slug}`

  return (
    <div className="min-h-screen bg-background">
      <PageHeader trip={trip} currentName={displayName ?? ''} />

      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-10 max-sm:py-6">
        <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground mb-8">{trip.name}</p>

        <section className="rounded-xl border border-border bg-card/50 p-5 max-sm:p-4 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Trip details</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Name, destinations and dates.
              </p>
            </div>
            {isMember && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
                className="shrink-0 gap-1.5 max-sm:min-h-[40px]"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}
          </div>

          <dl className="mt-4 grid gap-2.5 text-sm">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-muted-foreground pt-0.5">Name</dt>
              <dd className="min-w-0 text-foreground">{trip.name}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-muted-foreground pt-0.5">Destinations</dt>
              <dd className="min-w-0 text-foreground">
                {trip.destinations?.length ? trip.destinations.join(', ') : '—'}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-xs text-muted-foreground pt-0.5">Dates</dt>
              <dd className="min-w-0 text-foreground">{dateRange ?? '—'}</dd>
            </div>
          </dl>

          {!isMember && (
            <p className="text-xs text-muted-foreground/70 mt-4">
              Only trip members can change this.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card/50 p-5 max-sm:p-4 mb-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="mt-0.5 shrink-0 text-muted-foreground">
              <UserPlus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Invite link</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Anyone you send this to can sign in and join the trip. Members can edit the plan,
                so only share it with people you're travelling with.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <code className="flex-1 text-[11px] text-muted-foreground break-all min-w-0">
              {inviteUrl}
            </code>
            <button
              onClick={() => void copyText(inviteUrl, setInviteCopied)}
              className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {inviteCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </>
              )}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card/50 p-5 max-sm:p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="mt-0.5 shrink-0 text-muted-foreground">
              {token ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Public share link</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {token
                  ? 'Read-only. Anyone with this link can view the itinerary without signing in, but cannot join or edit. It always shows the current plan.'
                  : 'Off. Create a link to let people view the itinerary without an account — read-only, unlike the invite link above.'}
              </p>
            </div>
          </div>

          {!isMember && (
            <p className="text-xs text-muted-foreground/70">
              Only trip members can change this.
            </p>
          )}

          {isMember && (
            <>
              {token ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <code className="flex-1 text-[11px] text-muted-foreground break-all min-w-0">
                      {shareUrlFor(token)}
                    </code>
                    <button
                      onClick={copy}
                      className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={disable}
                    disabled={busy}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {busy ? 'Working…' : 'Turn off sharing'}
                  </button>
                  <p className="text-[11px] text-muted-foreground/60">
                    Turning it off breaks the existing link immediately. Creating a new one later
                    issues a different address.
                  </p>
                </div>
              ) : (
                <button
                  onClick={enable}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-50 max-sm:min-h-[44px]"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3.5 h-3.5" /> Create share link
                    </>
                  )}
                </button>
              )}

              {error && <p className="text-xs text-destructive/90 mt-2">{error}</p>}
            </>
          )}
        </section>
      </div>

      <EditTripModal
        open={editOpen}
        onOpenChange={setEditOpen}
        trip={trip}
        days={days}
      />
    </div>
  )
}
