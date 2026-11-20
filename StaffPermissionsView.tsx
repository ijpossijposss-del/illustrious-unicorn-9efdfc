import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';

  const PERMISSION_GROUPS: Record<string, { title: string; items: string[] }> = {
    navigation: { title: 'Navigation', items: ['view-dashboard', 'use-pos', 'view-products', 'view-eod', 'view-transactions', 'view-customers', 'view-returns'] },
    receipt: { title: 'Receipt', items: ['create-receipt','edit-receipt','print-receipt','edit-receipt-content','edit-receipt-text'] },
    products: { title: 'Products', items: ['add-products','edit-products','upload-images','view-products','bulk-import'] },
    inventory: { title: 'Inventory', items: ['record-stock','view-inventory'] },
    customers: { title: 'Customers', items: ['view-customers','add-customers'] },
    reports: { title: 'Reports', items: ['generate-reports','view-eod','view-profit','view-leaderboard','view-analytics','view-branch-reports','view-branch-transactions'] },
    admin: { title: 'Admin', items: ['use-voice-ai','view-settings','manage-staff','clear-records','view-expenses','view-assets','view-operations'] },
  };
  const ALL_PERMISSIONS = Object.values(PERMISSION_GROUPS).flatMap((g) => g.items);

export default function StaffPermissionsView() {
  const users = useStore((s) => s.users);
  const branches = useStore((s) => s.branches);
  const permissions = useStore((state) => state.staffPermissions);
  const currentUser = useStore((state) => state.currentUser);
  const grantPermission = useStore((s) => s.grantPermission);
  const revokePermission = useStore((s) => s.revokePermission);

  const [selectedUser, setSelectedUser] = useState(users[0]?.id || '');
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '');

  const isAdmin = currentUser?.role === 'admin';
  const visibleUserId = isAdmin ? selectedUser : currentUser?.id || '';
  const visibleBranchId = isAdmin ? selectedBranch : currentUser?.branchId || '';

  const userList = users;

  useEffect(() => {
    if (selectedUser && users.find((u) => u.id === selectedUser)) return;
    setSelectedUser(users[0]?.id || '');
  }, [users, selectedUser]);

  useEffect(() => {
    const user = users.find((item) => item.id === selectedUser);
    if (user?.branchId && branches.some((branch) => branch.id === user.branchId)) {
      setSelectedBranch(user.branchId);
    }
  }, [users, branches, selectedUser]);

  useEffect(() => {
    if (selectedBranch && branches.find((b) => b.id === selectedBranch)) return;
    setSelectedBranch(branches[0]?.id || '');
  }, [branches, selectedBranch]);

  const userPermissionsForBranch = (userId: string, branchId: string) => {
    const stored = permissions[userId]?.[branchId] || [];
    const user = users.find((item) => item.id === userId);
    return user?.role === 'admin' ? Array.from(new Set([...ALL_PERMISSIONS, ...stored])) : stored;
  };

  const handleGrantAll = (userId: string, branchId: string) => {
    if (!isAdmin) return;
    ALL_PERMISSIONS.forEach((p) => grantPermission(userId, branchId, p));
    toast.success('All permissions granted');
  };

  const handleRevokeAll = (userId: string, branchId: string) => {
    if (!isAdmin) return;
    ALL_PERMISSIONS.forEach((p) => revokePermission(userId, branchId, p));
    toast.success('All permissions revoked');
  };

  return (
    <div className="container staff-permissions-page">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Staff Permissions</h1>
            <p className="section-description">Control branch-specific access for every staff member from one place.</p>
          </div>
          <div className="section-actions staff-permissions-controls">
            {isAdmin ? <>
              <select className="input" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                {userList.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select className="input" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
                {branches.filter((b) => b.id === users.find((u) => u.id === selectedUser)?.branchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </> : <span className="status-pill">Read-only permissions</span>}
          </div>
        </div>

        <div className="field-grid staff-permissions-content" style={{ marginTop: 18 }}>
          <div style={{ flex: 1 }}>
            <div className="staff-permissions-summary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 18 }}>{users.find((u) => u.id === visibleUserId)?.name || 'Select staff'}</strong>
                <div style={{ color: '#6b7280' }}>{branches.find((b) => b.id === visibleBranchId)?.name || ''}</div>
              </div>
              {isAdmin && <div className="staff-permissions-summary-actions" style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => handleGrantAll(selectedUser, selectedBranch)}>Grant All</button>
                <button className="btn secondary" onClick={() => handleRevokeAll(selectedUser, selectedBranch)}>Revoke All</button>
              </div>}
            </div>

            <div className="grid-2col staff-permissions-grid" style={{ marginTop: 12 }}>
              {Object.entries(PERMISSION_GROUPS).map(([key, group]) => (
                <div key={key} className="panel-card p-4 staff-permissions-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>{group.title}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{group.items.length} items</div>
                  </div>
                  <div className="field-grid">
                    {group.items.map((perm) => {
                      const has = userPermissionsForBranch(visibleUserId, visibleBranchId).includes(perm);
                      return (
                        <div key={perm} className="permission-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#374151' }}>{perm.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                          <input type="checkbox" aria-label={perm} checked={has} disabled={!isAdmin} onChange={() => isAdmin && (has ? revokePermission(selectedUser, selectedBranch, perm) : grantPermission(selectedUser, selectedBranch, perm))} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
