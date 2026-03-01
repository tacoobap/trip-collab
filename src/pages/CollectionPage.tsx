import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useDisplayName } from '@/hooks/useDisplayName'
import { useTrip } from '@/hooks/useTrip'
import { useCollectionItems } from '@/hooks/useCollectionItems'
import { useCollectionSuggestions } from '@/hooks/useCollectionSuggestions'
import {
  addCollectionItem,
  deleteCollectionItem,
  setCollectionItemLikes,
} from '@/services/collectionService'
import { searchImage } from '@/lib/imageSearch'
import type { CollectionItem } from '@/types/database'
import { CollectionItemForm } from '@/components/collection/CollectionItemForm'
import { CollectionHeader } from '@/components/collection/CollectionHeader'
import { CollectionList } from '@/components/collection/CollectionList'
import { CollectionSuggestionsDialog } from '@/components/collection/CollectionSuggestionsDialog'

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user, loading: authLoading, getIdToken } = useAuth()
  const { addToast } = useToast()
  const { displayName } = useDisplayName()
  const { trip, days, loading: tripLoading, error, isMember, isOwner } = useTrip(slug, user?.uid)
  const { items, loading: itemsLoading } = useCollectionItems(trip?.id)
  const {
    suggestions,
    getSuggestions,
    status: suggestLoading,
    error: suggestError,
    clearError: clearSuggestError,
  } = useCollectionSuggestions(trip, days)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<CollectionItem | null>(null)
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
      created_by: displayName ?? '',
    })
    setSavedIds((prev) => new Set(prev).add(index))
  }

  const handleLike = async (itemId: string) => {
    if (!displayName) return
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const hasLiked = item.likes.includes(displayName)
    const newLikes = hasLiked
      ? item.likes.filter((n) => n !== displayName)
      : [...item.likes, displayName]
    await setCollectionItemLikes(itemId, newLikes)
  }

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Remove this idea from the collection?')) return
    await deleteCollectionItem(itemId)
  }

  if (authLoading || tripLoading) {
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
          {!user && (
            <p className="text-sm text-muted-foreground mb-4">Sign in to view this trip.</p>
          )}
          <div className="flex flex-col gap-2">
            {!user && (
              <a href="/sign-in" className="text-sm text-primary hover:underline">
                Sign in with Google
              </a>
            )}
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
            You need to be signed in to access the collection.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={slug ? `/sign-in?from=/trip/${slug}/collection` : '/sign-in'}
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

  const destinationOrder = trip.destinations?.length ? trip.destinations : []
  const isMemberBool = isMember === true

  return (
    <div className="min-h-screen bg-background">
      <PageHeader trip={trip} currentName={displayName ?? ''} />

      <CollectionHeader
        isMember={isMemberBool}
        onSuggestClick={() => {
          setSuggestOpen(true)
          setSavedIds(new Set())
          setVibeSentence('')
        }}
        onAddClick={() => setAddOpen(true)}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 max-sm:py-4">
        <CollectionList
          itemsLoading={itemsLoading}
          items={items}
          destinationOrder={destinationOrder}
          displayName={displayName ?? ''}
          isMember={isMemberBool}
          isOwner={isOwner ?? false}
          onLike={handleLike}
          onEdit={setEditItem}
          onDelete={handleDelete}
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
    </div>
  )
}
