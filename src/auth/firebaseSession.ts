import { useEffect } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { get, ref, runTransaction } from 'firebase/database';
import { auth, database, sharedDataPath } from '../sync/firebase';
import { normalizeUsers, useStore, type User } from '../store/useStore';
import { isOwnerAdminEmail, OWNER_ADMIN_EMAIL } from './credentials';

function withTimeout<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out.`)), milliseconds);
    }),
  ]);
}

async function readRemoteValue(path: string) {
  try {
    return await withTimeout(get(ref(database, path)), 8000, 'Firebase sync');
  } catch (error) {
    console.warn(`Could not load ${path}; using cached POS data.`, error);
    return null;
  }
}

export async function syncAuthenticatedUser(firebaseUser: FirebaseUser) {
  const currentState = useStore.getState();
  const [tokenResult, usersSnapshot, branchesSnapshot, permissionsSnapshot] = await Promise.all([
    withTimeout(firebaseUser.getIdTokenResult(), 8000, 'Firebase authentication'),
    readRemoteValue(`${sharedDataPath}/users`),
    readRemoteValue(`${sharedDataPath}/branches`),
    readRemoteValue(`${sharedDataPath}/staffPermissions`),
  ]);
  const cachedProfile = currentState.users.find((user) => user.id === firebaseUser.uid);
  const isOwnerAccount = isOwnerAdminEmail(tokenResult.claims.email || firebaseUser.email);
  const claimedRole = isOwnerAccount ? 'admin' : tokenResult.claims.role || cachedProfile?.role;
  if (claimedRole !== 'admin' && claimedRole !== 'seller' && claimedRole !== 'staff') {
    throw new Error('This account has no assigned POS role. Ask your admin to check the account.');
  }
  const role: User['role'] = claimedRole;
  const remoteUsers = usersSnapshot?.val();
  let users = Array.isArray(remoteUsers) ? normalizeUsers(remoteUsers as User[]) : currentState.users;
  if (!users.length && remoteUsers && typeof remoteUsers === 'object') users = normalizeUsers(Object.values(remoteUsers) as User[]);
  let profile = users.find((user) => user.id === firebaseUser.uid)
    || (isOwnerAccount ? users.find((user) => isOwnerAdminEmail(user.email)) : undefined);
  if (isOwnerAccount) {
    const ownerProfile: User = {
      ...profile,
      id: firebaseUser.uid,
      name: profile?.name || firebaseUser.displayName || 'Admin',
      email: OWNER_ADMIN_EMAIL,
      role: 'admin',
      position: profile?.position || 'Owner',
      branchId: profile?.branchId || 'b1',
      staffNumber: profile?.staffNumber || 'ADM-001',
      active: true,
      createdAt: profile?.createdAt || new Date().toISOString(),
    };
    const usersRef = ref(database, `${sharedDataPath}/users`);
    try {
      const result = await withTimeout(runTransaction(usersRef, (currentValue) => {
        const currentUsers = Array.isArray(currentValue) ? currentValue : [];
        return [...currentUsers.filter((user: { id?: string; email?: string }) => (
          user?.id !== firebaseUser.uid && !isOwnerAdminEmail(user?.email)
        )), ownerProfile];
      }), 8000, 'Owner profile synchronization');
      if (result.committed) {
        users = normalizeUsers(Array.isArray(result.snapshot.val()) ? result.snapshot.val() as User[] : []);
        profile = users.find((user) => user.id === firebaseUser.uid);
      }
    } catch (error) {
      console.warn('Owner profile transaction timed out; keeping the locally initialized profile.', error);
      users = normalizeUsers([...users.filter((user) => user.id !== firebaseUser.uid), ownerProfile]);
      profile = ownerProfile;
    }
  }
  if (!profile || !profile.active || profile.role !== role) {
    throw new Error('This account is inactive or its POS profile is missing. Ask your admin for help.');
  }
  if (role !== 'admin') {
    const remoteBranches = branchesSnapshot?.val();
    const branches = Array.isArray(remoteBranches)
      ? remoteBranches as Array<{ id?: string; active?: boolean }>
      : currentState.branches;
    if (!branches.some((branch) => branch.id === profile.branchId && branch.active !== false)) {
      throw new Error('Your assigned branch is unavailable. Ask your admin to assign you to an active branch.');
    }
  }

  const safeProfile = { ...profile, role, name: profile.name || firebaseUser.displayName || 'Staff' };
  const remotePermissions = permissionsSnapshot?.val();
  const staffPermissions = remotePermissions && typeof remotePermissions === 'object'
    ? remotePermissions as ReturnType<typeof useStore.getState>['staffPermissions']
    : currentState.staffPermissions;
  useStore.setState({
    currentUser: safeProfile,
    isAuthenticated: true,
    users,
    staffPermissions,
    selectedBranch: role === 'admin' ? currentState.selectedBranch : safeProfile.branchId,
    rememberMe: true,
  });
  return safeProfile;
}

export function useFirebaseAuthSession() {
  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      useStore.setState({ currentUser: null, isAuthenticated: false, rememberMe: false, cart: [] });
      return;
    }

    const loadProfile = async (attempt: number) => {
      try {
        await syncAuthenticatedUser(firebaseUser);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '';
        const invalidProfile = /inactive|missing|no assigned POS role|unavailable/.test(message);
        if (invalidProfile) {
          console.error('Could not load the signed-in POS profile.', error);
          useStore.setState({ currentUser: null, isAuthenticated: false });
          await signOut(auth).catch((signOutError: unknown) => console.error('Could not clear the invalid Firebase session.', signOutError));
          return;
        }
        if (attempt < 3) {
          console.warn(`Firebase profile load retry ${attempt + 1}.`, error);
          window.setTimeout(() => void loadProfile(attempt + 1), attempt * 1500);
          return;
        }
        console.error('Could not load the signed-in POS profile after retries.', error);
      }
    };
    void loadProfile(1);
  }), []);
}
