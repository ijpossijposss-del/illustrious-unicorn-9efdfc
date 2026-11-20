import { useEffect } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { get, ref, runTransaction } from 'firebase/database';
import { auth, database, sharedDataPath } from '../sync/firebase';
import { normalizeUsers, useStore, type User } from '../store/useStore';
import { isOwnerAdminEmail, OWNER_ADMIN_EMAIL } from './credentials';

export async function syncAuthenticatedUser(firebaseUser: FirebaseUser) {
  const [token, snapshot, branchesSnapshot] = await Promise.all([
    firebaseUser.getIdTokenResult(),
    get(ref(database, `${sharedDataPath}/users`)),
    get(ref(database, `${sharedDataPath}/branches`)),
  ]);
  const isOwnerAccount = isOwnerAdminEmail(token.claims.email || firebaseUser.email);
  const claimedRole = isOwnerAccount ? 'admin' : token.claims.role;
  if (claimedRole !== 'admin' && claimedRole !== 'seller' && claimedRole !== 'staff') {
    throw new Error('This account has no assigned POS role. Ask your admin to check the account.');
  }
  const role: User['role'] = claimedRole;
  let users = Array.isArray(snapshot.val()) ? normalizeUsers(snapshot.val() as User[]) : [];
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
    const result = await runTransaction(usersRef, (currentValue) => {
      const currentUsers = Array.isArray(currentValue) ? currentValue : [];
      return [...currentUsers.filter((user: { id?: string; email?: string }) => (
        user?.id !== firebaseUser.uid && !isOwnerAdminEmail(user?.email)
      )), ownerProfile];
    });
    if (!result.committed) throw new Error('Could not initialize the owner profile in Realtime Database.');
    users = normalizeUsers(Array.isArray(result.snapshot.val()) ? result.snapshot.val() as User[] : []);
    profile = users.find((user) => user.id === firebaseUser.uid);
  }
  if (!profile || !profile.active || profile.role !== role) {
    throw new Error('This account is inactive or its POS profile is missing. Ask your admin for help.');
  }
  if (role !== 'admin') {
    const branches = Array.isArray(branchesSnapshot.val()) ? branchesSnapshot.val() as Array<{ id?: string; active?: boolean }> : [];
    if (!branches.some((branch) => branch.id === profile.branchId && branch.active !== false)) {
      throw new Error('Your assigned branch is unavailable. Ask your admin to assign you to an active branch.');
    }
  }

  const safeProfile = { ...profile, role, name: profile.name || firebaseUser.displayName || 'Staff' };
  const currentState = useStore.getState();
  useStore.setState({
    currentUser: safeProfile,
    isAuthenticated: true,
    users,
    selectedBranch: role === 'admin' ? currentState.selectedBranch : safeProfile.branchId,
    rememberMe: false,
  });
  return safeProfile;
}

export function useFirebaseAuthSession() {
  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      useStore.setState({ currentUser: null, isAuthenticated: false, rememberMe: false, cart: [] });
      return;
    }

    void syncAuthenticatedUser(firebaseUser).catch((error: unknown) => {
      console.error('Could not load the signed-in POS profile.', error);
      useStore.setState({ currentUser: null, isAuthenticated: false });
      void signOut(auth).catch((signOutError: unknown) => console.error('Could not clear the invalid Firebase session.', signOutError));
    });
  }), []);
}
