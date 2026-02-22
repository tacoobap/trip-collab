import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SlotWithProposals } from '@/types/database'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'

interface TimelineItemProps {
  slot: SlotWithProposals
  index: number
}

const CATEGORY_ICONS: Record<string, string> = {
  food: '🍽',
  activity: '🎭',
  travel: '✈️',
  accommodation: '🏨',
  vibe: '✨',
}

export function TimelineItem({ slot, index }: TimelineItemProps) {
  const lockedProposal = slot.proposals.find((p) => p.id === slot.locked_proposal_id)

  if (slot.status !== 'locked' || !lockedProposal) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.08 }}
        className="flex gap-4 items-start opacity-40"
      >
        <div className="flex flex-col items-center shrink-0 pt-1">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center text-sm">
            {CATEGORY_ICONS[slot.category] ?? '📌'}
          </div>
          <div className="w-px flex-1 bg-border mt-2 min-h-[24px]" />
        </div>
        <div className="pb-6 min-w-0 flex-1">
          <p className="text-xs text-muted-foreground font-medium">{slot.time_label}</p>
          <p className="text-sm text-muted-foreground italic mt-0.5">Still deciding…</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex gap-4 items-start"
    >
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm">
          {CATEGORY_ICONS[slot.category] ?? '📌'}
        </div>
        <div className="w-px flex-1 bg-border mt-2 min-h-[24px]" />
      </div>

      <div className="pb-6 min-w-0 flex-1">
        <p className="text-xs text-muted-foreground font-medium">{slot.time_label}</p>
        <h4 className="font-serif font-semibold text-foreground mt-0.5 text-lg leading-tight">
          {lockedProposal.title}
        </h4>
        {lockedProposal.note && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{lockedProposal.note}</p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <ProposerAvatar
            name={lockedProposal.proposer_name}
            size="xs"
            showName
            className="text-xs text-muted-foreground"
          />
          {lockedProposal.url && (
            <a
              href={lockedProposal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Details
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}
