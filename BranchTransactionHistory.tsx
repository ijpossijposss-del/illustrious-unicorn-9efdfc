import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import ReceiptView from './ReceiptView';

export default function BranchTransactionHistory() {
  const sales = useStore((state) => state.sales);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const branches = useStore((state) => state.branches);
  const [selectedSale, setSelectedSale] = useState<typeof sales[number] | null>(null);
  const branch = branches.find((item) => item.id === selectedBranch);
  const branchSales = useMemo(
    () => sales.filter((sale) => selectedBranch === 'all' || sale.branchId === selectedBranch).sort((a, b) => b.timestamp - a.timestamp),
    [sales, selectedBranch],
  );

  return (
    <>
      <div className="container">
        <div className="section-card">
          <div className="section-header">
            <div>
              <h1>Branch Transaction History</h1>
              <p className="section-description">Sales recorded at {branch?.name || selectedBranch}.</p>
            </div>
          </div>
          {branchSales.length === 0 ? (
            <div style={{ color: '#6b7280', marginTop: 24 }}>No transactions recorded for this branch.</div>
          ) : (
            <div className="field-grid mt-6">
              {branchSales.map((sale) => (
                <div key={sale.id} className="panel-card p-4" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{sale.receiptNo}</strong>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{sale.date} {sale.time}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>{sale.sellerName}</span>
                    <strong>Le {sale.total.toFixed(2)}</strong>
                  </div>
                  <div style={{ color: '#4b5563', fontSize: 12 }}>{sale.items.length} items • {sale.paymentMethod}</div>
                  <button className="btn secondary" onClick={() => setSelectedSale(sale)}>View Receipt</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {selectedSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'auto' }}>
            <ReceiptView saleProp={selectedSale} onClose={() => setSelectedSale(null)} />
          </div>
        </div>
      )}
    </>
  );
}
