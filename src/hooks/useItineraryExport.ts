import { useCallback, useState } from 'react'

/**
 * Resolve once every `<img>` has finished loading. Day photos further down the
 * page may still be in flight when the user hits Export, and those print blank.
 */
async function waitForImages(timeoutMs = 8000): Promise<void> {
  const pending = Array.from(document.images)
    .filter((img) => !(img.complete && img.naturalWidth > 0))
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        })
    )
  if (pending.length === 0) return
  await Promise.race([
    Promise.all(pending),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

/**
 * Export the itinerary via the browser's own print-to-PDF. The paper layout
 * comes from the `@media print` rules in index.css, so the PDF tracks the page
 * design instead of being a second copy that drifts.
 */
export function useItineraryExport(tripName: string) {
  const [exporting, setExporting] = useState(false)

  const exportPdf = useCallback(async () => {
    setExporting(true)
    const previousTitle = document.title
    try {
      await waitForImages()
      // Browsers seed the "Save as PDF" filename from document.title
      document.title = `${tripName} — Itinerary`
      // Blocks until the print dialog is dismissed
      window.print()
    } finally {
      document.title = previousTitle
      setExporting(false)
    }
  }, [tripName])

  return { exporting, exportPdf }
}
