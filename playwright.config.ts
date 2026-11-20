import { defineConfig } from '@playwright/test';

const usingFirebaseEmulators = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_DATABASE_EMULATOR_HOST);
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  timeout: 60_000,
  ...(!process.env.E2E_BASE_URL || usingFirebaseEmulators
    ? {
      webServer: {
        command: usingFirebaseEmulators ? 'npm run dev -- --host 127.0.0.1 --mode firebase-emulator' : 'npm run dev -- --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
    }
    : {}),
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  testDir: './tests',
});
