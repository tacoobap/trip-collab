import { GoogleGenerativeAI } from '@google/generative-ai'
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

const SYSTEM_PROMPT = `You are crafting editorial copy for a boutique travel itinerary in the style of a premium travel magazine — think Condé Nast Traveler meets a handwritten trip journal. Your writing is specific, evocative, and personal — never generic.

Given trip data, return a JSON object with exactly this shape:
{
  "tagline": string,          // One line: evocative subtitle for the trip — e.g. "A Romantic Valentine's Getaway · 2026"
  "vibe_heading": string,     // 2–4 words: the section headline above the vibe cards, e.g. "Intention Over Itinerary", "Adventure Awaits", "Slow & Savored"
  "vibe_tags": [              // Exactly 6 tags capturing the trip's character (like the Charleston itinerary)
    { "label": string, "subtitle": string }  // label: 1–2 words (e.g. "Walkable", "Coffee First", "Golden Hour"). subtitle: 2–5 words only — punchy phrase, NOT a sentence. Examples: "Everything on foot", "Every morning starts right", "Rooftop cocktails at sunset", "Wander, don't museum", "Boutique over chain", "Designed for two"
  ],
  "days": [
    {
      "day_id": string,
      "narrative_title": string,   // 3–5 words, punchy day title — e.g. "Arrive & Settle In"
      "image_query": string        // Specific Unsplash search query for a beautiful hero photo for this day
                                   // Be very specific: include place names, lighting cues, city — e.g. "Rainbow Row Charleston golden hour"
    }
  ],
  "proposals": [
    {
      "proposal_id": string,
      "editorial_caption": string,  // One vivid sentence or evocative phrase — NOT a description.
                                    // Impressionistic. e.g. "Spanish moss, oak canopies, morning light"
                                    // or "A proper start — buttery croissants and the morning buzz of Saint-Germain"
      "suggested_time": string | null  // A specific clock time if context suggests one (e.g. "9:30 AM", "7:00 PM").
                                       // Use the slot's existing time as a guide (Morning → ~9:00 AM, Afternoon → ~2:00 PM, Evening → ~7:00 PM).
                                       // null only if genuinely ambiguous.
    }
  ]
}

Rules:
- Be specific to the actual places and activities. Do not use generic travel phrases.
- Editorial captions should feel like a sentence from a travel essay, not a review.
- Vibe tags: exactly 6. Each subtitle must be 2–5 words — concise and evocative (e.g. "Everything on foot", "Boutique over chain"). No full sentences.
- vibe_heading sets the tone for the section (e.g. "Intention Over Itinerary" for a relaxed romantic trip).
- Image queries should be highly specific and visual — include place names, time of day, mood.
- Output valid JSON only. No markdown, no explanation.`

function buildPrompt(trip: Trip, days: DayWithSlots[]): string {
  const lines: string[] = [
    `Trip: ${trip.name}`,
    `Destinations: ${trip.destinations.join(', ')}`,
    trip.start_date ? `Dates: ${trip.start_date} to ${trip.end_date ?? ''}` : '',
    '',
    'Days and locked activities:',
  ]

  for (const day of days) {
    lines.push(`\n${day.label} (${day.city}${day.date ? `, ${day.date}` : ''})  [day_id: ${day.id}]`)
    const lockedSlots = day.slots.filter((s) => s.status === 'locked' && s.locked_proposal_id)
    if (lockedSlots.length === 0) {
      lines.push('  — No locked activities yet')
    } else {
      for (const slot of lockedSlots) {
        const p = slot.proposals.find((p) => p.id === slot.locked_proposal_id)
        if (!p) continue
        lines.push(
          `  • [${p.exact_time ?? slot.time_label}] (${slot.category}) ${p.title}` +
          `${p.note ? ` — ${p.note}` : ''}  [proposal_id: ${p.id}]`
        )
      }
    }
  }

  lines.push('\nGenerate the narrative JSON for this trip.')
  return lines.filter((l) => l !== '').join('\n')
}

export async function generateNarrative(
  trip: Trip,
  days: DayWithSlots[]
): Promise<NarrativeResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set in .env')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.75,
    },
  })

  const result = await model.generateContent(buildPrompt(trip, days))
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Gemini')

  return JSON.parse(text) as NarrativeResult
}
