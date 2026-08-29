/**
 * Pulling an image out of a drag-and-drop or a paste.
 *
 * Two shapes come back, because the browser gives us two very different things:
 * dropping a file from Finder (or pasting a screenshot) hands over real bytes,
 * while dragging an image out of another tab only hands over a link.
 */
export type DroppedImage =
  /** Real bytes — uploaded like any other file. */
  | { kind: 'file'; file: File }
  /** A remote image whose bytes we can't read (no CORS headers); linked as-is. */
  | { kind: 'url'; url: string }

/** What a DataTransfer held, before we've tried to turn a link into bytes. */
export type TransferredImage =
  | { kind: 'file'; file: File }
  /**
   * `vouched` means the source said this is an image — a drag's uri-list, an
   * `<img src>`, or an image file extension. Unvouched links are bare pasted
   * URLs that only count if fetching one actually returns an image.
   */
  | { kind: 'link'; url: string; vouched: boolean }

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|bmp|heic|svg)(\?|#|$)/i
const IMAGE_HREF = /^(https?:|data:image\/)/i

function firstImageFile(files: FileList | null): File | null {
  for (const file of Array.from(files ?? [])) {
    if (file.type.startsWith('image/')) return file
  }
  return null
}

/** Pasted screenshots land in `items` rather than `files` in some browsers. */
function firstImageItem(items: DataTransferItemList | null): File | null {
  for (const item of Array.from(items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

/** `text/uri-list` is newline-separated with `#` comments. */
function firstHref(raw: string): string | null {
  for (const line of (raw || '').split(/\r?\n/)) {
    const url = line.trim()
    if (url && !url.startsWith('#') && IMAGE_HREF.test(url)) return url
  }
  return null
}

function srcFromHtml(html: string): string | null {
  const src = html.match(/<img[^>]+\bsrc=["']([^"']+)["']/i)?.[1]
  return src && IMAGE_HREF.test(src) ? src : null
}

function nameFromUrl(url: string): string {
  const last = url.split(/[?#]/)[0].split('/').pop()
  return last && last.length > 0 && last.length < 100 ? last : 'pasted-image'
}

/**
 * Read the transfer. **Must be called synchronously** from the drop/paste
 * handler — a DataTransfer is emptied as soon as that handler returns.
 *
 * `allowLink` is false when the user is typing in a field, so pasting a URL
 * still goes into the field instead of becoming a photo.
 */
export function readImageTransfer(
  dt: DataTransfer | null,
  allowLink = true
): TransferredImage | null {
  if (!dt) return null

  const file = firstImageFile(dt.files) ?? firstImageItem(dt.items)
  if (file) return { kind: 'file', file }
  if (!allowLink) return null

  // An image dragged from another tab: the browser vouches for it being an image.
  const dragged = firstHref(dt.getData('text/uri-list')) ?? srcFromHtml(dt.getData('text/html'))
  if (dragged) return { kind: 'link', url: dragged, vouched: true }

  // Loose text. An image extension is proof enough; anything else has to be
  // confirmed by fetching it, so pasting a Maps link doesn't become a photo.
  const pasted = firstHref(dt.getData('text/plain'))
  if (pasted) return { kind: 'link', url: pasted, vouched: IMAGE_EXTENSION.test(pasted) }

  return null
}

async function linkToFile(url: string): Promise<File | 'not-an-image' | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return 'not-an-image'
    return new File([blob], nameFromUrl(url), { type: blob.type })
  } catch {
    return null // cross-origin host that doesn't send CORS headers
  }
}

/**
 * Turn a read transfer into something uploadable. Links are fetched so the
 * image ends up on our own host like every other upload; when the host blocks
 * that, a vouched link falls back to being linked (same as an Unsplash result).
 *
 * A bare pasted URL that we can neither read nor recognise is dropped rather
 * than guessed at — plenty of pasted URLs aren't photos.
 */
export async function resolveImageTransfer(
  found: TransferredImage
): Promise<DroppedImage | null> {
  if (found.kind === 'file') return found
  const fetched = await linkToFile(found.url)
  if (fetched === 'not-an-image') return null
  if (fetched) return { kind: 'file', file: fetched }
  return found.vouched ? { kind: 'url', url: found.url } : null
}

/**
 * Whether a drag looks like it's carrying an image — for the hover highlight.
 * Mid-drag the browser hides the payload, so `types` is all we get.
 */
export function dragMayCarryImage(dt: DataTransfer | null): boolean {
  if (!dt) return false
  const types = Array.from(dt.types ?? [])
  return types.includes('Files') || types.includes('text/uri-list')
}
