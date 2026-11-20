# Netlify and Firebase deployment

The POS uses Firebase Authentication for staff sign-in. Admin-created passwords are sent only to Firebase Authentication and are never saved in the POS user list or Realtime Database. Netlify Functions use the Firebase Admin SDK; the service-account key must remain a Netlify environment variable.

## 1. Configure Firebase

1. In Firebase Console, open project `super-pos-e13f1`.
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Confirm Realtime Database is enabled in the project.
4. Deploy the database rules in `database.rules.json` using the Firebase CLI from the repository root: `firebase deploy --only database`.
5. Enable Firebase Storage and deploy `storage.rules` with `firebase deploy --only storage`. Product photos are stored in Storage rather than embedded in Realtime Database records.
6. In **Project settings → Service accounts**, create/download a private key. Keep it private; do not commit it or put it in a `VITE_` variable.

## 2. Configure Netlify

Import this repository into Netlify and deploy from the repository root. The checked-in `netlify.toml` sets the build command, `dist` publish directory, serverless functions, and SPA route fallback. The build also copies the SPA fallback into `dist/_redirects`, so direct routes such as `/login` work when static files are used.

**Do not use a manual `dist`-folder upload for this app's first deployment.** It only uploads static files and does not deploy `netlify/functions/bootstrap-admin` or `netlify/functions/staff`; initial admin setup and staff account management will return 404. Use a Git-connected deploy or run `npx netlify deploy --build --prod` from the repository root after linking the site with `npx netlify link`.

Add these environment variables in the Netlify site settings:

| Variable | Value |
|---|---|
| `VITE_PUBLIC_APP_URL` | Your final HTTPS Netlify domain |
| `VITE_FIREBASE_API_KEY` | Firebase web-app API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `super-pos-e13f1.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | `https://super-pos-e13f1-default-rtdb.firebaseio.com` |
| `VITE_FIREBASE_PROJECT_ID` | `super-pos-e13f1` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase web-app storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web-app sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web-app app ID |
| `FIREBASE_PROJECT_ID` | `super-pos-e13f1` |
| `FIREBASE_DATABASE_URL` | `https://super-pos-e13f1-default-rtdb.firebaseio.com` |
| `FIREBASE_SERVICE_ACCOUNT` | Entire service-account JSON, stored as a secret |
| `BOOTSTRAP_ADMIN_USERNAME` | The initial admin's chosen name |
| `BOOTSTRAP_ADMIN_PASSWORD` | A strong initial admin password (at least 6 characters) |

The `VITE_FIREBASE_*` settings are public browser configuration; the Admin service-account JSON and bootstrap password are secrets. Set Netlify's **Functions** environment variables for the same deploy context as the site build. Redeploy after changing variables.

## 3. Create the first admin and staff

1. Open the deployed site and enter the exact `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` values.
2. Select **Set up initial admin** once. This creates the Firebase Auth account and admin role, removes the old local-only sign-in marker, and signs the admin in. Normal sign-in will fail until this initial setup has succeeded and created the Firebase account. Existing local-only staff accounts do not have Firebase identities; recreate them from Staff Management with new passwords.
3. Remove `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` from Netlify once setup succeeds; keep the Firebase Admin service-account variables for staff management.
4. The admin opens **Staff Management → Add Staff**, enters a unique name and password, and selects the role and branch. Staff do not need an email address; they sign in with that exact name and password. The app creates an internal Firebase sign-in identifier from the name, so no staff email inbox is required. Branch assignment and permissions are synchronized through Firebase; when an account is moved to a branch without an existing permission set, the backend initializes the standard staff permissions for that branch.

The initial admin is provisioned only through the protected setup endpoint. The app does not ship a shared default admin or cashier password. Staff roles cannot write the user or permission records directly in Realtime Database.

A fresh database starts with the Main Branch and no sample catalog. Add or import real products after the initial admin signs in; the app no longer seeds a large demo catalog automatically.

The public customer order page reads the sanitized `pos/public-catalog` node (active branch names and active product names/prices/stock only). The admin app refreshes this node on sign-in and whenever products or branches change. Do not put customer or staff data in this node.

Run local checks with `npm run build` and `npm run test:e2e`. The Playwright suite skips the live staff/Admin flows unless `E2E_BASE_URL`, `E2E_FIREBASE_TEST_ADMIN`, and `E2E_FIREBASE_TEST_PASSWORD` point to an isolated staging deployment; those tests create staff/branch data and must not run against production.

## Important data-access limitation

The existing POS stores all branches and operational data in one shared Realtime Database state. The rules protect user profiles, permissions, and selected admin-only records, but any signed-in staff account can still read the shared state and write some operational data (including products). This implementation securely handles sign-in and staff-account creation; it does **not** provide branch-level database isolation or enforce every UI permission against direct database requests. Use a staging dataset until the shared-state model is split into server-authorized per-branch records before processing sensitive live business data.

## Accounting and clearing records

Sales revenue uses the recorded checkout total (after discounts and including any additional charge). Gross profit is that revenue less the recorded cost of each item sold; operating expenses are reported separately and are not deducted from gross profit. Daily summaries use each sale's timestamp and the local calendar day. Clear-record actions require an admin, write the cleared state to Realtime Database, and report success only after Firebase confirms the write. A full reset retains admin profiles and one default branch so the system can still be accessed.

## Local checks

Copy the public Firebase settings from `.env.example` to a local `.env` file if you need to run the browser app locally. Netlify Functions are hosted-side endpoints; test staff provisioning on a Netlify deploy or with the Netlify CLI and the server-only environment variables configured. Never add the service-account JSON or bootstrap password to `.env`, source control, or client variables.
