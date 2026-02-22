import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from '@/pages/LandingPage'
import { TripPage } from '@/pages/TripPage'
import { ItineraryPage } from '@/pages/ItineraryPage'

const DEV_SEED_ENABLED = import.meta.env.DEV

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/trip/:slug" element={<TripPage />} />
        <Route path="/trip/:slug/itinerary" element={<ItineraryPage />} />
        {DEV_SEED_ENABLED && (
          <Route
            path="/seed"
            lazy={async () => {
              const { SeedPage } = await import('@/pages/SeedPage')
              return { Component: SeedPage }
            }}
          />
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
