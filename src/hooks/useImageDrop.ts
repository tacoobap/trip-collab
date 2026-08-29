import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canReadClipboard,
  dragMayCarryImage,
  readClipboardImage,
  readImageTransfer,
  resolveImageTransfer,
  type ClipboardRead,
  type DroppedImage,
  type TransferredImage,
} from '@/lib/imageFromTransfer'

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
}

/** Outcome of a tap on a Paste button, so callers can say what went wrong. */
export type ClipboardPasteResult =
  | { status: 'ok' }
  /** Nothing usable — `held` describes what was on the clipboard instead. */
  | { status: 'empty'; held: string }
  | { status: 'denied' }
  | { status: 'unsupported' }

/** The message to show when a Paste tap didn't produce an image. */
export function pasteResultMessage(result: ClipboardPasteResult): string | null {
  switch (result.status) {
    case 'ok':
      return null
    case 'denied':
      return 'Clipboard access was declined.'
    case 'unsupported':
      return "This browser won't let a page read the clipboard."
    case 'empty':
      return `Couldn't get an image from the clipboard — it held ${result.held}. Try copying the image itself rather than a link to the page it sits on.`
  }
}

export interface UseImageDropOptions {
  /** Called once an image has been extracted from the drop or paste. */
  onImage: (image: DroppedImage) => void | Promise<void>
  disabled?: boolean
  /** Accept a paste from anywhere on the page, not just inside the drop zone. */
  pasteOnWindow?: boolean
}

/**
 * Drag-and-drop and paste for a photo target. Spread `dropHandlers` onto the
 * element that should accept the drop; `isDragging` drives the hover state.
 */
export function useImageDrop({
  onImage,
  disabled = false,
  pasteOnWindow = false,
}: UseImageDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const onImageRef = useRef(onImage)
  useEffect(() => {
    onImageRef.current = onImage
  })

  /** Resolves to false when the candidate turned out not to be a usable image. */
  const accept = useCallback(async (found: TransferredImage): Promise<boolean> => {
    const image = await resolveImageTransfer(found)
    if (!image) return false
    await onImageRef.current(image)
    return true
  }, [])

  useEffect(() => {
    if (disabled || !pasteOnWindow) return
    const onPaste = (event: ClipboardEvent) => {
      // Image bytes are no use to a text field, so take those even mid-typing;
      // a pasted link is, so leave that to the field.
      const editable = isEditable(event.target)
      const found = readImageTransfer(event.clipboardData, !editable)
      if (!found) return
      event.preventDefault()
      void accept(found)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [disabled, pasteOnWindow, accept])

  /**
   * Pull an image off the clipboard on demand — the phone path, where there is
   * no paste event to listen for. Safe to call from a button's onClick; both
   * mobile browsers require that user gesture.
   */
  const pasteFromClipboard = useCallback(async (): Promise<ClipboardPasteResult> => {
    if (disabled) return { status: 'empty', held: 'nothing' }
    if (!canReadClipboard()) return { status: 'unsupported' }
    let read: ClipboardRead
    try {
      read = await readClipboardImage()
    } catch {
      return { status: 'denied' } // prompt dismissed, or permission refused
    }
    if (!read.image) return { status: 'empty', held: read.held }
    // A link is only a candidate until we've actually fetched it — reporting
    // success before that turns an unreachable image into a silent no-op.
    const delivered = await accept(read.image)
    return delivered ? { status: 'ok' } : { status: 'empty', held: read.held }
  }, [disabled, accept])

  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (disabled || !dragMayCarryImage(e.dataTransfer)) return
      e.preventDefault()
      setIsDragging(true)
    },
    onDragOver: (e: React.DragEvent) => {
      if (disabled || !dragMayCarryImage(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: (e: React.DragEvent) => {
      // dragleave also fires when crossing between children, so only clear
      // once the pointer has actually left the zone
      const movedTo = e.relatedTarget as Node | null
      if (movedTo && e.currentTarget.contains(movedTo)) return
      setIsDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      setIsDragging(false)
      if (disabled) return
      e.preventDefault()
      const found = readImageTransfer(e.dataTransfer)
      if (found) void accept(found)
    },
  }

  return {
    isDragging: isDragging && !disabled,
    dropHandlers,
    pasteFromClipboard,
    /** Whether to offer a Paste control at all. */
    canPaste: canReadClipboard(),
  }
}
