import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import type { TripNote } from '@/types/database'

function relativeTime(value: unknown): string {
  let ms: number
  if (typeof value === 'string') {
    ms = new Date(value).getTime()
  } else if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    ms = (value as { toMillis: () => number }).toMillis()
  } else {
    return ''
  }
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

interface TripNotesDrawerProps {
  open: boolean
  onClose: () => void
  notes: TripNote[]
  currentName: string | null
  onAdd: (text: string) => Promise<void>
  onDelete: (noteId: string) => Promise<void>
}

export function TripNotesDrawer({
  open,
  onClose,
  notes,
  currentName,
  onAdd,
  onDelete,
}: TripNotesDrawerProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 100)
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !currentName) return
    setSubmitting(true)
    try {
      await onAdd(text)
      setText('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl border-t border-border shadow-2xl max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-serif font-semibold text-foreground">Trip notes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  High-level thoughts, considerations, constraints
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No notes yet. Add the first one below.
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-muted/50 rounded-xl p-4 group"
                  >
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {note.text}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5">
                        <ProposerAvatar name={note.author_name} size="xs" showName />
                        <span className="text-xs text-muted-foreground">
                          · {relativeTime(note.created_at)}
                        </span>
                      </div>
                      {note.author_name === currentName && (
                        <button
                          onClick={() => void onDelete(note.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add note form */}
            <form
              onSubmit={handleSubmit}
              className="px-5 py-4 border-t border-border shrink-0 space-y-2"
            >
              <Textarea
                ref={textareaRef}
                placeholder={
                  currentName
                    ? 'Add a note… (⌘↵ to submit)'
                    : 'Set your name to add notes'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={!currentName}
                className="resize-none text-sm"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!text.trim() || !currentName || submitting}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {submitting ? 'Adding…' : 'Add note'}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
