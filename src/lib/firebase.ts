/**
 * Firebase Web SDK initialization.
 * All config values come from VITE_FIREBASE_* environment variables.
 * This file is safe to import — it will no-op if vars are not set.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore, type Firestore } from "firebase/firestore"
import { getAuth, type Auth } from "firebase/auth"

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null

if (isConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  db = getFirestore(app)
  auth = getAuth(app)
} else {
  console.warn("[Firebase] VITE_FIREBASE_* env vars not set — Firebase client disabled")
}

export { app, db, auth, isConfigured }
