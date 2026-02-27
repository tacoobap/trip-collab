import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 sm:px-8 py-4">
        <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold">Trup</span>
        </Link>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-10">
        <h1 className="text-2xl font-serif font-bold text-foreground mb-6">Terms of Use</h1>
        <div className="prose prose-sm text-muted-foreground space-y-4">
          <p>
            By using Trup, you agree to the following terms.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">Use of the service</h2>
          <p>
            You use Trup at your own risk. You are responsible for the content you add (trip details, proposals, etc.) and for sharing trips only with people you trust.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">Acceptable use</h2>
          <p>
            Do not use the app for anything illegal or to harass others. We may suspend or remove access if we believe you have violated these terms.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">No warranty</h2>
          <p>
            The service is provided &ldquo;as is.&rdquo; We do not guarantee availability or that your data will never be lost. Back up important information elsewhere if needed.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">Changes</h2>
          <p>
            We may change these terms. Continued use of the app after changes means you accept the updated terms.
          </p>
        </div>
        <p className="mt-8">
          <Link to="/" className="text-sm text-primary hover:underline">← Back to home</Link>
        </p>
      </main>
    </div>
  )
}
