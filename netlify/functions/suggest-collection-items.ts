import type { Handler } from '@netlify/functions'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthUidFromEvent, requireAuthResponse } from './lib/verifyAuth'

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

/**
 * The wire shape. The client flattens `DayWithSlots` down to this before
 * posting — `src/types/database` can't be imported here (functions are outside
 * `tsconfig.app.json`), and sending the prompt itself would turn this into an
 * open Gemini proxy for anyone with an account.
 */
interface InputSlot {
  time: string
  category: string
  title?: string
}

interface InputDay {
  label: string
  locked_items: InputSlot[]
  open_slots: InputSlot[]
}

interface InputTrip {
  name: string
  destinations: string[]
  start_date: string | null
  end_date: string | null
}

/** A trip longer than this isn't real — it's someone running up the API bill. */
const MAX_DAYS = 60
/** The vibe sentence is one line of user text, not a payload. */
const MAX_VIBE_CHARS = 500

function buildPrompt(trip: InputTrip, days: InputDay[], vibeSentence: string | null): string {
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
    if (day.locked_items.length === 0) {
      lines.push(`  ${day.label}: (no locked activities)`)
    } else {
      for (const item of day.locked_items) {
        lines.push(`  ${day.label} — ${item.time}: ${item.title} (${item.category})`)
      }
    }
  }

  lines.push('', 'Open slots (no activity yet):')
  let hasOpen = false
  for (const day of days) {
    for (const slot of day.open_slots) {
      lines.push(`  ${day.label} — ${slot.time} (${slot.category})`)
      hasOpen = true
    }
  }
  if (!hasOpen) lines.push('  (none)')

  lines.push('', 'Return up to 3 suggestions as JSON.')
  return lines.join('\n')
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const uid = await getAuthUidFromEvent(event)
  const authError = requireAuthResponse(uid)
  if (authError) {
    return { statusCode: authError.statusCode, body: authError.body, headers: { 'Content-Type': 'application/json' } }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) }
  }

  try {
    const { trip, days, vibe } = JSON.parse(event.body ?? '{}') as {
      trip: InputTrip
      days: InputDay[]
      vibe: string | null
    }

    if (!trip || !Array.isArray(days)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing trip or days in request body' }) }
    }
    if (days.length > MAX_DAYS) {
      return { statusCode: 400, body: JSON.stringify({ error: `Too many days (max ${MAX_DAYS})` }) }
    }

    const vibeSentence = typeof vibe === 'string' ? vibe.slice(0, MAX_VIBE_CHARS) : null

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

    // Parsed here rather than passed straight through, so a malformed
    // generation surfaces as a 500 with a log line instead of as a JSON.parse
    // throw in the browser, where nobody sees what Gemini actually said.
    const parsed = JSON.parse(text) as unknown

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    }
  } catch (err) {
    console.error('[suggest-collection-items]', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Suggestions failed', detail: String(err) }),
    }
  }
}
