import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { createId } from '../utils/createId';

export default function ReturnsPage() {
  const returnRequests = useStore((state) => state.returnRequests);
  const addReturnRequest = useStore((state) => state.addReturnRequest);
  const processReturnRequest = useStore((state) => state.processReturnRequest);

  const [saleId, setSaleId] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!saleId.trim() || !item.trim() || quantity <= 0 || !reason.trim()) {
      toast.error('Complete all return details');
      return;
    }
    addReturnRequest({
      id: createId('ret'),
      saleId: saleId.trim(),
      item: item.trim(),
      quantity,
      reason: reason.trim(),
      status: 'pending',
      requestedAt: new Date().toLocaleDateString(),
    });
    setSaleId('');
    setItem('');
    setQuantity(1);
    setReason('');
    toast.success('Return request submitted');
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Returns</h1>
            <p className="section-description">Manage product return requests and track processing status.</p>
          </div>
        </div>

        <div className="returns-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 20, marginTop: 24 }}>
          <div className="panel-card">
            <h2>Active returns</h2>
            {returnRequests.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No return requests found.</div>
            ) : (
              <div className="field-grid" style={{ marginTop: 16 }}>
                {returnRequests.map((request) => (
                  <div key={request.id} className="panel-card p-4">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{request.item}</strong>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{request.saleId} • {request.requestedAt}</div>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', fontSize: 12 }}>{request.status}</span>
                    </div>
                    <div style={{ marginTop: 10, color: '#4b5563', fontSize: 12 }}>Qty: {request.quantity} • Reason: {request.reason}</div>
                    {request.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        <button className="btn" onClick={() => processReturnRequest(request.id, 'processed')}>Process</button>
                        <button className="btn secondary" onClick={() => processReturnRequest(request.id, 'cancelled')}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel-card">
            <h2>New return request</h2>
            <div className="field-grid" style={{ marginTop: 16 }}>
              <label className="form-field">
                <span>Sale ID</span>
                <input className="input" placeholder="Sale ID" value={saleId} onChange={(e) => setSaleId(e.target.value)} />
              </label>
              <label className="form-field">
                <span>Item</span>
                <input className="input" placeholder="Item" value={item} onChange={(e) => setItem(e.target.value)} />
              </label>
              <label className="form-field">
                <span>Quantity</span>
                <input className="input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              </label>
              <label className="form-field">
                <span>Reason</span>
                <textarea className="input" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
              </label>
              <button className="btn" onClick={handleSubmit}>Submit return</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
