import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
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
 * Phones get the picker as its own sheet, not a popover hanging off the
 * trigger: both hosts open near the bottom of the screen (the event sheet's
 * header, the last row of a dialog), so a panel dropped below the trigger fell
 * off the viewport with only its search box visible.
 *
 * Matched in an effect rather than read during render — the React Compiler
 * pass bails on a component that calls an unknown global in its body. Null
 * until the layout effect runs so the wrong variant never paints.
 */
function useCompactLayout(): boolean | null {
  const [compact, setCompact] = useState<boolean | null>(null)
  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 639.98px)')
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return compact
}

/**
 * How much of the layout viewport the on-screen keyboard is covering. A sheet
 * pinned to `bottom: 0` sits behind it on iOS, which would hide the grid the
 * moment someone typed in the search box.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const overlap = window.innerHeight - (vv.height + vv.offsetTop)
      setInset(overlap > 40 ? Math.round(overlap) : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
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
  const compact = useCompactLayout()
  const keyboardInset = useKeyboardInset()
  const dragControls = useDragControls()

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

  const body = (
    <>
      {/* Search */}
      <div className="flex items-center gap-2 mb-2 px-2 py-1.5 max-sm:py-2.5 rounded-lg bg-muted/50 border border-border/60 focus-within:border-primary/40 transition-colors shrink-0">
        <Search className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          aria-label="Search icons"
          className="flex-1 bg-transparent text-base md:text-sm outline-none text-foreground placeholder:text-muted-foreground/50 min-w-0"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); searchRef.current?.focus() }}
            className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors max-sm:w-8 max-sm:h-8 max-sm:flex max-sm:items-center max-sm:justify-center max-sm:-my-1"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="max-sm:flex-1 max-sm:min-h-0 sm:max-h-56 overflow-y-auto overflow-x-hidden overscroll-contain">
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
                    aria-label={label}
                    onClick={() => { onSelect(emoji); onClose() }}
                    className={`w-9 h-9 max-sm:w-full max-sm:h-11 text-xl flex items-center justify-center rounded-lg transition-colors hover:bg-muted ${
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
    </>
  )

  if (compact === null) return null

  if (compact) {
    // Above the dialog layer (z-[1000]) — the day dialog hosts a picker too.
    return createPortal(
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[1090] bg-black/40"
          onClick={onClose}
          aria-hidden
        />
        <motion.div
          ref={ref}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          style={{ bottom: keyboardInset }}
          // Same bargain as the event sheet: the handle drags it away, and
          // dragListener={false} leaves the emoji grid free to scroll.
          drag="y"
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.9 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100 || info.velocity.y > 700) onClose()
          }}
          role="dialog"
          aria-label="Choose an icon"
          className="fixed inset-x-0 z-[1100] flex flex-col bg-background border-t border-border rounded-t-2xl shadow-2xl px-4 pb-3 max-h-[70dvh]"
        >
          <div
            className="flex justify-center pt-2 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="w-9 h-1 rounded-full bg-muted-foreground/30" aria-hidden />
          </div>
          {body}
          <div style={{ height: keyboardInset ? 0 : 'env(safe-area-inset-bottom)' }} aria-hidden />
        </motion.div>
      </>,
      document.body
    )
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 right-0 top-full mt-2 z-10 bg-background border border-border rounded-xl shadow-xl p-3"
    >
      {body}
    </motion.div>
  )
}
