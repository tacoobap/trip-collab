import { motion } from 'framer-motion'
import type { DayWithSlots } from '@/types/database'

interface AtAGlanceSectionProps {
  days: DayWithSlots[]
}

export function AtAGlanceSection({ days }: AtAGlanceSectionProps) {
  const rows: { dayLabel: string; time: string; title: string; isFirstOfDay: boolean }[] = []

  for (const day of days) {
    const lockedSlots = [...day.slots]
      .filter((s) => s.status === 'locked' && s.locked_proposal_id)
      .sort((a, b) => {
        const pa = a.proposals.find((p) => p.id === a.locked_proposal_id)
        const pb = b.proposals.find((p) => p.id === b.locked_proposal_id)
        return a.sort_order - b.sort_order || (pa?.exact_time ?? '') < (pb?.exact_time ?? '') ? -1 : 1
      })

    lockedSlots.forEach((slot, i) => {
      const p = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
      if (!p) return
      rows.push({
        dayLabel: day.label,
        time: p.exact_time ?? p.narrative_time ?? slot.time_label,
        title: p.title,
        isFirstOfDay: i === 0,
      })
    })
  }

  if (rows.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-20"
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-2">
        At a Glance
      </p>
      <p className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-8">
        The Full Itinerary
      </p>

      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-1/4">Day</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-1/4">Time</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3 align-top">
                  {row.isFirstOfDay ? (
                    <span className="text-xs font-semibold text-foreground">{row.dayLabel}</span>
                  ) : (
                    <span />
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{row.time}</span>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="text-sm text-foreground">{row.title}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  )
}
