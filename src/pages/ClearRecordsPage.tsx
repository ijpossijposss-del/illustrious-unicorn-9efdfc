import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { getSaleTimestamp } from '../utils/salesMetrics';

export default function ClearRecordsPage() {
  const branches = useStore((state) => state.branches);
  const products = useStore((state) => state.products);
  const sales = useStore((state) => state.sales);
  const customers = useStore((state) => state.customers);
  const users = useStore((state) => state.users);
  const categories = useStore((state) => state.categories);
  const expenses = useStore((state) => state.expenses);
  const notifications = useStore((state) => state.notifications);
  const assetCheckouts = useStore((state) => state.assetCheckouts);
  const refundRequests = useStore((state) => state.refundRequests);
  const returnRequests = useStore((state) => state.returnRequests);
  const stockTransfers = useStore((state) => state.stockTransfers);
  const cashDrawerSessions = useStore((state) => state.cashDrawerSessions);
  const mobileOrders = useStore((state) => state.mobileOrders);

  const clearRecords = useStore((state) => state.clearRecords);

  const [mode, setMode] = useState<'sales' | 'branch' | 'reset'>('sales');
  const [branchId, setBranchId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const branchOptions = useMemo(
    () => [{ id: 'all', name: 'All Branches' }, ...branches.map((branch) => ({ id: branch.id, name: branch.name }))],
    [branches],
  );

  const selectedBranchName = useMemo(
    () => branchOptions.find((option) => option.id === branchId)?.name || 'All Branches',
    [branchOptions, branchId],
  );

  const matchesBranch = (saleBranchId: string) => branchId === 'all' || saleBranchId === branchId;

  const matchesDate = (timestamp: number) => {
    if (!startDate && !endDate) return true;
    if (!timestamp) return false;
    const saleDate = new Date(timestamp);
    if (startDate && saleDate < new Date(`${startDate}T00:00:00`)) return false;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (saleDate > end) return false;
    }
    return true;
  };

  const salesToDelete = useMemo(
    () => sales.filter((sale) => matchesBranch(sale.branchId) && matchesDate(getSaleTimestamp(sale))),
    [sales, branchId, startDate, endDate],
  );

  const deleteCount = useMemo(() => {
    if (mode === 'sales') {
      const saleIds = new Set(salesToDelete.map((sale) => sale.id));
      return salesToDelete.length
        + refundRequests.filter((request) => saleIds.has(request.saleId)).length
        + returnRequests.filter((request) => saleIds.has(request.saleId)).length;
    }

    const allBranches = mode === 'reset' || branchId === 'all';
    const isInBranch = (value?: string) => allBranches || value === branchId;
    const dataCount = mode === 'reset' || allBranches
      ? sales.length + customers.length + products.length + expenses.length + notifications.length + assetCheckouts.length + refundRequests.length + returnRequests.length + stockTransfers.length + cashDrawerSessions.length + mobileOrders.length + Math.max(0, categories.length - 1)
      : sales.filter((sale) => isInBranch(sale.branchId)).length
        + products.filter((product) => product.branchId === branchId || branchId in product.stock).length
        + expenses.filter((expense) => isInBranch(expense.branchId)).length
        + assetCheckouts.filter((item) => isInBranch(item.branchId)).length
        + refundRequests.filter((request) => sales.some((sale) => sale.id === request.saleId && isInBranch(sale.branchId))).length
        + returnRequests.filter((request) => sales.some((sale) => sale.id === request.saleId && isInBranch(sale.branchId))).length
        + cashDrawerSessions.filter((session) => isInBranch(session.branchId)).length
        + mobileOrders.filter((order) => isInBranch(order.branchId)).length;
    const removedBranches = mode === 'reset' || allBranches ? Math.max(0, branches.length - 1) : branches.some((branch) => branch.id === branchId) ? 1 : 0;
    const removedStaff = mode === 'reset' || allBranches
      ? users.filter((user) => user.role !== 'admin').length
      : users.filter((user) => user.role !== 'admin' && user.branchId === branchId).length;
    const removedTransfers = mode === 'reset' || allBranches
      ? 0
      : stockTransfers.filter((transfer) => transfer.fromBranchId === branchId || transfer.toBranchId === branchId).length;
    return dataCount + removedBranches + removedStaff + removedTransfers;
  }, [mode, branchId, salesToDelete, sales, customers, products, expenses, notifications, assetCheckouts, refundRequests, returnRequests, cashDrawerSessions, mobileOrders, categories, users, branches, stockTransfers]);

  const actionCountLabel = useMemo(() => {
    if (mode === 'sales') return `${salesToDelete.length} sale(s) and ${deleteCount - salesToDelete.length} related request(s)`;
    if (mode === 'branch') return branchId === 'all' ? `${deleteCount} data record(s) across all branches` : `${deleteCount} data record(s) for ${selectedBranchName}`;
    return `${deleteCount} data record(s)`;
  }, [mode, salesToDelete.length, deleteCount, branchId, selectedBranchName]);

  const warningText = useMemo(() => {
    if (mode === 'sales') {
      return `This will permanently remove matching sales and their related refund/return requests for ${selectedBranchName}. This affects reports and analytics.`;
    }
    if (mode === 'branch') {
      return `This removes the selected branch's staff, inventory, sales, expenses, requests, transfers, cash sessions and customer orders.`;
    }
    return 'This removes business records and staff profiles. Your admin account and one default branch are retained so you can sign in and continue using the app.';
  }, [mode, selectedBranchName]);

  const handleDelete = async () => {
    setIsClearing(true);
    try {
      await clearRecords(mode, branchId, startDate, endDate);
      toast.success(mode === 'sales' ? 'Sales records deleted and synced' : mode === 'branch' ? 'Branch data removed and synced' : 'System reset and synced');
    } catch (error) {
      console.error('Unable to clear and sync records.', error);
      toast.error(error instanceof Error ? error.message : 'Unable to confirm that the records were deleted from Firebase.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="container">
      <div className="card p-6" >
        <h1>What do you want to clear?</h1>
        <div className="clear-records-options" style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            <button
            className={`btn secondary${mode === 'sales' ? ' selected' : ''}`}
            style={{ padding: 22, textAlign: 'left', borderRadius: 18, border: mode === 'sales' ? '2px solid #1d4ed8' : '1px solid #e5e7eb' }}
            onClick={() => setMode('sales')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Clear Sales Records Only</div>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>Delete sales by branch and date range</p>
              </div>
              {mode === 'sales' && <span style={{ fontSize: 24, color: '#1d4ed8' }}>✔️</span>}
            </div>
          </button>

          <button
            className={`btn secondary${mode === 'branch' ? ' selected' : ''}`}
            style={{ padding: 22, textAlign: 'left', borderRadius: 18, border: mode === 'branch' ? '2px solid #1d4ed8' : '1px solid #e5e7eb' }}
            onClick={() => setMode('branch')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Clear Branch Data</div>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>Remove branch, its staff, products and sales</p>
              </div>
              {mode === 'branch' && <span style={{ fontSize: 24, color: '#1d4ed8' }}>✔️</span>}
            </div>
          </button>

          <button
            className={`btn secondary${mode === 'reset' ? ' selected' : ''}`}
            style={{ padding: 22, textAlign: 'left', borderRadius: 18, border: mode === 'reset' ? '2px solid #1d4ed8' : '1px solid #e5e7eb' }}
            onClick={() => setMode('reset')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Reset Entire System</div>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>Delete ALL data and start fresh</p>
              </div>
              {mode === 'reset' && <span style={{ fontSize: 24, color: '#1d4ed8' }}>✔️</span>}
            </div>
          </button>
        </div>

        <div style={{ marginTop: 32, display: 'grid', gap: 18 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Select Branch</div>
            <select
              className="input"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              style={{ width: '100%', maxWidth: 420 }}
            >
              {branchOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Date Range (Optional)</div>
            <div className="clear-records-date-range" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: '#4b5563', fontSize: 14 }}>
            <span>{startDate || endDate ? 'Date filter active' : 'All dates'}</span>
            <span>•</span>
            <span>{selectedBranchName}</span>
            <span>•</span>
            <span>{actionCountLabel}</span>
          </div>

          <div style={{ padding: 20, borderRadius: 18, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Warning: {deleteCount} record(s) will be deleted</div>
            <div>{warningText}</div>
          </div>

          <button
            className="btn"
            style={{ width: '100%', maxWidth: 320, background: 'linear-gradient(135deg,#dc2626,#f43f5e)', color: '#fff' }}
            onClick={() => setShowConfirm(true)}
            disabled={deleteCount === 0 || isClearing}
          >
            Delete Records
          </button>
        </div>
      </div>

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 1100, display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24 }}>Confirm Delete</h2>
                <p style={{ margin: '10px 0 0', color: '#6b7280' }}>This action cannot be undone.</p>
              </div>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ marginTop: 20, color: '#374151' }}>
              <p style={{ margin: '0 0 12px' }}><strong>Mode:</strong> {mode === 'sales' ? 'Clear Sales Records Only' : mode === 'branch' ? 'Clear Branch Data' : 'Reset Entire System'}</p>
              <p style={{ margin: '0 0 12px' }}><strong>Branch:</strong> {selectedBranchName}</p>
              <p style={{ margin: '0 0 12px' }}><strong>Records affected:</strong> {actionCountLabel}</p>
              {mode !== 'reset' && startDate && endDate && (
                <p style={{ margin: 0 }}><strong>Date range:</strong> {startDate} to {endDate}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
              <button
                className="btn"
                style={{ background: 'linear-gradient(135deg,#dc2626,#f43f5e)', color: '#fff' }}
                onClick={() => {
                  setShowConfirm(false);
                  void handleDelete();
                }}
              >
                {isClearing ? 'Deleting and syncing…' : 'Confirm Delete'}
              </button>
              <button className="btn secondary" onClick={() => setShowConfirm(false)} style={{ color: '#374151' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
