import { cn } from '@/lib/utils'

interface ImagePasteBoxProps {
  className?: string
  /** Placeholder shown while empty; also the accessible name. */
  label?: string
}

/**
 * A box you paste a picture into.
 *
 * Deliberately contenteditable rather than a button that reads the clipboard.
 * iOS won't hand a page a clipboard filled in another app without its own
 * permission prompt, and won't put image data into a plain input at all — but
 * a long-press Paste into a contenteditable needs no prompt (the paste is the
 * consent) and carries the image with it.
 *
 * The paste itself is handled by the enclosing `useImageDrop`, which treats
 * anything inside `[data-image-paste-target]` as a photo target rather than
 * somewhere to type. Nothing is ever kept in the box — it clears on input so
 * stray text can't collect in it.
 */
export function ImagePasteBox({ className, label = 'Paste an image here' }: ImagePasteBoxProps) {
  return (
    <div
      data-image-paste-target
      data-placeholder={label}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      onInput={(e) => {
        e.currentTarget.textContent = ''
      }}
      className={cn(
        'min-h-[44px] rounded-md border border-dashed px-3 py-2.5 outline-none transition-colors',
        // 16px on mobile or iOS zooms the page on focus, same as Input/Textarea
        'text-base md:text-sm',
        'text-foreground border-border/70 focus:border-primary focus:bg-primary/5',
        'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/70',
        className
      )}
    />
  )
}
