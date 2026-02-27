import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { SignInPage } from '@/pages/SignInPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'
import { TripPage } from '@/pages/TripPage'
import { ItineraryPage } from '@/pages/ItineraryPage'
import { CollectionPage } from '@/pages/CollectionPage'
import { SeedPage } from '@/pages/SeedPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/trip/:slug" element={<TripPage />} />
        <Route path="/trip/:slug/itinerary" element={<ItineraryPage />} />
        <Route path="/trip/:slug/collection" element={<CollectionPage />} />
        {import.meta.env.DEV && <Route path="/seed" element={<SeedPage />} />}
      </Routes>
    </BrowserRouter>
  )
}

export default App
