import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { createId } from '../utils/createId';

export default function AssetCheckoutLog() {
  const branches = useStore((state) => state.branches);
  const users = useStore((state) => state.users);
  const checkouts = useStore((state) => state.assetCheckouts);
  const addAssetCheckout = useStore((state) => state.addAssetCheckout);
  const returnAsset = useStore((state) => state.returnAsset);

  const [item, setItem] = useState('');
  const [checkedOutBy, setCheckedOutBy] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const activeCheckouts = useMemo(() => checkouts.filter((item) => item.status === 'checked-out'), [checkouts]);

  const handleAdd = () => {
    if (!item.trim() || !checkedOutBy || !branchId || !dueDate) {
      toast.error('Please fill in all checkout details');
      return;
    }
    addAssetCheckout({
      id: createId('asset'),
      item: item.trim(),
      checkedOutBy,
      branchId,
      dueDate,
      status: 'checked-out',
      notes: notes.trim(),
      createdAt: new Date().toLocaleDateString(),
    });
    setItem('');
    setCheckedOutBy('');
    setDueDate('');
    setNotes('');
    toast.success('Asset checkout added');
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Asset Checkout Log</h1>
            <p className="section-description">Track equipment and items that are checked out by staff.</p>
          </div>
          <div className="section-stats">
            <span>Active checkouts</span>
            <strong>{activeCheckouts.length}</strong>
          </div>
        </div>

        <div className="grid-wide mt-6">
          <div className="panel-card">
            <h2 style={{ marginTop: 0 }}>Checkout history</h2>
            {checkouts.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No asset checkouts recorded yet.</div>
            ) : (
              <div className="field-grid mt-3">
                {checkouts.map((checkout) => (
                  <div key={checkout.id} className="panel-card p-4">
                    <div className="section-header" style={{ borderBottom: 'none', padding: 0, gap: 10 }}>
                      <div>
                        <strong>{checkout.item}</strong>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{checkout.createdAt} • {checkout.dueDate}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ padding: '4px 10px', borderRadius: 999, background: checkout.status === 'returned' ? '#d1fae5' : '#fef3c7', color: '#134e4a', fontSize: 12 }}>
                          {checkout.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ color: '#4b5563', fontSize: 12 }}>
                        {checkout.checkedOutBy} • {branches.find((b) => b.id === checkout.branchId)?.name || checkout.branchId}
                      </div>
                      {checkout.status === 'checked-out' && (
                        <button className="btn" onClick={() => returnAsset(checkout.id)}>Mark returned</button>
                      )}
                    </div>
                    {checkout.notes && <p style={{ color: '#4b5563', margin: '10px 0 0 0', fontSize: 12 }}>{checkout.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-card p-5">
            <h2 style={{ marginTop: 0 }}>New checkout</h2>
            <div className="field-grid" style={{ marginTop: 12 }}>
              <label className="form-field">
                <span>Item</span>
                <input className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Asset name" />
              </label>
              <label className="form-field">
                <span>Checked out by</span>
                <select className="input" value={checkedOutBy} onChange={(e) => setCheckedOutBy(e.target.value)}>
                  <option value="">Select staff</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.name}>{user.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Branch</span>
                <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Due date</span>
                <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>
              <label className="form-field">
                <span>Notes</span>
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
              </label>
              <button className="btn" onClick={handleAdd}>Record checkout</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
