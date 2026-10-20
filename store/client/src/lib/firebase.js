// Firebase client SDK — config comes from Vite env (see .env.example).
// Get these from Firebase Console → Project settings → Your apps → Web app.
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let auth = null;
if (firebaseConfigured) {
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
}

export { auth };
export const missingConfigMessage =
  'Login is not configured yet — the store owner needs to add the Firebase keys.';
