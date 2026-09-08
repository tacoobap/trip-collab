import { postToAiFunction } from '@/lib/aiRequest'
import type { Trip, DayWithSlots } from '@/types/database'
import type { CollectionItemCategory } from '@/types/database'

export interface CollectionSuggestion {
  name: string
  category: CollectionItemCategory
  one_line_description: string
  suggested_for?: string
}

export interface SuggestCollectionItemsResult {
  suggestions: CollectionSuggestion[]
}

/**
 * Flattens the board down to the wire shape
 * `netlify/functions/suggest-collection-items.ts` expects. The prompt and the
 * system instruction live there, with the key — keep this in step with that
 * file's `InputDay` / `InputSlot`.
 */
function buildPayload(trip: Trip, days: DayWithSlots[], vibeSentence: string | null) {
  return {
    trip: {
      name: trip.name,
      destinations: trip.destinations,
      start_date: trip.start_date,
      end_date: trip.end_date,
    },
    days: days.map((day) => ({
      label: day.label,
      locked_items: day.slots.flatMap((slot) => {
        if (slot.status !== 'locked' || !slot.locked_proposal_id) return []
        const p = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
        if (!p) return []
        return [{ time: slot.time_label, category: slot.category, title: p.title }]
      }),
      open_slots: day.slots
        .filter((s) => s.status === 'open' || s.status === 'proposed')
        .map((s) => ({ time: s.time_label, category: s.category })),
    })),
    vibe: vibeSentence,
  }
}

export async function suggestCollectionItems(
  trip: Trip,
  days: DayWithSlots[],
  vibeSentence: string | null,
  getIdToken: () => Promise<string | null>
): Promise<SuggestCollectionItemsResult> {
  const parsed = await postToAiFunction<SuggestCollectionItemsResult>(
    'suggest-collection-items',
    buildPayload(trip, days, vibeSentence),
    getIdToken
  )

  if (!Array.isArray(parsed.suggestions)) {
    return { suggestions: [] }
  }
  const normalized = parsed.suggestions.slice(0, 3).map((s) => ({
    name: String(s?.name ?? '').trim() || 'Suggestion',
    category: ['food', 'activity', 'other'].includes(s?.category) ? s.category : 'other',
    one_line_description: String(s?.one_line_description ?? '').trim() || '',
    suggested_for: s?.suggested_for ? String(s.suggested_for).trim() : undefined,
  }))
  return { suggestions: normalized }
}
