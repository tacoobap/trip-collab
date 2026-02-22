import { ExternalLink, AlertCircle, CheckCircle2, Hash } from 'lucide-react'
import { motion } from 'framer-motion'
import type { SlotWithProposals } from '@/types/database'
import { CATEGORY_ICONS } from '@/components/planning/SlotIconPicker'

interface TimelineItemProps {
  slot: SlotWithProposals
  index: number
}

export function TimelineItem({ slot, index }: TimelineItemProps) {
  const lockedProposal = slot.proposals.find((p) => p.id === slot.locked_proposal_id)

  if (slot.status !== 'locked' || !lockedProposal) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.4, delay: index * 0.04, ease: 'easeOut' }}
        className="flex gap-5 items-start opacity-35"
      >
        <div className="flex flex-col items-center shrink-0 pt-1">
          <div className="w-9 h-9 rounded-full border-2 border-dashed border-border flex items-center justify-center text-base">
            {slot.icon ?? CATEGORY_ICONS[slot.category] ?? '📌'}
          </div>
          <div className="w-px flex-1 bg-border/50 mt-2 min-h-[32px]" />
        </div>
        <div className="pb-8 min-w-0 flex-1 pt-1">
          <p className="text-xs text-muted-foreground">{slot.time_label}</p>
          <p className="text-sm text-muted-foreground italic mt-0.5">Still deciding…</p>
        </div>
      </motion.div>
    )
  }

  const {
    booking_status,
    exact_time,
    narrative_time,
    confirmation_number,
    confirmation_url,
    editorial_caption,
  } = lockedProposal

  // Priority: manually set exact_time > LLM-suggested narrative_time > slot label
  const displayTime = exact_time ?? narrative_time ?? slot.time_label
  const isClockTime = !!(exact_time ?? narrative_time)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      className="flex gap-5 items-start"
    >
      {/* Left column: icon + line */}
      <div className="flex flex-col items-center shrink-0 pt-1.5">
        <div className="w-9 h-9 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-base">
          {slot.icon ?? CATEGORY_ICONS[slot.category] ?? '📌'}
        </div>
        <div className="w-px flex-1 bg-border/40 mt-2 min-h-[40px]" />
      </div>

      {/* Right column */}
      <div className="pb-10 min-w-0 flex-1">
        {/* Time */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={
              isClockTime
                ? 'text-sm font-semibold tracking-tight text-foreground'
                : 'text-xs font-medium text-muted-foreground uppercase tracking-wider'
            }
          >
            {displayTime}
          </span>
          {booking_status === 'booked' && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Confirmed
            </span>
          )}
          {booking_status === 'needs_booking' && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-2.5 h-2.5" />
              Needs booking
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="font-serif font-semibold text-foreground text-xl leading-snug">
          {lockedProposal.title}
        </h4>

        {/* Editorial caption (LLM-generated) */}
        {editorial_caption && (
          <p className="text-sm text-muted-foreground italic mt-1 leading-relaxed">
            {editorial_caption}
          </p>
        )}

        {/* Raw note fallback */}
        {lockedProposal.note && !editorial_caption && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {lockedProposal.note}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
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
          {confirmation_url && (
            <a
              href={confirmation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Booking
            </a>
          )}
          {confirmation_number && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
              <Hash className="w-3 h-3" />
              {confirmation_number}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
