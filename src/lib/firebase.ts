import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
}

export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.apiKey !== 'undefined'
)

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// App Check: optional; enable in Firebase Console and set VITE_APP_CHECK_RECAPTCHA_SITE_KEY
const appCheckSiteKey = import.meta.env.VITE_APP_CHECK_RECAPTCHA_SITE_KEY as
  | string
  | undefined
if (appCheckSiteKey && appCheckSiteKey !== 'undefined') {
  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import(
      'firebase/app-check'
    )
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } catch {
    // Optional; avoid breaking app when App Check not fully configured
  }
}
