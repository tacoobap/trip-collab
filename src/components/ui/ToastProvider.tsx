import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration: number
  createdAt: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, options?: { variant?: ToastVariant; duration?: number }) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 5_000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, options?: { variant?: ToastVariant; duration?: number }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const duration = options?.duration ?? DEFAULT_DURATION
      const toast: Toast = {
        id,
        message,
        variant: options?.variant ?? 'default',
        duration,
        createdAt: Date.now(),
      }
      setToasts((prev) => [...prev, toast])
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration)
      }
    },
    [removeToast]
  )

  const value = useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastList toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex max-w-[min(24rem,calc(100vw-2rem)) flex-col gap-2"
      aria-live="polite"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const reducedMotion = useReducedMotion()
  const variantStyles: Record<ToastVariant, string> = {
    default: 'bg-secondary text-secondary-foreground border-border',
    success: 'bg-success/95 text-success-foreground border-success',
    error: 'bg-destructive/95 text-destructive-foreground border-destructive',
  }

  return (
    <motion.div
      layout={!reducedMotion}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
      transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-4 py-3 shadow-lg',
        variantStyles[toast.variant]
      )}
    >
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
