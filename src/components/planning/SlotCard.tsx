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
        'w-full text-left rounded-lg p-4 transition-all cursor-pointer',
        'flex flex-col justify-between min-h-[88px]',
        isOpen && 'border border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40',
        isProposed && 'border border-border bg-muted/30 hover:border-border/80 hover:bg-muted/50',
        isLocked && 'border border-blue-500/40 bg-blue-500/5 hover:border-blue-500/60 hover:bg-blue-500/10'
      )}
    >
      {/* Icon + time label */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{slot.icon ?? CATEGORY_ICONS[slot.category] ?? '📌'}</span>
        <span className="text-sm font-medium text-muted-foreground truncate">
          {displayTime}
        </span>
      </div>

      {/* Content row — always rendered for consistent height */}
      <div className="mt-2.5">
        {isOpen && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground/50">
            <Plus className="w-3.5 h-3.5" />
            <span>Add idea</span>
          </div>
        )}

        {isProposed && slot.proposals.length > 0 && (
          <p className="text-sm font-medium text-foreground line-clamp-2 break-words">
            {slot.proposals.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <span className="text-muted-foreground font-normal"> · </span>}
                {p.title}
              </span>
            ))}
          </p>
        )}

        {isLocked && lockedProposal && (
          <p className="text-base text-foreground line-clamp-1 font-medium">
            {lockedProposal.title}
          </p>
        )}
      </div>
    </motion.button>
  )
}
