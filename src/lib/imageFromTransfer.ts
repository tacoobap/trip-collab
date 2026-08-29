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

/** The outcome of reading the clipboard, with a note on what was found. */
export interface ClipboardRead {
  image: TransferredImage | null
  /** Plain-language description of the clipboard's contents, for error copy. */
  held: string
}

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
  const m = html.match(/<img[^>]+\bsrc=(?:["']([^"']+)["']|([^\s>]+))/i)
  const src = m?.[1] ?? m?.[2]
  return src && IMAGE_HREF.test(src) ? src : null
}

/**
 * Find an image link among the text flavours of a payload, whichever way it
 * reached us. `get` returns '' for a flavour that isn't present.
 */
function linkFromText(get: (type: string) => string): TransferredImage | null {
  // uri-list, or the markup around a copied image: the source is telling us
  // this is an image, so take its word for it.
  const vouchedUrl = firstHref(get('text/uri-list')) ?? srcFromHtml(get('text/html'))
  if (vouchedUrl) return { kind: 'link', url: unwrapImageUrl(vouchedUrl), vouched: true }

  // Loose text. An image extension is proof enough; anything else has to be
  // confirmed by fetching it, so pasting a Maps link doesn't become a photo.
  const plain = firstHref(get('text/plain'))
  if (plain) {
    const url = unwrapImageUrl(plain)
    // Unwrapping means the page told us which URL is the image
    const vouched = url !== plain || IMAGE_EXTENSION.test(url)
    return { kind: 'link', url, vouched }
  }

  return null
}

/**
 * Google image results copy as a link to Google's viewer, not to the picture:
 * `google.com/imgres?imgurl=<the real one>&imgrefurl=…`. Same trick shows up
 * on other search and proxy pages, so unwrap any of those parameters.
 */
function unwrapImageUrl(url: string): string {
  try {
    const params = new URL(url).searchParams
    for (const key of ['imgurl', 'mediaurl', 'image_url', 'url']) {
      const inner = params.get(key)
      if (inner && IMAGE_HREF.test(inner)) return inner
    }
  } catch {
    // not a parseable URL — leave it as it came
  }
  return url
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

  return linkFromText((type) => dt.getData(type))
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

/** Whether this browser lets a page read the clipboard on demand. */
export function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'
}

/**
 * Read an image straight off the system clipboard.
 *
 * This is the only paste that works on a phone: mobile browsers fire `paste`
 * only inside a focused text field, and iOS won't put image data into one, so
 * there is no keystroke or gesture for us to listen for. Reading on demand from
 * a button tap works instead — both iOS Safari and Android Chrome confirm it
 * with their own prompt first.
 *
 * Throws if the read is refused, so callers can tell "denied" from "no image".
 */
export async function readClipboardImage(): Promise<ClipboardRead> {
  if (!canReadClipboard()) return { image: null, held: 'nothing' }
  const contents = await navigator.clipboard.read()

  for (const item of contents) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (!type) continue
    try {
      const blob = await item.getType(type)
      const ext = type.split('/')[1]?.split('+')[0] || 'png'
      const file = new File([blob], `pasted-image.${ext}`, { type: blob.type })
      return { image: { kind: 'file', file }, held: type }
    } catch {
      // Safari lists flavours it won't always hand over; fall through to the link
    }
  }

  // No bytes. Copying an image from a page on a phone usually leaves only the
  // markup around it, so read that the same way a drag would.
  const text: Record<string, string> = {}
  for (const item of contents) {
    for (const type of item.types) {
      if (!type.startsWith('text/') || text[type]) continue
      try {
        text[type] = await (await item.getType(type)).text()
      } catch {
        // same as above — an unreadable flavour just isn't a candidate
      }
    }
  }

  const image = linkFromText((type) => text[type] ?? '')
  return { image, held: describeClipboard(contents, text) }
}

/**
 * A short, honest account of what was on the clipboard, so a paste that finds
 * no image can say why instead of just insisting there wasn't one.
 */
function describeClipboard(
  contents: readonly ClipboardItem[],
  text: Record<string, string>
): string {
  const types = [...new Set(contents.flatMap((item) => item.types))]
  if (types.length === 0) return 'nothing'

  const body = text['text/plain']?.trim() || text['text/uri-list']?.trim()
  if (body) {
    const snippet = body.length > 60 ? `${body.slice(0, 60)}…` : body
    return IMAGE_HREF.test(body) ? `a link (${snippet})` : `text ("${snippet}")`
  }
  return types.join(', ')
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
