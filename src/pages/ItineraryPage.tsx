import { useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { DaySection } from '@/components/itinerary/DaySection'
import { CityDivider } from '@/components/layout/CityDivider'
import { VibeTagsSection } from '@/components/itinerary/VibeTagsSection'
import { AtAGlanceSection } from '@/components/itinerary/AtAGlanceSection'
import { Loader2, Share2, Camera, Sparkles, BedDouble, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTrip } from '@/hooks/useTrip'
import { useTripNotes } from '@/hooks/useTripNotes'
import { useStays } from '@/hooks/useStays'
import { PageHeader } from '@/components/layout/PageHeader'
import { TripNotesDrawer } from '@/components/planning/TripNotesDrawer'
import { StaysDrawer } from '@/components/stays/StaysDrawer'
import { useProposerName } from '@/hooks/useProposerName'
import { uploadImage } from '@/lib/imageUpload'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Stay } from '@/types/database'
import { generateNarrative } from '@/lib/generateNarrative'
import { searchImage } from '@/lib/imageSearch'
import { formatTripDate } from '@/lib/utils'

export function ItineraryPage() {
  const { slug } = useParams<{ slug: string }>()
  const { trip, days, travelers, loading, error } = useTrip(slug)
  const { name, clearName } = useProposerName()
  const { notes, addNote, deleteNote } = useTripNotes(trip?.id)
  const { stays, addStay, updateStay, deleteStay } = useStays(trip?.id)

  const [copied, setCopied] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [staysOpen, setStaysOpen] = useState(false)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [heroPreview, setHeroPreview] = useState<string | null>(null)
  const [heroUploading, setHeroUploading] = useState(false)
  const [heroPct, setHeroPct] = useState(0)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const [generating, setGenerating] = useState(false)
  const [generateStatus, setGenerateStatus] = useState('')
  const [generateError, setGenerateError] = useState('')

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !trip) return

    // Show the local file immediately — no CDN round-trip needed
    const preview = URL.createObjectURL(file)
    setHeroPreview(preview)

    setHeroUploading(true)
    setHeroPct(0)
    try {
      const url = await uploadImage(`trips/${trip.id}/hero.jpg`, file, setHeroPct)
      await updateDoc(doc(db, 'trips', trip.id), { image_url: url })
      setHeroUrl(url)
    } catch (err) {
      console.error('Hero upload failed', err)
      URL.revokeObjectURL(preview)
      setHeroPreview(null)
    } finally {
      setHeroUploading(false)
      if (heroInputRef.current) heroInputRef.current.value = ''
    }
  }

  const handleGenerate = async () => {
    if (!trip || generating) return
    setGenerating(true)
    setGenerateError('')
    try {
      // Step 1: generate narrative copy from the LLM
      setGenerateStatus('Writing narrative…')
      const result = await generateNarrative(trip, days)

      // Step 2: write trip-level fields
      setGenerateStatus('Saving narrative…')
      await updateDoc(doc(db, 'trips', trip.id), {
        tagline: result.tagline ?? null,
        vibe_tags: result.vibe_tags ?? null,
      })

      // Step 3: write day narrative titles
      await Promise.all(
        result.days.map((d) =>
          updateDoc(doc(db, 'days', d.day_id), { narrative_title: d.narrative_title })
        )
      )

      // Step 4: write proposal editorial captions + suggested times
      await Promise.all(
        result.proposals.map((p) =>
          updateDoc(doc(db, 'proposals', p.proposal_id), {
            editorial_caption: p.editorial_caption,
            narrative_time: p.suggested_time ?? null,
          })
        )
      )

      // Step 5: fetch and store a hero image for each day that has an image_query
      const daysWithQuery = result.days.filter((d) => d.image_query)
      for (let i = 0; i < daysWithQuery.length; i++) {
        const d = daysWithQuery[i]
        setGenerateStatus(`Finding photos… (${i + 1}/${daysWithQuery.length})`)
        try {
          const img = await searchImage(d.image_query)
          await updateDoc(doc(db, 'days', d.day_id), {
            image_url: img.url,
            image_attribution: img.attribution,
          })
        } catch {
          // Non-fatal — skip missing images silently
        }
      }

      setGenerateStatus('Done!')
      setTimeout(() => setGenerateStatus(''), 3000)
    } catch (err) {
      console.error('[handleGenerate]', err)
      const msg = err instanceof Error ? err.message : String(err)
      setGenerateError(msg)
    } finally {
      setGenerating(false)
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

  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null

  // heroPreview = local blob URL shown instantly on file select (bypasses CDN cache)
  // heroUrl    = confirmed remote URL after upload completes
  const currentHero = heroPreview ?? heroUrl ?? trip.image_url
  const bookedStays = stays.filter((s) => s.status === 'booked')

  function stayForDay(date: string | null): Stay | undefined {
    if (!date) return undefined
    return bookedStays.find((s) => s.check_in <= date && date < s.check_out)
  }

  let lastCity = ''
  let lastStayId = ''

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

      {/* ── Hero ── */}
      <div className="relative h-[62vh] overflow-hidden bg-gradient-to-br from-navy/80 via-sage/50 to-golden/40">
        {currentHero && (
          <motion.img
            src={currentHero}
            alt={trip.name}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1 }}
            animate={{ scale: 1.08 }}
            transition={{
              duration: 20,
              ease: 'linear',
              repeat: Infinity,
              repeatType: 'reverse',
            }}
          />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />

        {/* Trip info — bottom left */}
        <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-12 pb-10">
          <motion.p
            className="text-white/50 text-[10px] uppercase tracking-[0.3em] mb-3"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
          >
            Final Itinerary
          </motion.p>
          <motion.h1
            className="text-4xl sm:text-6xl font-serif font-bold text-white leading-tight mb-2"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.6 }}
          >
            {trip.name}
          </motion.h1>
          {trip.tagline && (
            <motion.p
              className="text-white/70 text-base sm:text-lg italic mb-1"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.5 }}
            >
              {trip.tagline}
            </motion.p>
          )}
          {trip.destinations.length > 0 && (
            <motion.p
              className="text-white/80 text-lg sm:text-xl"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
            >
              {trip.destinations.join(' · ')}
            </motion.p>
          )}
          {dateRange && (
            <motion.p
              className="text-white/50 text-sm mt-1"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56, duration: 0.5 }}
            >
              {dateRange}
            </motion.p>
          )}
        </div>

        {/* Actions — top right */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <input
              ref={heroInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHeroUpload}
            />
            <button
              onClick={() => heroInputRef.current?.click()}
              disabled={heroUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white text-xs font-medium border border-white/20 hover:bg-black/40 transition-all"
            >
              {heroUploading ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> {heroPct}%</>
              ) : (
                <><Camera className="w-3 h-3" /> {currentHero ? 'Change photo' : 'Add cover photo'}</>
              )}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white text-xs font-medium border border-white/20 hover:bg-black/40 transition-all disabled:opacity-60"
            >
              {generating ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> {generateStatus || 'Generating…'}</>
              ) : (
                <><Sparkles className="w-3 h-3" /> {trip.tagline ? 'Regenerate' : 'Generate narrative'}</>
              )}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white text-xs font-medium border border-white/20 hover:bg-black/40 transition-all"
            >
              <Share2 className="w-3 h-3" />
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
          {generateError && (
            <p className="text-xs text-red-300 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg max-w-xs text-right">
              {generateError}
            </p>
          )}
        </div>
      </div>

      {/* ── Vibe tags ── */}
      {trip.vibe_tags && trip.vibe_tags.length > 0 && (
        <VibeTagsSection tags={trip.vibe_tags} />
      )}

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-14 pb-0">
        {days.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-muted-foreground text-sm mb-3">Nothing locked in yet.</p>
            <Link to={`/trip/${slug}`} className="text-sm text-primary hover:underline">
              ← Head back to planning
            </Link>
          </div>
        ) : (
          days.map((day) => {
            const showDivider = day.city !== lastCity
            lastCity = day.city
            const dayStay = stayForDay(day.date)
            const showStay = !!dayStay && dayStay.id !== lastStayId
            if (dayStay) lastStayId = dayStay.id

            return (
              <div key={day.id}>
                {showDivider && <CityDivider city={day.city} />}

                {showStay && dayStay && (
                  <div className="mt-4 flex items-start gap-3 px-4 py-3 border border-border rounded-xl bg-muted/30 mb-2">
                    <BedDouble className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Staying at</p>
                      <p className="text-sm font-semibold text-foreground">{dayStay.name}</p>
                      {dayStay.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{dayStay.notes}</p>
                      )}
                    </div>
                    {dayStay.url && (
                      <a href={dayStay.url} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}

                <div className="mt-6">
                  <DaySection day={day} />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── At a Glance ── */}
      {days.length > 0 && <AtAGlanceSection days={days} />}

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
        onAdd={(text) => addNote(text, name ?? 'Anonymous')}
        onDelete={deleteNote}
      />
    </div>
  )
}
