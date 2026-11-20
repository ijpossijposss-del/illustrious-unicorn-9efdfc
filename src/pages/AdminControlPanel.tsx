import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getSaleProfit, getSaleRevenue } from '../utils/salesMetrics';

export default function AdminControlPanel() {
  const navigate = useNavigate();
  const users = useStore((state) => state.users);
  const branches = useStore((state) => state.branches);
  const products = useStore((state) => state.products);
  const sales = useStore((state) => state.sales);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const expenses = useStore((state) => state.expenses);
  const assetCheckouts = useStore((state) => state.assetCheckouts);

  const branchSales = useMemo(() => sales.filter((sale) => selectedBranch === 'all' || sale.branchId === selectedBranch), [sales, selectedBranch]);
  const totalRevenue = useMemo(() => branchSales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0), [branchSales]);
  const totalProfit = useMemo(() => branchSales.reduce((sum, sale) => sum + getSaleProfit(sale), 0), [branchSales]);
  const branchExpenses = useMemo(() => expenses.filter((expense) => expense.branchId === selectedBranch), [expenses, selectedBranch]);
  const totalExpenses = useMemo(() => branchExpenses.reduce((sum, expense) => sum + expense.amount, 0), [branchExpenses]);
  const assetsCheckedOut = useMemo(() => assetCheckouts.filter((checkout) => checkout.status === 'checked-out').length, [assetCheckouts]);

  const cards = [
    { label: 'Branches', value: branches.length, detail: 'Active locations' },
    { label: 'Staff Members', value: users.length, detail: 'Total users' },
    { label: 'Products', value: products.length, detail: 'Total inventory items' },
    { label: 'Revenue', value: `Le ${totalRevenue.toFixed(2)}`, detail: 'Total sales' },
    { label: 'Gross Profit', value: `Le ${totalProfit.toFixed(2)}`, detail: 'Revenue less item costs' },
    { label: 'Expenses', value: `Le ${totalExpenses.toFixed(2)}`, detail: 'Total costs' },
    { label: 'Assets Out', value: assetsCheckedOut, detail: 'Items checked out' },
  ];

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Admin Control Panel</h1>
            <p className="section-description">Quick overview of business health and admin actions.</p>
          </div>
        </div>

        <div className="field-grid mt-6">
          {cards.map((card) => (
            <div key={card.label} className="panel-card p-4">
              <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{card.detail}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }} className="mt-6">
          {[
            { label: 'All Branches', path: '/branches' },
            { label: 'Manage Staff', path: '/staff' },
            { label: 'Bulk Product Import', path: '/bulk-import' },
            { label: 'Asset Checkout', path: '/asset-checkout' },
            { label: 'Reports', path: '/reports' },
          ].map((action) => (
            <button
              key={action.path}
              className="btn"
              style={{ minWidth: 180 }}
              onClick={() => navigate(action.path)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
