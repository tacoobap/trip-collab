import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Plus, MapPin, Calendar, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db, firebaseReady } from '@/lib/firebase'
import { NewTripDialog } from '@/components/trips/NewTripDialog'
import { Button } from '@/components/ui/button'
import type { Trip } from '@/types/database'

function TripCard({ trip }: { trip: Trip }) {
  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null

  const start = formatDate(trip.start_date)
  const end = formatDate(trip.end_date)
  const dateRange = start && end ? `${start} – ${end}` : start ?? end ?? null

  return (
    <Link to={`/trip/${trip.slug}`}>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className="group bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all h-full"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif font-semibold text-foreground text-base leading-snug group-hover:text-primary transition-colors">
            {trip.name}
          </h3>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="mt-3 space-y-1.5">
          {trip.destinations.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span>{trip.destinations.join(' · ')}</span>
            </div>
          )}
          {dateRange && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{dateRange}</span>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  )
}

export function LandingPage() {
  const [newTripOpen, setNewTripOpen] = useState(false)
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDocs(query(collection(db, 'trips'), orderBy('created_at', 'desc')))
      .then((snap) => {
        setTrips(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip)))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!firebaseReady && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Firebase not connected.</strong> Create a{' '}
            <code className="bg-amber-100 px-1 rounded font-mono text-xs">.env</code> file
            with your Firebase config keys, then restart the dev server.
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-lg font-serif font-bold text-foreground">Tripboard</span>
        </div>
        <Button size="sm" onClick={() => setNewTripOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New trip
        </Button>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : trips.length === 0 ? (
          /* ── Empty state ── */
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center py-24"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-5">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-foreground mb-3">
              Plan trips together.
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-sm mb-8">
              Propose ideas, vote on favorites, lock in the plan —
              no spreadsheets required.
            </p>
            <Button size="lg" onClick={() => setNewTripOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Plan your first trip
            </Button>
          </motion.div>
        ) : (
          /* ── Trip grid ── */
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif font-semibold text-foreground">Trips</h2>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {trips.map((trip, i) => (
                <motion.div
                  key={trip.slug}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <TripCard trip={trip} />
                </motion.div>
              ))}

              {/* New trip card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: trips.length * 0.05 }}
              >
                <button
                  onClick={() => setNewTripOpen(true)}
                  className="w-full h-full min-h-[110px] bg-card border-2 border-dashed border-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">Plan a new trip</span>
                </button>
              </motion.div>
            </motion.div>
          </>
        )}
      </main>

      <NewTripDialog open={newTripOpen} onOpenChange={setNewTripOpen} />
    </div>
  )
}
