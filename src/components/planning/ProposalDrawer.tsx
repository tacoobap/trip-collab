import { useState, useEffect } from 'react'
import { X, Clock, LockOpen, CalendarCheck, AlertCircle, User, Hash, Link2, CheckCircle2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SlotWithProposals, Proposal, BookingStatus } from '@/types/database'
import { SlotIconPicker, CATEGORY_ICONS } from './SlotIconPicker'
import { sanitizeUrl } from '@/lib/utils'
import { ProposalCard } from './ProposalCard'
import { AddProposalForm } from './AddProposalForm'
import { LockConfirm } from './LockConfirm'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Inline time input (per proposal, any status) ────────────────────────────

function InlineTimeInput({ proposal }: { proposal: Proposal }) {
  const [time, setTime] = useState(proposal.exact_time ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTime(proposal.exact_time ?? '')
  }, [proposal.exact_time])

  const handleBlur = async () => {
    const val = time.trim()
    if (val === (proposal.exact_time ?? '')) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'proposals', proposal.id), {
        exact_time: val || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1.5 px-1">
      <Clock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
      <input
        value={time}
        onChange={(e) => setTime(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add time (e.g. 7:30 PM)"
        className="flex-1 text-xs bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/35 focus:text-foreground transition-colors"
      />
      {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50 shrink-0" />}
    </div>
  )
}

// ── Booking section ────────────────────────────────────────────────────────

interface BookingSectionProps {
  proposal: Proposal
}

function BookingSection({ proposal }: BookingSectionProps) {
  const [status, setStatus] = useState<BookingStatus | null>(proposal.booking_status ?? null)
  const [confirmNum, setConfirmNum] = useState(proposal.confirmation_number ?? '')
  const [confirmUrl, setConfirmUrl] = useState(proposal.confirmation_url ?? '')
  const [confirmUrlError, setConfirmUrlError] = useState('')
  const [assignedTo, setAssignedTo] = useState(proposal.assigned_to ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateStatus = async (next: BookingStatus | null) => {
    setStatus(next)
    await updateDoc(doc(db, 'proposals', proposal.id), { booking_status: next ?? null })
  }

  const saveDetails = async () => {
    setConfirmUrlError('')
    let safeUrl: string | null = null
    try {
      safeUrl = sanitizeUrl(confirmUrl)
    } catch (err) {
      setConfirmUrlError(err instanceof Error ? err.message : 'Invalid URL')
      return
    }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'proposals', proposal.id), {
        confirmation_number: confirmNum.trim() || null,
        confirmation_url: safeUrl,
        assigned_to: assignedTo.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const hasDetails = confirmNum || confirmUrl || assignedTo
  const detailsDirty =
    confirmNum !== (proposal.confirmation_number ?? '') ||
    confirmUrl !== (proposal.confirmation_url ?? '') ||
    assignedTo !== (proposal.assigned_to ?? '')

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <CalendarCheck className="w-3.5 h-3.5" />
          Booking
        </div>
        {status === 'booked' && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Confirmed
          </span>
        )}
        {status === 'needs_booking' && (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3 h-3" />
            Needs booking
          </span>
        )}
      </div>

      {/* Status toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => updateStatus(status === 'needs_booking' ? null : 'needs_booking')}
          className={cn(
            'flex-1 text-xs font-medium py-1.5 rounded-lg border transition-all',
            status === 'needs_booking'
              ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400'
              : 'bg-background border-border text-muted-foreground hover:border-amber-300 hover:text-amber-600'
          )}
        >
          Needs booking
        </button>
        <button
          onClick={() => updateStatus(status === 'booked' ? null : 'booked')}
          className={cn(
            'flex-1 text-xs font-medium py-1.5 rounded-lg border transition-all',
            status === 'booked'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-400'
              : 'bg-background border-border text-muted-foreground hover:border-emerald-300 hover:text-emerald-600'
          )}
        >
          Confirmed
        </button>
      </div>

      {/* Detail fields — shown when status is set */}
      {status && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Who's booking this?"
              className="flex-1 text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
            />
          </div>
          {status === 'booked' && (
            <>
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  value={confirmNum}
                  onChange={(e) => setConfirmNum(e.target.value)}
                  placeholder="Confirmation number"
                  className="flex-1 text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="flex items-start gap-2">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1.5" />
                <div className="flex-1">
                  <input
                    value={confirmUrl}
                    onChange={(e) => { setConfirmUrl(e.target.value); setConfirmUrlError('') }}
                    placeholder="Booking link (OpenTable, etc.)"
                    className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
                  />
                  {confirmUrlError && (
                    <p className="text-[10px] text-destructive mt-0.5">{confirmUrlError}</p>
                  )}
                </div>
              </div>
            </>
          )}
          {(detailsDirty || hasDetails) && (
            <div className="flex justify-end pt-1">
              <button
                onClick={saveDetails}
                disabled={saving || !detailsDirty}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-lg transition-all',
                  saved
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
                    : detailsDirty
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-default'
                )}
              >
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save details'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main drawer ─────────────────────────────────────────────────────────────

interface ProposalDrawerProps {
  slot: SlotWithProposals | null
  dayLabel: string
  currentName: string
  onClose: () => void
  onUpdate: () => void
}

export function ProposalDrawer({ slot, dayLabel, currentName, onClose, onUpdate }: ProposalDrawerProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [lockTarget, setLockTarget] = useState<Proposal | null>(null)
  const [lockLoading, setLockLoading] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  const currentIcon = slot?.icon ?? CATEGORY_ICONS[slot?.category ?? ''] ?? '📌'

  const handleIconSelect = async (emoji: string) => {
    if (!slot) return
    await updateDoc(doc(db, 'slots', slot.id), { icon: emoji })
  }

  if (!slot) return null

  const isLocked = slot.status === 'locked'

  const handleAddProposal = async (data: { title: string; note: string; url: string }) => {
    await addDoc(collection(db, 'proposals'), {
      slot_id: slot.id,
      proposer_name: currentName,
      title: data.title,
      note: data.note || null,
      url: data.url || null,
      votes: [],
      created_at: serverTimestamp(),
    })

    // Update slot status to 'proposed' if it was open
    if (slot.status === 'open') {
      await updateDoc(doc(db, 'slots', slot.id), { status: 'proposed' })
    }

    setShowAddForm(false)
    onUpdate()
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

  const handleLockConfirm = async () => {
    if (!lockTarget) return
    setLockLoading(true)
    try {
      await updateDoc(doc(db, 'slots', slot.id), {
        status: 'locked',
        locked_proposal_id: lockTarget.id,
      })
      setLockTarget(null)
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl border-t border-border shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {/* Tappable icon — opens the emoji picker */}
                      <button
                        type="button"
                        onClick={() => setIconPickerOpen((v) => !v)}
                        title="Change icon"
                        className="text-base leading-none hover:scale-110 active:scale-95 transition-transform"
                      >
                        {currentIcon}
                      </button>
                      <Clock className="w-3 h-3" />
                      <span>{slot.time_label}</span>
                      <span className="text-border">·</span>
                      <span className="capitalize">{slot.category}</span>
                      <span className="text-border">·</span>
                      <span>{dayLabel}</span>
                    </div>
                    <SlotIconPicker
                      open={iconPickerOpen}
                      current={currentIcon}
                      onSelect={handleIconSelect}
                      onClose={() => setIconPickerOpen(false)}
                    />
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="font-serif font-semibold text-foreground">
                  {isLocked
                    ? 'Locked in'
                    : `${slot.proposals.length} idea${slot.proposals.length !== 1 ? 's' : ''} proposed`}
                </h2>
              </div>

              <div className="overflow-y-auto flex-1 p-5 space-y-3">
                {slot.proposals.length === 0 && !showAddForm && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No ideas yet. Be the first to propose something!
                  </p>
                )}

                {slot.proposals.map((proposal) => {
                  const isThisLocked = slot.locked_proposal_id === proposal.id
                  return (
                    <div key={proposal.id}>
                      <ProposalCard
                        proposal={proposal}
                        currentName={currentName}
                        isLocked={isThisLocked}
                        onVote={handleVote}
                        onLock={
                          !isLocked
                            ? (id) =>
                                setLockTarget(
                                  slot.proposals.find((p) => p.id === id) ?? null
                                )
                            : undefined
                        }
                      />
                      <InlineTimeInput proposal={proposal} />
                      {isThisLocked && (
                        <BookingSection
                          key={`${proposal.id}-${proposal.booking_status}-${proposal.confirmation_number}`}
                          proposal={proposal}
                        />
                      )}
                    </div>
                  )
                })}

                {showAddForm && (
                  <AddProposalForm
                    currentName={currentName}
                    onSubmit={handleAddProposal}
                    onCancel={() => setShowAddForm(false)}
                  />
                )}
              </div>

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

              {!isLocked && !showAddForm && (
                <div className="px-5 py-4 border-t border-border shrink-0">
                  <Button
                    onClick={() => setShowAddForm(true)}
                    className="w-full"
                    variant="outline"
                  >
                    + Add your idea
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <LockConfirm
        proposal={lockTarget}
        slotLabel={`${slot.time_label} · ${dayLabel}`}
        open={lockTarget !== null}
        onOpenChange={(open) => { if (!open) setLockTarget(null) }}
        onConfirm={handleLockConfirm}
        loading={lockLoading}
      />
    </>
  )
}
