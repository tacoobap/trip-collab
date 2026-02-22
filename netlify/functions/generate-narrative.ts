import type { Handler } from '@netlify/functions'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT = `You are crafting editorial copy for a boutique travel itinerary in the style of a premium travel magazine — think Condé Nast Traveler meets a handwritten trip journal. Your writing is specific, evocative, and personal — never generic.

Given trip data, return a JSON object with exactly this shape:
{
  "tagline": string,          // One line: evocative subtitle for the trip — e.g. "A Romantic Valentine's Getaway · 2026"
  "vibe_heading": string,      // 2–4 words: section headline above vibe cards, e.g. "Intention Over Itinerary", "Adventure Awaits", "Slow & Savored"
  "vibe_tags": [               // Exactly 6 tags capturing the trip's character
    { "label": string, "subtitle": string }  // label: 1–2 words (e.g. "Walkable", "Coffee First"). subtitle: 2–5 words only — punchy phrase, e.g. "Everything on foot", "Boutique over chain", "Designed for two"
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
      "editorial_caption": string  // One vivid sentence or evocative phrase — NOT a description.
                                   // Impressionistic. e.g. "Spanish moss, oak canopies, morning light"
                                   // or "A proper start — buttery croissants and the morning buzz of Saint-Germain"
    }
  ]
}

Rules:
- Be specific to the actual places and activities. Do not use generic travel phrases.
- Editorial captions should feel like a sentence from a travel essay, not a review.
- Vibe tags: exactly 6. Each subtitle must be 2–5 words — concise (e.g. "Everything on foot", "Boutique over chain"). No full sentences.
- vibe_heading sets the tone (e.g. "Intention Over Itinerary" for a relaxed romantic trip).
- Image queries should be highly specific and visual — include place names, time of day, mood.
- Output valid JSON only. No markdown, no explanation.`

interface LockedItem {
  id: string
  time: string
  category: string
  title: string
  note: string | null
}

interface InputDay {
  id: string
  label: string
  city: string
  date: string | null
  locked_items: LockedItem[]
}

interface InputTrip {
  name: string
  destinations: string[]
  start_date: string | null
  end_date: string | null
}

function buildPrompt(trip: InputTrip, days: InputDay[]): string {
  const lines: string[] = [
    `Trip: ${trip.name}`,
    `Destinations: ${trip.destinations.join(', ')}`,
    trip.start_date ? `Dates: ${trip.start_date} to ${trip.end_date ?? ''}` : '',
    '',
    'Days and locked activities:',
  ]

  for (const day of days) {
    lines.push(`\n${day.label} (${day.city}${day.date ? `, ${day.date}` : ''})`)
    if (day.locked_items.length === 0) {
      lines.push('  — No locked activities yet')
    } else {
      for (const item of day.locked_items) {
        lines.push(`  • [${item.time}] (${item.category}) ${item.title}${item.note ? ` — ${item.note}` : ''}`)
      }
    }
  }

  lines.push('\nGenerate the narrative JSON for this trip.')
  return lines.filter((l) => l !== null).join('\n')
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) }
  }

  try {
    const { trip, days } = JSON.parse(event.body ?? '{}') as {
      trip: InputTrip
      days: InputDay[]
    }

    if (!trip || !days) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing trip or days in request body' }) }
    }

    const userPrompt = buildPrompt(trip, days)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.75,
        maxOutputTokens: 2000,
      },
    })

    const result = await model.generateContent(userPrompt)
    const text = result.response.text()
    if (!text) throw new Error('Empty response from Gemini')

    const parsed = JSON.parse(text)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    }
  } catch (err) {
    console.error('[generate-narrative]', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Narrative generation failed', detail: String(err) }),
    }
  }
}
