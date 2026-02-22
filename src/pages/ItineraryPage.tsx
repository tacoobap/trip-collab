import { useParams, Link } from 'react-router-dom'
import { DaySection } from '@/components/itinerary/DaySection'
import { CityDivider } from '@/components/layout/CityDivider'
import { Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useTrip } from '@/hooks/useTrip'
import { PageHeader } from '@/components/layout/PageHeader'
import { useProposerName } from '@/hooks/useProposerName'

export function ItineraryPage() {
  const { slug } = useParams<{ slug: string }>()
  const { trip, days, travelers, loading, error } = useTrip(slug)
  const { name, clearName } = useProposerName()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fallback */
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <p className="text-muted-foreground">{error || 'Trip not found'}</p>
      </div>
    )
  }

  let lastCity = ''

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        trip={trip}
        travelers={travelers}
        currentName={name}
        onChangeName={clearName}
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                Final Itinerary
              </p>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
                {trip.name}
              </h1>
              {trip.destinations.length > 0 && (
                <p className="text-muted-foreground mt-2">
                  {trip.destinations.join(' · ')}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleShare} className="shrink-0">
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              {copied ? 'Copied!' : 'Share'}
            </Button>
          </div>
        </motion.div>

        <div>
          {days.map((day, i) => {
            const showDivider = day.city !== lastCity
            lastCity = day.city
            return (
              <div key={day.id}>
                {showDivider && <CityDivider city={day.city} />}
                <div className="mt-6">
                  <DaySection day={day} dayIndex={i} />
                </div>
              </div>
            )
          })}

          {days.length === 0 && (
            <div className="text-center py-16 px-4">
              <p className="text-muted-foreground text-sm mb-3">
                Nothing locked in yet.
              </p>
              <Link
                to={`/trip/${slug}`}
                className="text-sm text-primary hover:underline"
              >
                ← Head back to planning
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
