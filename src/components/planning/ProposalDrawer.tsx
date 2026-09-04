import { useMemo, useState } from 'react'
import { X, LockOpen, Loader2, Trash2, ExternalLink, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  addProposal,
  updateProposal,
  updateSlotIcon,
  updateSlotSchedule,
  updateSlotStretchesGrid,
  setProposalVotes,
  lockSlot,
  unlockSlot,
  setSlotProposed,
  deleteProposal,
  deleteSlot,
  restoreSlot,
} from '@/services/planningService'
import type { DayWithSlots, Proposal, SlotWithProposals } from '@/types/database'
import type { Trip } from '@/types/database'
import { usePlanningHistory } from '@/hooks/usePlanningHistory'
import { SlotIconPicker } from './SlotIconPicker'
import { CATEGORY_ICONS } from '@/lib/slotEmojis'
import { ProposalCard } from './ProposalCard'
import { AddProposalForm } from './AddProposalForm'
import { PickFromCollectionModal } from './PickFromCollectionModal'
import { Button } from '@/components/ui/button'
import { formatTimeLabel, parseTimeToMinutes, minutesToTimeLabel } from '@/lib/timeUtils'
import {
  slotStartMinutes,
  slotDurationMinutes,
  lockedProposalOf,
  slotTitle,
  gridStretchCost,
} from '@/lib/timeGrid'
import { cn } from '@/lib/utils'

const TIME_CHIPS = ['9:00 AM', '11:00 AM', '12:00 PM', '3:00 PM', '5:00 PM', '7:00 PM']

// ── Inline time range (editable start–end in drawer header) ─────────────────

function TimePartInput({
  initial,
  onCommit,
  onCancel,
  error,
}: {
  initial: string
  onCommit: (value: string) => void
  onCancel: () => void
  error: string | null
}) {
  const [draft, setDraft] = useState(initial)
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') onCancel()
      }}
      placeholder="e.g. 9:00 AM"
      className={cn(
        'text-sm font-semibold bg-transparent border-b outline-none text-foreground w-24 min-w-0',
        error ? 'border-destructive' : 'border-primary'
      )}
      aria-invalid={!!error}
    />
  )
}

/**
 * "10:30 AM – 12:00 PM" with either end editable. The grid snaps to 15
 * minutes; here any exact minute can be typed. Writes go through
 * `updateSlotSchedule`, which keeps `time_label` and the locked proposal's
 * `exact_time` in step.
 */
function InlineTimeRange({ slot, canEdit }: { slot: SlotWithProposals; canEdit: boolean }) {
  const [editing, setEditing] = useState<'start' | 'end' | null>(null)
  const [saving, setSaving] = useState(false)
  const [timeError, setTimeError] = useState<string | null>(null)

  const start = slotStartMinutes(slot)
  const duration = slotDurationMinutes(slot)
  const lockedProposal = lockedProposalOf(slot)

  const save = async (nextStart: number, nextDuration: number) => {
    setSaving(true)
    try {
      await updateSlotSchedule({
        slotId: slot.id,
        start_minutes: nextStart,
        duration_minutes: nextDuration,
        lockedProposalId: lockedProposal?.id ?? null,
      })
    } finally {
      setSaving(false)
    }
  }

  const commit = (which: 'start' | 'end') => (value: string) => {
    const val = value.trim()
    if (!val) {
      setTimeError(null)
      setEditing(null)
      return
    }
    const formatted = formatTimeLabel(val)
    if (!formatted) {
      setTimeError('Use a time like 9:00 AM or 2:30 PM')
      return
    }
    const minutes = parseTimeToMinutes(formatted)
    if (which === 'start') {
      setTimeError(null)
      setEditing(null)
      if (minutes !== start) void save(minutes, duration)
      return
    }
    // End time — midnight counts as end-of-day, otherwise it must follow start
    const base = start ?? 0
    const end = minutes === 0 ? 24 * 60 : minutes
    if (end <= base) {
      setTimeError('End must be after the start')
      return
    }
    setTimeError(null)
    setEditing(null)
    if (end - base !== duration) void save(base, end - base)
  }

  const cancelEdit = () => {
    setTimeError(null)
    setEditing(null)
  }

  // The dotted underline is the whole affordance: a decorative pencil sat here
  // before and read as the button, so the first click always landed on nothing.
  const partButton = (label: string, which: 'start' | 'end') => (
    <button
      type="button"
      onClick={() => canEdit && setEditing(which)}
      disabled={!canEdit}
      aria-label={which === 'start' ? 'Change start time' : 'Change end time'}
      className={cn(
        'rounded px-1 py-0.5 -mx-0.5 transition-colors max-sm:py-1',
        canEdit &&
          'underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 ' +
            'hover:bg-primary/5 hover:text-primary hover:decoration-primary',
        'disabled:pointer-events-none disabled:no-underline'
      )}
    >
      {label}
    </button>
  )

  return (
    <span className="inline-flex flex-col gap-0.5 min-w-0">
      <span className="flex items-center gap-1 text-sm font-semibold text-foreground whitespace-nowrap">
        {start === null && editing === null && (
          <button
            type="button"
            onClick={() => canEdit && setEditing('start')}
            disabled={!canEdit}
            className="text-muted-foreground hover:text-primary transition-colors disabled:pointer-events-none font-medium"
          >
            Sometime that day{canEdit ? ' — set a time' : ''}
          </button>
        )}
        {start !== null && editing !== 'start' && partButton(minutesToTimeLabel(start), 'start')}
        {editing === 'start' && (
          <TimePartInput
            initial={start === null ? '' : minutesToTimeLabel(start)}
            onCommit={commit('start')}
            onCancel={cancelEdit}
            error={timeError}
          />
        )}
        {start !== null && (
          <>
            <span className="text-muted-foreground/50">–</span>
            {editing !== 'end' && partButton(minutesToTimeLabel(start + duration), 'end')}
            {editing === 'end' && (
              <TimePartInput
                initial={minutesToTimeLabel(start + duration)}
                onCommit={commit('end')}
                onCancel={cancelEdit}
                error={timeError}
              />
            )}
          </>
        )}
        {canEdit && saving && <Loader2 className="w-3 h-3 animate-spin opacity-50 shrink-0" />}
      </span>
      {timeError && (
        <span className="text-[10px] text-destructive leading-tight">{timeError}</span>
      )}
    </span>
  )
}

/**
 * Per-event opt-out from widening the board's hours.
 *
 * The board opens on every event, however lonely — a 6 AM airport run pulls
 * all seven days down to 5 AM. That is usually right and occasionally awful,
 * and the grid can't tell which from the times alone. So the call lives here,
 * on the event that costs the hours, and only surfaces when there are hours to
 * save: `gridStretchCost` is zero whenever the rest of the trip already
 * reaches this far, and the row stays out of the way entirely.
 */
function GridStretchToggle({
  slot,
  days,
  canEdit,
}: {
  slot: SlotWithProposals
  days: DayWithSlots[]
  canEdit: boolean
}) {
  const [saving, setSaving] = useState(false)
  const cost = useMemo(() => gridStretchCost(days, slot.id), [days, slot.id])
  const off = slot.stretches_grid === false

  // Nothing to offer: this event sits inside the hours the trip already shows.
  if (!canEdit || slotStartMinutes(slot) === null || (cost <= 0 && !off)) return null

  const hours = Math.round((cost / 60) * 10) / 10
  const savings = hours >= 1 ? `${hours % 1 === 0 ? hours : hours.toFixed(1)}h` : `${cost}min`

  return (
    <button
      type="button"
      onClick={() => {
        setSaving(true)
        void updateSlotStretchesGrid(slot.id, off).finally(() => setSaving(false))
      }}
      disabled={saving}
      role="switch"
      aria-checked={off}
      title={
        off
          ? 'The board keeps the hours the rest of the trip needs; this event sits behind the 12 AM toggle.'
          : `This event widens the board by ${savings} on every day. Turn on to keep the usual hours and leave it behind the 12 AM toggle.`
      }
      className={cn(
        'inline-flex items-center gap-1.5 mt-2.5 text-[11px] rounded-full border px-2 py-1 transition-colors max-sm:min-h-[36px]',
        off
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/60 text-muted-foreground/60 hover:border-primary/30 hover:text-foreground',
        'disabled:opacity-50'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex items-center justify-center w-3 h-3 rounded-[3px] border shrink-0',
          off ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
        )}
      >
        {off && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
      Don’t widen the board for this
      {!off && cost > 0 && (
        <span className="text-muted-foreground/40 tabular-nums">saves {savings}</span>
      )}
      {saving && <Loader2 className="w-3 h-3 animate-spin opacity-50 shrink-0" />}
    </button>
  )
}

/**
 * The event's name, edited where you read it. A locked slot's identity *is* its
 * locked proposal, so this writes straight through — renaming used to mean
 * card → drawer → find the row → its pencil.
 */
function InlineTitle({ proposal, canEdit }: { proposal: Proposal; canEdit: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(proposal.title)
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    const title = draft.trim()
    setEditing(false)
    if (!title || title === proposal.title) return
    setSaving(true)
    try {
      await updateProposal(proposal.id, {
        title,
        note: proposal.note ?? null,
        url: proposal.url ?? null,
      })
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(proposal.title)
            setEditing(false)
          }
        }}
        aria-label="Event name"
        className="w-full min-w-0 bg-transparent border-b border-primary outline-none font-serif text-lg font-semibold text-foreground"
      />
    )
  }

  const startEditing = () => {
    if (!canEdit) return
    setDraft(proposal.title)
    setEditing(true)
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={!canEdit}
      aria-label="Rename this event"
      className={cn(
        'block max-w-full truncate text-left font-serif text-lg font-semibold text-foreground',
        'rounded px-1 -mx-1 py-0.5 transition-colors',
        canEdit &&
          'underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 ' +
            'hover:bg-primary/5 hover:decoration-primary',
        'disabled:pointer-events-none disabled:no-underline'
      )}
    >
      {proposal.title}
      {saving && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin opacity-50" />}
    </button>
  )
}

// ── Main drawer ─────────────────────────────────────────────────────────────

interface ProposalDrawerProps {
  trip: Trip
  days: DayWithSlots[]
  slot: SlotWithProposals | null
  dayLabel: string
  currentName: string
  onClose: () => void
  onUpdate: () => void
  onSlotDeleted?: () => void
  canEdit?: boolean
  canDeleteSlot?: boolean
}

export function ProposalDrawer({ trip, days, slot, dayLabel, currentName, onClose, onUpdate, onSlotDeleted, canEdit = true, canDeleteSlot = false }: ProposalDrawerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [pickFromCollectionOpen, setPickFromCollectionOpen] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const history = usePlanningHistory()
  const [deletingSlot, setDeletingSlot] = useState(false)

  const currentIcon = slot?.icon ?? CATEGORY_ICONS[slot?.category ?? ''] ?? '📌'

  const handleIconSelect = async (emoji: string) => {
    if (!slot) return
    await updateSlotIcon(slot.id, emoji)
  }

  const handleQuickLabel = async (label: string) => {
    if (!slot) return
    const minutes = parseTimeToMinutes(label)
    if (minutes === Infinity || minutes === slotStartMinutes(slot)) return
    await updateSlotSchedule({
      slotId: slot.id,
      start_minutes: minutes,
      duration_minutes: slotDurationMinutes(slot),
      lockedProposalId: lockedProposalOf(slot)?.id ?? null,
    })
  }

  if (!slot) return null

  const isLocked = slot.status === 'locked'
  const lockedProposal = isLocked ? lockedProposalOf(slot) : null
  const otherIdeas = lockedProposal
    ? slot.proposals.filter((p) => p.id !== lockedProposal.id)
    : slot.proposals
  /** A decided event with nothing more to say: no body, and only one rule. */
  const bodyEmpty = Boolean(
    isLocked && lockedProposal && !lockedProposal.note && !lockedProposal.url && !otherIdeas.length
  )

  const handleAddProposal = async (data: { title: string; note?: string | null; url?: string | null }) => {
    await addProposal({
      slot_id: slot.id,
      trip_id: trip.id,
      proposer_name: currentName,
      title: data.title,
      note: data.note ?? null,
      url: data.url ?? null,
    })

    if (slot.status === 'open') {
      await setSlotProposed(slot.id)
    }

    setShowAddForm(false)
    onUpdate()
  }

  const handlePickFromCollection = async (item: { name: string; google_maps_url: string | null; place_name: string | null }) => {
    if (!slot) return
    await handleAddProposal({
      title: item.name,
      note: item.place_name ?? null,
      url: item.google_maps_url ?? null,
    })
    setPickFromCollectionOpen(false)
  }

  const handleVote = async (proposalId: string) => {
    const proposal = slot.proposals.find((p) => p.id === proposalId)
    if (!proposal) return
    const hasVoted = proposal.votes.includes(currentName)
    const newVotes = hasVoted
      ? proposal.votes.filter((v) => v !== currentName)
      : [...proposal.votes, currentName]
    await setProposalVotes(proposalId, newVotes)
    onUpdate()
  }

  /**
   * Adding an idea to a decided event only means something if the decision is
   * open again, so this reopens and drops you straight into the add form. The
   * itinerary degrades honestly meanwhile — TimelineItem renders an unlocked
   * slot as "Still deciding…" rather than dropping it.
   */
  const handleReopenWithIdea = async () => {
    setUnlockLoading(true)
    try {
      await unlockSlot(slot.id)
      setShowAddForm(true)
    } finally {
      setUnlockLoading(false)
    }
  }

  const handleDeleteProposal = async (proposalId: string) => {
    if (!slot) return
    const remaining = slot.proposals.filter((p) => p.id !== proposalId)
    await deleteProposal(proposalId, {
      slotId: slot.id,
      remainingProposalCount: remaining.length,
      lockedProposalId: slot.locked_proposal_id,
    })
    onUpdate()
  }

  const handleDeleteSlot = async () => {
    if (!slot) return
    // No confirm step: undo is the safety net, and it holds the whole slot —
    // proposals, votes and all — so restoring is exact rather than a rebuild.
    const deleted = slot
    setDeletingSlot(true)
    try {
      await deleteSlot(deleted.id)
      history.record(slotTitle(deleted), () => restoreSlot(deleted, trip.id))
      onClose()
      onSlotDeleted?.()
    } finally {
      setDeletingSlot(false)
    }
  }

  const handleEditProposal = async (
    proposalId: string,
    data: { title: string; note: string | null; url: string | null }
  ) => {
    await updateProposal(proposalId, {
      title: data.title,
      note: data.note,
      url: data.url,
    })
    onUpdate()
  }

  const handleLock = async (proposalId: string) => {
    try {
      // Only derive an icon if the user hasn't picked one themselves
      const title = slot.proposals.find((p) => p.id === proposalId)?.title
      await lockSlot(slot.id, proposalId, slot.icon ? null : title)
      onUpdate()
      onClose()
    } catch (err) {
      console.error('Failed to lock idea', err)
    }
  }

  return (
    <>
      <AnimatePresence>
        {slot && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={onClose}
            />
            <motion.div
              key="drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              // Centred with auto margins on both axes rather than a translate,
              // which framer-motion's own transform would overwrite. A sheet
              // rising from the bottom edge on phones; a dialog in the middle
              // of the screen from sm up, where a 160px strip pinned to the
              // bottom of a large monitor read as an afterthought.
              className="fixed bottom-0 left-0 right-0 mx-auto sm:inset-y-0 sm:my-auto sm:h-fit sm:max-w-2xl z-50 bg-background rounded-t-2xl sm:rounded-2xl border-t sm:border border-border shadow-2xl max-h-[85vh] flex flex-col min-h-0 max-sm:pb-[env(safe-area-inset-bottom)]"
            >
              {/* Drag handle (mobile) — hidden on sm and up */}
              <div className="sm:hidden flex justify-center pt-2 pb-0.5 shrink-0">
                <div className="w-9 h-1 rounded-full bg-muted-foreground/30" aria-hidden />
              </div>
              {/* Header */}
              <div className="px-5 pt-2 sm:pt-4 pb-3 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="relative flex items-start gap-2 min-w-0 flex-1">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setIconPickerOpen((v) => !v)}
                        title="Change icon"
                        className="text-lg leading-none hover:scale-110 active:scale-95 transition-transform shrink-0 max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center"
                      >
                        {currentIcon}
                      </button>
                    ) : (
                      <span className="text-lg leading-none shrink-0">{currentIcon}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      {/* Decided: the name leads and the clock reads as a subhead.
                          Still deciding: there is no one name, so time leads. */}
                      {lockedProposal && (
                        <InlineTitle proposal={lockedProposal} canEdit={canEdit} />
                      )}
                      <div className={cn('flex items-center gap-1 min-w-0', lockedProposal && 'mt-0.5')}>
                        <InlineTimeRange slot={slot} canEdit={canEdit} />
                        <span className="text-xs text-muted-foreground/40 truncate">· {dayLabel}</span>
                      </div>
                    </div>
                    <SlotIconPicker
                      open={iconPickerOpen}
                      current={currentIcon}
                      onSelect={handleIconSelect}
                      onClose={() => setIconPickerOpen(false)}
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {canDeleteSlot && (
                      <button
                        onClick={handleDeleteSlot}
                        disabled={deletingSlot}
                        className="rounded-full w-8 h-8 flex items-center justify-center text-muted-foreground/40 hover:text-destructive/70 hover:bg-destructive/10 transition-colors disabled:opacity-50 max-sm:min-h-[44px] max-sm:min-w-[44px]"
                        title="Delete this event — undo puts it back"
                        aria-label="Delete this event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors max-sm:min-h-[44px] max-sm:min-w-[44px]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Time quick-picks — only worth a row when no time is set yet;
                    once there is one, the header's time range edits it. */}
                {canEdit && slotStartMinutes(slot) === null && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {TIME_CHIPS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleQuickLabel(t)}
                      className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                        slotStartMinutes(slot) === parseTimeToMinutes(t)
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border/60 text-muted-foreground/60 hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                  <span className="text-[11px] text-muted-foreground/30">or type above ↑</span>
                </div>
                )}

                {/* Quiet by design: only an event that actually costs the board
                    hours gets to mention it. */}
                <GridStretchToggle slot={slot} days={days} canEdit={canEdit} />
              </div>

              {/* Body — flex-1 + min-h-0 so it gets bounded height and scrolls.
                  Skipped entirely when a decided event has nothing more to say,
                  and the footer drops its own rule so one line is left. */}
              {!bodyEmpty && (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 flex flex-col">
                {/* Decided: just the thing itself, with the ideas it beat folded
                    away as history. The ballot only comes back when unlocked. */}
                {isLocked && lockedProposal ? (
                  <div className="py-3">
                    {lockedProposal.note && (
                      <p className="text-sm text-muted-foreground">{lockedProposal.note}</p>
                    )}
                    {lockedProposal.url && (
                      <a
                        href={lockedProposal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Open link</span>
                      </a>
                    )}
                    {otherIdeas.length > 0 && (
                      <details className="mt-3 group/other">
                        <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                          {otherIdeas.length} idea{otherIdeas.length === 1 ? '' : 's'} you didn't pick
                        </summary>
                        <div className="mt-2 divide-y divide-border/50 rounded-xl border border-border/50 bg-muted/20 overflow-hidden px-3">
                          {otherIdeas.map((proposal) => (
                            <ProposalCard
                              key={proposal.id}
                              proposal={proposal}
                              currentName={currentName}
                              onDelete={canEdit ? handleDeleteProposal : undefined}
                              onEdit={canEdit ? handleEditProposal : undefined}
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ) : (
                <>
                <div className="pt-3 pb-2 shrink-0">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                    {slot.proposals.length === 0
                      ? 'Ideas'
                      : `${slot.proposals.length} idea${slot.proposals.length === 1 ? '' : 's'}`}
                  </h3>
                </div>

                {slot.proposals.length === 0 && !showAddForm && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No ideas for this slot yet. Add the first one and others can like it or lock it in.
                  </p>
                )}

                <div className="divide-y divide-border/50 rounded-xl border border-border/50 bg-muted/20 overflow-hidden px-3">
                  {[...slot.proposals]
                    .sort((a, b) => b.votes.length - a.votes.length)
                    .map((proposal) => {
                      const isThisLocked = slot.locked_proposal_id === proposal.id
                      return (
                        <ProposalCard
                          key={proposal.id}
                          proposal={proposal}
                          currentName={currentName}
                          isLocked={isThisLocked}
                          onVote={canEdit ? handleVote : undefined}
                          onLock={canEdit && !isLocked ? handleLock : undefined}
                          onDelete={canEdit ? handleDeleteProposal : undefined}
                          onEdit={canEdit ? handleEditProposal : undefined}
                        />
                      )
                    })}
                </div>

                {showAddForm && (
                  <div className={cn('mt-3 pb-3', 'rounded-xl border border-border/50 bg-muted/20 p-3')}>
                    <AddProposalForm
                      currentName={currentName}
                      onSubmit={handleAddProposal}
                      onCancel={() => setShowAddForm(false)}
                    />
                  </div>
                )}

                {canEdit && !isLocked && !showAddForm && (
                  <div className="pt-3 pb-4 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                      Add an idea
                    </p>
                    <div className="flex flex-col max-sm:flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => setShowAddForm(true)}
                        className="flex-1 max-sm:w-full"
                        variant="outline"
                      >
                        Write a new idea
                      </Button>
                      <Button
                        onClick={() => setPickFromCollectionOpen(true)}
                        variant="outline"
                        className="flex-1 max-sm:w-full"
                      >
                        Pick from Collection
                      </Button>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
              )}

              {/* Footer — only when locked and member can edit */}
              {canEdit && isLocked && (
                <div className={cn('px-5 py-3 shrink-0', !bodyEmpty && 'border-t border-border')}>
                  <button
                    type="button"
                    onClick={handleReopenWithIdea}
                    disabled={unlockLoading}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 max-sm:min-h-[44px]"
                  >
                    <LockOpen className="w-3.5 h-3.5 shrink-0" />
                    {unlockLoading ? 'Reopening…' : 'Add another idea — reopens this for the group'}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {slot && (
        <PickFromCollectionModal
          open={pickFromCollectionOpen}
          onOpenChange={setPickFromCollectionOpen}
          tripId={trip.id}
          days={days}
          slotCategory={slot.category === 'food' || slot.category === 'activity' ? slot.category : undefined}
          currentName={currentName}
          onSelect={handlePickFromCollection}
        />
      )}
    </>
  )
}
