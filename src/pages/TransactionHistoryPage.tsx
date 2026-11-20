import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import ReceiptView from './ReceiptView';

export default function TransactionHistoryPage() {
  const sales = useStore((state) => state.sales);
  const currentUser = useStore((state) => state.currentUser);
  const selectedBranch = useStore((state) => state.selectedBranch);

  const recentSales = useMemo(
    () => sales
      .filter((sale) => {
        const branchId = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId || selectedBranch;
        return branchId === 'all' || sale.branchId === branchId;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20),
    [sales, currentUser, selectedBranch],
  );

  const deleteSale = useStore((s) => s.deleteSale);
  const addRefundRequest = useStore((s) => s.addRefundRequest);
  const [confirmSale, setConfirmSale] = useState<null | typeof sales[0]>(null);
  const [selectedSale, setSelectedSale] = useState<null | typeof sales[0]>(null);

  return (
    <>
      <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Sales</div>
            <h1>Transaction History</h1>
            <p className="section-description">Browse recent sales transactions and receipts in a cleaner, brighter layout.</p>
          </div>
        </div>
      </div>

        <div className="panel-card mt-4">
          <h2>Recent sales</h2>
          <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: 14 }}>Latest 20 transactions sorted by date.</p>
          {recentSales.length === 0 ? (
            <div style={{ color: '#6b7280', marginTop: 24 }}>No transaction history available.</div>
          ) : (
            <div className="field-grid" style={{ marginTop: 24 }}>
              {recentSales.map((sale) => (
                <div key={sale.id} className="panel-card p-4" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <strong>{sale.receiptNo}</strong>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{sale.date} {sale.time}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span>{sale.sellerName}</span>
                  <span>Le {sale.total.toFixed(2)}</span>
                </div>
                <div style={{ color: '#4b5563', fontSize: 12 }}>{sale.items.length} items • {sale.paymentMethod}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn secondary" onClick={() => setSelectedSale(sale)}>View Receipt</button>
                  <button
                    className="btn"
                    style={{ background: '#f97316', color: '#fff' }}
                    onClick={() => setConfirmSale(sale)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {confirmSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 1100, display: 'grid', placeItems: 'center', padding: 24 }}>
          <div className="card modal-card" style={{ width: '100%', maxWidth: 560, padding: 20 }}>
            <h2 style={{ marginTop: 0 }}>Confirm delete receipt {confirmSale.receiptNo}</h2>
            <div style={{ color: '#6b7280', marginBottom: 12 }}>This will remove the receipt and restore the following product quantities back to stock:</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {confirmSale.items.map((it) => (
                <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{it.name}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{it.quantity} × Le {it.price.toFixed(2)}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>Le {(it.price * it.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Total to restore</div>
              <div style={{ fontWeight: 800 }}>Le {confirmSale.total.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                className="btn"
                style={{ background: '#ef4444', color: '#fff' }}
                onClick={() => {
                  const refund = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, saleId: confirmSale.id, amount: confirmSale.total, reason: 'Receipt deleted - automatic refund', status: 'approved' as const, requestedAt: new Date().toISOString() };
                  try { addRefundRequest(refund); } catch {}
                  deleteSale(confirmSale.id);
                  toast.success('Receipt deleted, stock restored, refund recorded');
                  setConfirmSale(null);
                }}
              >Confirm Delete</button>
              <button className="btn secondary" onClick={() => setConfirmSale(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {selectedSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ background: 'transparent' }}>
              <ReceiptView saleProp={selectedSale} onClose={() => setSelectedSale(null)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
