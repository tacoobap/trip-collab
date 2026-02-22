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
// Map label + subtitle keywords to Lucide icon (icon per card, based on text)
const ICON_MAP: Array<{ keys: string[]; Icon: LucideIcon }> = [
  { keys: ['walkable', 'walk', 'foot', 'on foot'], Icon: Footprints },
  { keys: ['coffee', 'morning', 'starts right'], Icon: Coffee },
  { keys: ['golden', 'sunset', 'sun', 'rooftop', 'cocktails'], Icon: Sun },
  { keys: ['architecture', 'building', 'wander', 'museum'], Icon: Building2 },
  { keys: ['dining', 'food', 'eat', 'curated', 'boutique', 'chain'], Icon: UtensilsCrossed },
  { keys: ['romantic', 'couple', 'two', 'for two'], Icon: Heart },
  { keys: ['mountain', 'hike', 'nature'], Icon: Mountain },
  { keys: ['coastal', 'beach', 'water'], Icon: Waves },
  { keys: ['night', 'nightlife'], Icon: Moon },
  { keys: ['culture', 'art'], Icon: Palette },
]

function vibeIcon(label: string, subtitle?: string): LucideIcon {
  const text = `${label} ${subtitle ?? ''}`.toLowerCase()
  for (const { keys, Icon } of ICON_MAP) {
    if (keys.some((k) => text.includes(k))) return Icon
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
    <section className="py-16 md:py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-sans text-xs tracking-[0.25em] uppercase text-primary font-semibold">
            The Vibe
          </span>
          <h2 className="font-serif text-3xl md:text-4xl text-foreground mt-3 mb-12">
            {sectionTitle}
          </h2>
        </motion.header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {tags.slice(0, 6).map((tag, i) => {
            const Icon = vibeIcon(tag.label, tag.subtitle)
            const colorHex = ['#b85c3a', '#8B6914', '#b8860b', '#3a5470', '#4a7060', '#a8304a'][i % 6]
            const hoverBg = [
              'rgba(184,92,58,0.05)',
              'rgba(139,105,20,0.05)',
              'rgba(184,134,11,0.05)',
              'rgba(58,84,112,0.05)',
              'rgba(74,112,96,0.05)',
              'rgba(168,48,74,0.05)',
            ][i % 6]
            return (
              <motion.div
                key={tag.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ duration: 0.5, delay: 0.08 * i }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="p-6 rounded-xl bg-card border border-border transition-all duration-300 hover:shadow-md hover:border-transparent group cursor-default"
                onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <Icon
                  size={26}
                  strokeWidth={1.5}
                  className="mb-4 mx-auto transition-transform duration-300 group-hover:scale-110"
                  style={{ color: colorHex }}
                />
                <h3
                  className="font-serif text-lg mb-1 transition-colors duration-300"
                  style={{ color: colorHex }}
                >
                  {tag.label}
                </h3>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                  {tag.subtitle}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
