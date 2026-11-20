import { getAdminAuth, getAdminDatabase, getLoginEmail, jsonResponse, requireAdmin } from '../lib/firebaseAdmin';
import { DEFAULT_STAFF_PERMISSIONS } from '../../src/auth/credentials';

interface FunctionEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined> | null;
}

interface StaffInput {
  id?: string;
  name?: string;
  role?: 'seller' | 'staff';
  position?: string;
  password?: string;
  branchId?: string;
  staffNumber?: string;
  email?: string;
  phone?: string;
  active?: boolean;
}

function validateStaff(input: StaffInput, isNew: boolean) {
  const name = input.name?.trim();
  if (!name || name.length > 100) throw new Error('Enter a staff name between 1 and 100 characters.');
  if (input.role !== 'seller' && input.role !== 'staff') throw new Error('Choose a valid staff role.');
  if (!input.branchId?.trim() || !input.staffNumber?.trim()) throw new Error('Branch and staff number are required.');
  if (isNew && (!input.password || input.password.length < 6)) throw new Error('New staff passwords must be at least 6 characters.');
  return {
    name,
    email: getLoginEmail(name),
    branchId: input.branchId.trim(),
    staffNumber: input.staffNumber.trim(),
  };
}

export const handler = async (event: FunctionEvent) => {
  if (!['POST', 'PUT', 'DELETE'].includes(event.httpMethod)) return jsonResponse(405, { error: 'Method not allowed.' });

  try {
    const caller = await requireAdmin(event.headers.authorization || event.headers.Authorization);
    const database = getAdminDatabase();
    const auth = getAdminAuth();

    if (event.httpMethod === 'POST') {
      const input = JSON.parse(event.body || '{}') as StaffInput;
      const { name, email, branchId, staffNumber } = validateStaff(input, true);
      const branchesSnapshot = await database.ref('pos/shared-state/branches').once('value');
      const branches = Array.isArray(branchesSnapshot.val()) ? branchesSnapshot.val() as Array<{ id?: string; active?: boolean }> : [];
      if (!branches.some((branch) => branch.id === branchId && branch.active !== false)) {
        return jsonResponse(400, { error: 'Choose an active branch for this staff account.' });
      }
      const usersRef = database.ref('pos/shared-state/users');
      const snapshot = await usersRef.once('value');
      const users = Array.isArray(snapshot.val()) ? snapshot.val() as Array<{ id: string; name: string; role?: string; branchId?: string }> : [];
      if (users.some((user) => getLoginEmail(user.name) === email)) {
        return jsonResponse(409, { error: 'A staff account with that name already exists.' });
      }

      const user = await auth.createUser({ email, password: input.password, displayName: name });
      const profile = {
        id: user.uid,
        name,
        role: input.role,
        position: input.position?.trim() || 'Staff',
        branchId,
        staffNumber,
        email: input.email?.trim() || '',
        phone: input.phone?.trim() || '',
        active: true,
        createdAt: new Date().toISOString(),
      };

      try {
        await auth.setCustomUserClaims(user.uid, { role: input.role });
        const result = await usersRef.transaction((currentValue: unknown) => {
          const currentUsers = Array.isArray(currentValue) ? currentValue : [];
          if (currentUsers.some((entry: { id?: string; name?: string }) => entry?.id === user.uid || entry?.name?.trim().toLowerCase() === name.toLowerCase())) return;
          return [...currentUsers, profile];
        });
        if (!result.committed) throw new Error('A staff account with that name already exists.');
        try {
          await database.ref(`pos/shared-state/staffPermissions/${user.uid}/${branchId}`).set(DEFAULT_STAFF_PERMISSIONS);
        } catch (error) {
          const rollback = await usersRef.transaction((currentValue: unknown) => (
            Array.isArray(currentValue) ? currentValue.filter((entry: { id?: string }) => entry?.id !== user.uid) : currentValue
          ));
          if (!rollback.committed) console.error('Could not roll back staff profile after permission setup failure.', user.uid);
          throw error;
        }
        return jsonResponse(201, { user: profile });
      } catch (error) {
        await auth.deleteUser(user.uid);
        throw error;
      }
    }

    const id = event.queryStringParameters?.id;
    if (!id) return jsonResponse(400, { error: 'A staff account ID is required.' });
    const userRef = database.ref('pos/shared-state/users');
    const snapshot = await userRef.once('value');
    const users = Array.isArray(snapshot.val()) ? snapshot.val() as Array<{ id: string; name: string; role?: string; branchId?: string }> : [];
    const existing = users.find((user) => user.id === id);
    if (!existing) return jsonResponse(404, { error: 'Staff account not found.' });
    if (id === caller.uid || existing.role === 'admin') {
      return jsonResponse(403, { error: 'The initial admin account cannot be changed or deleted here.' });
    }

    if (event.httpMethod === 'DELETE') {
      const result = await userRef.transaction((value: unknown) => Array.isArray(value) ? value.filter((user: { id?: string }) => user?.id !== id) : value);
      if (!result.committed) return jsonResponse(409, { error: 'The staff account could not be removed from the POS profile.' });
      try {
        await auth.deleteUser(id);
      } catch (error) {
        await userRef.transaction((value: unknown) => Array.isArray(value) ? [...value, existing] : [existing]);
        throw error;
      }
      return jsonResponse(200, { ok: true });
    }

    const input = JSON.parse(event.body || '{}') as StaffInput;
    const { name, email, branchId, staffNumber } = validateStaff(input, false);
    const branchesSnapshot = await database.ref('pos/shared-state/branches').once('value');
    const branches = Array.isArray(branchesSnapshot.val()) ? branchesSnapshot.val() as Array<{ id?: string; active?: boolean }> : [];
    if (!branches.some((branch) => branch.id === branchId && branch.active !== false)) {
      return jsonResponse(400, { error: 'Choose an active branch for this staff account.' });
    }
    if (users.some((user) => user.id !== id && getLoginEmail(user.name) === email)) {
      return jsonResponse(409, { error: 'A staff account with that name already exists.' });
    }
    if (input.password && input.password.length < 6) {
      return jsonResponse(400, { error: 'Passwords must be at least 6 characters.' });
    }
    const existingAuthUser = await auth.getUser(id);
    const profile = {
      ...existing,
      name,
      role: input.role,
      position: input.position?.trim() || 'Staff',
      branchId,
      staffNumber,
      email: input.email?.trim() || '',
      phone: input.phone?.trim() || '',
      active: input.active !== false,
    };
    const result = await userRef.transaction((value: unknown) => {
      if (!Array.isArray(value)) return value;
      return value.map((user: { id?: string }) => user?.id === id ? profile : user);
    });
    if (!result.committed) {
      return jsonResponse(409, { error: 'The staff account could not be updated. Retry the request.' });
    }
    try {
      if (branchId !== existing.branchId) {
        const branchPermissions = await database
          .ref(`pos/shared-state/staffPermissions/${id}/${branchId}`)
          .transaction((currentPermissions: unknown) => (
            Array.isArray(currentPermissions) ? currentPermissions : DEFAULT_STAFF_PERMISSIONS
          ));
        if (!branchPermissions.committed) {
          throw new Error('Could not initialize permissions for the newly assigned branch.');
        }
      }
      await auth.updateUser(id, {
        email,
        displayName: name,
        disabled: input.active === false,
        ...(input.password ? { password: input.password } : {}),
      });
      await auth.setCustomUserClaims(id, { role: input.role });
      if (input.active === false || existing.role !== input.role) await auth.revokeRefreshTokens(id);
    } catch (error) {
      const rollback = await userRef.transaction((value: unknown) => {
        if (!Array.isArray(value)) return value;
        return value.map((user: { id?: string }) => user?.id === id ? existing : user);
      });
      if (!rollback.committed) console.error('Could not roll back staff profile after Firebase Auth update failure.', id);
      await auth.updateUser(id, {
        ...(existingAuthUser.email ? { email: existingAuthUser.email } : {}),
        ...(existingAuthUser.displayName ? { displayName: existingAuthUser.displayName } : {}),
        disabled: existingAuthUser.disabled,
      });
      await auth.setCustomUserClaims(id, existingAuthUser.customClaims || {});
      throw error;
    }
    return jsonResponse(200, { user: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Staff account request failed.';
    const statusCode = /sign in as an admin|only an admin/i.test(message) ? 403 : 400;
    console.error('Staff account request failed.', error);
    return jsonResponse(statusCode, { error: message });
  }
};
