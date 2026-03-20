import type { Handler } from '@netlify/functions'
import { getAuthUidFromEvent, requireAuthResponse } from './lib/verifyAuth'

const MAX_BASE64_CHARS = 14_000_000 // ~10.5MB binary upper bound

function normalizePath(path: string): string | null {
  const trimmed = path.trim().replace(/^\/+/, '')
  if (!trimmed || trimmed.includes('..')) return null
  return trimmed.replace(/\.[^/.]+$/, '') + '.jpg'
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const uid = await getAuthUidFromEvent(event)
  const authError = requireAuthResponse(uid)
  if (authError) {
    return {
      statusCode: authError.statusCode,
      body: authError.body,
      headers: { 'Content-Type': 'application/json' },
    }
  }

  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  if (!token || !owner || !repo) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'GitHub upload not configured',
        detail: 'Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO (server-side only, not VITE_*)',
      }),
    }
  }

  let body: { path?: string; imageBase64?: string }
  try {
    body = JSON.parse(event.body || '{}') as { path?: string; imageBase64?: string }
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const filePath = typeof body.path === 'string' ? normalizePath(body.path) : null
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
  if (!filePath || !imageBase64) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing path or imageBase64' }),
    }
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return {
      statusCode: 413,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Image too large' }),
    }
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
  }

  let sha: string | undefined
  const getRes = await fetch(apiUrl, { headers })
  if (getRes.ok) {
    const data = (await getRes.json()) as { sha?: string }
    if (data.sha) sha = data.sha
  }

  const putBody: Record<string, string> = {
    message: `Upload ${filePath}`,
    content: imageBase64,
  }
  if (sha) putBody.sha = sha

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  })

  if (!putRes.ok) {
    const text = await putRes.text()
    console.error('[upload-github-image]', putRes.status, text)
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'GitHub upload failed', detail: `${putRes.status} ${text}` }),
    }
  }

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }
}
