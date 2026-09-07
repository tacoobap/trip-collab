import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { LandingPage } from '@/pages/LandingPage'
import { MarketingPage } from '@/pages/MarketingPage'
import { SignInPage } from '@/pages/SignInPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'
import { TripPage } from '@/pages/TripPage'
import { ItineraryPage } from '@/pages/ItineraryPage'
import { CollectionPage } from '@/pages/CollectionPage'
import { SeedPage } from '@/pages/SeedPage'
import { SharedItineraryPage } from '@/pages/SharedItineraryPage'
import { TripSettingsPage } from '@/pages/TripSettingsPage'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { useAuth } from '@/contexts/AuthContext'

/**
 * `/` is the front door for two different people: someone signed in, who wants
 * their trips, and someone who has never seen the app — often an invitee who
 * followed a link. The first goes straight to `/home`; the second gets the
 * marketing page, with sign-in one click away.
 */
function RootRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden />
      </div>
    )
  }

  return user ? <Navigate to="/home" replace /> : <MarketingPage />
}

/**
 * The route-level boundary, inside the router so one page's crash can't take
 * the app down with it. Keyed on the pathname rather than by `key` — remounting
 * `<Routes>` on every navigation would throw away healthy page state, whereas
 * `resetKey` only clears an error that is already on screen.
 */
function RoutedApp() {
  const location = useLocation()

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/trip/:slug" element={<TripPage />} />
        <Route path="/trip/:slug/itinerary" element={<ItineraryPage />} />
        <Route path="/trip/:slug/collection" element={<CollectionPage />} />
        <Route path="/trip/:slug/settings" element={<TripSettingsPage />} />
        {/* Public — no auth; data comes from the shared-trip function */}
        <Route path="/i/:token" element={<SharedItineraryPage />} />
        {import.meta.env.DEV && <Route path="/seed" element={<SeedPage />} />}
      </Routes>
    </ErrorBoundary>
  )
}

function App() {
  return (
    <BrowserRouter>
      <RoutedApp />
    </BrowserRouter>
  )
}

export default App
