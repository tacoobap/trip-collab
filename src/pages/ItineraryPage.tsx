import { useRef, useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { DaySection } from '@/components/itinerary/DaySection'
import { CityDivider } from '@/components/layout/CityDivider'
import { VibeTagsSection } from '@/components/itinerary/VibeTagsSection'
import { AtAGlanceSection } from '@/components/itinerary/AtAGlanceSection'
import { Loader2, Camera, Sparkles, BedDouble } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTrip } from '@/hooks/useTrip'
import { useStays } from '@/hooks/useStays'
import { PageHeader } from '@/components/layout/PageHeader'
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
  const { stays } = useStays(trip?.id)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [heroPreview, setHeroPreview] = useState<string | null>(null)
  const [heroUploading, setHeroUploading] = useState(false)
  const [heroPct, setHeroPct] = useState(0)
  const heroInputRef = useRef<HTMLInputElement>(null)
  const [generating, setGenerating] = useState(false)
  const [generateStatus, setGenerateStatus] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [scrolledPastHero, setScrolledPastHero] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const hero = heroRef.current
      if (!hero) return
      const threshold = hero.getBoundingClientRect().height - 1
      setScrolledPastHero(window.scrollY >= threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])


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
        vibe_heading: result.vibe_heading ?? null,
        vibe_tags: result.vibe_tags ?? null,
      })

      // Step 3: write day narrative titles — only for days that don't have one yet
      const daysNeedingTitle = result.days.filter((d) => {
        const fullDay = days.find((day) => day.id === d.day_id)
        return !fullDay?.narrative_title
      })
      await Promise.all(
        daysNeedingTitle.map((d) =>
          updateDoc(doc(db, 'days', d.day_id), { narrative_title: d.narrative_title })
        )
      )

      // Step 4: write proposal editorial captions + suggested times — only for proposals that don't have one yet
      const proposalsNeedingCaption = result.proposals.filter((p) => {
        for (const day of days) {
          for (const slot of day.slots) {
            const existing = slot.proposals.find((pr) => pr.id === p.proposal_id)
            if (existing) return !existing.editorial_caption
          }
        }
        return true
      })
      await Promise.all(
        proposalsNeedingCaption.map((p) =>
          updateDoc(doc(db, 'proposals', p.proposal_id), {
            editorial_caption: p.editorial_caption,
            narrative_time: p.suggested_time ?? null,
          })
        )
      )

      // Step 5: fetch images only for days that don't already have one
      const daysNeedingImages = result.days.filter((d) => {
        const fullDay = days.find((day) => day.id === d.day_id)
        return !fullDay?.image_url
      })
      for (let i = 0; i < daysNeedingImages.length; i++) {
        const d = daysNeedingImages[i]
        setGenerateStatus(`Finding photos… (${i + 1}/${daysNeedingImages.length})`)
        const fullDay = days.find((day) => day.id === d.day_id)
        try {
          const img = await searchImage(d.image_query)
          await updateDoc(doc(db, 'days', d.day_id), {
            image_url: img.url,
            image_attribution: img.attribution,
          })
        } catch {
          if (fullDay?.city) {
            try {
              const img = await searchImage(fullDay.city)
              await updateDoc(doc(db, 'days', d.day_id), {
                image_url: img.url,
                image_attribution: img.attribution,
              })
            } catch {
              // Non-fatal
            }
          }
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
  function stayForDay(date: string | null): Stay | undefined {
    if (!date) return undefined
    return stays.find((s) => s.check_in <= date && date < s.check_out)
  }

  let lastCity = ''
  let lastStayId = ''

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed overlay when hero is in view */}
      {!scrolledPastHero && (
        <PageHeader
          trip={trip}
          travelers={travelers}
          currentName={name}
          onChangeName={clearName}
          overHero
        />
      )}

      {/* ── Full-viewport hero (Charleston-style) ── */}
      <div
        ref={heroRef}
        className="relative min-h-screen h-[100vh] overflow-hidden bg-gradient-to-br from-navy/80 via-sage/50 to-golden/40"
      >
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

        {/* Gradient overlay + soft fade into next section at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, hsl(var(--background)), transparent)',
          }}
        />

        {/* Trip info — centered, elegant */}
        <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-12">
          <div className="text-center max-w-2xl">
            <motion.h1
              className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal text-white leading-tight tracking-tight mb-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {trip.name}
            </motion.h1>
            {trip.tagline && (() => {
              const withoutTripName = trip.tagline.replace(new RegExp(` · ${trip.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '').trim()
              const displayLine = trip.start_date
                ? `${withoutTripName} · ${new Date(trip.start_date).getFullYear()}`
                : withoutTripName
              return (
                <motion.p
                  className="font-serif text-xs sm:text-sm md:text-base text-white/65 italic font-normal tracking-wide mb-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.45 }}
                >
                  {displayLine}
                </motion.p>
              )
            })()}
            {(trip.destinations.length > 0 || dateRange) && (
              <motion.div
                className="w-12 h-px bg-primary/80 mx-auto my-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              />
            )}
            {trip.destinations.length > 0 && (
              <motion.p
                className="text-white/80 text-base sm:text-lg font-sans font-light tracking-wide mb-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.45 }}
              >
                {trip.destinations.join(' · ')}
              </motion.p>
            )}
            {dateRange && (
              <motion.p
                className="text-white/60 text-sm font-sans font-light"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.45 }}
              >
                {dateRange}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Sticky header in flow when scrolled (same minimal design) */}
      {scrolledPastHero && (
        <PageHeader
          trip={trip}
          travelers={travelers}
          currentName={name}
          onChangeName={clearName}
        />
      )}

      {/* ── Fade-in content block (Charleston-style transition) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: scrolledPastHero ? 1 : undefined }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative -mt-16 pt-4"
      >
        {/* ── Vibe tags ── */}
        {trip.vibe_tags && trip.vibe_tags.length > 0 && (
          <VibeTagsSection
            tags={trip.vibe_tags}
            heading={trip.vibe_heading}
          />
        )}

        {/* Photo + Update text — below the fold */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-4 flex justify-end gap-2">
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all"
            title={currentHero ? 'Change cover photo' : 'Add cover photo'}
          >
            {heroUploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {heroPct}%</>
            ) : (
              <><Camera className="w-3.5 h-3.5" /> {currentHero ? 'Photo' : 'Add photo'}</>
            )}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all disabled:opacity-50"
            title={trip.tagline ? 'Update narrative text' : 'Generate narrative text'}
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {generateStatus || '…'}</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> {trip.tagline ? 'Update text' : 'Generate text'}</>
            )}
          </button>
        </div>
        {generateError && (
          <p className="max-w-3xl mx-auto px-4 sm:px-6 text-[10px] text-destructive/90 text-right -mt-2 pb-2">
            {generateError}
          </p>
        )}

        {/* ── Content ── */}
        {days.length === 0 ? (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-12 text-center">
            <p className="text-muted-foreground text-sm mb-3">Nothing locked in yet.</p>
            <Link to={`/trip/${slug}`} className="text-sm text-primary hover:underline">
              ← Head back to planning
            </Link>
          </div>
        ) : (
          days.map((day, dayIndex) => {
            const showDivider = day.city !== lastCity
            lastCity = day.city
            const dayStay = stayForDay(day.date)
            const showStay = !!dayStay && dayStay.id !== lastStayId
            if (dayStay) lastStayId = dayStay.id

            return (
              <div
                key={day.id}
                className={dayIndex % 2 === 0 ? 'bg-background' : 'bg-sand/40'}
              >
                <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-14">
                  {showDivider && <CityDivider city={day.city} />}

                  {showStay && dayStay && (
                    <div className="mt-4 flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-muted/30 mb-2">
                      <BedDouble className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Staying at</p>
                        <p className="text-sm font-semibold text-foreground">{dayStay.name}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <DaySection day={day} flip={dayIndex % 2 === 1} />
                  </div>
                </div>
              </div>
            )
          })
        )}

        {/* ── At a Glance ── */}
        {days.length > 0 && <AtAGlanceSection days={days} />}
      </motion.div>
    </div>
  )
}
