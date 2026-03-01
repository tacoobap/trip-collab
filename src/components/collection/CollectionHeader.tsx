import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CollectionHeaderProps {
  isMember: boolean
  onSuggestClick: () => void
  onAddClick: () => void
}

export function CollectionHeader({
  isMember,
  onSuggestClick,
  onAddClick,
}: CollectionHeaderProps) {
  return (
    <div className="border-b border-border bg-gradient-to-br from-muted/30 to-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 max-sm:py-5">
        <h1 className="font-serif text-lg sm:text-xl font-semibold text-foreground">
          Collection
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4 sm:mb-6">
          Save ideas for later and add them to the plan when you're ready.
        </p>
        {!isMember && (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
            <p className="text-sm text-warning-foreground">
              Only trip members can add or edit ideas. Join this trip to contribute to the
              collection.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-3 max-sm:flex-col max-sm:gap-2">
          {isMember && (
            <>
              <Button
                onClick={onSuggestClick}
                variant="default"
                className="gap-2 max-sm:w-full max-sm:justify-center"
              >
                <Sparkles className="w-4 h-4" />
                Suggest something for me
              </Button>
              <Button
                onClick={onAddClick}
                variant="outline"
                className="gap-2 max-sm:w-full max-sm:justify-center"
              >
                <Plus className="w-4 h-4" />
                Add an idea
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
