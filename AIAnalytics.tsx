import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { getSaleRevenue } from '../utils/salesMetrics';

export default function AIAnalytics() {
  const sales = useStore((state) => state.sales);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const currentUser = useStore((state) => state.currentUser);
  const products = useStore((state) => state.products);
  const users = useStore((state) => state.users);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scope = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId;
  const branchSales = useMemo(() => sales.filter((sale) => scope === 'all' || sale.branchId === scope), [sales, scope]);

  const totalSales = useMemo(() => branchSales.length, [branchSales]);
  const totalRevenue = useMemo(() => branchSales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0), [branchSales]);
  const topCategory = useMemo(() => {
    const counts = branchSales.flatMap((sale) => sale.items.map((item) => item.name)).reduce<Record<string, number>>((agg, name) => {
      agg[name] = (agg[name] || 0) + 1;
      return agg;
    }, {});
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'No data';
  }, [branchSales]);
  const topSeller = useMemo(() => {
    const counts = branchSales.reduce<Record<string, number>>((agg, sale) => {
      agg[sale.sellerName] = (agg[sale.sellerName] || 0) + sale.total;
      return agg;
    }, {});
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'No data';
  }, [branchSales]);
  const reorderRecommendations = useMemo(() => {
    const sold: Record<string, number> = {};
    branchSales.forEach((sale) => sale.items.forEach((item) => { sold[item.productId] = (sold[item.productId] || 0) + item.quantity; }));
    return products.filter((product) => product.active && (scope === 'all' || product.branchId === scope)).map((product) => ({ product, sold: sold[product.id] || 0, stock: product.stock?.[product.branchId] || 0 })).sort((a, b) => (b.sold - a.sold) || (a.stock - b.stock)).slice(0, 5);
  }, [products, branchSales, scope]);

  const alerts = useMemo(() => {
    const items = [] as string[];
    if (totalSales === 0) items.push('No sales recorded yet. Encourage staff to log daily transactions.');
    if (totalRevenue > 10000) items.push('Sales are strong — consider increasing stock for top categories.');
    if (users.length > 0 && branchSales.some((sale) => sale.total < 20)) items.push('Low-value sales detected. Review pricing or promotions.');
    if (reorderRecommendations.some((item) => item.sold > item.stock)) items.push('Fast-moving products are selling faster than current stock. Reorder the highlighted items.');
    return items;
  }, [branchSales, totalRevenue, users.length, reorderRecommendations]);
  const voiceSummary = `There are ${totalSales} sales and ${reorderRecommendations.length} product recommendations. Top item is ${topCategory}.`;
  const speakInsights = () => {
    const Speech = (window as any).SpeechSynthesisUtterance;
    if (!Speech || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) { setIsSpeaking(false); return; }
    const utterance = new Speech(voiceSummary);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h1>AI Insights</h1>
            <p className="section-description">Automated recommendations based on your current sales activity.</p>
          </div>
          <button className="btn secondary" type="button" onClick={speakInsights}>{isSpeaking ? 'Stop voice' : 'Read insights aloud'}</button>
        </div>

        <div className="field-grid mt-6">
          <div className="panel-card p-4">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Total sales</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{totalSales}</div>
          </div>

          <div className="panel-card p-4">
            <h2 style={{ margin: '0 0 12px 0' }}>What to buy more of</h2>
            {reorderRecommendations.length === 0 ? <p>No reorder recommendation yet.</p> : reorderRecommendations.map(({ product, sold, stock }) => <div className="list-item-card" key={product.id}><strong>{product.name}</strong><span>{sold} sold • {stock} stock • {sold > stock ? 'Reorder now' : 'Monitor demand'}</span></div>)}
          </div>
          <div className="panel-card p-4">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Total revenue</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Le {totalRevenue.toFixed(2)}</div>
          </div>
          <div className="panel-card p-4">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Top sold item</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{topCategory}</div>
          </div>
          <div className="panel-card p-4">
            <div style={{ color: '#6b7280', fontSize: 12 }}>Top seller</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{topSeller}</div>
          </div>
        </div>

        <div className="field-grid mt-6">
          <div className="panel-card p-4">
            <h2 style={{ margin: '0 0 12px 0' }}>Actionable insights</h2>
            <ul style={{ margin: 0, paddingLeft: 16, color: '#4b5563' }}>
              {alerts.length > 0 ? alerts.map((item) => <li key={item}>{item}</li>) : <li>No insights available right now.</li>}
            </ul>
          </div>

          <div className="panel-card p-4">
            <h2 style={{ margin: '0 0 12px 0' }}>What the system sees</h2>
            <p style={{ margin: 0, color: '#4b5563' }}>
              This page uses your active sales data to spot trends, highlight top sellers, and suggest areas where operations can be tightened.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
