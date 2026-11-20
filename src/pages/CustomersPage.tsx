import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { createId } from '../utils/createId';

export default function CustomersPage() {
  const customers = useStore((state) => state.customers);
  const addCustomer = useStore((state) => state.addCustomer);
  const updateCustomer = useStore((state) => state.updateCustomer);
  const deleteCustomer = useStore((state) => state.deleteCustomer);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loyaltyId, setLoyaltyId] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (!name.trim()) {
      toast.error('Customer name required');
      return;
    }
    addCustomer({
      id: createId('c'),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      loyaltyId: loyaltyId.trim(),
      active: true,
      createdAt: new Date().toLocaleDateString(),
    });
    setName('');
    setPhone('');
    setEmail('');
    setLoyaltyId('');
    toast.success('Customer added');
    setShowForm(false);
  };

  const toggleActive = (id: string, current: boolean) => {
    const customer = customers.find((item) => item.id === id);
    if (!customer) return;
    updateCustomer({ ...customer, active: !current });
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Customers</h1>
            <p className="section-description">Create and manage customer profiles for loyalty and tracking.</p>
          </div>
          <div className="section-actions">
            <button className="btn secondary" onClick={() => window.location.reload()}>Refresh</button>
            <button className="btn" onClick={() => setShowForm(true)}>+ Add Customer</button>
          </div>
        </div>

        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: 16 }}>
            <div className="section-card" style={{ width: '100%', maxWidth: 560, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Add customer</h2>
                <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>✕</button>
              </div>
              <div className="field-grid mt-3">
                <label className="form-field">
                  <span>Name</span>
                  <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="form-field">
                  <span>Phone</span>
                  <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label className="form-field">
                  <span>Email</span>
                  <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="form-field">
                  <span>Loyalty ID</span>
                  <input className="input" placeholder="Loyalty ID" value={loyaltyId} onChange={(e) => setLoyaltyId(e.target.value)} />
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={handleAdd}>Create customer</button>
                  <button className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="panel-card mt-6">
          <h2>Customer list</h2>
          {customers.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No customers added yet.</div>
          ) : (
            <div className="field-grid mt-3">
              {customers.map((customer) => (
                <div key={customer.id} className="panel-card p-5" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <strong>{customer.name}</strong>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{customer.phone || 'No phone'} • {customer.email || 'No email'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="btn secondary" onClick={() => toggleActive(customer.id, customer.active)}>
                        {customer.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="btn secondary" onClick={() => { if (window.confirm(`Delete ${customer.name}? This cannot be undone.`)) deleteCustomer(customer.id); }}>Delete</button>
                    </div>
                  </div>
                  {customer.loyaltyId && <div style={{ color: '#4b5563', fontSize: 12 }}>Loyalty ID: {customer.loyaltyId}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
