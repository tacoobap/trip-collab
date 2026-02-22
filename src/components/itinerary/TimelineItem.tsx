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
        className="flex gap-4 items-start opacity-50"
      >
        <div className="flex flex-col items-center shrink-0 pt-2">
          <div className="w-2 h-2 rounded-full bg-primary/40" />
          {!isLast && <div className="w-px flex-1 bg-muted-foreground/20 mt-2 min-h-[28px]" />}
        </div>
        <div className="pb-8 min-w-0 flex-1 pt-1">
          <p className="text-sm text-muted-foreground">{slot.time_label}</p>
          <p className="font-sans font-medium text-foreground/70 mt-0.5">Still deciding…</p>
        </div>
      </motion.div>
    )
  }

  const { exact_time, narrative_time, editorial_caption } = lockedProposal
  const displayTime = exact_time ?? narrative_time ?? slot.time_label
  const isClockTime = !!(exact_time ?? narrative_time)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      className="flex gap-4 items-start"
    >
      {/* Timeline dot + connecting line */}
      <div className="flex flex-col items-center shrink-0 pt-2">
        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
        {!isLast && <div className="w-px flex-1 bg-muted-foreground/25 mt-2 min-h-[36px]" />}
      </div>

      {/* Content */}
      <div className="pb-10 min-w-0 flex-1">
        <p
          className={
            isClockTime
              ? 'text-sm font-normal text-foreground mb-0.5'
              : 'text-sm text-muted-foreground mb-0.5'
          }
        >
          {displayTime}
        </p>

        <h4 className="font-sans font-semibold text-foreground text-lg leading-snug">
          {lockedProposal.title}
        </h4>

        {editorial_caption && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {editorial_caption}
          </p>
        )}

        {lockedProposal.note && !editorial_caption && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {lockedProposal.note}
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
