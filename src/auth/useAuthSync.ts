import { useEffect } from 'react';
import { useStore } from '../store/useStore';

const AUTH_BROADCAST_KEY = 'jann-pos-auth-broadcast';

export function useAuthSync() {
  const logout = useStore((state) => state.logout);
  const currentUser = useStore((state) => state.currentUser);
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  useEffect(() => {
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('jann-pos-auth') : null;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_BROADCAST_KEY) return;
      const payload = event.newValue;
      if (payload === 'AUTH_LOGOUT') {
        logout();
      }
      if (payload === 'AUTH_STATE_CHANGED') {
        useStore.setState({ currentUser, isAuthenticated });
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AUTH_LOGOUT') logout();
      if (event.data?.type === 'AUTH_STATE_CHANGED') useStore.setState({ currentUser, isAuthenticated });
    };

    window.addEventListener('storage', handleStorage);
    channel?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
    };
  }, [currentUser, isAuthenticated, logout]);
}
