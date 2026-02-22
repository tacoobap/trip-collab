import { useState } from 'react'
import { X, Clock, Tag, LockOpen, CalendarCheck, AlertCircle, User, Hash, Link2, CheckCircle2 } from 'lucide-react'
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
import { ProposalCard } from './ProposalCard'
import { AddProposalForm } from './AddProposalForm'
import { LockConfirm } from './LockConfirm'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Booking section ────────────────────────────────────────────────────────

interface BookingSectionProps {
  proposal: Proposal
}

function BookingSection({ proposal }: BookingSectionProps) {
  const [status, setStatus] = useState<BookingStatus | null>(proposal.booking_status ?? null)
  const [exactTime, setExactTime] = useState(proposal.exact_time ?? '')
  const [confirmNum, setConfirmNum] = useState(proposal.confirmation_number ?? '')
  const [confirmUrl, setConfirmUrl] = useState(proposal.confirmation_url ?? '')
  const [assignedTo, setAssignedTo] = useState(proposal.assigned_to ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const updateStatus = async (next: BookingStatus | null) => {
    setStatus(next)
    await updateDoc(doc(db, 'proposals', proposal.id), { booking_status: next ?? null })
  }

  const saveDetails = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'proposals', proposal.id), {
        exact_time: exactTime.trim() || null,
        confirmation_number: confirmNum.trim() || null,
        confirmation_url: confirmUrl.trim() || null,
        assigned_to: assignedTo.trim() || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const hasDetails = exactTime || confirmNum || confirmUrl || assignedTo
  const detailsDirty =
    exactTime !== (proposal.exact_time ?? '') ||
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
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={exactTime}
              onChange={(e) => setExactTime(e.target.value)}
              placeholder="Exact time (e.g. 7:30 PM)"
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
              <div className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  value={confirmUrl}
                  onChange={(e) => setConfirmUrl(e.target.value)}
                  placeholder="Booking link (OpenTable, etc.)"
                  className="flex-1 text-xs bg-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
                />
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
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Clock className="w-3 h-3" />
                    <span>{slot.time_label}</span>
                    <span className="text-border">·</span>
                    <Tag className="w-3 h-3" />
                    <span className="capitalize">{slot.category}</span>
                    <span className="text-border">·</span>
                    <span>{dayLabel}</span>
                  </div>
                  <h2 className="font-serif font-semibold text-foreground">
                    {isLocked
                      ? 'Locked in'
                      : `${slot.proposals.length} idea${slot.proposals.length !== 1 ? 's' : ''} proposed`}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
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
                      {isThisLocked && (
                        <BookingSection
                          key={`${proposal.id}-${proposal.booking_status}-${proposal.exact_time}-${proposal.confirmation_number}`}
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
