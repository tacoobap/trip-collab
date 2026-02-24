import { useState, useRef, useEffect } from 'react'
import { Loader2, ImagePlus, X } from 'lucide-react'
import { addDoc, collection, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadImage } from '@/lib/imageUpload'
import { searchImage } from '@/lib/imageSearch'
import { parseGoogleMapsUrl } from '@/lib/parseGoogleMapsUrl'
import type { CollectionItemCategory } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface AddCollectionItemFormProps {
  tripId: string
  destinations: string[]
  currentName: string
  onSuccess: () => void
  onCancel: () => void
}

const CATEGORIES: { value: CollectionItemCategory; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
]

export function AddCollectionItemForm({
  tripId,
  destinations,
  currentName,
  onSuccess,
  onCancel,
}: AddCollectionItemFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CollectionItemCategory>('other')
  const [destination, setDestination] = useState<string | null>(null)
  const [mapsUrl, setMapsUrl] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [fetchedImageUrl, setFetchedImageUrl] = useState<string | null>(null)
  const [fetchImageLoading, setFetchImageLoading] = useState(false)
  const [fetchImageError, setFetchImageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsed = mapsUrl.trim() ? parseGoogleMapsUrl(mapsUrl.trim()) : null

  // When we have a Google Maps URL, fetch an image from Unsplash: use place name from URL, or the name field
  const searchQuery = parsed
    ? (parsed.placeName?.trim() || name.trim() || null)
    : null

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:useEffect',message:'image effect',data:{searchQuery:searchQuery||null,hasSearchQuery:!!searchQuery},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!searchQuery) {
      setFetchedImageUrl(null)
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
          const msg = err instanceof Error ? err.message : 'Could not fetch image'
          // #region agent log
          fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:searchImage.catch',message:'searchImage failed',data:{errorMessage:msg},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          setFetchImageError(msg)
          setFetchedImageUrl(null)
          setFetchImageLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [searchQuery])

  // When a Maps URL is pasted and we extract a place name, fill the name field if it's empty
  const handleMapsUrlChange = (value: string) => {
    setMapsUrl(value)
    const result = value.trim() ? parseGoogleMapsUrl(value.trim()) : null
    // #region agent log
    fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:handleMapsUrlChange',message:'Maps URL changed',data:{urlLength:value.length,placeName:result?.placeName ?? null,nameAtCall:name,willSetName:!!(result?.placeName && !name.trim())},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (result?.placeName && !name.trim()) setName(result.placeName)
    if (!result?.placeName) setFetchedImageUrl(null)
    setSubmitError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitError(null)
    setLoading(true)
    setUploadPct(0)
    // #region agent log
    fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:handleSubmit.start',message:'submit start',data:{hasPhotoFile:!!photoFile,hasFetchedImageUrl:!!fetchedImageUrl},hypothesisId:'H3 H5',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const docData = {
        trip_id: tripId,
        name: name.trim(),
        category,
        destination: destination?.trim() || null,
        image_url: (photoFile ? null : fetchedImageUrl) as string | null,
        google_maps_url: mapsUrl.trim() || null,
        latitude: parsed?.latitude ?? null,
        longitude: parsed?.longitude ?? null,
        place_name: parsed?.placeName ?? null,
        likes: [] as string[],
        created_at: serverTimestamp(),
        created_by: currentName,
      }
      const ref = await addDoc(collection(db, 'collection_items'), docData)
      const docId = ref.id
      // #region agent log
      fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:afterAddDoc',message:'doc created',data:{docId,willUploadPhoto:!!photoFile},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (photoFile) {
        setUploadPct(10)
        // #region agent log
        fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:beforeUpload',message:'entering upload block',data:{},hypothesisId:'H3 H4',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const url = await uploadImage(
          `trips/${tripId}/collection/${docId}.jpg`,
          photoFile,
          (p) => setUploadPct(p)
        )
        // #region agent log
        fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:afterUpload',message:'upload done',data:{urlLength:url?.length},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        await updateDoc(doc(db, 'collection_items', docId), { image_url: url })
      }

      onSuccess()
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7610/ingest/f2b541e2-014a-40b9-bc7b-f2c09dbf8f20',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'92ebb8'},body:JSON.stringify({sessionId:'92ebb8',location:'AddCollectionItemForm.tsx:catch',message:'submit failed',data:{errorMessage:err instanceof Error ? err.message : String(err)},hypothesisId:'H2 H3 H4',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitError(msg)
      console.error('Add collection item failed', err)
    } finally {
      setLoading(false)
      setPhotoFile(null)
      setFetchedImageUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Google Maps link (optional)
        </label>
        <Input
          value={mapsUrl}
          onChange={(e) => handleMapsUrlChange(e.target.value)}
          placeholder="Paste a Google Maps URL to extract name and location"
          type="url"
          className="w-full"
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
        {fetchImageError && !fetchImageLoading && (
          <p className="text-xs text-destructive mt-1">{fetchImageError}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
        <div className="min-w-0">
          <label className="block text-sm font-medium text-foreground mb-1">
            Name <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSubmitError(null)
            }}
            placeholder="e.g. Husk, Rainbow Row walk (or paste Maps link above)"
            maxLength={300}
            required
            className="w-full"
          />
        </div>
        <div className="shrink-0">
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
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Photo (optional)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {fetchedImageUrl && !photoFile && (
            <div className="flex items-center gap-2">
              <img
                src={fetchedImageUrl}
                alt=""
                className="w-14 h-14 rounded-lg object-cover border border-border"
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
          {photoFile && (
            <div className="flex items-center gap-2">
              <img
                src={URL.createObjectURL(photoFile)}
                alt=""
                className="w-14 h-14 rounded-lg object-cover border border-border"
              />
              <span className="text-xs text-muted-foreground truncate max-w-28">{photoFile.name}</span>
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null)
                  fileInputRef.current && (fileInputRef.current.value = '')
                }}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
            setPhotoFile(e.target.files?.[0] ?? null)
            setSubmitError(null)
          }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {photoFile ? photoFile.name : 'Choose image'}
          </Button>
          {loading && photoFile && (
            <span className="text-xs text-muted-foreground">Uploading… {uploadPct}%</span>
          )}
        </div>
      </div>
      {submitError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {submitError}
        </p>
      )}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={!name.trim() || loading} className="flex-1">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Add to collection'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
