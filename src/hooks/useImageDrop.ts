import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canReadClipboard,
  dragMayCarryImage,
  readClipboardImage,
  readImageTransfer,
  resolveImageTransfer,
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
export type ClipboardPasteResult = 'ok' | 'empty' | 'denied' | 'unsupported'

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

  const accept = useCallback((found: TransferredImage) => {
    void (async () => {
      const image = await resolveImageTransfer(found)
      if (image) await onImageRef.current(image)
    })()
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
      accept(found)
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
    if (disabled) return 'empty'
    if (!canReadClipboard()) return 'unsupported'
    let found: TransferredImage | null
    try {
      found = await readClipboardImage()
    } catch {
      return 'denied' // the browser's own prompt was dismissed, or permission refused
    }
    if (!found) return 'empty'
    accept(found)
    return 'ok'
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
      if (found) accept(found)
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
