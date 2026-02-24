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
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { NamePrompt } from './NamePrompt'
import { useProposerName } from '@/hooks/useProposerName'
import { useTrip } from '@/hooks/useTrip'
import { useCollectionItems } from '@/hooks/useCollectionItems'
import { updateDoc, doc, addDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { suggestCollectionItems } from '@/lib/suggestCollectionItems'
import type { CollectionSuggestion } from '@/lib/suggestCollectionItems'
import { searchImage } from '@/lib/imageSearch'
import type { CollectionItem } from '@/types/database'
import { CollectionItemCard } from '@/components/collection/CollectionItemCard'
import { AddCollectionItemForm } from '@/components/collection/AddCollectionItemForm'
import { EditCollectionItemForm } from '@/components/collection/EditCollectionItemForm'
import { Textarea } from '@/components/ui/textarea'

const OTHER_LABEL = 'Other'

function groupByDestination(
  items: CollectionItem[],
  destinationOrder: string[]
): { label: string; items: CollectionItem[] }[] {
  const sorted = [...items].sort((a, b) => {
    const likesA = a.likes.length
    const likesB = b.likes.length
    if (likesB !== likesA) return likesB - likesA
    return (a.created_at || '').localeCompare(b.created_at || '')
  })
  const map = new Map<string, CollectionItem[]>()
  for (const dest of destinationOrder) {
    map.set(dest, [])
  }
  map.set(OTHER_LABEL, [])
  for (const item of sorted) {
    const dest = item.destination?.trim() || null
    const key = dest && destinationOrder.includes(dest) ? dest : OTHER_LABEL
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return destinationOrder
    .filter((d) => (map.get(d)?.length ?? 0) > 0)
    .map((label) => ({ label, items: map.get(label) ?? [] }))
    .concat(
      (map.get(OTHER_LABEL)?.length ?? 0) > 0
        ? [{ label: OTHER_LABEL, items: map.get(OTHER_LABEL) ?? [] }]
        : []
    )
}

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const { name, setName, clearName, namesUsed } = useProposerName()
  const { trip, days, loading: tripLoading, error } = useTrip(slug)
  const { items, loading: itemsLoading } = useCollectionItems(trip?.id)
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<CollectionItem | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [vibeSentence, setVibeSentence] = useState('')
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<CollectionSuggestion[]>([])
  const [suggestionImageUrls, setSuggestionImageUrls] = useState<Record<number, string>>({})
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())

  const handleGetSuggestions = async () => {
    if (!trip) return
    setSuggestLoading(true)
    setSuggestions([])
    setSuggestionImageUrls({})
    try {
      const { suggestions: list } = await suggestCollectionItems(trip, days, vibeSentence.trim() || null)
      setSuggestions(list)
    } catch (err) {
      console.error('Suggestions failed', err)
      setSuggestions([])
    } finally {
      setSuggestLoading(false)
    }
  }

  // Fetch an image for each suggestion when we have new suggestions
  useEffect(() => {
    if (suggestions.length === 0) return
    suggestions.forEach((s, i) => {
      searchImage(s.name)
        .then((res) => setSuggestionImageUrls((prev) => ({ ...prev, [i]: res.url })))
        .catch(() => {})
    })
  }, [suggestions])

  const handleSaveSuggestion = async (index: number) => {
    const s = suggestions[index]
    if (!trip || !s) return
    await addDoc(collection(db, 'collection_items'), {
      trip_id: trip.id,
      name: s.name,
      category: s.category,
      destination: null,
      image_url: suggestionImageUrls[index] ?? null,
      google_maps_url: null,
      latitude: null,
      longitude: null,
      place_name: null,
      likes: [],
      created_at: serverTimestamp(),
      created_by: name,
    })
    setSavedIds((prev) => new Set(prev).add(index))
  }

  const handleLike = async (itemId: string) => {
    if (!name) return
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    const hasLiked = item.likes.includes(name)
    const newLikes = hasLiked
      ? item.likes.filter((n) => n !== name)
      : [...item.likes, name]
    await updateDoc(doc(db, 'collection_items', itemId), { likes: newLikes })
  }

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Remove this idea from the collection?')) return
    await deleteDoc(doc(db, 'collection_items', itemId))
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
          <a href="/" className="text-sm text-primary hover:underline">
            ← Back to home
          </a>
        </div>
      </div>
    )
  }

  if (!name) {
    return <NamePrompt onSetName={setName} namesUsed={namesUsed} />
  }

  const destinationOrder = trip.destinations?.length ? trip.destinations : []
  const sections = groupByDestination(items, destinationOrder)
  const hasAny = items.length > 0

  return (
    <div className="min-h-screen bg-background">
      <PageHeader trip={trip} currentName={name} onChangeName={clearName} />

      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-br from-muted/30 to-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <h1 className="font-serif text-lg sm:text-xl font-semibold text-foreground">
            Collection
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 mb-6">
            Save ideas for later and add them to the plan when you’re ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setSuggestOpen(true)
                setSuggestions([])
                setSavedIds(new Set())
                setVibeSentence('')
              }}
              variant="default"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Suggest something for me
            </Button>
            <Button
              onClick={() => setAddOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add an idea
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {itemsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAny ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-border bg-muted/20">
            <p className="text-muted-foreground text-sm mb-4">
              No ideas in the collection yet.
            </p>
            <Button onClick={() => setAddOpen(true)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Add the first one
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {sections.map(({ label, items: list }) => (
              <section key={label}>
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
                  {label}
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),min(100%,360px)))] gap-4">
                  {list.map((item) => (
                    <CollectionItemCard
                      key={item.id}
                      item={item}
                      currentName={name}
                      onLike={handleLike}
                      onEdit={setEditItem}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogClose onClick={() => setAddOpen(false)} />
          <DialogHeader>
            <DialogTitle>Add an idea</DialogTitle>
          </DialogHeader>
          <AddCollectionItemForm
            tripId={trip.id}
            destinations={trip.destinations ?? []}
            currentName={name}
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
            <EditCollectionItemForm
              item={editItem}
              tripId={trip.id}
              destinations={trip.destinations ?? []}
              onSuccess={() => setEditItem(null)}
              onCancel={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-6">
          <DialogClose onClick={() => setSuggestOpen(false)} />
          <DialogHeader className="shrink-0">
            <DialogTitle>Suggest something for me</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              We’ll look at your itinerary and open slots and suggest up to 3 places. Add a vibe to narrow it down (optional).
            </p>
          </DialogHeader>
          <div className="flex flex-col min-h-0 flex-1 overflow-y-auto space-y-4">
            <div className="shrink-0">
              <label className="block text-sm font-medium text-foreground mb-1">
                Vibe (optional)
              </label>
              <Textarea
                value={vibeSentence}
                onChange={(e) => setVibeSentence(e.target.value)}
                placeholder="e.g. chill coffee spot, something romantic, kid-friendly"
                rows={2}
                className="resize-none"
              />
            </div>
            {suggestions.length === 0 && !suggestLoading && (
              <Button
                onClick={handleGetSuggestions}
                className="w-full gap-2 shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                Get suggestions
              </Button>
            )}
            {suggestLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground shrink-0">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Finding ideas…</span>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pick what to save
                </p>
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                  >
                    <div className="flex gap-3">
                      {suggestionImageUrls[i] ? (
                        <img
                          src={suggestionImageUrls[i]}
                          alt=""
                          className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted/50 shrink-0 border border-border flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{s.name}</p>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {s.category}
                            </span>
                          </div>
                          {savedIds.has(i) ? (
                            <span className="text-xs text-primary font-medium">Saved</span>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSaveSuggestion(i)}
                              >
                                Save
                              </Button>
                            </div>
                          )}
                        </div>
                        {s.one_line_description && (
                          <p className="text-sm text-muted-foreground">
                            {s.one_line_description}
                          </p>
                        )}
                        {s.suggested_for && (
                          <p className="text-xs text-muted-foreground/80">
                            Suggested for: {s.suggested_for}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGetSuggestions}
                  disabled={suggestLoading}
                  className="w-full"
                >
                  Get more suggestions
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
