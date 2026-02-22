import { ExternalLink } from 'lucide-react'
import type { SlotWithProposals } from '@/types/database'

interface TimelineItemProps {
  slot: SlotWithProposals
  isLast?: boolean
}

export function TimelineItem({ slot, isLast = false }: TimelineItemProps) {
  const lockedProposal = slot.proposals.find((p) => p.id === slot.locked_proposal_id)

  if (slot.status !== 'locked' || !lockedProposal) {
    return (
      <div className="flex gap-4 group opacity-60">
        <div className="flex flex-col items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-primary/40 shrink-0 mt-1.5" />
          {!isLast && <div className="w-px flex-1 bg-border min-h-[20px]" />}
        </div>
        <div className="pb-4">
          <span className="font-sans text-xs text-primary font-semibold tracking-wide">{slot.time_label}</span>
          <p className="font-sans text-foreground font-medium mt-0.5">Still deciding…</p>
        </div>
      </div>
    )
  }

  const { exact_time, narrative_time, editorial_caption } = lockedProposal
  const displayTime = exact_time ?? narrative_time ?? slot.time_label
  const note = editorial_caption || lockedProposal.note

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors duration-300 mt-1.5 shrink-0" />
        {!isLast && <div className="w-px flex-1 bg-border min-h-[24px]" />}
      </div>
      <div className="pb-4">
        <span className="font-sans text-xs text-primary font-semibold tracking-wide">
          {displayTime}
        </span>
        <p className="font-sans text-foreground font-medium mt-0.5">{lockedProposal.title}</p>
        {note && (
          <p className="font-sans text-sm text-muted-foreground mt-1 italic">{note}</p>
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
    </div>
  )
}
