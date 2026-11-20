import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getSaleProfit, getSaleRevenue } from '../utils/salesMetrics';

export default function BranchSalesReport() {
  const branches = useStore((state) => state.branches);
  const sales = useStore((state) => state.sales);

  const branchSummaries = useMemo(() => {
    return branches.map((branch) => {
      const branchSales = sales.filter((sale) => sale.branchId === branch.id);
      const revenue = branchSales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0);
      const profit = branchSales.reduce((sum, sale) => sum + getSaleProfit(sale), 0);
      return { branch, revenue, profit, transactions: branchSales.length };
    });
  }, [branches, sales]);

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Branch Sales Report</h1>
            <p className="section-description">Compare revenue and profitability for each branch.</p>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 24 }}>
          {branchSummaries.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No branches available.</div>
          ) : (
            branchSummaries.map((summary) => (
              <div key={summary.branch.id} className="panel-card p-4">
                <div className="section-header" style={{ borderBottom: 'none', padding: 0, gap: 12 }}>
                  <div>
                    <strong>{summary.branch.name}</strong>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{summary.branch.location} • {summary.branch.region}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Transactions</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.transactions}</div>
                  </div>
                </div>
                <div className="grid-2col mt-4">
                  <div className="panel-card p-3" style={{ background: '#f9fafb', boxShadow: 'none', borderColor: '#e5ebf2' }}>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Revenue</div>
                    <div style={{ fontWeight: 700 }}>Le {summary.revenue.toFixed(2)}</div>
                  </div>
                  <div className="panel-card p-3" style={{ background: '#f9fafb', boxShadow: 'none', borderColor: '#e5ebf2' }}>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Gross Profit</div>
                    <div style={{ fontWeight: 700 }}>Le {summary.profit.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
