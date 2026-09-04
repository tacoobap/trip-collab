import { BedDouble, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UndoButton } from '@/components/planning/UndoButton'

interface TripActionsProps {
  onOpenTodos: () => void
  onOpenStays: () => void
  onCopyInviteLink: () => void
  /** True for a couple of seconds after a copy, so the button can say so. */
  copied: boolean
}

/**
 * Undo, to-dos, stays and the invite link. Rendered in two places — folded into
 * the page header from `lg` up, and in the trip bar the page keeps below that —
 * so the phone touch-target sizes stay on the buttons rather than the wrapper.
 */
export function TripActions({
  onOpenTodos,
  onOpenStays,
  onCopyInviteLink,
  copied,
}: TripActionsProps) {
  const iconButton =
    'shrink-0 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation max-sm:min-h-[44px] max-sm:min-w-[44px] max-sm:flex max-sm:items-center max-sm:justify-center'

  return (
    <>
      <UndoButton />
      <button onClick={onOpenTodos} className={iconButton} title="To-dos" aria-label="To-dos">
        <ListChecks className="w-4 h-4" />
      </button>
      <button onClick={onOpenStays} className={iconButton} title="Stays" aria-label="Stays">
        <BedDouble className="w-4 h-4" />
      </button>
      <Button
        size="sm"
        variant="outline"
        onClick={onCopyInviteLink}
        className="max-sm:min-h-[40px]"
      >
        <span className="sm:hidden">{copied ? 'Copied' : 'Invite'}</span>
        <span className="hidden sm:inline">{copied ? 'Link copied' : 'Invite link'}</span>
      </Button>
    </>
  )
}
