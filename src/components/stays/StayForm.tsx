import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapsLinkStatus } from '@/components/shared/MapsLinkStatus'
import { useMapsLinkLocation } from '@/hooks/useMapsLinkLocation'
import { parseGoogleMapsUrl } from '@/lib/parseGoogleMapsUrl'
import type { StayInput } from '@/services/staysService'
import type { Stay, Trip } from '@/types/database'
import { cn } from '@/lib/utils'

/** The "Other" chip: a city that isn't one of the trip's destinations. */
const CUSTOM_CITY = '__custom__'

export interface StayFormProps {
  trip: Trip
  /** When null the form adds a stay; when set, it edits that one. */
  stay: Stay | null
  currentName: string
  getToken?: () => Promise<string | null>
  onSubmit: (data: StayInput) => Promise<void>
  onCancel: () => void
}

export function StayForm({
  trip,
  stay,
  currentName,
  getToken,
  onSubmit,
  onCancel,
}: StayFormProps) {
  const isEdit = stay !== null
  const hasDestinations = trip.destinations.length > 0
  // A stay whose city has since been dropped from the trip still edits as
  // itself, under "Other".
  const cityIsKnown = !!stay && trip.destinations.includes(stay.city)

  const [name, setName] = useState(stay?.name ?? '')
  const [city, setCity] = useState(
    stay
      ? cityIsKnown
        ? stay.city
        : CUSTOM_CITY
      : (trip.destinations[0] ?? CUSTOM_CITY)
  )
  const [customCity, setCustomCity] = useState(stay && !cityIsKnown ? stay.city : '')
  const [checkIn, setCheckIn] = useState(stay?.check_in ?? trip.start_date ?? '')
  const [checkOut, setCheckOut] = useState(stay?.check_out ?? trip.end_date ?? '')
  const [mapsUrl, setMapsUrl] = useState(stay?.google_maps_url ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const effectiveCity = city === CUSTOM_CITY ? customCity.trim() : city

  const location = useMapsLinkLocation({
    url: mapsUrl,
    getToken,
    lookupQuery: [name.trim(), effectiveCity].filter(Boolean).join(', '),
    lookupKey: effectiveCity,
    onLinkName: isEdit
      ? undefined
      : (placeName) => setName((current) => current.trim() || placeName),
  })

  const handleMapsUrlChange = (value: string) => {
    setMapsUrl(value)
    if (!isEdit) {
      const parsed = value.trim() ? parseGoogleMapsUrl(value.trim()) : null
      if (parsed?.placeName && !name.trim()) setName(parsed.placeName)
    }
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    if (!effectiveCity) { setError('City is required.'); return }
    if (!checkIn || !checkOut) { setError('Check-in and check-out are required.'); return }
    if (checkOut <= checkIn) { setError('Check-out must be after check-in.'); return }

    setLoading(true)
    setError('')
    try {
      await onSubmit({
        name: name.trim(),
        city: effectiveCity,
        check_in: checkIn,
        check_out: checkOut,
        // Provenance stays with whoever added it, even when someone else edits.
        proposed_by: stay?.proposed_by ?? currentName,
        google_maps_url: location.effectiveUrl || null,
        latitude: location.position?.latitude ?? null,
        longitude: location.position?.longitude ?? null,
        place_name: location.position?.placeName ?? null,
      })
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      <p className="text-sm font-semibold text-foreground">
        {isEdit ? 'Edit stay' : 'Add a stay'}
      </p>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Property name <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder="e.g. Le Marais Airbnb, Hôtel du Nord"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          autoFocus
          className="text-sm"
        />
      </div>

      <div className="min-w-0">
        <label className="block text-xs font-medium text-foreground mb-1">
          Google Maps link (optional)
        </label>
        <Input
          value={mapsUrl}
          onChange={(e) => handleMapsUrlChange(e.target.value)}
          placeholder="Paste a Maps link to pin it on the collection map"
          type="url"
          className="text-sm w-full min-w-0"
        />
        <MapsLinkStatus location={location} />
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          City <span className="text-destructive">*</span>
        </label>
        {hasDestinations && (
          <div className="flex flex-wrap gap-2">
            {trip.destinations.map((dest) => (
              <button
                key={dest}
                type="button"
                onClick={() => setCity(dest)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  city === dest
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary/40'
                )}
              >
                {dest}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCity(CUSTOM_CITY)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                city === CUSTOM_CITY
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-dashed border-border hover:border-primary/40'
              )}
            >
              Other
            </button>
          </div>
        )}
        {city === CUSTOM_CITY && (
          <Input
            className={cn('text-sm', hasDestinations && 'mt-2')}
            placeholder="City name"
            value={customCity}
            onChange={(e) => {
              setCustomCity(e.target.value)
              setError('')
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Check-in <span className="text-destructive">*</span>
          </label>
          <Input
            type="date"
            value={checkIn}
            min={trip.start_date ?? undefined}
            max={trip.end_date ?? undefined}
            onChange={(e) => setCheckIn(e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Check-out <span className="text-destructive">*</span>
          </label>
          <Input
            type="date"
            value={checkOut}
            min={trip.start_date ?? undefined}
            max={trip.end_date ?? undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="flex-1"
          // Saving mid-lookup would drop the pin the link was about to earn.
          disabled={loading || !name.trim() || location.resolving}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isEdit ? (
            'Save changes'
          ) : (
            'Add stay'
          )}
        </Button>
      </div>
    </form>
  )
}
