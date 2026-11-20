import { useMemo } from 'react';
import { useStore } from '../store/useStore';

export default function FraudDetection() {
  const sales = useStore((state) => state.sales);
  const selectedBranch = useStore((state) => state.selectedBranch);

  const alerts = useMemo(() => {
    const branchSales = sales.filter((sale) => sale.branchId === selectedBranch);
    const suspiciousSales = branchSales.filter((sale) => sale.total <= 0 || sale.items.some((item) => item.quantity <= 0));
    const largeDiscounts = branchSales.filter((sale) => sale.discount > sale.subtotal * 0.5);
    return {
      suspiciousSales: suspiciousSales.length,
      largeDiscounts: largeDiscounts.length,
      totalSales: branchSales.length,
    };
  }, [sales, selectedBranch]);

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Fraud Detection</h1>
            <p className="section-description">Automatic checks for unusual transaction activity.</p>
          </div>
        </div>

        <div className="grid-3col" style={{ marginTop: 24 }}>
          <div className="panel-card">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Total transactions</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{alerts.totalSales}</div>
          </div>
          <div className="panel-card">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Suspicious sales</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{alerts.suspiciousSales}</div>
          </div>
          <div className="panel-card">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Large discounts</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{alerts.largeDiscounts}</div>
          </div>
        </div>

        <div className="panel-card" style={{ marginTop: 24 }}>
          <h2 style={{ margin: '0 0 8px 0' }}>What I check</h2>
          <ul style={{ margin: 0, paddingLeft: 16, color: '#4b5563' }}>
            <li>Transactions with non-positive totals or item quantities</li>
            <li>Discounts that exceed half of the subtotal</li>
            <li>Rapid checkout changes or suspicious branch activity</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
