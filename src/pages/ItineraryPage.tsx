import { useRef, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { VibeTagsSection } from '@/components/itinerary/VibeTagsSection'
import { AtAGlanceSection } from '@/components/itinerary/AtAGlanceSection'
import { ItineraryHero } from '@/components/itinerary/ItineraryHero'
import { ItineraryCustomizePanel } from '@/components/itinerary/ItineraryCustomizePanel'
import { ItineraryDaysList } from '@/components/itinerary/ItineraryDaysList'
import { UpdateTextModal } from '@/components/itinerary/UpdateTextModal'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useTrip } from '@/hooks/useTrip'
import { useStays } from '@/hooks/useStays'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDisplayName } from '@/hooks/useDisplayName'
import { uploadImage } from '@/lib/imageUpload'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useNarrativeGeneration } from '@/hooks/useNarrativeGeneration'
import { searchImage } from '@/lib/imageSearch'
import { formatTripDate } from '@/lib/utils'

export function ItineraryPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading: authLoading, getIdToken } = useAuth()
  const { addToast } = useToast()
  const { trip, days, loading, error, isMember } = useTrip(slug, user?.uid)
  const { generate: generateNarrativeResult, error: narrativeError, clearError: clearNarrativeError } = useNarrativeGeneration(trip, days)
  const { displayName } = useDisplayName()
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

  const [updateTextModalOpen, setUpdateTextModalOpen] = useState(false)
  const [updateTextSelections, setUpdateTextSelections] = useState({
    vibe: true,
    dayDescriptions: true,
    activityDescriptions: true,
  })
  const [updateTextDayScopeMode, setUpdateTextDayScopeMode] = useState<'all' | 'selected'>('all')
  const [updateTextSelectedDayIds, setUpdateTextSelectedDayIds] = useState<string[]>([])

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
      addToast('Hero image updated.')
    } catch (err) {
      console.error('Hero upload failed', err)
      addToast('Failed to upload hero image. Try again.', { variant: 'error' })
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
    clearNarrativeError()
    try {
      setGenerateStatus('Writing narrative…')
      const result = await generateNarrativeResult()
      if (!result) {
        setGenerateError(narrativeError || 'Generation failed')
        addToast('Failed to generate narrative.', { variant: 'error' })
        return
      }

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
      const totalDays = daysNeedingTitle.length
      for (let i = 0; i < totalDays; i++) {
        setGenerateStatus(totalDays > 1 ? `Writing day ${i + 1} of ${totalDays}…` : 'Saving days…')
        const d = daysNeedingTitle[i]
        await updateDoc(doc(db, 'days', d.day_id), { narrative_title: d.narrative_title })
      }

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
          const img = await searchImage(d.image_query, getIdToken)
          await updateDoc(doc(db, 'days', d.day_id), {
            image_url: img.url,
            image_attribution: img.attribution,
          })
        } catch {
          if (fullDay?.city) {
            try {
              const img = await searchImage(fullDay.city, getIdToken)
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
      addToast('Narrative generated.')
      setTimeout(() => setGenerateStatus(''), 3000)
    } catch (err) {
      console.error('[handleGenerate]', err)
      const msg = err instanceof Error ? err.message : String(err)
      setGenerateError(msg)
      addToast('Failed to save narrative.', { variant: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const handleUpdateText = async (
    selections: typeof updateTextSelections,
    dayScope: { mode: 'all' | 'selected'; selectedDayIds: string[] }
  ) => {
    if (!trip || generating) return
    const effectiveDayIds =
      dayScope.mode === 'all'
        ? days.map((d) => d.id)
        : dayScope.selectedDayIds

    setGenerating(true)
    setGenerateError('')
    clearNarrativeError()
    setUpdateTextModalOpen(false)
    try {
      setGenerateStatus('Updating…')
      const result = await generateNarrativeResult()
      if (!result) {
        setGenerateError(narrativeError || 'Generation failed')
        addToast('Failed to update text.', { variant: 'error' })
        setGenerating(false)
        return
      }
      setGenerateStatus('Saving…')

      const tripUpdates: { vibe_heading?: string | null; vibe_tags?: typeof result.vibe_tags } = {}
      if (selections.vibe) {
        tripUpdates.vibe_heading = result.vibe_heading ?? null
        tripUpdates.vibe_tags = result.vibe_tags ?? null
      }
      if (Object.keys(tripUpdates).length > 0) {
        await updateDoc(doc(db, 'trips', trip.id), tripUpdates)
      }
      if (selections.dayDescriptions && result.days.length > 0 && effectiveDayIds.length > 0) {
        const daysToUpdate = result.days.filter((d) => effectiveDayIds.includes(d.day_id))
        await Promise.all(
          daysToUpdate.map((d) =>
            updateDoc(doc(db, 'days', d.day_id), { narrative_title: d.narrative_title })
          )
        )
      }
      if (selections.activityDescriptions && result.proposals.length > 0 && effectiveDayIds.length > 0) {
        const allowedProposalIds = new Set<string>()
        for (const day of days) {
          if (!effectiveDayIds.includes(day.id)) continue
          for (const slot of day.slots) {
            for (const p of slot.proposals) allowedProposalIds.add(p.id)
          }
        }
        const proposalsToUpdate = result.proposals.filter((p) => allowedProposalIds.has(p.proposal_id))
        await Promise.all(
          proposalsToUpdate.map((p) =>
            updateDoc(doc(db, 'proposals', p.proposal_id), {
              editorial_caption: p.editorial_caption,
              narrative_time: p.suggested_time ?? null,
            })
          )
        )
      }

      setGenerateStatus('Done!')
      addToast('Text updated.')
      setTimeout(() => setGenerateStatus(''), 3000)
    } catch (err) {
      console.error('[handleUpdateText]', err)
      const msg = err instanceof Error ? err.message : String(err)
      setGenerateError(msg)
      addToast('Failed to update text.', { variant: 'error' })
    } finally {
      setGenerating(false)
    }
  }

  const openUpdateTextModal = () => {
    setUpdateTextSelections({
      vibe: true,
      dayDescriptions: true,
      activityDescriptions: true,
    })
    setUpdateTextDayScopeMode('all')
    setUpdateTextSelectedDayIds(days.map((d) => d.id))
    setUpdateTextModalOpen(true)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-muted-foreground mb-2">{error || 'Trip not found'}</p>
          {!user && (
            <a href="/sign-in" className="text-sm text-primary hover:underline">
              Sign in with Google
            </a>
          )}
          <div className="mt-2">
            <a href="/" className="text-sm text-primary hover:underline">
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-serif font-semibold text-foreground mb-2">
            Sign in to view this trip
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            You need to be signed in to view the itinerary.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={slug ? `/sign-in?from=/trip/${slug}/itinerary` : '/sign-in'}
              className="text-sm text-primary hover:underline"
            >
              Sign in with Google
            </a>
            <a href="/" className="text-sm text-primary hover:underline">
              ← Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }

  const startFmt = formatTripDate(trip.start_date, { month: 'long', day: 'numeric' })
  const endFmt = formatTripDate(trip.end_date, { month: 'long', day: 'numeric' })
  const dateRange = startFmt && endFmt ? `${startFmt} – ${endFmt}` : startFmt ?? endFmt ?? null

  const currentHero = heroPreview ?? heroUrl ?? trip.image_url

  return (
    <div className="min-h-screen bg-background">
      {!scrolledPastHero && (
        <PageHeader
          trip={trip}
          currentName={displayName ?? ''}
          overHero
        />
      )}

      <ItineraryHero
        trip={trip}
        currentHero={currentHero}
        heroRef={heroRef}
        dateRange={dateRange}
      />

      {/* Sticky header in flow when scrolled — fade in for smoother transition */}
      {scrolledPastHero && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <PageHeader
            trip={trip}
            currentName={displayName ?? ''}
          />
        </motion.div>
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

        {isMember && (
          <ItineraryCustomizePanel
            heroUploading={heroUploading}
            heroPct={heroPct}
            onHeroClick={() => heroInputRef.current?.click()}
            onHeroFileChange={handleHeroUpload}
            generating={generating}
            generateStatus={generateStatus}
            generateError={generateError}
            hasExistingNarrative={!!trip.tagline}
            onGenerate={handleGenerate}
            onOpenUpdateModal={openUpdateTextModal}
            heroInputRef={heroInputRef}
          />
        )}

        <UpdateTextModal
          open={updateTextModalOpen}
          onClose={() => setUpdateTextModalOpen(false)}
          selections={updateTextSelections}
          onSelectionsChange={setUpdateTextSelections}
          dayScopeMode={updateTextDayScopeMode}
          onDayScopeModeChange={setUpdateTextDayScopeMode}
          selectedDayIds={updateTextSelectedDayIds}
          onSelectedDayIdsChange={setUpdateTextSelectedDayIds}
          days={days}
          onUpdate={handleUpdateText}
          disabled={
            (!updateTextSelections.vibe &&
              !updateTextSelections.dayDescriptions &&
              !updateTextSelections.activityDescriptions) ||
            ((updateTextSelections.dayDescriptions ||
              updateTextSelections.activityDescriptions) &&
              updateTextDayScopeMode === 'selected' &&
              updateTextSelectedDayIds.length === 0)
          }
        />

        {slug && (
          <ItineraryDaysList slug={slug} days={days} stays={stays} />
        )}

        {/* ── At a Glance ── */}
        {days.length > 0 && <AtAGlanceSection days={days} />}
      </motion.div>
    </div>
  )
}
