import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { getSaleProfit, getSaleRevenue, getSaleTimestamp } from '../utils/salesMetrics';

export default function AnalyticsPage() {
  const sales = useStore((state) => state.sales);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const products = useStore((state) => state.products);
  const customers = useStore((state) => state.customers);
  const expenses = useStore((state) => state.expenses);
  const currentUser = useStore((state) => state.currentUser);
  const scope = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId;
  const branchSales = useMemo(() => sales.filter((sale) => scope === 'all' || sale.branchId === scope), [sales, scope]);
  const branchExpenses = useMemo(() => expenses.filter((expense) => scope === 'all' || expense.branchId === scope), [expenses, scope]);

  const totalRevenue = useMemo(() => branchSales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0), [branchSales]);
  const totalProfit = useMemo(() => branchSales.reduce((sum, sale) => sum + getSaleProfit(sale), 0), [branchSales]);
  const totalExpenses = useMemo(() => branchExpenses.reduce((sum, expense) => sum + expense.amount, 0), [branchExpenses]);
  const totalCustomers = customers.length;
  const bestSellingCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    branchSales.forEach((sale) => {
      sale.items.forEach((item) => {
        counts[item.name] = (counts[item.name] || 0) + item.quantity;
      });
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'No data';
  }, [branchSales]);
  const recommendations = useMemo(() => {
    const sold: Record<string, number> = {};
    branchSales.forEach((sale) => sale.items.forEach((item) => { sold[item.productId] = (sold[item.productId] || 0) + item.quantity; }));
    return products
      .filter((product) => product.active && (scope === 'all' || product.branchId === scope))
      .map((product) => ({ product, sold: sold[product.id] || 0, stock: product.stock?.[product.branchId] || 0 }))
      .sort((a, b) => (b.sold - a.sold) || (a.stock - b.stock))
      .slice(0, 5);
  }, [products, branchSales, scope]);
  const trend = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const daySales = branchSales.filter((sale) => getSaleTimestamp(sale) >= day.getTime() && getSaleTimestamp(sale) < next.getTime());
    return { label: day.toLocaleDateString(undefined, { weekday: 'short' }), revenue: daySales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0), count: daySales.length };
  }), [branchSales]);
  const maxRevenue = Math.max(...trend.map((day) => day.revenue), 1);
  const chartPoints = trend.map((day, index) => `${(index / 6) * 100},${100 - (day.revenue / maxRevenue) * 82}`).join(' ');

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>Analytics</h1>
            <p className="section-description">Track key business metrics and performance trends.</p>
          </div>
        </div>

        <motion.div className="analytics-kpis field-grid mt-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
          <motion.div className="panel-card p-4" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Revenue</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Le {totalRevenue.toFixed(2)}</div>
          </motion.div>
          <motion.div className="panel-card p-4" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Gross Profit</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Le {totalProfit.toFixed(2)}</div>
          </motion.div>
          <motion.div className="panel-card p-4" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Expenses</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Le {totalExpenses.toFixed(2)}</div>
          </motion.div>
          <motion.div className="panel-card p-4" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Customers</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{totalCustomers}</div>
          </motion.div>
        </motion.div>

        <div className="analytics-chart panel-card p-4 mt-6">
          <div className="analytics-chart-heading"><div><span className="eyebrow">Live pulse</span><h2>Revenue rhythm</h2></div><strong>7 day view</strong></div>
          <div className="analytics-chart-visual">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Seven day revenue trend">
              <defs><linearGradient id="analytics-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f97316" stopOpacity=".34" /><stop offset="1" stopColor="#f97316" stopOpacity="0" /></linearGradient></defs>
              <polyline className="analytics-grid-line" points="0,18 100,18" /><polyline className="analytics-grid-line" points="0,50 100,50" /><polyline className="analytics-grid-line" points="0,82 100,82" />
              <motion.polygon points={`0,100 ${chartPoints} 100,100`} fill="url(#analytics-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .8 }} />
              <motion.polyline className="analytics-line" points={chartPoints} fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
            </svg>
            <div className="analytics-chart-labels">{trend.map((day) => <span key={day.label}>{day.label}<strong>Le {day.revenue.toFixed(0)}</strong></span>)}</div>
          </div>
        </div>

        <div className="panel-card p-4 mt-6">
          <h2 style={{ marginTop: 0 }}>Inventory recommendations</h2>
          <p style={{ color: '#64748b' }}>Products ranked by sales activity for {scope === 'all' ? 'all branches' : 'your selected branch'}.</p>
          {recommendations.length === 0 ? <p>No product activity is available yet.</p> : recommendations.map(({ product, sold, stock }) => <div className="list-item-card" key={product.id}><strong>{product.name}</strong><span>{sold} sold • {stock} in stock • {sold > stock ? 'Consider reordering' : 'Stock level looks healthy'}</span></div>)}
        </div>

        <div className="field-grid mt-6">
          <div className="panel-card p-4">
            <h2 style={{ marginTop: 0 }}>Growth summary</h2>
            <p style={{ margin: 0, color: '#4b5563' }}>
              Total sales transactions: <strong>{branchSales.length}</strong>. Top item by quantity sold: <strong>{bestSellingCategory}</strong>.
            </p>
          </div>
          <div className="panel-card p-4">
            <h2 style={{ marginTop: 0 }}>Inventory snapshot</h2>
            <p style={{ margin: 0, color: '#4b5563' }}>
              You currently have <strong>{products.length}</strong> product records in inventory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
