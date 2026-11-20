import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCf8U2YYgz7jDuR7qXYxgFPtUYLQdwWlIA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ijposssss.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://ijposssss-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ijposssss',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ijposssss.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '246845126496',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:246845126496:web:34143c0b99e56afee55005',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-DY3K1EM33J',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);

if (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL, { disableWarnings: true });
}
if (import.meta.env.VITE_FIREBASE_DATABASE_EMULATOR_HOST) {
  connectDatabaseEmulator(
    database,
    import.meta.env.VITE_FIREBASE_DATABASE_EMULATOR_HOST,
    Number(import.meta.env.VITE_FIREBASE_DATABASE_EMULATOR_PORT || '9000'),
  );
}
export const sharedDataPath = 'pos/shared-state';
export const publicCatalogPath = 'pos/public-catalog';
export const publicOrdersPath = 'pos/public-orders';