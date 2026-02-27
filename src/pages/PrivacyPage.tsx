import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 sm:px-8 py-4">
        <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold">Trup</span>
        </Link>
      </header>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-10">
        <h1 className="text-2xl font-serif font-bold text-foreground mb-6">Privacy Policy</h1>
        <div className="prose prose-sm text-muted-foreground space-y-4">
          <p>
            Trup (&ldquo;we&rdquo;) is a trip-planning app. This policy describes what data we collect and how we use it.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">Sign-in</h2>
          <p>
            We use Google Sign-In for authentication. When you sign in, we receive your email address and display name from Google. We do not receive or store your Google password.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">Data we store</h2>
          <p>
            We store your trip data (trip names, destinations, dates, proposed activities, stays, and collection items) and your display name (and optionally profile photo URL) in Firebase (Firestore and Authentication). This data is used only to run the app and to show it to you and the other members of each trip.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">Sharing</h2>
          <p>
            Trip data is visible only to you and the people you add as members of that trip. We do not sell or share your data with third parties for advertising.
          </p>
          <h2 className="text-lg font-semibold text-foreground mt-6">Changes</h2>
          <p>
            We may update this policy from time to time. The current version is always linked from the app.
          </p>
        </div>
        <p className="mt-8">
          <Link to="/" className="text-sm text-primary hover:underline">← Back to home</Link>
        </p>
      </main>
    </div>
  )
}
