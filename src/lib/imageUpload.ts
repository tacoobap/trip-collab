const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN as string | undefined
const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER as string | undefined
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO as string | undefined

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

export async function uploadImage(
  path: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    const missing = [
      !GITHUB_TOKEN && 'VITE_GITHUB_TOKEN',
      !GITHUB_OWNER && 'VITE_GITHUB_OWNER',
      !GITHUB_REPO && 'VITE_GITHUB_REPO',
    ].filter(Boolean)
    throw new Error(
      `Image upload not configured: set ${missing.join(', ')} in your build environment (e.g. Netlify Environment Variables) and redeploy.`
    )
  }
  onProgress?.(10)
  const compressed = await compressImage(file)
  onProgress?.(40)
  const base64 = await blobToBase64(compressed)
  onProgress?.(65)

  // Normalise path to always end in .jpg
  const filePath = path.replace(/\.[^/.]+$/, '') + '.jpg'
  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
  }

  // GitHub requires the existing file's SHA when overwriting
  let sha: string | undefined
  const getRes = await fetch(apiUrl, { headers })
  if (getRes.ok) {
    const data = await getRes.json() as { sha: string }
    sha = data.sha
  }

  onProgress?.(75)

  const body: Record<string, string> = { message: `Upload ${filePath}`, content: base64 }
  if (sha) body.sha = sha

  const putRes = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!putRes.ok) {
    const putBody = await putRes.text()
    throw new Error(`GitHub upload failed: ${putRes.status} ${putBody}`)
  }

  onProgress?.(100)
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${filePath}`
}
