import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Trip, DayWithSlots } from '@/types/database'
import type { CollectionItemCategory } from '@/types/database'

export interface CollectionSuggestion {
  name: string
  category: CollectionItemCategory
  one_line_description: string
  suggested_for?: string
}

const SYSTEM_PROMPT = `You suggest concrete places or activities for a trip — restaurants, cafés, sights, experiences — that fit the itinerary and the user's vibe.

Given trip info, current itinerary (locked activities per day), open slots (times with no activity yet), and an optional vibe sentence from the user, return a JSON object with exactly this shape:
{
  "suggestions": [
    {
      "name": string,           // Short place or activity name, e.g. "Husk", "Rainbow Row walk", "The Daily coffee"
      "category": "food" | "activity" | "other",
      "one_line_description": string,  // One vivid sentence, e.g. "Southern fine dining in a historic mansion"
      "suggested_for": string | null  // Optional: e.g. "Day 2 morning" or "Open dinner slot on Day 3"
    }
  ]
}

Rules:
- Return at most 3 suggestions. Fewer is fine if context is thin.
- Prefer high-quality places: well-reviewed, critically acclaimed, award-winning, or locally beloved spots. Avoid generic chains or mediocre options when better alternatives exist.
- Don't suggest the obvious mega-attractions everyone already knows (e.g. the Louvre, Eiffel Tower, Times Square). Prefer lesser-known gems, standout local spots, or distinctive experiences that feel more curated.
- Be specific to the trip's destinations and dates. Suggest real or realistic places/activities.
- If the user provided a vibe sentence, prioritize suggestions that match it (e.g. "chill coffee spot" → cafés).
- suggested_for should reference open slots or gaps when relevant.
- Output valid JSON only. No markdown, no explanation.`

function buildPrompt(
  trip: Trip,
  days: DayWithSlots[],
  vibeSentence: string | null
): string {
  const lines: string[] = [
    `Trip: ${trip.name}`,
    `Destinations: ${trip.destinations.join(', ')}`,
    trip.start_date ? `Dates: ${trip.start_date} to ${trip.end_date ?? ''}` : '',
    '',
  ]

  if (vibeSentence?.trim()) {
    lines.push(`User vibe: "${vibeSentence.trim()}"`, '')
  }

  lines.push('Current itinerary (locked activities):')
  for (const day of days) {
    const locked = day.slots.filter((s) => s.status === 'locked' && s.locked_proposal_id)
    if (locked.length === 0) {
      lines.push(`  ${day.label}: (no locked activities)`)
    } else {
      for (const slot of locked) {
        const p = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
        if (p) {
          lines.push(`  ${day.label} — ${slot.time_label}: ${p.title} (${slot.category})`)
        }
      }
    }
  }

  lines.push('', 'Open slots (no activity yet):')
  let hasOpen = false
  for (const day of days) {
    const open = day.slots.filter((s) => s.status === 'open' || s.status === 'proposed')
    for (const slot of open) {
      lines.push(`  ${day.label} — ${slot.time_label} (${slot.category})`)
      hasOpen = true
    }
  }
  if (!hasOpen) lines.push('  (none)')

  lines.push('', 'Return up to 3 suggestions as JSON.')
  return lines.join('\n')
}

export interface SuggestCollectionItemsResult {
  suggestions: CollectionSuggestion[]
}

export async function suggestCollectionItems(
  trip: Trip,
  days: DayWithSlots[],
  vibeSentence: string | null
): Promise<SuggestCollectionItemsResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string
  if (!apiKey) throw new Error('AI suggestions are not configured. Set VITE_GEMINI_API_KEY in your deployment environment (e.g. Netlify or Vercel) and redeploy.')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
    },
  })

  const result = await model.generateContent(buildPrompt(trip, days, vibeSentence))
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Gemini')

  const parsed = JSON.parse(text) as SuggestCollectionItemsResult
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
