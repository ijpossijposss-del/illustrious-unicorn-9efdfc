import { useMemo } from 'react';
import { useStore } from '../store/useStore';

export default function CustomerDisplay() {
  const customers = useStore((state) => state.customers);

  const activeCount = useMemo(() => customers.filter((customer) => customer.active).length, [customers]);

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Customer Display</h1>
            <p className="section-description">Show registered customer details and loyalty status.</p>
          </div>
        </div>

        <div className="field-grid mt-6">
          <div className="panel-card p-5">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Registered customers</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{customers.length}</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Active customer profiles: {activeCount}</div>
          </div>

          {customers.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No customers have been added yet.</div>
          ) : (
            <div className="field-grid">
              {customers.map((customer) => (
                <div key={customer.id} className="panel-card" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{customer.name}</strong>
                    <span style={{ color: customer.active ? '#16a34a' : '#ef4444', fontSize: 12 }}>
                      {customer.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{customer.phone || 'No phone'} • {customer.email || 'No email'}</div>
                  {customer.loyaltyId && <div style={{ fontSize: 12, color: '#4b5563' }}>Loyalty ID: {customer.loyaltyId}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
