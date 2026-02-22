import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SlotWithProposals } from '@/types/database'

interface TimelineItemProps {
  slot: SlotWithProposals
  index: number
  isLast?: boolean
}

export function TimelineItem({ slot, index, isLast = false }: TimelineItemProps) {
  const lockedProposal = slot.proposals.find((p) => p.id === slot.locked_proposal_id)

  if (slot.status !== 'locked' || !lockedProposal) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.4, delay: index * 0.04, ease: 'easeOut' }}
        className="relative flex items-start opacity-50"
      >
        <div className="absolute -left-8 top-2.5 w-2.5 h-2.5 rounded-full bg-primary/40 shrink-0" />
        <div className="pb-10 min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-bold font-sans text-primary">{slot.time_label}</p>
          <p className="font-sans font-semibold text-[#333333] mt-1">Still deciding…</p>
        </div>
      </motion.div>
    )
  }

  const { exact_time, narrative_time, editorial_caption } = lockedProposal
  const displayTime = exact_time ?? narrative_time ?? slot.time_label

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      className="relative flex items-start"
    >
      {/* Timeline dot (sits on the vertical line from DaySection) */}
      <div className="absolute -left-8 top-2.5 w-2.5 h-2.5 rounded-full bg-primary shrink-0 shadow-sm" aria-hidden />

      {/* Content */}
      <div className="pb-10 min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-bold font-sans text-primary">
          {displayTime}
        </p>

        <h4 className="font-sans font-semibold text-[#333333] text-base sm:text-lg leading-snug mt-1">
          {lockedProposal.title}
        </h4>

        {(editorial_caption || lockedProposal.note) && (
          <p className="text-sm font-normal text-[#6C757D] mt-1 leading-relaxed">
            {editorial_caption || lockedProposal.note}
          </p>
        )}

        {lockedProposal.url && (
          <a
            href={lockedProposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2 font-medium"
          >
            <ExternalLink className="w-3 h-3" />
            Details
          </a>
        )}
      </div>
    </motion.div>
  )
}
