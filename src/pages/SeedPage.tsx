import { useState } from 'react'
import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react'

type SeedStatus = 'idle' | 'running' | 'done' | 'error'

const SEED_DATA = {
  trip: {
    name: 'Paris & London · May 2026',
    slug: 'paris-london-2026',
    destinations: ['Paris', 'London'],
    start_date: '2026-05-10',
    end_date: '2026-05-14',
  },
  days: [
    {
      date: '2026-05-10',
      label: 'Day 1 · Paris',
      city: 'Paris',
      day_number: 1,
      slots: [
        { time_label: 'Afternoon', category: 'accommodation', sort_order: 0 },
        { time_label: 'Afternoon', category: 'activity', sort_order: 1 },
        { time_label: 'Evening', category: 'food', sort_order: 2 },
      ],
    },
    {
      date: '2026-05-11',
      label: 'Day 2 · Paris',
      city: 'Paris',
      day_number: 2,
      slots: [
        { time_label: 'Morning', category: 'activity', sort_order: 0 },
        { time_label: 'Afternoon', category: 'activity', sort_order: 1 },
        { time_label: 'Evening', category: 'food', sort_order: 2 },
      ],
    },
    {
      date: '2026-05-12',
      label: 'Day 3 · Paris → London',
      city: 'Paris',
      day_number: 3,
      slots: [
        { time_label: 'Morning', category: 'activity', sort_order: 0 },
        { time_label: 'Afternoon', category: 'travel', sort_order: 1 },
        { time_label: 'Evening', category: 'food', sort_order: 2 },
      ],
    },
    {
      date: '2026-05-13',
      label: 'Day 4 · London',
      city: 'London',
      day_number: 4,
      slots: [
        { time_label: 'Morning', category: 'activity', sort_order: 0 },
        { time_label: 'Afternoon', category: 'activity', sort_order: 1 },
        { time_label: 'Evening', category: 'food', sort_order: 2 },
      ],
    },
    {
      date: '2026-05-14',
      label: 'Day 5 · London',
      city: 'London',
      day_number: 5,
      slots: [
        { time_label: 'Morning', category: 'activity', sort_order: 0 },
        { time_label: 'Afternoon', category: 'food', sort_order: 1 },
      ],
    },
  ],
}

export function SeedPage() {
  const [status, setStatus] = useState<SeedStatus>('idle')
  const [log, setLog] = useState<string[]>([])
  const [tripSlug, setTripSlug] = useState('')

  const appendLog = (msg: string) => setLog((prev) => [...prev, msg])

  const handleSeed = async () => {
    setStatus('running')
    setLog([])

    try {
      // Check if trip already exists
      appendLog('Checking for existing trip…')
      const existing = await getDocs(
        query(collection(db, 'trips'), where('slug', '==', SEED_DATA.trip.slug))
      )
      if (!existing.empty) {
        appendLog('⚠️  Trip already exists — deleting old data first…')
        const batch = writeBatch(db)
        existing.docs.forEach((d) => batch.delete(doc(db, 'trips', d.id)))
        await batch.commit()
      }

      // Create trip
      appendLog('Creating trip…')
      const tripRef = await addDoc(collection(db, 'trips'), {
        ...SEED_DATA.trip,
        created_at: serverTimestamp(),
      })
      appendLog(`✓ Trip created (${tripRef.id})`)

      // Create days + slots
      for (const dayData of SEED_DATA.days) {
        appendLog(`Creating ${dayData.label}…`)
        const { slots, ...dayFields } = dayData
        const dayRef = await addDoc(collection(db, 'days'), {
          ...dayFields,
          trip_id: tripRef.id,
        })

        for (const slot of slots) {
          await addDoc(collection(db, 'slots'), {
            ...slot,
            day_id: dayRef.id,
            status: 'open',
            locked_proposal_id: null,
          })
        }
        appendLog(`  ✓ ${slots.length} slots added`)
      }

      setTripSlug(SEED_DATA.trip.slug)
      appendLog('🎉 All done!')
      setStatus('done')
    } catch (err) {
      console.error(err)
      appendLog(`Error: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Seed Trip Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Creates the Paris & London test trip with all days and slots in Firestore.
          </p>
        </div>

        {status === 'idle' && (
          <Button onClick={handleSeed} className="w-full">
            Seed Paris & London trip →
          </Button>
        )}

        {status === 'running' && (
          <Button disabled className="w-full">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Seeding…
          </Button>
        )}

        {log.length > 0 && (
          <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i} className="text-foreground">{line}</div>
            ))}
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sage font-medium text-sm">
              <CheckCircle className="w-4 h-4" />
              Trip seeded successfully
            </div>
            <a
              href={`/trip/${tripSlug}`}
              className="block w-full text-center bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Open the planning board →
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle className="w-4 h-4" />
            Something went wrong — check the console for details
          </div>
        )}
      </div>
    </div>
  )
}
