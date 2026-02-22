import { motion } from 'framer-motion'
import {
  Footprints,
  Coffee,
  Sun,
  Building2,
  UtensilsCrossed,
  Heart,
  Mountain,
  Waves,
  Moon,
  Palette,
  type LucideIcon,
} from 'lucide-react'
import type { VibeTag } from '@/types/database'
import { cn } from '@/lib/utils'

// Charleston-style accent colors (icon + label per card)
const CARD_COLORS = [
  'text-[#8B4513]',   // sienna / reddish-brown (walkable)
  'text-[#B8860B]',   // dark goldenrod (coffee)
  'text-[#C9A227]',   // golden (golden hour)
  'text-[#6B7B8C]',   // slate (architecture)
  'text-[#6B8E23]',   // olive (dining)
  'text-[#B76E79]',   // dusty rose (romantic)
] as const

const CARD_BG = [
  'bg-[#8B4513]/8',
  'bg-[#B8860B]/8',
  'bg-[#C9A227]/8',
  'bg-[#6B7B8C]/8',
  'bg-[#6B8E23]/8',
  'bg-[#B76E79]/8',
] as const

// Map label keywords to Lucide icon (else fallback)
const ICON_MAP: Array<{ keys: string[]; Icon: LucideIcon }> = [
  { keys: ['walkable', 'walk', 'foot'], Icon: Footprints },
  { keys: ['coffee', 'morning'], Icon: Coffee },
  { keys: ['golden', 'sunset', 'sun', 'rooftop'], Icon: Sun },
  { keys: ['architecture', 'building', 'wander', 'museum'], Icon: Building2 },
  { keys: ['dining', 'food', 'eat', 'curated', 'boutique'], Icon: UtensilsCrossed },
  { keys: ['romantic', 'couple', 'two'], Icon: Heart },
  { keys: ['mountain', 'hike', 'nature'], Icon: Mountain },
  { keys: ['coastal', 'beach', 'water'], Icon: Waves },
  { keys: ['night', 'nightlife'], Icon: Moon },
  { keys: ['culture', 'art'], Icon: Palette },
]

function vibeIcon(label: string): LucideIcon {
  const lower = label.toLowerCase()
  for (const { keys, Icon } of ICON_MAP) {
    if (keys.some((k) => lower.includes(k))) return Icon
  }
  return Sun
}

interface VibeTagsSectionProps {
  tags: VibeTag[]
  heading?: string | null
}

export function VibeTagsSection({ tags, heading }: VibeTagsSectionProps) {
  if (tags.length === 0) return null

  const sectionTitle = heading ?? 'Intention Over Itinerary'

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-8">
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center mb-6"
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-primary/90 mb-2 font-sans">
          The Vibe
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground">
          {sectionTitle}
        </h2>
      </motion.header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {tags.slice(0, 6).map((tag, i) => {
          const Icon = vibeIcon(tag.label)
          const colorClass = CARD_COLORS[i % CARD_COLORS.length]
          const bgClass = CARD_BG[i % CARD_BG.length]
          return (
            <motion.div
              key={tag.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
              className="rounded-xl border border-border/60 bg-white shadow-sm px-5 py-5 flex flex-col"
            >
              <div className={cn('flex items-center gap-2 mb-2', colorClass)}>
                <span className={bgClass + ' rounded-lg p-1.5'}>
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold font-sans">{tag.label}</span>
              </div>
              <p className="text-xs text-muted-foreground font-sans leading-snug">
                {tag.subtitle}
              </p>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
