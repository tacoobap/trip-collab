import { Undo2 } from 'lucide-react'
import { usePlanningHistory } from '@/hooks/usePlanningHistory'
import { cn } from '@/lib/utils'

/**
 * Sits in the trip bar so a mis-drag can be taken back from where you already
 * are. Disabled rather than hidden when there's nothing to undo, so it doesn't
 * appear and disappear under the cursor.
 */
export function UndoButton() {
  const { undo, canUndo, lastLabel, undoing } = usePlanningHistory()

  const label = canUndo
    ? `Undo — put ${lastLabel ?? 'that'} back`
    : 'Nothing to undo yet'

  return (
    <button
      type="button"
      onClick={() => void undo()}
      disabled={!canUndo || undoing}
      title={label}
      aria-label={label}
      className={cn(
        'shrink-0 p-2 rounded-md transition-colors touch-manipulation',
        'max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center',
        canUndo
          ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          : 'text-muted-foreground/30 cursor-default'
      )}
    >
      <Undo2 className={cn('w-4 h-4', undoing && 'animate-pulse')} />
    </button>
  )
}
