import { FileDown, Loader2 } from 'lucide-react'

interface ItineraryExportBarProps {
  /** Whether a PDF export is in progress. */
  exporting: boolean
  /** Run the export (opens the browser's print-to-PDF). */
  onExport: () => void
}

/**
 * Standalone export button for viewers who aren't trip members — members get
 * the same action as a third button inside ItineraryCustomizePanel, so the page
 * doesn't grow a second band of controls.
 */
export function ItineraryExportBar({ exporting, onExport }: ItineraryExportBarProps) {
  return (
    <div
      data-print="hide"
      className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 max-sm:pt-4 max-sm:px-3 flex justify-center"
    >
      <button
        onClick={onExport}
        disabled={exporting}
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all disabled:opacity-50 touch-manipulation max-sm:min-h-[44px]"
        title="Export this itinerary as a PDF"
      >
        {exporting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…
          </>
        ) : (
          <>
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </>
        )}
      </button>
    </div>
  )
}
