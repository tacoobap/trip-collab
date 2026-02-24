import { useState, useRef, useEffect } from 'react'
import { Loader2, ImagePlus, X } from 'lucide-react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadImage } from '@/lib/imageUpload'
import { searchImage } from '@/lib/imageSearch'
import { parseGoogleMapsUrl } from '@/lib/parseGoogleMapsUrl'
import type { CollectionItem, CollectionItemCategory } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const CATEGORIES: { value: CollectionItemCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
]

interface EditCollectionItemFormProps {
  item: CollectionItem
  tripId: string
  destinations: string[]
  onSuccess: () => void
  onCancel: () => void
}

export function EditCollectionItemForm({
  item,
  tripId,
  destinations,
  onSuccess,
  onCancel,
}: EditCollectionItemFormProps) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState<CollectionItemCategory>((item.category as CollectionItemCategory) || 'other')
  const [destination, setDestination] = useState<string | null>(item.destination ?? null)
  const [mapsUrl, setMapsUrl] = useState(item.google_maps_url || '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [fetchedImageUrl, setFetchedImageUrl] = useState<string | null>(item.image_url || null)
  const [fetchImageLoading, setFetchImageLoading] = useState(false)
  const [fetchImageError, setFetchImageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsed = mapsUrl.trim() ? parseGoogleMapsUrl(mapsUrl.trim()) : null
  const searchQuery = parsed ? (parsed.placeName?.trim() || name.trim() || null) : null

  useEffect(() => {
    if (!searchQuery) {
      if (!mapsUrl.trim()) setFetchedImageUrl(item.image_url || null)
      setFetchImageError(null)
      return
    }
    let cancelled = false
    setFetchImageLoading(true)
    setFetchImageError(null)
    searchImage(searchQuery)
      .then((res) => {
        if (!cancelled) {
          setFetchedImageUrl(res.url)
          setFetchImageLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchImageError(err instanceof Error ? err.message : 'Could not fetch image')
          setFetchedImageUrl(null)
          setFetchImageLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [searchQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setUploadPct(0)
    try {
      const updateData: Partial<CollectionItem> = {
        name: name.trim(),
        category,
        destination: destination?.trim() || null,
        google_maps_url: mapsUrl.trim() || null,
        latitude: parsed?.latitude ?? null,
        longitude: parsed?.longitude ?? null,
        place_name: parsed?.placeName ?? null,
        image_url: photoFile ? null : (item.image_url ?? fetchedImageUrl),
      }
      await updateDoc(doc(db, 'collection_items', item.id), updateData)

      if (photoFile) {
        setUploadPct(10)
        const url = await uploadImage(
          `trips/${tripId}/collection/${item.id}.jpg`,
          photoFile,
          (p) => setUploadPct(p)
        )
        await updateDoc(doc(db, 'collection_items', item.id), { image_url: url })
      }

      onSuccess()
    } catch (err) {
      console.error('Update collection item failed', err)
    } finally {
      setLoading(false)
      setPhotoFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Husk, Rainbow Row walk"
          maxLength={300}
          required
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Category
        </label>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-colors',
                category === c.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {destinations.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Destination
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setDestination(null)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full border transition-colors',
                destination === null
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              None
            </button>
            {destinations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDestination(d)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  destination === d
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="min-w-0">
        <label className="block text-sm font-medium text-foreground mb-1">
          Google Maps link (optional)
        </label>
        <Input
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          placeholder="Paste a Google Maps URL"
          type="url"
          className="w-full min-w-0"
        />
        {parsed && (
          <p className="text-xs text-muted-foreground mt-1">
            Location: {parsed.latitude.toFixed(4)}, {parsed.longitude.toFixed(4)}
            {parsed.placeName && ` · ${parsed.placeName}`}
          </p>
        )}
        {fetchImageLoading && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Finding image…
          </p>
        )}
        {fetchedImageUrl && !fetchImageLoading && (
          <div className="mt-2 flex items-center gap-2">
            <img
              src={fetchedImageUrl}
              alt=""
              className="w-16 h-16 rounded-lg object-cover border border-border"
            />
            <span className="text-xs text-muted-foreground">Image found</span>
            <button
              type="button"
              onClick={() => setFetchedImageUrl(null)}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {fetchImageError && !fetchImageLoading && (
          <p className="text-xs text-destructive mt-1">{fetchImageError}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Replace photo (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {photoFile ? photoFile.name : 'Choose new image'}
          </Button>
          {photoFile && (
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null)
                fileInputRef.current && (fileInputRef.current.value = '')
              }}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {loading && photoFile && (
          <p className="text-xs text-muted-foreground mt-1">Uploading… {uploadPct}%</p>
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={!name.trim() || loading} className="flex-1">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
