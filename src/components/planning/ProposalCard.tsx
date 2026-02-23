import { useState } from 'react'
import { Heart, Lock, Trash2, Pencil, Check, X, Loader2, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Proposal } from '@/types/database'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import { cn } from '@/lib/utils'

interface ProposalCardProps {
  proposal: Proposal
  currentName: string
  isLocked?: boolean
  onVote: (proposalId: string) => void
  onLock?: (proposalId: string) => void
  onDelete?: (proposalId: string) => void
  onEdit?: (proposalId: string, data: { title: string; note: string | null; url: string | null }) => Promise<void>
  className?: string
}

export function ProposalCard({
  proposal,
  currentName,
  isLocked = false,
  onVote,
  onLock,
  onDelete,
  onEdit,
  className,
}: ProposalCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(proposal.title)
  const [savingEdit, setSavingEdit] = useState(false)

  const hasVoted = proposal.votes.includes(currentName)
  const voteCount = proposal.votes.length

  const startEdit = () => {
    setEditTitle(proposal.title)
    setConfirmDelete(false)
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const handleSaveEdit = async () => {
    if (!onEdit || !editTitle.trim()) return
    setSavingEdit(true)
    try {
      await onEdit(proposal.id, {
        title: editTitle.trim(),
        note: proposal.note ?? null,
        url: proposal.url ?? null,
      })
      setEditing(false)
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Edit mode (title only) ────────────────────────────────────────────────
  if (editing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn('py-3', className)}
      >
        <div className="flex gap-2.5">
          <ProposerAvatar name={proposal.proposer_name} size="xs" className="mt-1 shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEdit()
                if (e.key === 'Enter') handleSaveEdit()
              }}
              placeholder="Idea title"
              className="w-full text-sm bg-muted/50 border border-border/70 rounded-lg px-3 py-1.5 outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/50"
            />
            <button
              onClick={cancelEdit}
              className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || savingEdit}
              className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Normal view ──────────────────────────────────────────────────────────
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-start gap-3 py-3', className)}
    >
      <ProposerAvatar name={proposal.proposer_name} size="xs" className="mt-0.5 shrink-0" />

      {/* Title + note + url + proposer */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">
          {proposal.title}
        </p>
        {proposal.note && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {proposal.note}
          </p>
        )}
        {proposal.url && (
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
          >
            <ExternalLink className="w-3 h-3" />
            Link
          </a>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{proposal.proposer_name}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {confirmDelete ? (
          <>
            <button
              onClick={() => onDelete!(proposal.id)}
              className="text-xs text-destructive hover:text-destructive/80 px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
            >
              Delete idea
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {/* Like (collection-style: always show count) */}
            <button
              onClick={() => onVote(proposal.id)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors',
                hasVoted
                  ? 'text-coral bg-coral/10 hover:bg-coral/20'
                  : 'text-muted-foreground/50 hover:text-coral hover:bg-coral/10'
              )}
            >
              <Heart className={cn('w-3.5 h-3.5', hasVoted && 'fill-coral')} />
              <span>{voteCount}</span>
            </button>

            {/* Edit */}
            {onEdit && (
              <button
                onClick={startEdit}
                className="text-muted-foreground/50 hover:text-foreground p-1.5 rounded-full hover:bg-muted transition-colors"
                title="Edit idea"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete idea (also clears lock if this proposal was locked) */}
            {onDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-muted-foreground/50 hover:text-destructive/80 p-1.5 rounded-full hover:bg-destructive/10 transition-colors"
                title={isLocked ? 'Delete idea and unlock slot' : 'Delete idea'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Lock (pick this one from the collection) / locked badge */}
            {isLocked ? (
              <span className="flex items-center gap-1 text-xs text-sage font-medium px-2 py-1">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            ) : onLock ? (
              <button
                onClick={() => onLock(proposal.id)}
                className="text-xs font-medium text-sage/80 hover:text-sage border border-sage/30 hover:border-sage/60 hover:bg-sage/10 px-2.5 py-1 rounded-full transition-colors shrink-0"
              >
                Lock it in
              </button>
            ) : null}
          </>
        )}
      </div>
    </motion.div>
  )
}
