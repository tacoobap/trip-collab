import { Lock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Proposal } from '@/types/database'

interface LockConfirmProps {
  proposal: Proposal | null
  slotLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  loading?: boolean
}

export function LockConfirm({
  proposal,
  slotLabel,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: LockConfirmProps) {
  if (!proposal) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lock in this idea?</DialogTitle>
          <DialogDescription>
            This will set <strong>{proposal.title}</strong> as the plan for{' '}
            <strong>{slotLabel}</strong>. Everyone on the trip will see it locked in.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-sage/30 bg-sage/5 p-4 my-2">
          <p className="font-semibold text-sm text-foreground">{proposal.title}</p>
          {proposal.note && (
            <p className="text-xs text-muted-foreground mt-1">{proposal.note}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Proposed by {proposal.proposer_name}
            {proposal.votes.length > 0 && ` · ${proposal.votes.length} vote${proposal.votes.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Not yet
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-sage hover:bg-sage/90 text-white"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            {loading ? 'Locking…' : 'Lock it in'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
