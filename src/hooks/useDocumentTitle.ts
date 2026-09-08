import { useEffect } from 'react'

/**
 * The title `index.html` shipped with, read once before anything can change it.
 * Restoring to this rather than to a hardcoded string keeps the two in sync.
 */
const BASE_TITLE = typeof document === 'undefined' ? 'Trup' : document.title

/**
 * Name the browser tab after the trip, so two trips open side by side are
 * told apart. Pass null while the trip is still loading — the tab keeps the
 * app's own title until there's something better to say.
 *
 * Restores the base title on unmount, which is also what makes this safe to sit
 * alongside `useItineraryExport`: that hook swaps the title in and back out
 * around `window.print()` to seed the PDF filename, and only ever restores what
 * it found.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${BASE_TITLE}`
    return () => {
      document.title = BASE_TITLE
    }
  }, [title])
}
