import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD5ujCieBfNvyl8muYn3_jHsg_G2BV8fKQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'super-pos-e13f1.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://super-pos-e13f1-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'super-pos-e13f1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'super-pos-e13f1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1049151220438',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1049151220438:web:017b95265b0b9c7b347777',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-XEFP6M24LV',
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