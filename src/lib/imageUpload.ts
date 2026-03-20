async function compressImage(
  file: File,
  maxWidth = 3840,
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality)
    }
    img.src = url
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.readAsDataURL(blob)
  })
}

async function uploadViaNetlifyFunction(
  filePath: string,
  imageBase64: string,
  getIdToken: () => Promise<string | null>,
  onProgress?: (pct: number) => void
): Promise<string> {
  const idToken = await getIdToken()
  if (!idToken) {
    throw new Error('Sign in to upload images.')
  }
  onProgress?.(70)
  const base =
    typeof window !== 'undefined' ? window.location.origin : ''
  const res = await fetch(`${base}/.netlify/functions/upload-github-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ path: filePath, imageBase64 }),
  })
  const data = (await res.json()) as { url?: string; error?: string; detail?: string }
  onProgress?.(100)
  if (!res.ok) {
    const msg = data.detail || data.error || `Upload failed: ${res.status}`
    throw new Error(msg)
  }
  if (!data.url) throw new Error('Invalid response from upload')
  return data.url
}

/** Local dev only: direct GitHub API (not included in production bundle — avoids leaking PAT into `dist`). */
async function uploadDirectToGithub(
  filePath: string,
  imageBase64: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN as string | undefined
  const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER as string | undefined
  const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO as string | undefined
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    const missing = [
      !GITHUB_TOKEN && 'VITE_GITHUB_TOKEN',
      !GITHUB_OWNER && 'VITE_GITHUB_OWNER',
      !GITHUB_REPO && 'VITE_GITHUB_REPO',
    ].filter(Boolean)
    throw new Error(
      `Image upload not configured: set ${missing.join(', ')} in .env, or use production deploy with Netlify functions.`
    )
  }
  onProgress?.(65)
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  }

  let sha: string | undefined
  const getRes = await fetch(apiUrl, { headers })
  if (getRes.ok) {
    const data = (await getRes.json()) as { sha: string }
    sha = data.sha
  }

  onProgress?.(75)

  const body: Record<string, string> = { message: `Upload ${filePath}`, content: imageBase64 }
  if (sha) body.sha = sha

  const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!putRes.ok) {
    const putBody = await putRes.text()
    throw new Error(`GitHub upload failed: ${putRes.status} ${putBody}`)
  }

  onProgress?.(100)
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${filePath}`
}

/**
 * Upload a JPEG to the configured GitHub repo (Contents API).
 * - **Production:** uses `/.netlify/functions/upload-github-image` with Firebase auth; PAT lives in `GITHUB_TOKEN` (Netlify env).
 * - **Local `npm run dev`:** optional direct API via `VITE_GITHUB_*` in `.env`.
 */
export async function uploadImage(
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
  getIdToken?: () => Promise<string | null>
): Promise<string> {
  onProgress?.(10)
  const compressed = await compressImage(file)
  onProgress?.(40)
  const base64 = await blobToBase64(compressed)

  const filePath = path.replace(/\.[^/.]+$/, '') + '.jpg'

  if (import.meta.env.PROD) {
    if (!getIdToken) {
      throw new Error('Image upload requires authentication.')
    }
    return uploadViaNetlifyFunction(filePath, base64, getIdToken, onProgress)
  }

  return uploadDirectToGithub(filePath, base64, onProgress)
}
