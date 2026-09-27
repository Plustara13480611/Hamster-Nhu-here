/**
 * Firebase configuration
 *
 * Replace the placeholder values below with your actual Firebase project config.
 * Get them from: Firebase Console → Project Settings → Your apps → Web app → SDK setup
 *
 * For environment variables (recommended for production):
 * Create a .env file with VITE_FIREBASE_* variables and reference them here.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? 'REPLACE_ME',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? 'REPLACE_ME',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? 'REPLACE_ME',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? 'REPLACE_ME',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? 'REPLACE_ME',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? 'REPLACE_ME',
};

// Prevent duplicate initialization in dev hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
export default app;
