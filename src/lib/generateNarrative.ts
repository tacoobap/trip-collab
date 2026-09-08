import { postToAiFunction } from '@/lib/aiRequest'
import type { Trip, DayWithSlots, VibeTag } from '@/types/database'

export interface NarrativeDay {
  day_id: string
  narrative_title: string
  image_query: string
}

export interface NarrativeProposal {
  proposal_id: string
  editorial_caption: string
  suggested_time: string | null
}

export interface NarrativeResult {
  tagline: string
  vibe_heading: string
  vibe_tags: VibeTag[]
  days: NarrativeDay[]
  proposals: NarrativeProposal[]
}

/**
 * Flattens the board down to the wire shape `netlify/functions/generate-narrative.ts`
 * expects. The prompt and the system instruction live there, with the key —
 * keep this in step with that file's `InputDay` / `LockedItem`.
 */
function buildPayload(trip: Trip, days: DayWithSlots[]) {
  return {
    trip: {
      name: trip.name,
      destinations: trip.destinations,
      start_date: trip.start_date,
      end_date: trip.end_date,
    },
    days: days.map((day) => ({
      id: day.id,
      label: day.label,
      city: day.city,
      date: day.date,
      locked_items: day.slots.flatMap((slot) => {
        if (slot.status !== 'locked' || !slot.locked_proposal_id) return []
        const p = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
        if (!p) return []
        return [{
          id: p.id,
          time: p.exact_time ?? slot.time_label,
          category: slot.category,
          title: p.title,
          note: p.note,
        }]
      }),
    })),
  }
}

export async function generateNarrative(
  trip: Trip,
  days: DayWithSlots[],
  getIdToken: () => Promise<string | null>
): Promise<NarrativeResult> {
  return postToAiFunction<NarrativeResult>(
    'generate-narrative',
    buildPayload(trip, days),
    getIdToken
  )
}
