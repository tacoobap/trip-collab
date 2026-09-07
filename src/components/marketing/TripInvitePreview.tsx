import { motion } from 'framer-motion'
import { Loader2, MapPin, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTripPreview } from '@/hooks/useTripPreview'
import { formatTripDate } from '@/lib/utils'

/**
 * "September 12 – 18, 2026", collapsing whatever the two ends share — the same
 * shape `formatRange` gives the link-preview card, which can't be imported here
 * because it lives outside `src`.
 *
 * The tail of a collapsed range is built from the ISO string rather than
 * another `toLocaleDateString`: asked for a day and a year and nothing else,
 * Intl renders "2026 (day: 18)".
 */
function dateRange(startDate: string | null, endDate: string | null): string | null {
  const full: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
  if (!startDate || !endDate) {
    return formatTripDate(startDate, full) ?? formatTripDate(endDate, full)
  }
  if (startDate === endDate) return formatTripDate(startDate, full)

  const [sy, sm] = startDate.split('-')
  const [ey, em, ed] = endDate.split('-')
  const from = formatTripDate(startDate, { month: 'long', day: 'numeric' })

  // Same month — "September 12 – 18, 2026"
  if (sy === ey && sm === em) return `${from} – ${Number(ed)}, ${ey}`
  // Same year — "September 12 – October 3, 2026"
  if (sy === ey) return `${from} – ${formatTripDate(endDate, full)}`
  return `${formatTripDate(startDate, full)} – ${formatTripDate(endDate, full)}`
}

/**
 * The invite card: cover photo, trip name, when and where, then the way in.
 *
 * The name sits on a scrim over the photo, matching how a day header treats
 * its own photo. A trip with no cover photo swaps that white-on-scrim
 * treatment for ordinary text on a muted ground, for the same reason it does
 * there — white on a light placeholder is unreadable.
 */
export function TripInvitePreview({
  slug,
  returnTo,
}: {
  slug: string | undefined
  /** Where to land after signing in; defaults to the trip's planning board. */
  returnTo?: string
}) {
  const { preview, loading } = useTripPreview(slug)
  const target = returnTo ?? (slug ? `/trip/${slug}` : null)
  const signInHref = target ? `/sign-in?from=${encodeURIComponent(target)}` : '/sign-in'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  const when = preview ? dateRange(preview.startDate, preview.endDate) : null
  const where = preview?.destinations.slice(0, 3).join(' · ') || null

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 sm:px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <p className="text-center text-sm text-muted-foreground mb-4">
          {preview ? "You've been invited to plan" : 'Sign in to view this trip'}
        </p>

        {preview && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm mb-6">
            {preview.imageUrl ? (
              <div className="relative aspect-[3/2]">
                <img
                  src={preview.imageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <h1 className="absolute inset-x-0 bottom-0 p-5 font-serif text-2xl sm:text-3xl font-bold text-white">
                  {preview.name}
                </h1>
              </div>
            ) : (
              <div className="bg-muted px-5 py-6">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
                  {preview.name}
                </h1>
              </div>
            )}

            {(when || where) && (
              <div className="px-5 py-4 space-y-1.5">
                {when && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-4 h-4 shrink-0" aria-hidden />
                    {when}
                  </p>
                )}
                {where && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0" aria-hidden />
                    {where}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <a href={signInHref} className="block">
          <Button size="lg" className="w-full">
            Sign in to join
          </Button>
        </a>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          No account yet? You can create one on the next screen.
        </p>
        <p className="mt-6 text-center">
          <a href="/" className="text-sm text-primary hover:underline">
            What is Trup?
          </a>
        </p>
      </motion.div>
    </div>
  )
}
