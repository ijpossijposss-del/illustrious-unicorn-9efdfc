import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getSaleProfit, getSaleRevenue } from '../utils/salesMetrics';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDate(value: string | number | Date) {
  if (typeof value === 'number') return new Date(value);
  if (value instanceof Date) return value;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  return new Date(value.replace(/\//g, '-'));
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(start: Date) {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function formatDayLabel(date: Date) {
  return dayNames[date.getDay()];
}

function formatDayDate(date: Date) {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function saleDate(sale: any) {
  return sale.timestamp ? new Date(sale.timestamp) : toDate(sale.date);
}

export default function EndOfDayReconciliation() {
  const sales = useStore((state) => state.sales);
  const branches = useStore((state) => state.branches);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const currentUser = useStore((state) => state.currentUser);
  const canViewProfit = useStore((state) => state.canViewProfit);

  const today = useMemo(() => new Date(), []);
  const initialWeekStart = useMemo(() => getMonday(today), [today]);

  const [weekStart, setWeekStart] = useState<Date>(initialWeekStart);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDayReceipts, setShowDayReceipts] = useState(false);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + index);
      return d;
    });
  }, [weekStart]);

  const salesInWeek = useMemo(() => {
    return sales.filter((sale) => {
      const date = saleDate(sale);
      return (selectedBranch === 'all' || sale.branchId === selectedBranch) && date >= weekStart && date < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    });
  }, [sales, selectedBranch, weekStart]);

  const salesByDay = useMemo(() => {
    return weekDates.reduce((acc, date) => {
      const key = date.toDateString();
      acc[key] = salesInWeek.filter((sale) => saleDate(sale).toDateString() === key);
      return acc;
    }, {} as Record<string, any[]>);
  }, [weekDates, salesInWeek]);

  const selectedSales = useMemo(() => {
    const key = selectedDay.toDateString();
    return salesByDay[key] || [];
  }, [salesByDay, selectedDay]);

  const filteredSales = useMemo(() => {
    return selectedSales.filter((sale) => {
      if (paymentFilter !== 'all' && sale.paymentMethod !== paymentFilter) return false;
      if (sellerFilter !== 'all' && sale.sellerName !== sellerFilter) return false;
      if (branchFilter !== 'all' && sale.branchId !== branchFilter) return false;
      return true;
    });
  }, [selectedSales, paymentFilter, sellerFilter, branchFilter]);

  const weekRevenue = useMemo(() => salesInWeek.reduce((sum, sale) => sum + getSaleRevenue(sale), 0), [salesInWeek]);
  const weekProfit = useMemo(() => salesInWeek.reduce((sum, sale) => sum + getSaleProfit(sale), 0), [salesInWeek]);
  const weekTransactions = useMemo(() => salesInWeek.length, [salesInWeek]);
  const showProfit = currentUser?.role === 'admin' || canViewProfit();

  const branchName = selectedBranch === 'all' ? 'All Branches' : branches.find((b) => b.id === selectedBranch)?.name || 'All Branches';

  const weekLabel = formatWeekRange(weekStart);
  const selectedDayLabel = `${selectedDay.toLocaleDateString('en-US', { weekday: 'long' })}, ${selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const allPaymentMethods = useMemo(() => Array.from(new Set(sales.map((sale) => sale.paymentMethod || 'Unknown'))), [sales]);
  const allSellers = useMemo(() => Array.from(new Set(sales.map((sale) => sale.sellerName || 'Unknown'))), [sales]);
  const allBranches = useMemo(() => Array.from(new Set(sales.map((sale) => sale.branchId || 'Unknown'))), [sales]);

  const goPreviousWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() - 7);
    setWeekStart(next);
    setSelectedDay(next);
  };
  const goNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
    setSelectedDay(next);
  };

  const selectDay = (date: Date) => {
    setSelectedDay(date);
  };

  const exportCSV = () => {
    const rows = filteredSales.map((sale) => ({
      receiptNo: sale.receiptNo,
      date: saleDate(sale).toISOString().split('T')[0],
      time: sale.time,
      sellerName: sale.sellerName,
      branchId: sale.branchId,
      paymentMethod: sale.paymentMethod,
      itemsCount: sale.items?.length || 0,
      total: sale.total,
    }));
    if (!rows.length) return;
    const header = Object.keys(rows[0]);
    const csv = [header.join(','), ...rows.map((row) => header.map((key) => `"${String((row as any)[key]).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-${selectedDay.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <div className="card p-6 eod-header-card" style={{ marginBottom: 24 }}>
        <div className="eod-header-layout" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div className="eod-header-main">
            <div className="eod-title-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#2B3A8C', display: 'grid', placeItems: 'center', color: '#fff' }}>📅</div>
              <div className="eod-title-copy">
                <h1 style={{ margin: 0 }}>End of Day Reconciliation</h1>
                <div style={{ color: '#AEB6F5', marginTop: 6 }}>Weekly overview for {branchName}</div>
              </div>
            </div>
            <div className="eod-week-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn secondary" onClick={goPreviousWeek}>◀</button>
              <div className="eod-week-label" style={{ minWidth: 180, padding: '10px 16px', borderRadius: 999, background: '#253068', color: '#fff' }}>{weekLabel}</div>
              <button className="btn secondary" onClick={goNextWeek}>▶</button>
            </div>
          </div>
          <div className="eod-today-info" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ color: '#FF7A45', fontWeight: 700 }}>Today: {selectedDayLabel}</div>
            <div style={{ color: '#AEB6F5' }}>Sierra Leone Time (GMT+0)</div>
          </div>
        </div>
      </div>

      <div className="eod-summary-grid">
        <div className="card eod-summary-card eod-revenue-card">
          <div style={{ color: '#E96F49', fontSize: 12 }}>Week Revenue</div>
          <div className="eod-summary-value">Le {weekRevenue.toLocaleString()}</div>
        </div>
        <div className="card eod-summary-card">
          <div style={{ color: '#2B3A8C', fontSize: 12 }}>Week Gross Profit</div>
          <div className={`eod-summary-value${showProfit ? '' : ' eod-profit-locked'}`}>{showProfit ? `Le ${weekProfit.toLocaleString()}` : 'Hidden'}</div>
          {!showProfit && <div className="stat-label">Admin approval required</div>}
        </div>
        <div className="card eod-summary-card eod-transactions-card">
          <div style={{ color: '#2B3A8C', fontSize: 12 }}>Week Transactions</div>
          <div className="eod-summary-value">{weekTransactions}</div>
        </div>
      </div>

      <div className="eod-day-scroll">
        <div className="eod-day-grid">
        {weekDates.map((day) => {
          const key = day.toDateString();
          const daySales = salesByDay[key] || [];
          const revenue = daySales.reduce((sum, sale) => sum + getSaleRevenue(sale), 0);
          const profit = daySales.reduce((sum, sale) => sum + getSaleProfit(sale), 0);
          const items = daySales.reduce((sum, sale) => sum + (sale.items?.reduce((count: number, item: any) => count + item.quantity, 0) || 0), 0);
          const isSelected = day.toDateString() === selectedDay.toDateString();
          return (
            <button
              key={key}
              onClick={() => selectDay(day)}
              className={`card eod-day-card ${isSelected ? 'eod-day-selected' : ''}`}
            >
              <div className="eod-day-name">{formatDayLabel(day)}</div>
              <div className="eod-day-date">{formatDayDate(day)}</div>
              <div className="eod-day-sales">{daySales.length} sales</div>
              <div className="eod-day-revenue">Le {revenue.toLocaleString()}</div>
              <div className={`eod-day-profit${showProfit ? '' : ' eod-profit-locked'}`}>
                {showProfit ? `Gross Profit: Le ${profit.toLocaleString()}` : 'Gross Profit: Hidden'}
              </div>
              <div className="eod-day-items">
                <span>{items} items</span>
              </div>
            </button>
          );
        })}
        </div>
      </div>

      <div className="card p-6 eod-details-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0' }}>{selectedDay.toLocaleDateString('en-US', { weekday: 'long' })} details</h2>
            <div style={{ color: '#6B7280' }}>{selectedSales.length} transaction(s) for {formatDayDate(selectedDay)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={() => setShowDayReceipts(true)} disabled={filteredSales.length === 0}>View receipts</button>
            <button className="btn" onClick={exportCSV}>Export CSV</button>
            <button className="btn secondary" onClick={() => { setPaymentFilter('all'); setSellerFilter('all'); setBranchFilter('all'); }}>Clear filters</button>
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div style={{ padding: 16, borderRadius: 18, background: '#F8F9FF' }}>
            <div style={{ color: '#6B7280', fontSize: 12 }}>Payment method</div>
            <select className="input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="all">All</option>
              {allPaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#F8F9FF' }}>
            <div style={{ color: '#6B7280', fontSize: 12 }}>Seller</div>
            <select className="input" value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
              <option value="all">All</option>
              {allSellers.map((seller) => <option key={seller} value={seller}>{seller}</option>)}
            </select>
          </div>
          <div style={{ padding: 16, borderRadius: 18, background: '#F8F9FF' }}>
            <div style={{ color: '#6B7280', fontSize: 12 }}>Branch</div>
            <select className="input" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="all">All</option>
              {allBranches.map((branch) => <option key={branch} value={branch}>{branches.find((b) => b.id === branch)?.name || branch}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 24, color: '#6B7280' }}>
          {filteredSales.length === 0 ? 'No receipts match the selected filters.' : 'Receipts are grouped above. Select View receipts to open the list.'}
        </div>
      </div>

      {showDayReceipts && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, padding: 16 }} onClick={() => setShowDayReceipts(false)}>
          <div className="card p-6" style={{ width: 680, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>Receipts for {formatDayDate(selectedDay)}</h2>
                <div style={{ color: '#6B7280', marginTop: 6 }}>{filteredSales.length} receipt(s)</div>
              </div>
              <button className="btn secondary" type="button" onClick={() => setShowDayReceipts(false)}>Close</button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
              {filteredSales.map((sale) => (
                <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 14, border: '1px solid #E5E7EB', borderRadius: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{sale.receiptNo}</div>
                    <div style={{ color: '#6B7280', fontSize: 13 }}>{sale.time} • {sale.sellerName} • {sale.paymentMethod}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                    <strong>Le {sale.total.toFixed(2)}</strong>
                    <button className="btn secondary" type="button" onClick={() => { setShowDayReceipts(false); setSelectedSale(sale); }}>Open receipt</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }} onClick={() => setSelectedSale(null)}>
          <div className="card p-6" style={{ width: 760, maxWidth: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedSale.receiptNo}</div>
                <div style={{ color: '#6B7280', marginTop: 6 }}>{saleDate(selectedSale).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} • {selectedSale.time}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Le {selectedSale.total.toFixed(2)}</div>
                <div style={{ color: '#6B7280', marginTop: 6 }}>{selectedSale.paymentMethod}</div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div><strong>Seller</strong><div style={{ color: '#6B7280' }}>{selectedSale.sellerName}</div></div>
                <div><strong>Branch</strong><div style={{ color: '#6B7280' }}>{branches.find((b) => b.id === selectedSale.branchId)?.name || selectedSale.branchId}</div></div>
                <div><strong>Items</strong><div style={{ color: '#6B7280' }}>{selectedSale.items?.length || 0}</div></div>
              </div>
            </div>

            <div style={{ marginTop: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F4F6FF', color: '#3241A8' }}>
                    <th style={{ padding: 12, textAlign: 'left' }}>Item</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Price</th>
                    <th style={{ padding: 12, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ padding: 12 }}>{item.name}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>Le {item.price.toFixed(2)}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>Le {(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Link className="btn" to={`/receipt/${selectedSale.receiptNo}`}>View Receipt</Link>
              <button className="btn secondary" onClick={() => setSelectedSale(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
