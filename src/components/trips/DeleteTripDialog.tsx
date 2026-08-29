import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Trip } from '@/types/database'

interface DeleteTripDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: Trip
  getIdToken: () => Promise<string | null>
  onDeleted: (tripId: string) => void
}

/**
 * Confirmation for permanently deleting a trip. Irreversible and cascading, so
 * it asks the owner to type the trip name rather than relying on one stray click.
 */
export function DeleteTripDialog({
  open,
  onOpenChange,
  trip,
  getIdToken,
  onDeleted,
}: DeleteTripDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const matches = confirmText.trim() === trip.name.trim()

  const close = () => {
    if (loading) return
    setConfirmText('')
    setError('')
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!matches || loading) return
    setLoading(true)
    setError('')
    try {
      const idToken = await getIdToken()
      if (!idToken) throw new Error('Sign in again to delete this trip.')
      const res = await fetch('/.netlify/functions/delete-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ tripId: trip.id }),
      })
      const data = (await res.json()) as { deleted?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not delete the trip.')
      onDeleted(trip.id)
      setConfirmText('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Delete this trip?</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This permanently removes <span className="font-medium text-foreground">{trip.name}</span>{' '}
              and everything in it — every day, slot, idea, stay and collection item, for all
              members. It can't be undone, and any share link stops working.
            </p>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">
              Type <span className="font-medium text-foreground">{trip.name}</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={loading}
              autoFocus
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm outline-none focus:border-destructive/50 disabled:opacity-50"
              placeholder={trip.name}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!matches || loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete permanently
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
