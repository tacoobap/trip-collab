import { Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SlotWithProposals } from '@/types/database'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
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

  const proposerNames = [...new Set(slot.proposals.map((p) => p.proposer_name))]

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg p-3 transition-all cursor-pointer',
        isOpen && 'border-2 border-dashed border-border/60 bg-background hover:border-primary/30 hover:bg-primary/5',
        isProposed && 'border border-primary/30 bg-primary/5 hover:border-primary/50',
        isLocked && 'border border-sage/30 bg-sage/5 hover:border-sage/50'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">{slot.icon ?? CATEGORY_ICONS[slot.category] ?? '📌'}</span>
          <span className="text-xs font-medium text-muted-foreground truncate">
            {slot.time_label}
          </span>
        </div>
        <StatusBadge
          status={slot.status}
          proposalCount={slot.proposals.length}
          className="shrink-0"
        />
      </div>

      {isOpen && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/60">
          <Plus className="w-3 h-3" />
          <span>Add idea</span>
        </div>
      )}

      {isProposed && (
        <div className="mt-2">
          <p className="text-xs font-medium text-foreground line-clamp-1">
            {slot.proposals[0]?.title}
            {slot.proposals.length > 1 && (
              <span className="text-muted-foreground font-normal"> +{slot.proposals.length - 1} more</span>
            )}
          </p>
          {proposerNames.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 -space-x-1">
              {proposerNames.slice(0, 3).map((name) => (
                <ProposerAvatar key={name} name={name} size="xs" />
              ))}
            </div>
          )}
        </div>
      )}

      {isLocked && lockedProposal && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-foreground line-clamp-1">{lockedProposal.title}</p>
          {lockedProposal.note && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{lockedProposal.note}</p>
          )}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <ProposerAvatar name={lockedProposal.proposer_name} size="xs" showName />
            {lockedProposal.booking_status === 'booked' && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                {lockedProposal.exact_time ?? 'Confirmed'}
              </span>
            )}
            {lockedProposal.booking_status === 'needs_booking' && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 shrink-0">
                <AlertCircle className="w-3 h-3" />
                Book
              </span>
            )}
            {!lockedProposal.booking_status && lockedProposal.exact_time && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                {lockedProposal.exact_time}
              </span>
            )}
          </div>
        </div>
      )}
    </motion.button>
  )
}
