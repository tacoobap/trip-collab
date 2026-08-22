import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { SLOT_EMOJI_GROUPS, matchesEmoji } from '@/lib/slotEmojis'

interface SlotIconPickerProps {
  open: boolean
  current: string
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function SlotIconPicker({ open, current, onSelect, onClose }: SlotIconPickerProps) {
  return (
    <AnimatePresence>
      {open && (
        <PickerPanel current={current} onSelect={onSelect} onClose={onClose} />
      )}
    </AnimatePresence>
  )
}

/**
 * Split out so it unmounts with AnimatePresence — the search box then resets
 * itself on every reopen without an effect reaching back into state.
 */
function PickerPanel({
  current,
  onSelect,
  onClose,
}: Omit<SlotIconPickerProps, 'open'>) {
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Escape clears the search first, then closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (query) setQuery('')
      else onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, query])

  // Focus search on pointer devices only — autofocus on touch would throw up
  // the keyboard over the grid
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) {
      searchRef.current?.focus()
    }
  }, [])

  const q = query.trim().toLowerCase()

  const groups = useMemo(() => {
    if (!q) return SLOT_EMOJI_GROUPS
    return SLOT_EMOJI_GROUPS.map((g) => ({
      name: g.name,
      emojis: g.emojis.filter((e) => matchesEmoji(e, g.name, q)),
    })).filter((g) => g.emojis.length > 0)
  }, [q])

  const resultCount = groups.reduce((n, g) => n + g.emojis.length, 0)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 right-0 top-full mt-2 z-10 bg-background border border-border rounded-xl shadow-xl p-3"
    >
      {/* Search */}
      <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-muted/50 border border-border/60 focus-within:border-primary/40 transition-colors">
        <Search className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          aria-label="Search icons"
          className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); searchRef.current?.focus() }}
            className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="max-h-56 overflow-y-auto overflow-x-hidden overscroll-contain">
        {resultCount === 0 ? (
          <p className="text-xs text-muted-foreground/70 text-center py-6">
            No icons match “{query}”
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.name} className="pb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium px-1 pt-1 pb-1 sticky top-0 bg-background">
                {group.name}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map(({ emoji, label }) => (
                  <button
                    key={`${group.name}-${emoji}`}
                    type="button"
                    title={label}
                    onClick={() => { onSelect(emoji); onClose() }}
                    className={`w-9 h-9 text-xl flex items-center justify-center rounded-lg transition-colors hover:bg-muted ${
                      current === emoji ? 'bg-primary/10 ring-1 ring-primary/40' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}
