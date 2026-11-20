import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { getLocalDateKey, getSaleDateKey, getSaleProfit, getSaleRevenue, getSaleTimestamp } from '../utils/salesMetrics';

export default function Dashboard() {
  const sales = useStore((state) => state.sales);
  const mobileOrders = useStore((state) => state.mobileOrders);
  const currentUser = useStore((s) => s.currentUser);
  const selectedBranch = useStore((s) => s.selectedBranch);
  const canViewProfit = useStore((s) => s.canViewProfit);
  const products = useStore((s) => s.products);
  const branches = useStore((s) => s.branches);
  const scopedBranchId = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId || selectedBranch;
  const scopedSales = useMemo(
    () => scopedBranchId === 'all' ? sales : sales.filter((sale) => sale.branchId === scopedBranchId),
    [sales, scopedBranchId],
  );
  const scopedOrders = useMemo(
    () => scopedBranchId === 'all' ? mobileOrders : mobileOrders.filter((order) => order.branchId === scopedBranchId),
    [mobileOrders, scopedBranchId],
  );
  const scopedProducts = useMemo(
    () => scopedBranchId === 'all' ? products.filter((product) => product.active) : products.filter((product) => product.active && product.branchId === scopedBranchId),
    [products, scopedBranchId],
  );

  const todayKey = getLocalDateKey(new Date());
  const todaySales = scopedSales.filter((sale) => getSaleDateKey(sale) === todayKey);
  const totalRevenue = scopedSales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0);
  const todayProfit = todaySales.reduce((sum, sale) => sum + getSaleProfit(sale), 0);
  const totalProfit = scopedSales.reduce((sum, sale) => sum + getSaleProfit(sale), 0);
  const branchProductCount = scopedProducts.length;

  const revenueTrend = useMemo(() => {
    const trend = Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - index));
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const value = scopedSales
        .filter((sale) => getSaleTimestamp(sale) >= start.getTime() && getSaleTimestamp(sale) < end.getTime())
        .reduce((sum, sale) => sum + getSaleRevenue(sale), 0);
      return { label, value };
    });
    return trend;
  }, [scopedSales]);

  const totalOrders = scopedOrders.length;

  const topProducts = useMemo(() => {
    const revenueMap = scopedSales.reduce<Record<string, number>>((agg, sale) => {
      const itemSubtotal = sale.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      sale.items.forEach((item) => {
        const allocation = itemSubtotal > 0 ? getSaleRevenue(sale) * (item.price * item.quantity / itemSubtotal) : 0;
        agg[item.name] = (agg[item.name] || 0) + allocation;
      });
      return agg;
    }, {});

    return Object.entries(revenueMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, revenue]) => ({ name, revenue }));
  }, [scopedSales]);

  const paymentMethods = useMemo(() => {
    const colors = ['#fb923c', '#fcd34d', '#818cf8', '#34d399', '#f472b6', '#38bdf8'];
    const labels = new Map<string, string>([
      ['cash', 'Cash'],
      ['mobile money', 'Mobile Money'],
      ['mobile-money', 'Mobile Money'],
      ['mobile_money', 'Mobile Money'],
      ['card', 'Card'],
    ]);
    const amounts = new Map<string, number>();
    scopedSales.forEach((sale) => {
      const rawMethod = sale.paymentMethod?.trim();
      const key = rawMethod?.toLowerCase() || 'unknown';
      const label = labels.get(key) || (rawMethod || 'Unknown');
      amounts.set(label, (amounts.get(label) || 0) + getSaleRevenue(sale));
    });
    const total = Array.from(amounts.values()).reduce((sum, amount) => sum + amount, 0);
    return Array.from(amounts.entries()).map(([label, amount], index) => ({
      label,
      amount,
      percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: colors[index % colors.length],
    }));
  }, [scopedSales]);
  const paymentTotal = paymentMethods.reduce((sum, method) => sum + method.amount, 0);
  const paymentGradient = paymentTotal > 0
    ? (() => {
      let start = 0;
      return paymentMethods.map((method) => {
        const end = start + (method.amount / paymentTotal) * 100;
        const segment = `${method.color} ${start}% ${end}%`;
        start = end;
        return segment;
      }).join(', ');
    })()
    : '#e5e7eb 0% 100%';

  const StatCard = ({ title, value, icon, label, color, currency, locked }: { title: string; value: number; icon: AppIconName; label: string; color: string; currency?: boolean; locked?: boolean }) => (
    <div className="card stat-card" style={locked ? { opacity: 0.58, position: 'relative' } : undefined}>
      <div className="stat-header">
        <div>
          <div className="stat-title">{title}</div>
          <div className="stat-value">{locked ? 'Hidden' : currency ? `Le ${value.toLocaleString()}` : value}</div>
        </div>
        <div className="stat-icon" style={{ background: color }}>
          <AppIcon name={icon} size={20} />
        </div>
      </div>
      {label && <span className="stat-label">{locked ? 'Admin approval required' : label}</span>}
    </div>
  );

  return (
    <div className="container">
      <div className="dashboard-grid stats-grid">
        {currentUser?.role === 'admin' ? (
          <>
            <StatCard title="Total Branches" value={branches.filter((branch) => branch.active).length} icon="branch" label="Active locations" color="#2563eb" />
            <StatCard title="Total Revenue" value={totalRevenue} icon="cash" label={selectedBranch === 'all' ? 'All branches revenue' : 'Selected branch revenue'} color="#22c55e" currency />
            <StatCard title="Gross Profit" value={totalProfit} icon="coins" label="Sales less item costs; expenses separate" color="#8b5cf6" currency />
            <StatCard title="Today&apos;s Revenue" value={todayRevenue} icon="cash" label={selectedBranch === 'all' ? 'All branches today' : 'Selected branch today'} color="#14b8a6" currency />
            <StatCard title="Today&apos;s Gross Profit" value={todayProfit} icon="coins" label="Revenue less item costs" color="#6366f1" currency />
            <StatCard title="Total Sales" value={scopedSales.length} icon="shopping-cart" label={selectedBranch === 'all' ? 'All branches transactions' : 'Selected branch transactions'} color="#fb923c" />
            <StatCard title="Total Orders" value={totalOrders} icon="box" label={selectedBranch === 'all' ? 'All branches orders' : 'Selected branch orders'} color="#2563eb" />
            <StatCard title="Products" value={branchProductCount} icon="box" label={selectedBranch === 'all' ? 'All branch catalogs' : 'Selected branch catalog'} color="#f59e0b" />
          </>
        ) : (
          <>
            <StatCard title="Today&apos;s Revenue" value={todayRevenue} icon="cash" label="Your branch today" color="#22c55e" currency />
            <StatCard title="Products" value={branchProductCount} icon="box" label="Your branch catalog" color="#f59e0b" />
            <StatCard title="Total Revenue" value={totalRevenue} icon="shopping-cart" label="Your branch all time" color="#fb923c" currency />
            <StatCard title="Today&apos;s Gross Profit" value={todayProfit} icon="coins" label="Revenue less item costs" color="#8b5cf6" currency locked={!canViewProfit()} />
            <StatCard title="Total Sales" value={scopedSales.length} icon="shopping-cart" label="Your branch transactions" color="#14b8a6" />
            <StatCard title="Total Orders" value={totalOrders} icon="box" label="Your branch orders" color="#2563eb" />
          </>
        )}
      </div>

      <div className="dashboard-panel-grid">
        <div className="card panel-card">
          <div className="panel-card-header">
            <div>
              <div className="panel-card-subtitle">Revenue Trend</div>
              <h3 className="panel-card-title">Last 14 days</h3>
            </div>
            <button className="btn secondary" style={{ padding: '10px 14px', borderRadius: 999, fontSize: 13 }}>Last 14 days</button>
          </div>
          <div className="soft-surface chart-surface">
            <div className="chart-wrapper">
              <svg viewBox="0 0 280 190" preserveAspectRatio="none" className="trend-chart">
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon
                  points={revenueTrend.map((point, index) => {
                    const x = (index / (revenueTrend.length - 1)) * 280;
                    const maxValue = Math.max(...revenueTrend.map((item) => item.value), 1);
                    const y = 170 - (point.value / maxValue) * 160;
                    return `${x},${y}`;
                  }).join(' ') + ' 280,170 0,170'}
                  fill="url(#trendGradient)"
                  stroke="none"
                />
                <polyline
                  points={revenueTrend.map((point, index) => {
                    const x = (index / (revenueTrend.length - 1)) * 280;
                    const maxValue = Math.max(...revenueTrend.map((item) => item.value), 1);
                    const y = 170 - (point.value / maxValue) * 160;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#fb923c"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {revenueTrend.map((point, index) => {
                  const x = (index / (revenueTrend.length - 1)) * 280;
                  const maxValue = Math.max(...revenueTrend.map((item) => item.value), 1);
                  const y = 170 - (point.value / maxValue) * 160;
                  return (
                    <circle key={point.label} cx={x} cy={y} r={4} fill="#fb923c" />
                  );
                })}
              </svg>
            </div>
            <div className="chart-caption">
              <span>Revenue trend over the last 14 days</span>
              <span className="chart-total">Le {totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card panel-card">
          <div className="panel-card-header">
            <div>
              <div className="panel-card-subtitle">Payment Methods</div>
              <h3 className="panel-card-title">Checkout split</h3>
            </div>
          </div>
          <div className="soft-surface payment-surface">
            <div className="donut-chart" style={{ background: `conic-gradient(${paymentGradient})` }}>
              <div className="donut-hole" />
              <div className="donut-overlay">{paymentTotal > 0 ? '100%' : '0%'}</div>
            </div>
          </div>
          <div className="payment-legend">
            {paymentMethods.map((method) => (
              <div key={method.label} className="payment-row">
                <div className="payment-label">
                  <span className="payment-swatch" style={{ background: method.color }} />
                  <span>{method.label}</span>
                </div>
                <span className="payment-value">{method.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card panel-card">
        <div className="panel-card-header">
          <div>
            <div className="panel-card-subtitle">Top Products</div>
            <h3 className="panel-card-title">Top products by revenue</h3>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>Latest performance snapshot</span>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          {topProducts.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No product revenue found yet.</div>
          ) : (
            topProducts.map((product, index) => {
              const maxRevenue = topProducts[0]?.revenue || 1;
              const width = Math.max(10, (product.revenue / maxRevenue) * 100);
              const colors = ['#22c55e', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899'];
              return (
                <div key={product.name} style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#111827', fontWeight: 600 }}>
                    <span>{product.name}</span>
                    <span>Le {product.revenue.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 14, width: '100%', borderRadius: 999, background: '#e5e7eb' }}>
                    <div style={{ width: `${width}%`, height: '100%', borderRadius: 999, background: colors[index % colors.length] }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
