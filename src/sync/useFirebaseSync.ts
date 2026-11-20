import { useEffect, useRef } from 'react';
import { get, onValue, ref, set } from 'firebase/database';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { database, publicCatalogPath, publicOrdersPath, sharedDataPath } from './firebase';
import { registerFlushHandler } from './outgoingSync';

const PENDING_SYNC_KEY = 'jann-pos-pending-sync';
const WRITE_LOCK_KEY = 'jann-pos-firebase-write-lock';
const WRITE_LOCK_TTL = 15_000;

const sharedKeys = [
  'products', 'customers', 'users', 'branches', 'categories', 'sales', 'expenses',
  'notifications', 'staffPermissions', 'lastUpdate', 'printerSettings', 'receiptSettings',
  'assetCheckouts', 'refundRequests', 'returnRequests', 'stockTransfers', 'cashDrawerSessions',
  'mobileOrders', 'paymentTerminal',
] as const;

type SharedData = Partial<Record<(typeof sharedKeys)[number], unknown>>;

function sanitizeForFirebase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeForFirebase(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, sanitizeForFirebase(item)]),
    );
  }
  return value;
}

function getSharedData(state: ReturnType<typeof useStore.getState>): SharedData {
  const sharedState = {
    ...Object.fromEntries(sharedKeys.map((key) => [key, state[key]])),
    products: state.products.filter((product) => !product.deleted),
    users: state.users.map(({ password: _legacyPassword, ...user }) => user),
  };
  return sanitizeForFirebase(sharedState) as SharedData;
}

function getPublicCatalog(data: SharedData) {
  const branches = Array.isArray(data.branches) ? data.branches : [];
  const products = Array.isArray(data.products) ? data.products : [];
  return {
    branches: branches
      .filter((branch) => branch && typeof branch === 'object' && 'active' in branch && branch.active)
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        location: branch.location,
        phone: branch.phone,
        active: true,
        openingHours: branch.openingHours,
        closingHours: branch.closingHours,
      })),
    products: products
      .filter((product) => product && typeof product === 'object' && 'active' in product && product.active && !product.deleted)
      .map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        branchId: product.branchId,
        active: true,
      })),
  };
}

function applySharedData(data: SharedData, pendingKeys: ReadonlySet<(typeof sharedKeys)[number]> = new Set()) {
  const current = useStore.getState();
  if (!pendingKeys.has('products') && Array.isArray(data.products)) {
    const remoteProducts = data.products as typeof current.products;
    const localProducts = current.products;
    const productsWithLocalImages = remoteProducts.map((product) => {
      const localProduct = localProducts.find((item) => item.id === product.id);
      return product.image || !localProduct?.image ? product : { ...product, image: localProduct.image, imageWidth: product.imageWidth || localProduct.imageWidth, imageHeight: product.imageHeight || localProduct.imageHeight, imageFit: product.imageFit || localProduct.imageFit };
    });
    current.setProducts(productsWithLocalImages);
  }
  if (!pendingKeys.has('customers') && Array.isArray(data.customers)) current.setCustomers(data.customers as typeof current.customers);
  if (!pendingKeys.has('users') && Array.isArray(data.users)) {
    const users = data.users as typeof current.users;
    current.setUsers(users);
    const signedInUser = current.currentUser;
    if (signedInUser) {
      const updatedUser = users.find((user) => user.id === signedInUser.id);
      if (!updatedUser?.active || updatedUser.role !== signedInUser.role) {
        current.logout();
      } else if (updatedUser !== signedInUser) {
        useStore.setState({
          currentUser: updatedUser,
          ...(updatedUser.role !== 'admin' ? { selectedBranch: updatedUser.branchId } : {}),
        });
      }
    }
  }
  if (!pendingKeys.has('branches') && Array.isArray(data.branches)) {
    current.setBranches(data.branches as typeof current.branches);
    const signedInUser = useStore.getState().currentUser;
    if (
      signedInUser
      && signedInUser.role !== 'admin'
      && !data.branches.some((branch) => branch && typeof branch === 'object' && branch.id === signedInUser.branchId && branch.active !== false)
    ) {
      current.logout();
    }
  }
  if (!pendingKeys.has('categories') && Array.isArray(data.categories)) current.setCategories(data.categories as string[]);
  if (!pendingKeys.has('sales') && Array.isArray(data.sales)) current.applySalesFromRemote(data.sales as typeof current.sales);
  if (!pendingKeys.has('expenses') && Array.isArray(data.expenses)) current.setExpenses(data.expenses as typeof current.expenses);
  if (!pendingKeys.has('assetCheckouts') && Array.isArray(data.assetCheckouts)) current.setAssetCheckouts(data.assetCheckouts as typeof current.assetCheckouts);
  if (!pendingKeys.has('refundRequests') && Array.isArray(data.refundRequests)) current.setRefundRequests(data.refundRequests as typeof current.refundRequests);
  if (!pendingKeys.has('returnRequests') && Array.isArray(data.returnRequests)) current.setReturnRequests(data.returnRequests as typeof current.returnRequests);
  if (!pendingKeys.has('staffPermissions') && data.staffPermissions && typeof data.staffPermissions === 'object') current.setStaffPermissions(data.staffPermissions as typeof current.staffPermissions);
  useStore.setState({
    ...(!pendingKeys.has('notifications') && Array.isArray(data.notifications) ? { notifications: data.notifications } : {}),
    ...(!pendingKeys.has('stockTransfers') && Array.isArray(data.stockTransfers) ? { stockTransfers: data.stockTransfers } : {}),
    ...(!pendingKeys.has('cashDrawerSessions') && Array.isArray(data.cashDrawerSessions) ? { cashDrawerSessions: data.cashDrawerSessions } : {}),
    ...(!pendingKeys.has('mobileOrders') && Array.isArray(data.mobileOrders) ? { mobileOrders: data.mobileOrders } : {}),
    ...(!pendingKeys.has('paymentTerminal') && data.paymentTerminal ? { paymentTerminal: data.paymentTerminal as ReturnType<typeof useStore.getState>['paymentTerminal'] } : {}),
    ...(!pendingKeys.has('printerSettings') && data.printerSettings ? { printerSettings: data.printerSettings as ReturnType<typeof useStore.getState>['printerSettings'] } : {}),
    ...(!pendingKeys.has('receiptSettings') && data.receiptSettings ? { receiptSettings: data.receiptSettings as ReturnType<typeof useStore.getState>['receiptSettings'] } : {}),
    ...(!pendingKeys.has('lastUpdate') && typeof data.lastUpdate === 'string' ? { lastUpdate: data.lastUpdate } : {}),
  });
}

export async function forceRefreshFromFirebase() {
  const snapshot = await get(ref(database, sharedDataPath));
  const hasRemoteData = snapshot.exists();
  if (hasRemoteData) applySharedData(snapshot.val() as SharedData);
  useStore.setState({ firebaseSynced: true });
  return hasRemoteData;
}

export function useFirebaseSync() {
  const firebaseDataInitialized = useRef(false);
  const applyingRemoteOrders = useRef(false);
  const syncFailureReported = useRef(false);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const lastSyncRef = useRef<number>(0);
  const MIN_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    let writeTimer: number | null = null;
    let writePending = false;
    let activeWrite: Promise<void> | null = null;
    let suppressWrites = false;
    const pendingKeys = new Set<(typeof sharedKeys)[number]>();
    const pendingVersions = new Map<(typeof sharedKeys)[number], number>();
    let unsubscribeFirebase: (() => void) | null = null;
    const writerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const pendingSync = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || 'null') as { keys?: unknown } | null;
      if (Array.isArray(pendingSync?.keys)) {
        pendingSync.keys
          .filter((key): key is (typeof sharedKeys)[number] => typeof key === 'string' && sharedKeys.includes(key as (typeof sharedKeys)[number]))
          .forEach((key) => {
            pendingKeys.add(key);
            pendingVersions.set(key, 1);
          });
      }
    } catch (error) {
      console.warn('Could not read the pending Firebase sync list.', error);
    }
    const releaseWriteLock = () => {
      try {
        const lock = JSON.parse(localStorage.getItem(WRITE_LOCK_KEY) || 'null');
        if (lock?.id === writerId) localStorage.removeItem(WRITE_LOCK_KEY);
      } catch {}
    };
    const acquireWriteLock = () => {
      try {
        const now = Date.now();
        const existing = JSON.parse(localStorage.getItem(WRITE_LOCK_KEY) || 'null');
        if (existing?.id !== writerId && existing?.expiresAt > now) return false;
        localStorage.setItem(WRITE_LOCK_KEY, JSON.stringify({ id: writerId, expiresAt: now + WRITE_LOCK_TTL }));
        const confirmed = JSON.parse(localStorage.getItem(WRITE_LOCK_KEY) || 'null');
        return confirmed?.id === writerId;
      } catch {
        return true;
      }
    };
    const writeSnapshot = async () => {
      if (!isAuthenticated) return;
      if (activeWrite) {
        writePending = true;
        await activeWrite;
        if (pendingKeys.size) await writeSnapshot();
        return;
      }
      const snapshot = getSharedData(useStore.getState());
      if (!pendingKeys.size) {
        localStorage.removeItem(PENDING_SYNC_KEY);
        return;
      }
      if (!acquireWriteLock()) {
        writePending = true;
        useStore.getState().setSyncStatus('retrying');
        scheduleWrite(750);
        return;
      }
      useStore.getState().setSyncStatus('syncing');
      activeWrite = (async () => {
      try {
        const currentUser = useStore.getState().currentUser;
        const keysToWrite = Array.from(pendingKeys).filter((key) => currentUser?.role === 'admin' || (key !== 'users' && key !== 'staffPermissions'));
        const versionsToWrite = new Map(keysToWrite.map((key) => [key, pendingVersions.get(key) || 0]));
        await Promise.all(keysToWrite.map((key) => set(ref(database, `${sharedDataPath}/${key}`), snapshot[key])));
        if (currentUser?.role === 'admin' && keysToWrite.some((key) => key === 'products' || key === 'branches')) {
          await set(ref(database, publicCatalogPath), getPublicCatalog(snapshot));
        }
        syncFailureReported.current = false;
        keysToWrite.forEach((key) => {
          if (pendingVersions.get(key) === versionsToWrite.get(key)) {
            pendingKeys.delete(key);
            pendingVersions.delete(key);
          }
        });
        if (pendingKeys.size) {
          useStore.getState().setSyncStatus('retrying');
        } else {
          localStorage.removeItem(PENDING_SYNC_KEY);
          useStore.getState().setSyncStatus('synced');
        }
      } catch (error) {
        localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ updatedAt: Date.now(), keys: Array.from(pendingKeys) }));
        useStore.getState().setSyncStatus('retrying');
        console.warn('Firebase write failed; local data remains available.', error);
        if (!syncFailureReported.current) {
          toast.error('Changes could not be saved to Firebase. Check your connection and database permissions; this device may be the only copy.');
          syncFailureReported.current = true;
        }
      } finally {
        releaseWriteLock();
        activeWrite = null;
        if (writePending) { writePending = false; scheduleWrite(); }
      }
      })();
      await activeWrite;
    };
    const scheduleWrite = (delay = 500) => {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ updatedAt: Date.now(), keys: Array.from(pendingKeys) }));
      if (writeTimer) window.clearTimeout(writeTimer);
      writeTimer = window.setTimeout(() => void writeSnapshot(), delay);
    };
    registerFlushHandler(writeSnapshot);
    const unsubscribeState = useStore.subscribe((state, previousState) => {
      if (suppressWrites || !isAuthenticated || state === previousState) return;
      const changedKeys = sharedKeys.filter((key) => (
        state[key] !== previousState[key]
        && (state.currentUser?.role === 'admin' || (key !== 'users' && key !== 'staffPermissions'))
      ));
      changedKeys.forEach((key) => {
        pendingKeys.add(key);
        pendingVersions.set(key, (pendingVersions.get(key) || 0) + 1);
      });
      if (changedKeys.length) scheduleWrite();
    });
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('super-pos-mobile-orders') : null;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'jann-pos-store' || !event.newValue) return;
      try {
        const data = JSON.parse(event.newValue);
        if (Array.isArray(data.state?.mobileOrders)) {
          applyingRemoteOrders.current = true;
          useStore.getState().setMobileOrders(data.state.mobileOrders);
          applyingRemoteOrders.current = false;
        }
      } catch {}
    };
    const handleMessage = (event: MessageEvent) => {
      if (Array.isArray(event.data?.mobileOrders)) {
        applyingRemoteOrders.current = true;
        useStore.getState().setMobileOrders(event.data.mobileOrders);
        applyingRemoteOrders.current = false;
      }
    };
    const unsubscribeOrders = useStore.subscribe((state, previousState) => {
      if (!applyingRemoteOrders.current && state.mobileOrders !== previousState.mobileOrders) {
        channel?.postMessage({ mobileOrders: state.mobileOrders });
      }
    });
    channel?.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    if (!isAuthenticated) {
      useStore.getState().setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
      return () => {
        unsubscribeState();
        if (writeTimer) window.clearTimeout(writeTimer);
        channel?.removeEventListener('message', handleMessage);
        channel?.close();
        unsubscribeOrders();
        window.removeEventListener('storage', handleStorage);
      };
    }

    const run = async (force = false) => {
      const now = Date.now();
      if (!force && (unsubscribeFirebase || now - lastSyncRef.current < MIN_SYNC_INTERVAL)) {
        // skip frequent syncs
        return;
      }
      lastSyncRef.current = now;
      try {
        unsubscribeFirebase?.();
        unsubscribeFirebase = null;
        firebaseDataInitialized.current = true;
        const unsubscribePublicOrders = onValue(ref(database, publicOrdersPath), (snapshot) => {
          const remoteOrders = Object.values((snapshot.val() || {}) as Record<string, Record<string, unknown>>)
            .flatMap((branchOrders) => Object.values(branchOrders))
            .filter((order): order is ReturnType<typeof useStore.getState>['mobileOrders'][number] => Boolean(order && typeof order === 'object' && 'id' in order));
          if (!remoteOrders.length) return;
          const currentOrders = useStore.getState().mobileOrders;
          const merged = [...currentOrders.filter((order) => !remoteOrders.some((remote) => remote.id === order.id)), ...remoteOrders];
          suppressWrites = true;
          applyingRemoteOrders.current = true;
          useStore.getState().setMobileOrders(merged);
          applyingRemoteOrders.current = false;
          suppressWrites = false;
        });
        const { hasRemoteData, stopListeners } = await new Promise<{ hasRemoteData: boolean; stopListeners: () => void }>((resolve, reject) => {
          let firstSnapshot = true;
          const unsubscribeSharedData = onValue(ref(database, sharedDataPath), (snapshot) => {
            const hasData = snapshot.exists();
            suppressWrites = true;
              if (hasData) {
                const remoteData = snapshot.val() as SharedData;
                applySharedData(remoteData, pendingKeys);
              }
            if (!pendingKeys.size) useStore.getState().setSyncStatus('synced');
            suppressWrites = false;
            if (firstSnapshot) {
              firstSnapshot = false;
              resolve({ hasRemoteData: hasData, stopListeners: () => { unsubscribeSharedData(); unsubscribePublicOrders(); } });
              if (useStore.getState().currentUser?.role === 'admin') {
                const remoteData = (snapshot.val() || {}) as SharedData;
                const missingKeys = sharedKeys.filter((key) => !(key in remoteData));
                missingKeys.forEach((key) => {
                  pendingKeys.add(key);
                  pendingVersions.set(key, (pendingVersions.get(key) || 0) + 1);
                });
                if (missingKeys.length) scheduleWrite();
              }
            }
          }, (error) => {
            if (firstSnapshot) reject(error);
            console.warn('Firebase realtime listener failed.', error);
          });
        });
        unsubscribeFirebase = stopListeners;
        if (!hasRemoteData) {
          sharedKeys.forEach((key) => {
            pendingKeys.add(key);
            pendingVersions.set(key, (pendingVersions.get(key) || 0) + 1);
          });
          await writeSnapshot();
        } else if (pendingKeys.size) await writeSnapshot();
        else useStore.getState().setSyncStatus('synced');
      } catch (error) {
        useStore.getState().setSyncStatus(navigator.onLine ? 'retrying' : 'offline');
        console.warn('Firebase sync failed, continuing from cache.', error);
      }
    };

    // initial sync (allow immediate)
    void run(true);

    // when the browser comes online, attempt a rate-limited sync
    const onOnline = () => { useStore.getState().setSyncStatus('syncing'); void run(true); };
    const onOffline = () => useStore.getState().setSyncStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsubscribeFirebase?.();
      unsubscribeFirebase = null;
      releaseWriteLock();
      unsubscribeState();
      if (writeTimer) window.clearTimeout(writeTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      unsubscribeOrders();
      window.removeEventListener('storage', handleStorage);
    };
  }, [isAuthenticated]);
}
