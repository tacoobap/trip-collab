import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { TripLayout } from '@/components/layout/TripLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useDisplayName } from '@/hooks/useDisplayName'
import { useTrip } from '@/hooks/useTrip'
import { useCollectionItems } from '@/hooks/useCollectionItems'
import { useCollectionSuggestions } from '@/hooks/useCollectionSuggestions'
import { useStays } from '@/hooks/useStays'
import {
  addCollectionItem,
  deleteCollectionItem,
  setCollectionItemLikes,
} from '@/services/collectionService'
import { searchImage } from '@/lib/imageSearch'
import type { CollectionItem } from '@/types/database'
import { CollectionItemForm } from '@/components/collection/CollectionItemForm'
import { useTripTools } from '@/components/layout/TripTools'
import { Button } from '@/components/ui/button'
import { CollectionList } from '@/components/collection/CollectionList'
import { CollectionSuggestionsDialog } from '@/components/collection/CollectionSuggestionsDialog'
import { ScheduleIdeaDialog } from '@/components/collection/ScheduleIdeaDialog'
import { TripInvitePreview } from '@/components/marketing/TripInvitePreview'
import {
  TripPeopleProvider,
  useTripPeopleValue,
  toggleMine,
} from '@/contexts/TripPeopleContext'

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading: authLoading, getIdToken } = useAuth()
  const { addToast } = useToast()
  const { displayName } = useDisplayName()
  const { trip, days, loading: tripLoading, error, isMember, isOwner } = useTrip(slug, user?.uid)
  const { isMe } = useTripPeopleValue(trip?.id)
  const { items, loading: itemsLoading } = useCollectionItems(trip?.id)
  const { stays } = useStays(trip?.id)
  const {
    suggestions,
    getSuggestions,
    status: suggestLoading,
    error: suggestError,
    clearError: clearSuggestError,
  } = useCollectionSuggestions(trip, days)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<CollectionItem | null>(null)
  const [scheduleItem, setScheduleItem] = useState<CollectionItem | null>(null)
  const tools = useTripTools({
    trip,
    isMember: isMember ?? false,
    currentName: displayName ?? '',
    userUid: user?.uid,
    getToken: getIdToken,
  })
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [vibeSentence, setVibeSentence] = useState('')
  const [suggestionImageUrls, setSuggestionImageUrls] = useState<Record<number, string>>({})
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (suggestError) {
      addToast('Failed to load suggestions.', { variant: 'error' })
      clearSuggestError()
    }
  }, [suggestError, addToast, clearSuggestError])

  const handleGetSuggestions = () => {
    setSuggestionImageUrls({})
    getSuggestions(vibeSentence.trim() || null)
  }

  // Fetch an image for each suggestion when we have new suggestions
  useEffect(() => {
    if (suggestions.length === 0) return
    suggestions.forEach((s, i) => {
      searchImage(s.name, getIdToken)
        .then((res) => setSuggestionImageUrls((prev) => ({ ...prev, [i]: res.url })))
        .catch(() => {})
    })
  }, [suggestions])

  const handleSaveSuggestion = async (index: number) => {
    const s = suggestions[index]
    if (!trip || !s) return
    await addCollectionItem({
      trip_id: trip.id,
      name: s.name,
      category: s.category,
      destination: null,
      image_url: suggestionImageUrls[index] ?? null,
      google_maps_url: null,
      url: null,
      note: s.one_line_description ?? null,
      latitude: null,
      longitude: null,
      place_name: null,
      created_by: user?.uid ?? '',
      created_by_name: displayName ?? '',
    })
    setSavedIds((prev) => new Set(prev).add(index))
  }

  const handleLike = async (itemId: string) => {
    if (!user) return
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    await setCollectionItemLikes(itemId, toggleMine(item.likes, user.uid, isMe))
  }

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Remove this idea from the collection?')) return
    await deleteCollectionItem(itemId)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Before the trip load, not after: rules deny an unauthenticated read, so
  // waiting only ever lands an invitee on "Trip not found".
  if (!user) {
    return <TripInvitePreview slug={slug} returnTo={slug ? `/trip/${slug}/collection` : undefined} />
  }

  if (tripLoading) {
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
          <a href="/home" className="text-sm text-primary hover:underline">
            ← Back to home
          </a>
        </div>
      </div>
    )
  }

  const destinationOrder = trip.destinations?.length ? trip.destinations : []
  const isMemberBool = isMember === true

  return (
    <TripPeopleProvider tripId={trip.id}>
    <TripLayout
      trip={trip}
      currentName={displayName ?? ''}
      headerActions={tools.buttons}
    >

      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-6 max-sm:py-4">
        {!isMemberBool && (
          <div className="mb-6 max-sm:mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
            <p className="text-sm text-warning-foreground">
              Only trip members can add or edit ideas. Join this trip to contribute to the
              collection.
            </p>
          </div>
        )}
        {isMemberBool && (
          <div className="flex gap-3 mb-6 max-sm:mb-4 max-sm:gap-2">
            <Button
              onClick={() => {
                setSuggestOpen(true)
                setSavedIds(new Set())
                setVibeSentence('')
              }}
              className="gap-2 max-sm:flex-1 max-sm:justify-center max-sm:min-h-[44px]"
            >
              <Sparkles className="w-4 h-4" />
              <span className="sm:hidden">Suggest</span>
              <span className="hidden sm:inline">Suggest something for me</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddOpen(true)}
              className="gap-2 max-sm:flex-1 max-sm:justify-center max-sm:min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span className="sm:hidden">Add idea</span>
              <span className="hidden sm:inline">Add an idea</span>
            </Button>
          </div>
        )}
        <CollectionList
          itemsLoading={itemsLoading}
          items={items}
          stays={stays}
          destinationOrder={destinationOrder}
          isMember={isMemberBool}
          isOwner={isOwner ?? false}
          onLike={handleLike}
          onEdit={setEditItem}
          onDelete={handleDelete}
          onSchedule={days.length > 0 ? setScheduleItem : undefined}
          onAddClick={() => setAddOpen(true)}
        />
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogClose onClick={() => setAddOpen(false)} />
          <DialogHeader>
            <DialogTitle>Add an idea</DialogTitle>
          </DialogHeader>
          <CollectionItemForm
            item={null}
            tripId={trip.id}
            destinations={trip.destinations ?? []}
            currentName={displayName ?? ''}
            getToken={getIdToken}
            onSuccess={() => setAddOpen(false)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogClose onClick={() => setEditItem(null)} />
          <DialogHeader>
            <DialogTitle>Edit idea</DialogTitle>
          </DialogHeader>
          {editItem && (
            <CollectionItemForm
              item={editItem}
              tripId={trip.id}
              destinations={trip.destinations ?? []}
              currentName={displayName ?? ''}
              getToken={getIdToken}
              onSuccess={() => setEditItem(null)}
              onCancel={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ScheduleIdeaDialog
        open={!!scheduleItem}
        onOpenChange={(open) => !open && setScheduleItem(null)}
        item={scheduleItem}
        tripId={trip.id}
        days={days}
        currentName={displayName ?? ''}
        onScheduled={(day, timeRange) => {
          setScheduleItem(null)
          addToast(
            timeRange
              ? `Added to ${day.label}, ${timeRange}.`
              : `Added to ${day.label} — sometime this day.`,
            { variant: 'success' }
          )
        }}
        onError={() => addToast('Could not add it to that day.', { variant: 'error' })}
      />

      {tools.drawers}

      <CollectionSuggestionsDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        suggestions={suggestions}
        suggestLoading={suggestLoading}
        vibeSentence={vibeSentence}
        onVibeChange={setVibeSentence}
        onGetSuggestions={handleGetSuggestions}
        suggestionImageUrls={suggestionImageUrls}
        savedIds={savedIds}
        onSaveSuggestion={handleSaveSuggestion}
      />
    </TripLayout>
    </TripPeopleProvider>
  )
}
