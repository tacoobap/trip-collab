import { useState } from 'react'
import { motion } from 'framer-motion'
import type { DayWithSlots } from '@/types/database'
import { cn } from '@/lib/utils'
import { parseTimeToMinutes } from '@/lib/timeUtils'

interface AtAGlanceSectionProps {
  days: DayWithSlots[]
}

type RowStatus = 'locked' | 'proposed' | 'open'

type Row = {
  dayLabel: string
  time: string
  title: string
  status: RowStatus
  isFirstOfDay: boolean
}

function buildRows(days: DayWithSlots[], mode: 'locked' | 'full'): Row[] {
  const rows: Row[] = []

  for (const day of days) {
    const slots = [...day.slots].sort((a, b) => {
      const aLocked = a.proposals.find((p) => p.id === a.locked_proposal_id)
      const bLocked = b.proposals.find((p) => p.id === b.locked_proposal_id)
      const aTime = parseTimeToMinutes(aLocked?.exact_time ?? aLocked?.narrative_time ?? a.time_label)
      const bTime = parseTimeToMinutes(bLocked?.exact_time ?? bLocked?.narrative_time ?? b.time_label)
      if (aTime !== bTime) return aTime - bTime
      return a.sort_order - b.sort_order
    })

    let firstAdded = true

    for (const slot of slots) {
      const lockedProposal = slot.proposals.find((p) => p.id === slot.locked_proposal_id)

      if (mode === 'locked' && slot.status !== 'locked') continue

      const isFirstOfDay = firstAdded
      firstAdded = false

      if (slot.status === 'locked' && lockedProposal) {
        rows.push({
          dayLabel: day.label,
          time: lockedProposal.exact_time ?? lockedProposal.narrative_time ?? slot.time_label,
          title: lockedProposal.title,
          status: 'locked',
          isFirstOfDay,
        })
      } else if (slot.status === 'proposed') {
        rows.push({
          dayLabel: day.label,
          time: slot.time_label,
          title: `${slot.proposals.length} idea${slot.proposals.length !== 1 ? 's' : ''} — still deciding`,
          status: 'proposed',
          isFirstOfDay,
        })
      } else {
        rows.push({
          dayLabel: day.label,
          time: slot.time_label,
          title: 'Nothing planned yet',
          status: 'open',
          isFirstOfDay,
        })
      }
    }
  }

  return rows
}

export function AtAGlanceSection({ days }: AtAGlanceSectionProps) {
  const [mode, setMode] = useState<'locked' | 'full'>('locked')

  const rows = buildRows(days, mode)

  if (buildRows(days, 'locked').length === 0) return null

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

      <div className="flex items-end justify-between gap-4 mb-8">
        <p className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
          The Full Itinerary
        </p>

        {/* Toggle */}
        <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30 shrink-0">
          <button
            onClick={() => setMode('locked')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'locked'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Locked in
          </button>
          <button
            onClick={() => setMode('full')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              mode === 'full'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            All slots
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Nothing locked in yet.
          </p>
        ) : (
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
                    <span
                      className={cn(
                        'text-xs whitespace-nowrap',
                        row.status === 'locked' ? 'text-muted-foreground' : 'text-muted-foreground/50'
                      )}
                    >
                      {row.time}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={cn(
                        'text-sm',
                        row.status === 'locked' && 'text-foreground',
                        row.status === 'proposed' && 'text-muted-foreground italic',
                        row.status === 'open' && 'text-muted-foreground/40 italic'
                      )}
                    >
                      {row.title}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </motion.section>
  )
}
