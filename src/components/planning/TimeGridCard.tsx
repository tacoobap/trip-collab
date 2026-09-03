import { Plus } from 'lucide-react'
import type { SlotWithProposals } from '@/types/database'
import { CATEGORY_ICONS } from '@/lib/slotEmojis'
import { formatMinuteRange, lockedProposalOf } from '@/lib/timeGrid'
import { cn } from '@/lib/utils'

interface TimeGridCardProps {
  slot: SlotWithProposals
  start: number
  duration: number
  top: number
  height: number
  col: number
  cols: number
  /** Mid-drag: elevated, no transitions. */
  held?: boolean
  /** Mid-drag over a shelf: about to be unscheduled. */
  fading?: boolean
  canEdit?: boolean
}

/**
 * A slot on the timeline. Same visual states as the old stacked SlotCard —
 * open / proposed / locked — positioned and sized by its schedule.
 */
export function TimeGridCard({
  slot,
  start,
  duration,
  top,
  height,
  col,
  cols,
  held = false,
  fading = false,
  canEdit = true,
}: TimeGridCardProps) {
  const isLocked = slot.status === 'locked'
  const lockedProposal = lockedProposalOf(slot)
  const hasProposals = slot.proposals.length > 0
  const isOpen = !isLocked && !hasProposals
  const isProposed = !isLocked && hasProposals

  const slim = height <= 50
  const showMicro = isProposed && height >= 92

  const title = isLocked
    ? lockedProposal?.title ?? slot.time_label
    : slot.proposals.map((p) => p.title).join(' · ')

  const placement =
    cols > 1
      ? {
          width: `calc((100% - 4px) / ${cols})`,
          left: `calc((100% - 4px) * ${col} / ${cols} + ${col * 4}px)`,
        }
      : { left: 0, right: 4 }

  return (
    <div
      data-slot-id={slot.id}
      tabIndex={0}
      role="button"
      aria-label={`${isOpen ? 'Open slot' : title}, ${formatMinuteRange(start, duration)}`}
      className={cn(
        'group absolute overflow-hidden rounded-lg touch-none outline-none',
        slim ? 'px-2.5 py-1' : 'px-3 py-2',
        canEdit ? 'cursor-grab' : 'cursor-pointer',
        'focus-visible:ring-2 focus-visible:ring-primary',
        !held && 'transition-[background-color,border-color,box-shadow,opacity] duration-150',
        isOpen && 'border border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40',
        isProposed && 'border border-border bg-muted/30 hover:border-border/80 hover:bg-muted/50',
        isLocked && 'border border-locked/40 bg-locked/5 hover:border-locked/60 hover:bg-locked/10',
        held && 'z-40 shadow-lg cursor-grabbing',
        fading && 'opacity-40'
      )}
      style={{ top, height, ...placement }}
    >
      {/* Icon + time; slim cards inline the title here too */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('shrink-0 leading-none', slim ? 'text-sm' : 'text-base')}>
          {slot.icon ?? CATEGORY_ICONS[slot.category] ?? '📌'}
        </span>
        <span className="text-xs font-medium text-muted-foreground truncate tabular-nums">
          {formatMinuteRange(start, duration)}
        </span>
        {slim && !isOpen && (
          <span className="text-xs font-medium text-foreground truncate min-w-0">
            · {title}
          </span>
        )}
        {slim && isOpen && (
          <span className="text-xs text-muted-foreground/50 truncate">· open</span>
        )}
      </div>

      {!slim && (
        <div className="mt-1">
          {isOpen && (
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground/50">
              <Plus className="w-3.5 h-3.5" />
              <span>Add idea</span>
            </div>
          )}
          {isProposed && (
            <p className="text-[13px] font-medium text-foreground line-clamp-2 break-words">
              {slot.proposals.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && <span className="text-muted-foreground font-normal"> · </span>}
                  {p.title}
                </span>
              ))}
            </p>
          )}
          {isLocked && (
            <p className="text-[13px] font-medium text-foreground line-clamp-2 break-words">
              {title}
            </p>
          )}
        </div>
      )}

      {showMicro && (
        <p className="mt-0.5 text-[11px] text-muted-foreground/70 truncate">
          Not locked in yet — tap to decide together.
        </p>
      )}

      {/* Resize handle — stretch the bottom edge */}
      {canEdit && (
        <div data-resize className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none">
          <span
            aria-hidden
            className="absolute left-1/2 bottom-[3px] -translate-x-1/2 w-5 h-[3px] rounded-full bg-muted-foreground opacity-0 group-hover:opacity-40 transition-opacity"
          />
        </div>
      )}
    </div>
  )
}
