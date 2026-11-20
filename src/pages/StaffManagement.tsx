import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { auth } from '../sync/firebase';
import type { User } from '../store/useStore';

export default function StaffManagement() {
  const users = useStore((state) => state.users);
  const branches = useStore((state) => state.branches);
  const createStaffAccount = useStore((state) => state.createStaffAccount);
  const updateStaffAccount = useStore((state) => state.updateStaffAccount);
  const deleteUser = useStore((state) => state.deleteUser);

  const [name, setName] = useState('');
  const [role, setRole] = useState<'seller' | 'staff'>('seller');
  const [position, setPosition] = useState('Cashier');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [staffNumber, setStaffNumber] = useState('ST-002');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const requestStaff = async (method: 'POST' | 'PUT' | 'DELETE', body?: Record<string, unknown>, id?: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Your admin sign-in has expired. Sign in again.');
    const query = id ? `?id=${encodeURIComponent(id)}` : '';
    const response = await fetch(`/.netlify/functions/staff${query}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json() as { user?: User; error?: string };
    if (!response.ok) throw new Error(result.error || 'Staff account request failed.');
    return result.user;
  };

  const handleCreate = async () => {
    if (!name.trim() || !branchId || (!editingId && !password.trim())) {
      toast.error('Name, branch and password are required for new staff accounts.');
      return;
    }

    const existingUser = editingId ? users.find((u) => u.id === editingId) : undefined;
    const proposed = staffNumber.trim() || `ST-${Date.now()}`;
    const duplicate = users.find((u) => u.staffNumber === proposed && u.id !== editingId);
    if (duplicate) {
      toast.error('Staff number already exists — choose a different one');
      return;
    }
    if (users.some((user) => user.id !== editingId && user.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      toast.error('A staff account with that name already exists.');
      return;
    }

    const userPayload = {
      name: name.trim(),
      role,
      position: position.trim() || 'Staff',
      branchId,
      staffNumber: proposed,
      phone: phone.trim() || undefined,
      active: true,
      createdAt: existingUser?.createdAt || new Date().toISOString(),
    };

    try {
      if (editingId) {
        const updated = await requestStaff('PUT', { ...userPayload, active: existingUser?.active ?? true, ...(password.trim() ? { password: password.trim() } : {}) }, editingId);
        if (updated) updateStaffAccount(updated);
        toast.success('Staff updated');
        setEditingId(null);
      } else {
        const created = await requestStaff('POST', { ...userPayload, password: password.trim() });
        if (!created) throw new Error('The server did not return the new staff profile.');
        createStaffAccount(created);
        toast.success('Staff account created. Staff can now sign in with this name and password.');
      }

      setName('');
      setPassword('');
      setStaffNumber(`ST-${Date.now()}`);
      setPhone('');
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Staff account could not be saved.');
    }
  };

  const toggleActive = async (userId: string) => {
    const existing = users.find((user) => user.id === userId);
    if (!existing) return;
    try {
      const updated = await requestStaff('PUT', { ...existing, active: !existing.active }, userId);
      if (updated) updateStaffAccount(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Staff account could not be updated.');
    }
  };

  const startEdit = (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    setEditingId(u.id);
    setName(u.name);
    setRole(u.role === 'staff' ? 'staff' : 'seller');
    setPosition(u.position || 'Staff');
    setBranchId(u.branchId || branches[0]?.id || '');
    setStaffNumber(u.staffNumber || '');
    setPassword('');
    setPhone((u as any).phone || '');
    setShowForm(true);
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
            <div className="hero-icon" style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, #0f172a, #2563eb)', color: '#fff', fontWeight: 800, fontSize: 20 }}>A</div>
            <div style={{ minWidth: 0 }}>
              <h1>Staff Management</h1>
              <p className="section-description">14 team members across {branches.length} branches</p>
            </div>
          </div>

          <div className="section-actions">
            <button className="btn secondary" onClick={() => window.location.reload()} style={{ padding: '10px 14px' }}>Refresh</button>
            <button className="btn" onClick={() => { setEditingId(null); setName(''); setPassword(''); setStaffNumber(`ST-${Date.now()}`); setShowForm(true); }} style={{ padding: '10px 14px' }}>+ Add Staff</button>
          </div>
        </div>
      </div>

      {/* Form modal (hidden by default) */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div className="section-card staff-form-modal" style={{ width: '100%', maxWidth: 520, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{editingId ? 'Edit staff account' : 'New staff account'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div className="field-grid staff-form-grid" style={{ marginTop: 10 }}>
              <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'seller' | 'staff')}>
                  <option value="seller">Seller</option>
                  <option value="staff">Staff</option>
                </select>
                <input className="input" placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
              <div className="staff-contact-row" style={{ display: 'grid', gap: 8 }}>
                <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                <input className="input" placeholder="Staff number (for receipts) e.g. STF001" value={staffNumber} onChange={(e) => setStaffNumber(e.target.value)} />
              </div>
              <input className="input" type="password" autoComplete="new-password" placeholder={editingId ? 'Leave blank to keep password' : 'Password (minimum 6 characters)'} value={password} onChange={(e) => setPassword(e.target.value)} />
              <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Staff sign in with the name and password you set here. No email address is needed.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => void handleCreate()}>{editingId ? 'Save Changes' : 'Create account'}</button>
                <button className="btn secondary" onClick={() => { setShowForm(false); setEditingId(null); setName(''); setPassword(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {users.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No staff accounts found.</div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="card" style={{ padding: 18, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 28, background: '#0b69ff', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18 }}>{user.name?.[0]?.toUpperCase() || 'U'}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{user.name}</div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>{user.position}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ padding: '6px 8px', background: user.active ? '#dcfce7' : '#fee2e2', borderRadius: 18, color: user.active ? '#166534' : '#991b1b', fontSize: 12 }}>{user.active ? 'Active' : 'Inactive'}</div>
                </div>
              </div>

              <div style={{ color: '#6b7280', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span>📍</span>
                  <span>{branches.find(b => b.id === user.branchId)?.name || user.branchId}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
                  <span>🛡️</span>
                  <span>{user.role}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn secondary" style={{ flex: 1 }} onClick={() => startEdit(user.id)}>✎ Edit</button>
                <button className="btn" style={{ background: 'linear-gradient(135deg,#f97316,#ff8a00)', color: '#fff' }} onClick={() => void toggleActive(user.id)}>{user.active ? 'Deactivate' : 'Activate'}</button>
                <button className="btn secondary" onClick={() => { if (window.confirm(`Delete ${user.name}? This cannot be undone.`)) void requestStaff('DELETE', undefined, user.id).then(() => { deleteUser(user.id); toast.success('Staff account deleted'); }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Staff account could not be deleted.')); }} style={{ width: 40, padding: 8, background: '#fff', border: '1px solid #fee2e2', color: '#991b1b' }}>🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
