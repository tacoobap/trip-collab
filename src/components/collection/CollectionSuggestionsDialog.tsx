import { Loader2, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CollectionSuggestion } from '@/lib/suggestCollectionItems'
import type { CollectionSuggestionsStatus } from '@/hooks/useCollectionSuggestions'

interface CollectionSuggestionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestions: CollectionSuggestion[]
  suggestLoading: CollectionSuggestionsStatus
  vibeSentence: string
  onVibeChange: (value: string) => void
  onGetSuggestions: () => void
  suggestionImageUrls: Record<number, string>
  savedIds: Set<number>
  onSaveSuggestion: (index: number) => void
}

export function CollectionSuggestionsDialog({
  open,
  onOpenChange,
  suggestions,
  suggestLoading,
  vibeSentence,
  onVibeChange,
  onGetSuggestions,
  suggestionImageUrls,
  savedIds,
  onSaveSuggestion,
}: CollectionSuggestionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-6">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader className="shrink-0">
          <DialogTitle>Suggest something for me</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            We'll look at your itinerary and open slots and suggest up to 3 places. Add a
            vibe to narrow it down (optional).
          </p>
        </DialogHeader>
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto space-y-4">
          <div className="shrink-0">
            <label className="block text-sm font-medium text-foreground mb-1">
              Vibe (optional)
            </label>
            <Textarea
              value={vibeSentence}
              onChange={(e) => onVibeChange(e.target.value)}
              placeholder="e.g. chill coffee spot, something romantic, kid-friendly"
              rows={2}
              className="resize-none"
            />
          </div>
          {suggestions.length === 0 && suggestLoading !== 'loading' && (
            <Button onClick={onGetSuggestions} className="w-full gap-2 shrink-0">
              <Sparkles className="w-4 h-4" />
              Get suggestions
            </Button>
          )}
          {suggestLoading === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Finding ideas…</span>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pick what to save
              </p>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex gap-3">
                    {suggestionImageUrls[i] ? (
                      <img
                        src={suggestionImageUrls[i]}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted/50 shrink-0 border border-border flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{s.name}</p>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {s.category}
                          </span>
                        </div>
                        {savedIds.has(i) ? (
                          <span className="text-xs text-primary font-medium">Saved</span>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onSaveSuggestion(i)}
                            >
                              Save
                            </Button>
                          </div>
                        )}
                      </div>
                      {s.one_line_description && (
                        <p className="text-sm text-muted-foreground">
                          {s.one_line_description}
                        </p>
                      )}
                      {s.suggested_for && (
                        <p className="text-xs text-muted-foreground/80">
                          Suggested for: {s.suggested_for}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={onGetSuggestions}
                disabled={suggestLoading === 'loading'}
                className="w-full"
              >
                Get more suggestions
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
