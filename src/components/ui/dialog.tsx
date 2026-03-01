import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  )
}

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const previousActiveRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    previousActiveRef.current = document.activeElement as HTMLElement | null
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return

    const focusables = getFocusableElements(container)
    const first = focusables[0]
    if (first) {
      const t = requestAnimationFrame(() => first.focus())
      return () => cancelAnimationFrame(t)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
        return
      }
      if (e.key !== 'Tab' || !containerRef.current) return
      const focusables = getFocusableElements(containerRef.current)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open && previousActiveRef.current?.focus) {
      previousActiveRef.current.focus()
      previousActiveRef.current = null
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className="relative z-[1000] w-full max-w-[42rem] mx-auto flex justify-center items-center min-w-0 max-h-[90vh]"
      >
        {children}
      </div>
    </div>
  )
}

function DialogContent({
  className,
  children,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-card rounded-xl border shadow-lg p-6 relative max-h-[90vh] overflow-y-auto w-full max-w-[42rem] min-w-0',
        'max-sm:max-h-[85dvh]',
        className
      )}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4', className)} {...props} />
}

function DialogTitle({ className, id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      id={id}
      className={cn('text-lg font-serif font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground mt-1', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2 mt-6', className)} {...props} />
}

function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity max-sm:top-3 max-sm:right-3 max-sm:p-3 max-sm:-m-2 touch-manipulation"
      aria-label="Close"
    >
      <X className="h-4 w-4" />
    </button>
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose }
