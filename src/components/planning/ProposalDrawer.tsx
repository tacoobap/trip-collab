import { useState } from 'react'
import { X, Clock, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { SlotWithProposals, Proposal } from '@/types/database'
import { ProposalCard } from './ProposalCard'
import { AddProposalForm } from './AddProposalForm'
import { LockConfirm } from './LockConfirm'
import { Button } from '@/components/ui/button'

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

                {slot.proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    currentName={currentName}
                    isLocked={slot.locked_proposal_id === proposal.id}
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
                ))}

                {showAddForm && (
                  <AddProposalForm
                    currentName={currentName}
                    onSubmit={handleAddProposal}
                    onCancel={() => setShowAddForm(false)}
                  />
                )}
              </div>

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
