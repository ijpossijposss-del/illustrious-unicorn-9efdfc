import { getAdminAuth, getAdminDatabase, getLoginEmail, jsonResponse } from '../lib/firebaseAdmin';

interface FunctionEvent {
  httpMethod: string;
  body?: string | null;
}

export const handler = async (event: FunctionEvent) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });

  const expectedUsername = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const expectedPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return jsonResponse(503, { error: 'Initial admin setup is not enabled. Configure the bootstrap credentials in Netlify first.' });
  }

  try {
    const request = JSON.parse(event.body || '{}') as { username?: string; password?: string };
    if (request.username !== expectedUsername || request.password !== expectedPassword) {
      return jsonResponse(401, { error: 'The supplied initial admin credentials do not match the Netlify setup values.' });
    }

    const auth = getAdminAuth();
    const email = getLoginEmail(expectedUsername);
    let user;
    try {
      user = await auth.getUserByEmail(email);
      if (user.customClaims?.role !== 'admin') {
        return jsonResponse(409, { error: 'This username already exists and is not the initial admin.' });
      }
      await auth.updateUser(user.uid, { displayName: expectedUsername.trim(), password: expectedPassword, disabled: false });
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      user = await auth.createUser({ email, password: expectedPassword, displayName: expectedUsername.trim(), disabled: false });
      await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    }

    const profile = {
      id: user.uid,
      name: expectedUsername.trim(),
      role: 'admin',
      position: 'Owner',
      branchId: 'b1',
      staffNumber: 'ADM-001',
      active: true,
      createdAt: new Date().toISOString(),
    };
    const usersRef = getAdminDatabase().ref('pos/shared-state/users');
    await usersRef.transaction((usersValue: unknown) => {
      const users = Array.isArray(usersValue) ? usersValue : [];
      return [...users.filter((entry: { id?: string }) => entry?.id !== user.uid), profile];
    });

    return jsonResponse(200, { customToken: await auth.createCustomToken(user.uid, { role: 'admin' }) });
  } catch (error) {
    console.error('Initial admin setup failed.', error);
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Initial admin setup failed.' });
  }
};
