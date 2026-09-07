import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /**
   * Change this to clear a caught error without remounting the healthy tree.
   * The route boundary passes the pathname, so a browser Back out of a crashed
   * page recovers instead of leaving the fallback stranded over the new one.
   */
  resetKey?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches a render-time throw and offers a way out, instead of a white page.
 *
 * Worth having here in particular because so much of the schema is
 * optional-or-legacy — `start_minutes?`, `duration_minutes?`, `stretches_grid?`,
 * slots with no `trip_id` that resolve through `day_id`, the legacy booking
 * fields on `Proposal` — so a single old document can take down a whole page.
 *
 * A class because that is still the only way to catch: there is no hook
 * equivalent. The usual limits apply — it sees throws from rendering,
 * lifecycles and constructors below it, but *not* from event handlers,
 * `setTimeout` or a rejected promise. Those keep needing their own try/catch,
 * which is what the pages already do with toasts.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
    // Optional, like the rest of GA — without VITE_GA_MEASUREMENT_ID there is no
    // `gtag` and this is a no-op, which also means a crash in production is only
    // ever visible in one person's console.
    window.gtag?.('event', 'exception', {
      description: `${error.name}: ${error.message}`,
      fatal: true,
    })
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5 sm:px-6 text-center">
        <div className="w-full max-w-md">
          <p className="text-lg font-serif font-semibold text-foreground mb-2">
            Something went wrong
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Sorry — this page ran into a problem and couldn't finish loading.
            Nothing you've planned has been lost.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-xs font-mono text-left text-muted-foreground whitespace-pre-wrap break-all bg-muted/40 rounded-md p-3 mb-6 max-h-48 overflow-auto">
              {error.stack ?? `${error.name}: ${error.message}`}
            </pre>
          )}
          <div className="flex items-center justify-center gap-4">
            <Button onClick={() => window.location.reload()}>
              <RotateCw className="w-4 h-4" aria-hidden />
              Reload
            </Button>
            {/* A real navigation, not a <Link> — whatever broke is still mounted
                above this, and a fresh document is the only guaranteed reset. */}
            <a href="/home" className="text-sm text-primary hover:underline">
              Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
