import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TripIdentityProps {
  name: string
  /** Full range, e.g. "September 12 – September 18, 2026". */
  dateRange: string | null
  /** Phone-width range, e.g. "Sep 12 – Sep 18". */
  dateRangeShort: string | null
  canEdit: boolean
  onEdit: () => void
  /**
   * The merged-bar variant: name over dates on two tight lines, so the whole
   * header row still comes in at 49px. The roomy variant is the trip bar the
   * page renders on its own below `lg`.
   */
  dense?: boolean
}

/** Trip name, dates and the edit pencil — the planning page's identity block. */
export function TripIdentity({
  name,
  dateRange,
  dateRangeShort,
  canEdit,
  onEdit,
  dense = false,
}: TripIdentityProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h2
          className={cn(
            'font-serif font-semibold text-foreground truncate',
            dense ? 'text-lg leading-tight' : 'text-lg sm:text-xl'
          )}
        >
          {name}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              'shrink-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors',
              dense ? 'p-1' : 'p-1.5'
            )}
            title="Edit trip"
            aria-label="Edit trip"
          >
            <Pencil className={dense ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </button>
        )}
      </div>
      {dateRange &&
        (dense ? (
          <p className="text-[11px] text-muted-foreground leading-tight truncate tabular-nums">
            {dateRange}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            <span className="sm:hidden">{dateRangeShort}</span>
            <span className="hidden sm:inline">{dateRange}</span>
          </p>
        ))}
    </div>
  )
}
