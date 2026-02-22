import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getProposerColor } from '@/lib/proposerColors'

const SUGGESTED_NAMES = ['Rad', 'Tyler']

interface NamePromptProps {
  onSetName: (name: string) => void
}

export function NamePrompt({ onSetName }: NamePromptProps) {
  const [customName, setCustomName] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customName.trim()) onSetName(customName.trim())
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm w-full"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-muted mb-4">
          <Users className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Who are you?</h2>
        <p className="text-muted-foreground text-sm mb-8">
          Your name attaches to ideas and votes you add.
        </p>

        <div className="flex flex-col gap-3">
          {SUGGESTED_NAMES.map((name) => {
            const color = getProposerColor(name)
            return (
              <button
                key={name}
                onClick={() => onSetName(name)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all p-4 text-left"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: color.bg, color: color.text }}
                >
                  {name.charAt(0)}
                </div>
                <span className="font-medium text-foreground">{name}</span>
              </button>
            )
          })}

          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="rounded-xl border border-dashed border-border bg-card hover:border-primary/40 transition-all p-4 text-sm text-muted-foreground hover:text-foreground"
            >
              + Someone else
            </button>
          ) : (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleCustomSubmit}
              className="flex gap-2"
            >
              <Input
                placeholder="Your name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={!customName.trim()}>
                Go
              </Button>
            </motion.form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
