import { useState } from 'react'
import { Loader2, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'

interface AddProposalFormProps {
  currentName: string
  onSubmit: (data: { title: string }) => Promise<void>
  onCancel: () => void
}

export function AddProposalForm({ currentName, onSubmit, onCancel }: AddProposalFormProps) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      await onSubmit({ title: title.trim() })
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-2.5 bg-muted/50 border border-border/60 rounded-xl px-3 py-2.5">
        <ProposerAvatar name={currentName} size="xs" />
        <input
          autoFocus
          placeholder="What's the idea?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
          disabled={loading}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground min-w-0 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center transition-opacity disabled:opacity-30"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
            : <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
          }
        </button>
      </form>
      <button
        type="button"
        onClick={onCancel}
        className="w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground mt-2 py-1 transition-colors"
      >
        Cancel
      </button>
    </motion.div>
  )
}
