import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanningBoard } from '@/components/planning/PlanningBoard'
import { TripNotesDrawer } from '@/components/planning/TripNotesDrawer'
import { StaysDrawer } from '@/components/stays/StaysDrawer'
import { NamePrompt } from './NamePrompt'
import { useProposerName } from '@/hooks/useProposerName'
import { useTrip } from '@/hooks/useTrip'
import { useTripNotes } from '@/hooks/useTripNotes'
import { useStays } from '@/hooks/useStays'
import { Loader2 } from 'lucide-react'

export function TripPage() {
  const { slug } = useParams<{ slug: string }>()
  const { name, setName, clearName } = useProposerName()
  const { trip, days, travelers, loading, error } = useTrip(slug)
  const { notes, addNote, deleteNote } = useTripNotes(trip?.id)
  const { stays, addStay, updateStay, deleteStay } = useStays(trip?.id)
  const [notesOpen, setNotesOpen] = useState(false)
  const [staysOpen, setStaysOpen] = useState(false)

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
        stayCount={stays.length}
        onOpenStays={() => setStaysOpen(true)}
        noteCount={notes.length}
        onOpenNotes={() => setNotesOpen(true)}
      />
      <main className="pt-6">
        <PlanningBoard trip={trip} days={days} currentName={name} />
      </main>

      <StaysDrawer
        open={staysOpen}
        onClose={() => setStaysOpen(false)}
        trip={trip}
        stays={stays}
        currentName={name}
        onAdd={addStay}
        onUpdate={updateStay}
        onDelete={deleteStay}
      />

      <TripNotesDrawer
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        notes={notes}
        currentName={name}
        onAdd={(text) => addNote(text, name)}
        onDelete={deleteNote}
      />
    </div>
  )
}
