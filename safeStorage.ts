const safeStorage = (storage: Storage | null) => ({
  getItem(key: string) {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      storage?.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  },
  removeItem(key: string) {
    try {
      storage?.removeItem(key);
    } catch {
      // ignore storage errors
    }
  },
});

export const getItem = (storage: 'local' | 'session', key: string) =>
  safeStorage(storage === 'local' ? localStorage : sessionStorage).getItem(key);

export const setItem = (storage: 'local' | 'session', key: string, value: string) =>
  safeStorage(storage === 'local' ? localStorage : sessionStorage).setItem(key, value);

export const removeItem = (storage: 'local' | 'session', key: string) =>
  safeStorage(storage === 'local' ? localStorage : sessionStorage).removeItem(key);
