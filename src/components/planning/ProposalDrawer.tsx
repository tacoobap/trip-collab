import { useState } from 'react'
import { X, LockOpen, Loader2, Pencil, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { DayWithSlots, SlotWithProposals } from '@/types/database'
import type { Trip } from '@/types/database'
import { SlotIconPicker, CATEGORY_ICONS } from './SlotIconPicker'
import { ProposalCard } from './ProposalCard'
import { AddProposalForm } from './AddProposalForm'
import { PickFromCollectionModal } from './PickFromCollectionModal'
import { Button } from '@/components/ui/button'
import { formatTimeLabel } from '@/lib/timeUtils'
import { cn } from '@/lib/utils'

const TIME_CHIPS = ['9:00 AM', '12:00 PM', '3:00 PM', '7:00 PM']

// ── Inline slot label (editable time in drawer header) ──────────────────────

function InlineSlotLabel({ slot }: { slot: SlotWithProposals }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [timeError, setTimeError] = useState<string | null>(null)

  const lockedProposal = slot.status === 'locked'
    ? slot.proposals.find((p) => p.id === slot.locked_proposal_id) ?? null
    : null

  // Mirror the same priority as SlotCard / TimelineItem
  const displayTime = lockedProposal
    ? (lockedProposal.exact_time ?? lockedProposal.narrative_time ?? slot.time_label)
    : slot.time_label

  const [draft, setDraft] = useState(displayTime)

  const commit = async () => {
    const val = draft.trim()
    if (!val || val === displayTime) {
      setTimeError(null)
      setEditing(false)
      return
    }
    const formatted = formatTimeLabel(val)
    if (!formatted) {
      setTimeError('Use a time like 9:00 AM or 2:30 PM')
      return
    }
    setTimeError(null)
    setEditing(false)
    setSaving(true)
    try {
      if (lockedProposal) {
        await updateDoc(doc(db, 'proposals', lockedProposal.id), { exact_time: formatted })
      } else {
        await updateDoc(doc(db, 'slots', slot.id), { time_label: formatted })
      }
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setDraft(displayTime)
    setTimeError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (timeError) setTimeError(null)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') cancelEdit()
          }}
          placeholder="e.g. 9:00 AM"
          className={cn(
            'text-sm font-semibold bg-transparent border-b outline-none text-foreground w-28 min-w-0',
            timeError ? 'border-destructive' : 'border-primary'
          )}
          aria-invalid={!!timeError}
        />
        {timeError && (
          <span className="text-[10px] text-destructive leading-tight">{timeError}</span>
        )}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Change time"
      className="group flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
    >
      <span>{displayTime}</span>
      {saving ? (
        <Loader2 className="w-3 h-3 animate-spin opacity-50 shrink-0" />
      ) : (
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
      )}
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
}

export function ProposalDrawer({ trip, days, slot, dayLabel, currentName, onClose, onUpdate, onSlotDeleted }: ProposalDrawerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [pickFromCollectionOpen, setPickFromCollectionOpen] = useState(false)
  const [_lockLoading, setLockLoading] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState(false)
  const [deletingSlot, setDeletingSlot] = useState(false)

  const currentIcon = slot?.icon ?? CATEGORY_ICONS[slot?.category ?? ''] ?? '📌'

  const handleIconSelect = async (emoji: string) => {
    if (!slot) return
    await updateDoc(doc(db, 'slots', slot.id), { icon: emoji })
  }

  const handleQuickLabel = async (label: string) => {
    if (!slot) return
    const lockedProposal = slot.status === 'locked'
      ? slot.proposals.find((p) => p.id === slot.locked_proposal_id)
      : null
    if (lockedProposal) {
      await updateDoc(doc(db, 'proposals', lockedProposal.id), { exact_time: label })
    } else {
      if (label === slot.time_label) return
      await updateDoc(doc(db, 'slots', slot.id), { time_label: label })
    }
  }

  if (!slot) return null

  const isLocked = slot.status === 'locked'

  const handleAddProposal = async (data: { title: string; note?: string | null; url?: string | null }) => {
    await addDoc(collection(db, 'proposals'), {
      slot_id: slot.id,
      proposer_name: currentName,
      title: data.title,
      note: data.note ?? null,
      url: data.url ?? null,
      votes: [],
      created_at: serverTimestamp(),
    })

    if (slot.status === 'open') {
      await updateDoc(doc(db, 'slots', slot.id), { status: 'proposed' })
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
    await updateDoc(doc(db, 'proposals', proposalId), { votes: newVotes })
    onUpdate()
  }

  const handleUnlock = async () => {
    setUnlockLoading(true)
    try {
      await updateDoc(doc(db, 'slots', slot.id), {
        status: 'proposed',
        locked_proposal_id: null,
      })
    } finally {
      setUnlockLoading(false)
    }
  }

  const handleDeleteProposal = async (proposalId: string) => {
    if (!slot) return
    await deleteDoc(doc(db, 'proposals', proposalId))
    const remaining = slot.proposals.filter((p) => p.id !== proposalId)
    if (remaining.length === 0) {
      await updateDoc(doc(db, 'slots', slot.id), { status: 'open', locked_proposal_id: null })
    } else if (slot.locked_proposal_id === proposalId) {
      await updateDoc(doc(db, 'slots', slot.id), { status: 'proposed', locked_proposal_id: null })
    }
    onUpdate()
  }

  const handleDeleteSlot = async () => {
    if (!slot) return
    setDeletingSlot(true)
    try {
      const proposalsSnap = await getDocs(query(collection(db, 'proposals'), where('slot_id', '==', slot.id)))
      await Promise.all(proposalsSnap.docs.map((d) => deleteDoc(d.ref)))
      await deleteDoc(doc(db, 'slots', slot.id))
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
    await updateDoc(doc(db, 'proposals', proposalId), {
      title: data.title,
      note: data.note,
      url: data.url,
    })
    onUpdate()
  }

  const handleLock = async (proposalId: string) => {
    setLockLoading(true)
    try {
      await updateDoc(doc(db, 'slots', slot.id), {
        status: 'locked',
        locked_proposal_id: proposalId,
      })
      onUpdate()
      onClose()
    } finally {
      setLockLoading(false)
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl border-t border-border shadow-2xl h-[85vh] max-h-[85vh] flex flex-col min-h-0"
            >
              {/* Header */}
              <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setIconPickerOpen((v) => !v)}
                      title="Change icon"
                      className="text-lg leading-none hover:scale-110 active:scale-95 transition-transform shrink-0"
                    >
                      {currentIcon}
                    </button>
                    <InlineSlotLabel slot={slot} />
                    <span className="text-xs text-muted-foreground/40 truncate">· {dayLabel}</span>
                    <SlotIconPicker
                      open={iconPickerOpen}
                      current={currentIcon}
                      onSelect={handleIconSelect}
                      onClose={() => setIconPickerOpen(false)}
                    />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {confirmDeleteSlot ? (
                      <>
                        <button
                          onClick={handleDeleteSlot}
                          disabled={deletingSlot}
                          className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                        >
                          {deletingSlot ? 'Deleting…' : 'Delete slot'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteSlot(false)}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteSlot(true)}
                        className="rounded-full w-8 h-8 flex items-center justify-center text-muted-foreground/40 hover:text-destructive/70 hover:bg-destructive/10 transition-colors"
                        title="Delete this slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Time quick-picks */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  {TIME_CHIPS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleQuickLabel(t)}
                      className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                        slot.time_label === t
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border/60 text-muted-foreground/60 hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                  <span className="text-[11px] text-muted-foreground/30">or type above ↑</span>
                </div>
              </div>

              {/* Ideas collection — flex-1 + min-h-0 so it gets bounded height and scrolls */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 flex flex-col">
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
                          onVote={handleVote}
                          onLock={!isLocked ? handleLock : undefined}
                          onDelete={handleDeleteProposal}
                          onEdit={handleEditProposal}
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

                {!isLocked && !showAddForm && (
                  <div className="pt-3 pb-4 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                      Add an idea
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setShowAddForm(true)}
                        className="flex-1"
                        variant="outline"
                      >
                        Write a new idea
                      </Button>
                      <Button
                        onClick={() => setPickFromCollectionOpen(true)}
                        variant="outline"
                        className="flex-1"
                      >
                        Pick from Collection
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer — only when locked */}
              {isLocked && (
                <div className="px-5 py-4 border-t border-border shrink-0">
                  <Button
                    onClick={handleUnlock}
                    disabled={unlockLoading}
                    variant="outline"
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    <LockOpen className="w-3.5 h-3.5 mr-1.5" />
                    {unlockLoading ? 'Unlocking…' : 'Unlock — reopen for planning'}
                  </Button>
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
