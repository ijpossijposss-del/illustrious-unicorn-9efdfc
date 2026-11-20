import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { createId } from '../utils/createId';

export default function BranchesManager() {
  const branches = useStore((state) => state.branches);
  const addBranch = useStore((state) => state.addBranch);
  const updateBranch = useStore((state) => state.updateBranch);
  const deleteBranch = useStore((state) => state.deleteBranch);
  const toggleBranchActive = useStore((state) => state.toggleBranchActive);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [region, setRegion] = useState('');
  const [phone, setPhone] = useState('');
  const [openingHours, setOpeningHours] = useState('08:00');
  const [closingHours, setClosingHours] = useState('20:00');
  const [showForm, setShowForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  const openAddForm = () => {
    setEditingBranchId(null);
    setName('');
    setLocation('');
    setRegion('');
    setPhone('');
    setOpeningHours('08:00');
    setClosingHours('20:00');
    setShowForm(true);
  };

  const openEditForm = (branch: typeof branches[number]) => {
    setEditingBranchId(branch.id);
    setName(branch.name);
    setLocation(branch.location);
    setRegion(branch.region);
    setPhone(branch.phone);
    setOpeningHours(branch.openingHours);
    setClosingHours(branch.closingHours);
    setShowForm(true);
  };

  const handleAdd = () => {
    if (!name.trim() || !location.trim()) {
      toast.error('Enter a branch name and location.');
      return;
    }
    const branch = {
      id: createId('b'),
      name: name.trim(),
      location: location.trim(),
      region: region.trim() || 'Unknown',
      phone: phone.trim(),
      active: true,
      openingHours,
      closingHours,
      allowExtendedHours: false,
    };
    if (editingBranchId) {
      const existingBranch = branches.find((item) => item.id === editingBranchId);
      if (existingBranch) updateBranch({ ...existingBranch, ...branch, id: editingBranchId });
    } else {
      addBranch(branch);
    }
    setName('');
    setLocation('');
    setRegion('');
    setPhone('');
    setEditingBranchId(null);
    setShowForm(false);
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Branches</h1>
            <p className="section-description">Manage branch locations and active branch controls.</p>
          </div>
          <div className="section-actions">
            <button className="btn secondary" onClick={() => window.location.reload()}>Refresh</button>
            <button className="btn" onClick={openAddForm}>+ Add Branch</button>
          </div>
        </div>
      </div>

      {/* Add branch modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1300, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div className="section-card p-0 branch-modal" style={{ width: '100%', maxWidth: 480, overflow: 'hidden' }}>
            <div className="p-5 branch-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center', color: '#2563eb' }}>🏷️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{editingBranchId ? 'Edit Branch' : 'New Branch'}</div>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div className="p-5 branch-modal-body">
              <div className="field-grid">
                <label className="form-field">
                  <span>Branch Name</span>
                  <input className="input" placeholder="e.g. Downtown Branch" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="form-field">
                  <span>Location</span>
                  <input className="input" placeholder="Street address or area" value={location} onChange={(e) => setLocation(e.target.value)} />
                </label>
                <label className="form-field">
                  <span>Region</span>
                  <input className="input" placeholder="e.g. Central, East, North" value={region} onChange={(e) => setRegion(e.target.value)} />
                </label>
                <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <label className="form-field">
                    <span>Phone Number</span>
                    <input className="input" placeholder="+232 76 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Allow admin extended time</span>
                    <select className="input" value={''} onChange={() => {}}>
                      <option>Yes - Admin can sell any time</option>
                      <option>No - Enforce branch hours</option>
                    </select>
                  </label>
                </div>
                <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <label className="form-field">
                    <span>Opening time</span>
                    <input className="input" type="time" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Closing time</span>
                    <input className="input" type="time" value={closingHours} onChange={(e) => setClosingHours(e.target.value)} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className="btn secondary" onClick={() => setShowForm(false)} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e6e6e6' }}>Cancel</button>
                  <button className="btn" onClick={handleAdd} style={{ background: 'linear-gradient(135deg, #f97316, #ff8a00)', color: '#fff' }}>{editingBranchId ? 'Save Changes' : 'Add Branch'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {branches.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No branch records available.</div>
        ) : (
          <div className="branches-grid">
            {branches.map((branch) => (
              <div key={branch.id} className="branch-card">
                <div className="header">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="branch-badge">📍</div>
                    <div>
                      <div className="branch-title">{branch.name}</div>
                      <div className="branch-meta">{branch.location}</div>
                      <div className="muted">{branch.region}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div className="branch-pill">{branch.active ? 'Active' : 'Inactive'}</div>
                  </div>
                </div>

                <div style={{ color: '#475569', fontSize: 13 }}>
                  <div>Hours: {branch.openingHours} - {branch.closingHours}</div>
                  <div>Phone: {branch.phone || 'N/A'}</div>
                </div>

                <div className="branch-actions">
                  <button className="btn secondary" onClick={() => toggleBranchActive(branch.id)}>
                    {branch.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn" onClick={() => { if (window.confirm(`Delete ${branch.name}? This cannot be undone.`)) deleteBranch(branch.id); }} style={{ background: '#fff', color: '#ef4444', border: '1px solid rgba(239,68,68,0.08)' }}>
                    🗑️
                  </button>
                  <button className="btn" onClick={() => openEditForm(branch)} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e6e6e6' }}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
