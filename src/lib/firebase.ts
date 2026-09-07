import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

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
// Firestore mirrors everything it reads into IndexedDB, so a trip that has been
// opened once still renders with no network, and edits made offline queue until
// one comes back. This is a travel app; planes and hotel wifi are the normal
// case. Multi-tab, because two trips in two tabs is a normal way to use it.
//
// Note this caches the *data*, not the app shell. Without a service worker a
// cold start still needs the network to fetch the bundle at all — see README
// item 3.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
export const firebaseProjectId = firebaseConfig.projectId

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
