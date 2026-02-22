import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'

interface AddProposalFormProps {
  currentName: string
  onSubmit: (data: { title: string; note: string; url: string }) => Promise<void>
  onCancel: () => void
}

export function AddProposalForm({ currentName, onSubmit, onCancel }: AddProposalFormProps) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      await onSubmit({ title: title.trim(), note: note.trim(), url: url.trim() })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="pt-3 pb-1 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <ProposerAvatar name={currentName} size="xs" showName />
          </div>

          <Input
            placeholder="What's the idea? (e.g. Wild Common for dinner)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="text-sm"
          />

          <Textarea
            placeholder="Any notes? (optional — vibe, address, why you love it)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="text-sm resize-none"
          />

          <Input
            placeholder="Link (optional — Google Maps, website)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            className="text-sm"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || loading}
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              {loading ? 'Adding…' : 'Add idea'}
            </Button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  )
}
