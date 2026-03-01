import { Loader2, Camera, Sparkles } from 'lucide-react'

interface ItineraryCustomizePanelProps {
  /** Whether hero image is currently uploading. */
  heroUploading: boolean
  /** Upload progress 0–100. */
  heroPct: number
  /** Callback when user selects a file (parent wires hidden input). */
  onHeroClick: () => void
  /** Callback when file input changes (parent passes through). */
  onHeroFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Whether narrative generate/update is in progress. */
  generating: boolean
  /** Status message shown next to spinner. */
  generateStatus: string
  /** Error message to show below buttons. */
  generateError: string
  /** If true, show "Update text" and open modal; otherwise run generate. */
  hasExistingNarrative: boolean
  /** Run full generate (first time). */
  onGenerate: () => void
  /** Open the "Update text" modal. */
  onOpenUpdateModal: () => void
  /** Ref for the hidden file input. */
  heroInputRef: React.RefObject<HTMLInputElement | null>
}

export function ItineraryCustomizePanel({
  heroUploading,
  heroPct,
  onHeroClick,
  onHeroFileChange,
  generating,
  generateStatus,
  generateError,
  hasExistingNarrative,
  onGenerate,
  onOpenUpdateModal,
  heroInputRef,
}: ItineraryCustomizePanelProps) {
  const handleGenerateOrUpdate = () => {
    if (hasExistingNarrative) {
      onOpenUpdateModal()
    } else {
      onGenerate()
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-4 max-sm:pt-6 max-sm:px-3 max-sm:pb-3">
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 flex flex-col items-center gap-3 max-sm:px-3 max-sm:py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Customize
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-sm:gap-2 max-sm:w-full max-sm:flex-col">
          <input
            ref={heroInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onHeroFileChange}
          />
          <button
            onClick={onHeroClick}
            disabled={heroUploading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all touch-manipulation max-sm:min-h-[44px] max-sm:w-full"
            title="Change or add cover photo"
          >
            {heroUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {heroPct}%
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" /> Hero Photo
              </>
            )}
          </button>
          <button
            onClick={handleGenerateOrUpdate}
            disabled={generating}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs font-medium border border-border/60 transition-all disabled:opacity-50 touch-manipulation max-sm:min-h-[44px] max-sm:w-full"
            title={hasExistingNarrative ? 'Update narrative text' : 'Generate narrative text'}
          >
            {generating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {generateStatus || '…'}
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />{' '}
                {hasExistingNarrative ? 'Update text' : 'Generate text'}
              </>
            )}
          </button>
        </div>
        {generateError && (
          <p className="text-[10px] text-destructive/90 text-center">{generateError}</p>
        )}
      </div>
    </div>
  )
}
