import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SlotWithProposals } from '@/types/database'
import { CATEGORY_ICONS } from './SlotIconPicker'
import { cn } from '@/lib/utils'

interface SlotCardProps {
  slot: SlotWithProposals
  onClick: () => void
}

export function SlotCard({ slot, onClick }: SlotCardProps) {
  const isOpen = slot.status === 'open'
  const isProposed = slot.status === 'proposed'
  const isLocked = slot.status === 'locked'

  const lockedProposal = isLocked
    ? slot.proposals.find((p) => p.id === slot.locked_proposal_id)
    : null

  const displayTime = lockedProposal
    ? (lockedProposal.exact_time ?? lockedProposal.narrative_time ?? slot.time_label)
    : slot.time_label

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg p-3 transition-all cursor-pointer',
        'flex flex-col justify-between min-h-[72px]',
        isOpen && 'border border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40',
        isProposed && 'border border-border bg-muted/30 hover:border-border/80 hover:bg-muted/50',
        isLocked && 'border border-blue-500/40 bg-blue-500/5 hover:border-blue-500/60 hover:bg-blue-500/10'
      )}
    >
      {/* Icon + time label */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm shrink-0">{slot.icon ?? CATEGORY_ICONS[slot.category] ?? '📌'}</span>
        <span className="text-xs font-medium text-muted-foreground truncate">
          {displayTime}
        </span>
      </div>

      {/* Content row — always rendered for consistent height */}
      <div className="mt-2">
        {isOpen && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
            <Plus className="w-3 h-3" />
            <span>Add idea</span>
          </div>
        )}

        {isProposed && slot.proposals.length > 0 && (
          <p className="text-xs font-medium text-foreground line-clamp-2 break-words">
            {slot.proposals.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <span className="text-muted-foreground font-normal"> · </span>}
                {p.title}
              </span>
            ))}
          </p>
        )}

        {isLocked && lockedProposal && (
          <p className="text-sm text-foreground line-clamp-1">
            {lockedProposal.title}
          </p>
        )}
      </div>
    </motion.button>
  )
}
