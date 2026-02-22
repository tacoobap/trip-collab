import { motion } from 'framer-motion'
import type { VibeTag } from '@/types/database'

const VIBE_ICONS: Record<string, string> = {
  walkable: '🚶',
  romantic: '🌹',
  adventure: '🧗',
  foodie: '🍷',
  food: '🍷',
  culture: '🎨',
  nature: '🌿',
  relaxed: '☀️',
  chill: '☀️',
  urban: '🏙',
  coastal: '🌊',
  mountain: '⛰',
  coffee: '☕',
  nightlife: '🌃',
  history: '🏛',
  architecture: '🏛',
  hidden: '🗝',
  luxury: '✦',
  budget: '🎒',
  family: '👨‍👩‍👧',
  solo: '🧭',
  scenic: '🌅',
}

function vibeEmoji(label: string): string {
  const key = label.toLowerCase().replace(/\s+/g, '')
  for (const [k, v] of Object.entries(VIBE_ICONS)) {
    if (key.includes(k)) return v
  }
  return '✦'
}

interface VibeTagsSectionProps {
  tags: VibeTag[]
}

export function VibeTagsSection({ tags }: VibeTagsSectionProps) {
  if (tags.length === 0) return null

  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 pt-20 pb-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">
          The Vibe
        </p>
        <p className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-10">
          {tags[0]?.label && tags.length >= 3
            ? `${tags.slice(0, 3).map(t => t.label).join(' · ')}`
            : 'What This Trip Is About'}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tags.map((tag, i) => (
          <motion.div
            key={tag.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.4, delay: i * 0.07, ease: 'easeOut' }}
            className="rounded-xl border border-border bg-muted/20 px-4 py-3.5"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{vibeEmoji(tag.label)}</span>
              <span className="text-sm font-semibold text-foreground">{tag.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{tag.subtitle}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
