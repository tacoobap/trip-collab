import { getProposerColor, getProposerInitial } from '@/lib/proposerColors'
import { cn } from '@/lib/utils'

interface ProposerAvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md'
  showName?: boolean
  className?: string
}

export function ProposerAvatar({ name, size = 'sm', showName = false, className }: ProposerAvatarProps) {
  const color = getProposerColor(name)
  const initial = getProposerInitial(name)

  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold shrink-0',
          sizeClasses[size]
        )}
        style={{ backgroundColor: color.bg, color: color.text }}
        title={name}
      >
        {initial}
      </div>
      {showName && (
        <span className="text-sm font-medium text-foreground">{name}</span>
      )}
    </div>
  )
}
