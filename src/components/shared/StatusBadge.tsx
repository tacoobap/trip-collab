import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'open' | 'proposed' | 'locked'
  proposalCount?: number
  className?: string
}

export function StatusBadge({ status, proposalCount = 0, className }: StatusBadgeProps) {
  if (status === 'open') {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>Open</span>
    )
  }

  if (status === 'proposed') {
    return (
      <span className={cn('text-xs font-medium text-primary', className)}>
        {proposalCount} {proposalCount === 1 ? 'idea' : 'ideas'}
      </span>
    )
  }

  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium text-sage', className)}>
      <Lock className="w-3 h-3" />
      Locked
    </span>
  )
}
