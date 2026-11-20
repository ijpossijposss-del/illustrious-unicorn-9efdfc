import { Navigate, useLocation } from 'react-router-dom';
import { Layout } from './Layout';
import { useStore } from '../store/useStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  permission?: string;
}

export function ProtectedRoute({ children, adminOnly = false, permission }: ProtectedRouteProps) {
  const location = useLocation();
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const currentUser = useStore((state) => state.currentUser);
  const staffPermissions = useStore((state) => state.staffPermissions);

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if ((adminOnly && currentUser.role !== 'admin')
    || (permission && currentUser.role !== 'admin' && !useStore.getState().hasPermission(permission))) {
    return (
      <Layout>
        <div className="container">
          <div className="section-card">
            <h1>Access denied</h1>
            <p className="section-description">Your account does not have permission to open this page. Ask an admin to update your access.</p>
          </div>
        </div>
      </Layout>
    );
  }

  void staffPermissions;

  return <Layout>{children}</Layout>;
}
