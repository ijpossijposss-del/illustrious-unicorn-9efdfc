import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { isOwnerAdminEmail, usernameToAuthEmail as getLoginEmail } from '../../src/auth/credentials';

function getFirebaseAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  const serviceAccountValue = process.env.FIREBASE_SERVICE_ACCOUNT;
  const usingEmulators = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_DATABASE_EMULATOR_HOST);
  if (!projectId || !databaseURL || (!serviceAccountValue && !usingEmulators)) {
    throw new Error('Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, and FIREBASE_SERVICE_ACCOUNT in Netlify.');
  }

  if (usingEmulators) return initializeApp({ projectId, databaseURL });
  if (!serviceAccountValue) throw new Error('FIREBASE_SERVICE_ACCOUNT is required outside the Firebase emulators.');

  const serviceAccount = JSON.parse(serviceAccountValue) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email, or private_key.');
  }
  if (serviceAccount.project_id !== projectId) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT belongs to a different Firebase project.');
  }
  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    databaseURL,
    projectId,
  });
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDatabase() {
  return getDatabase(getFirebaseAdminApp());
}

export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

export async function requireAdmin(authorization?: string) {
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new Error('Sign in as an admin to manage staff accounts.');
  const decoded = await getAdminAuth().verifyIdToken(token);
  if (decoded.role !== 'admin' && !isOwnerAdminEmail(decoded.email)) {
    throw new Error('Only an admin can manage staff accounts.');
  }
  return decoded;
}

export { getLoginEmail };
