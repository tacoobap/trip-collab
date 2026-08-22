import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { SignInPage } from '@/pages/SignInPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'
import { TripPage } from '@/pages/TripPage'
import { ItineraryPage } from '@/pages/ItineraryPage'
import { CollectionPage } from '@/pages/CollectionPage'
import { SeedPage } from '@/pages/SeedPage'
import { SharedItineraryPage } from '@/pages/SharedItineraryPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignInPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/trip/:slug" element={<TripPage />} />
        <Route path="/trip/:slug/itinerary" element={<ItineraryPage />} />
        <Route path="/trip/:slug/collection" element={<CollectionPage />} />
        {/* Public — no auth; data comes from the shared-trip function */}
        <Route path="/i/:token" element={<SharedItineraryPage />} />
        {import.meta.env.DEV && <Route path="/seed" element={<SeedPage />} />}
      </Routes>
    </BrowserRouter>
  )
}

export default App
