import { ExternalLink, Heart, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Proposal } from '@/types/database'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProposalCardProps {
  proposal: Proposal
  currentName: string
  isLocked?: boolean
  onVote: (proposalId: string) => void
  onLock?: (proposalId: string) => void
  compact?: boolean
}

export function ProposalCard({
  proposal,
  currentName,
  isLocked = false,
  onVote,
  onLock,
  compact = false,
}: ProposalCardProps) {
  const hasVoted = proposal.votes.includes(currentName)
  const voteCount = proposal.votes.length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border p-3 bg-card transition-all',
        isLocked && 'border-sage/40 bg-sage/5 ring-1 ring-sage/20',
        !isLocked && 'border-border hover:border-primary/30'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <ProposerAvatar name={proposal.proposer_name} size="xs" />
            <span className="text-xs text-muted-foreground">{proposal.proposer_name}</span>
            {isLocked && (
              <span className="flex items-center gap-1 text-xs text-sage font-medium ml-auto">
                <Lock className="w-3 h-3" />
                Locked in
              </span>
            )}
          </div>
          <p className="font-medium text-sm text-foreground leading-snug">{proposal.title}</p>
          {!compact && proposal.note && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{proposal.note}</p>
          )}
        </div>
      </div>

      {!compact && (
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-2">
            {proposal.url && (
              <a
                href={proposal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Link
              </a>
            )}
            <button
              onClick={() => onVote(proposal.id)}
              className={cn(
                'flex items-center gap-1 text-xs font-medium transition-colors rounded px-2 py-1',
                hasVoted
                  ? 'text-coral bg-coral/10 hover:bg-coral/20'
                  : 'text-muted-foreground hover:text-coral hover:bg-coral/10'
              )}
            >
              <Heart className={cn('w-3 h-3', hasVoted && 'fill-coral')} />
              {voteCount > 0 ? voteCount : ''}
            </button>
          </div>

          {onLock && !isLocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLock(proposal.id)}
              className="text-xs h-7 border-sage/40 text-sage hover:bg-sage/10 hover:text-sage"
            >
              Lock it in
            </Button>
          )}
        </div>
      )}
    </motion.div>
  )
}
