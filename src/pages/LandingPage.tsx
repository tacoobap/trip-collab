import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, Sparkles, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, firebaseReady } from '@/lib/firebase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export function LandingPage() {
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [destination, setDestination] = useState('')
  const [destinations, setDestinations] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addDestination = () => {
    const trimmed = destination.trim()
    if (trimmed && !destinations.includes(trimmed)) {
      setDestinations([...destinations, trimmed])
      setDestination('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tripName.trim()) return

    setLoading(true)
    setError('')

    const baseSlug = slugify(tripName)
    const slug = `${baseSlug}-${Date.now().toString(36)}`

    try {
      await addDoc(collection(db, 'trips'), {
        name: tripName.trim(),
        slug,
        destinations,
        start_date: startDate || null,
        end_date: endDate || null,
        created_at: serverTimestamp(),
      })
      navigate(`/trip/${slug}`)
    } catch (err) {
      setError('Failed to create trip. Check your Firebase connection.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!firebaseReady && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Firebase not connected.</strong> Create a{' '}
            <code className="bg-amber-100 px-1 rounded font-mono text-xs">.env</code> file with your Firebase config keys, then restart the dev server.
          </div>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-serif font-bold text-foreground mb-3">
              Tripboard
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Plan a trip together. Propose ideas, vote on favorites,<br className="hidden sm:block" />
              lock in the plan — no spreadsheets required.
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Trip name
              </label>
              <Input
                placeholder="e.g. Paris & London · May 2026"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Destinations
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="City (e.g. Paris)"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDestination() } }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addDestination}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {destinations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {destinations.map((d) => (
                    <span
                      key={d}
                      className="flex items-center gap-1 bg-muted text-foreground text-xs rounded-full px-2.5 py-1"
                    >
                      <MapPin className="w-3 h-3" />
                      {d}
                      <button
                        type="button"
                        onClick={() => setDestinations(destinations.filter((x) => x !== d))}
                        className="ml-1 opacity-50 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Start date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  End date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={!tripName.trim() || loading}>
              {loading ? 'Creating…' : 'Create trip →'}
            </Button>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-xs text-muted-foreground mt-6"
          >
            Share the link with anyone to start planning together. No accounts needed.
          </motion.p>
        </div>
      </div>
    </div>
  )
}
