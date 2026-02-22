import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanningBoard } from '@/components/planning/PlanningBoard'
import { NamePrompt } from './NamePrompt'
import { useProposerName } from '@/hooks/useProposerName'
import { useTrip } from '@/hooks/useTrip'
import { Loader2 } from 'lucide-react'

export function TripPage() {
  const { slug } = useParams<{ slug: string }>()
  const { name, setName, clearName } = useProposerName()
  const { trip, days, travelers, loading, error } = useTrip(slug)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground mb-2">
            {error || 'Trip not found'}
          </p>
          <a href="/" className="text-sm text-primary hover:underline">
            ← Back to home
          </a>
        </div>
      </div>
    )
  }

  // Show name prompt after trip loads so we can pass existing travelers
  if (!name) {
    return <NamePrompt onSetName={setName} travelers={travelers} />
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        trip={trip}
        travelers={travelers}
        currentName={name}
        onChangeName={clearName}
      />
      <main className="pt-6">
        <PlanningBoard
          tripId={trip.id}
          days={days}
          currentName={name}
        />
      </main>
    </div>
  )
}
