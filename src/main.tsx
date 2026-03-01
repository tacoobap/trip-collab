import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/ToastProvider'
import App from './App'

// Google Analytics 4 (optional): set VITE_GA_MEASUREMENT_ID in .env
const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
if (gaId) {
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  document.head.appendChild(script)
  const dataLayer: unknown[] = (window.dataLayer = window.dataLayer || [])
  function gtag(..._args: unknown[]) {
    dataLayer.push(arguments)
  }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', gaId)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
