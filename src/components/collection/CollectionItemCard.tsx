import { useState, useRef, useEffect } from 'react'
import { Heart, Image, Pencil, Trash2 } from 'lucide-react'
import type { CollectionItem } from '@/types/database'
import { getProposerColor, getProposerInitial } from '@/lib/proposerColors'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'

interface CollectionItemCardProps {
  item: CollectionItem
  currentName: string
  onLike: (itemId: string) => void
  onEdit?: (item: CollectionItem) => void
  onDelete?: (itemId: string) => void
  className?: string
}

const CATEGORY_LABELS: Record<CollectionItem['category'], string> = {
  food: 'Food',
  activity: 'Activity',
  other: 'Other',
}

export function CollectionItemCard({
  item,
  currentName,
  onLike,
  onEdit,
  onDelete,
  className,
}: CollectionItemCardProps) {
  const hasLiked = item.likes.includes(currentName)
  const likeCount = item.likes.length
  const [likesOpen, setLikesOpen] = useState(false)

  const [retryKey, setRetryKey] = useState(0)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    setRetryKey(0)
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [item.id, item.image_url])

  const imageSrc = item.image_url
    ? `${item.image_url}${retryKey > 0 ? `?v=${retryKey}` : ''}`
    : null

  const handleImageError = () => {
    if (retryKey < 2 && retryTimeoutRef.current === null) {
      retryTimeoutRef.current = setTimeout(() => {
        setRetryKey((k) => k + 1)
        retryTimeoutRef.current = null
      }, 1500)
    }
  }

  return (
    <article
      className={cn(
        'rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-violet-100 text-violet-400 dark:bg-violet-950/40 dark:text-violet-500/70">
            <Image className="w-12 h-12" strokeWidth={1.25} />
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 max-sm:top-2 max-sm:right-2 max-sm:gap-1.5">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(item) }}
              className="w-8 h-8 rounded-full bg-background/90 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background shadow-sm touch-manipulation max-sm:w-10 max-sm:h-10 max-sm:min-w-[44px] max-sm:min-h-[44px]"
              aria-label="Edit"
            >
              <Pencil className="w-3.5 h-3.5 max-sm:w-4 max-sm:h-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
              className="w-8 h-8 rounded-full bg-background/90 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shadow-sm touch-manipulation max-sm:w-10 max-sm:h-10 max-sm:min-w-[44px] max-sm:min-h-[44px]"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 max-sm:w-4 max-sm:h-4" />
            </button>
          )}
        </div>
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm backdrop-blur-sm',
              item.category === 'food' && 'bg-amber-500/35 text-amber-900 border-amber-600/50 dark:bg-amber-600/50 dark:text-amber-100 dark:border-amber-500/70',
              item.category === 'activity' && 'bg-emerald-500/35 text-emerald-900 border-emerald-600/50 dark:bg-emerald-600/50 dark:text-emerald-100 dark:border-emerald-500/70',
              item.category === 'other' && 'bg-slate-500/35 text-slate-800 border-slate-600/50 dark:bg-slate-600/50 dark:text-slate-100 dark:border-slate-500/70'
            )}
          >
            {CATEGORY_LABELS[item.category]}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-foreground truncate pr-8">{item.name}</h3>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onLike(item.id)}
            className={cn(
              'inline-flex items-center gap-1 text-xs transition-colors touch-manipulation max-sm:py-2 max-sm:-my-1 max-sm:pr-1',
              hasLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
            )}
            aria-label={hasLiked ? 'Unlike' : 'Like'}
          >
            <Heart
              className={cn('w-3.5 h-3.5', hasLiked && 'fill-current')}
            />
            <span>{likeCount > 0 ? likeCount : 'Like'}</span>
          </button>
          {likeCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLikesOpen(true) }}
              className="flex items-center -space-x-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              title={`Liked by: ${item.likes.join(', ')}`}
              aria-label={`See who liked (${item.likes.join(', ')})`}
            >
              {item.likes.map((name) => {
                const color = getProposerColor(name)
                const initial = getProposerInitial(name)
                return (
                  <div
                    key={name}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 border-card shrink-0"
                    style={{ backgroundColor: color.bg, color: color.text }}
                    title={name}
                  >
                    {initial}
                  </div>
                )
              })}
            </button>
          )}
        </div>
      </div>

      <Dialog open={likesOpen} onOpenChange={setLikesOpen}>
        <DialogContent className="max-w-xs">
          <DialogClose onClick={() => setLikesOpen(false)} />
          <DialogHeader>
            <DialogTitle>Liked by</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1.5">
            {item.likes.map((name) => {
              const color = getProposerColor(name)
              const initial = getProposerInitial(name)
              return (
                <li
                  key={name}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-card shrink-0"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    {initial}
                  </span>
                  <span className="text-foreground">{name}</span>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </article>
  )
}
