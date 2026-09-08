/**
 * The Gemini key is server-side only. Both AI features post a structured
 * payload to a Netlify function that holds the key and builds the prompt; the
 * bundle carries no key and no prompt.
 *
 * There is no local-dev fallback on purpose — the whole point of the item was
 * that `VITE_GEMINI_API_KEY` shipped in `dist`. Run `netlify dev` to exercise
 * these locally; plain `vite` doesn't serve `/.netlify/functions/*`.
 */
export async function postToAiFunction<T>(
  fnName: string,
  payload: unknown,
  getIdToken: () => Promise<string | null>
): Promise<T> {
  const idToken = await getIdToken()
  if (!idToken) throw new Error('Sign in to use AI features.')

  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const res = await fetch(`${base}/.netlify/functions/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    // Under plain `vite dev` the SPA fallback answers with index.html and a 200,
    // so an unparseable body is the normal shape of "functions aren't running"
    // rather than a real server fault. Say so instead of surfacing a JSON error.
    if (import.meta.env.DEV) {
      throw new Error(`AI features need the Netlify functions running locally — start the app with \`netlify dev\` instead of \`npm run dev\`.`)
    }
    throw new Error(`AI request failed: ${res.status}`)
  }

  if (!res.ok) {
    const err = data as { error?: string; detail?: string }
    throw new Error(err.detail || err.error || `AI request failed: ${res.status}`)
  }

  return data as T
}
