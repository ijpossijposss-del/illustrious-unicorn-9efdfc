import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { createId } from '../utils/createId';
import { database, publicOrdersPath } from '../sync/firebase';
import { ref, remove, set } from 'firebase/database';

export default function OperationsCenter() {
  const [tab, setTab] = useState<'transfers' | 'returns' | 'drawer' | 'forecast' | 'terminal' | 'orders'>('transfers');
  const products = useStore((state) => state.products);
  const branches = useStore((state) => state.branches);
  const sales = useStore((state) => state.sales);
  const returns = useStore((state) => state.returnRequests);
  const transfers = useStore((state) => state.stockTransfers);
  const drawers = useStore((state) => state.cashDrawerSessions);
  const orders = useStore((state) => state.mobileOrders);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const terminal = useStore((state) => state.paymentTerminal);
  const currentUser = useStore((state) => state.currentUser);
  const addTransfer = useStore((state) => state.addStockTransfer);
  const processTransfer = useStore((state) => state.processStockTransfer);
  const processReturn = useStore((state) => state.processReturnRequest);
  const openDrawer = useStore((state) => state.openCashDrawer);
  const closeDrawer = useStore((state) => state.closeCashDrawer);
  const setTerminal = useStore((state) => state.setPaymentTerminal);
  const updateOrder = useStore((state) => state.updateMobileOrder);
  const deleteOrder = useStore((state) => state.deleteMobileOrder);
  const changeOrderStatus = async (orderId: string, status: typeof orders[number]['status']) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    updateOrder(orderId, status);
    try {
      await set(ref(database, `${publicOrdersPath}/${order.branchId}/${order.id}`), { ...order, status });
    } catch (error) {
      updateOrder(orderId, order.status);
      console.error('Unable to sync customer order status.', error);
      toast.error('Order status could not be saved to Firebase.');
    }
  };
  const removeOrder = async (orderId: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;
    try {
      await remove(ref(database, `${publicOrdersPath}/${order.branchId}/${order.id}`));
      deleteOrder(orderId);
      toast.success('Order deleted');
    } catch (error) {
      console.error('Unable to delete customer order from Firebase.', error);
      toast.error('Order could not be deleted from Firebase.');
    }
  };
  const branchOrders = orders.filter((order) => selectedBranch === 'all' || order.branchId === selectedBranch);
  const selectedBranchRecord = branches.find((branch) => branch.id === selectedBranch);
  const branchOrderTotal = branchOrders.reduce((sum, order) => sum + order.total, 0);
  const newOrderCount = branchOrders.filter((order) => order.status === 'new').length;
  const copyOrderLink = async () => {
    const selectedBranchRecord = branches.find((branch) => branch.id === selectedBranch);
    if (!selectedBranchRecord?.active) {
      toast.error('Select an active branch before copying an order link');
      return;
    }
    const publicOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || window.location.origin;
    const link = `${publicOrigin}/order?branch=${encodeURIComponent(selectedBranchRecord.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Customer order link copied');
    } catch {
      toast.error('Could not copy the order link');
    }
  };
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [fromBranch, setFromBranch] = useState(branches[0]?.id || '');
  const [toBranch, setToBranch] = useState(branches[1]?.id || branches[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [openingAmount, setOpeningAmount] = useState(0);
  const [closingAmount, setClosingAmount] = useState(0);
  const [drawerBranch, setDrawerBranch] = useState(branches[0]?.id || '');
  const [terminalAmount, setTerminalAmount] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<typeof orders[number] | null>(null);

  const selectedProduct = products.find((product) => product.id === productId);
  const forecast = useMemo(() => products.map((product) => {
    const branchSales = sales.filter((sale) => sale.branchId === selectedBranch);
    const sold = branchSales.reduce((total, sale) => total + sale.items.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0), 0);
    const averageDaily = sold / Math.max(1, new Set(branchSales.map((sale) => sale.date)).size || 1);
    const stock = Object.values(product.stock).reduce((sum, value) => sum + value, 0);
    return { product, stock, averageDaily, days: averageDaily ? Math.round(stock / averageDaily) : null };
  }), [products, sales, selectedBranch]);

  const createTransfer = () => {
    if (!selectedProduct || fromBranch === toBranch || quantity <= 0) return toast.error('Choose two different branches and a valid quantity');
    if ((selectedProduct.stock[fromBranch] || 0) < quantity) return toast.error('Not enough stock at the source branch');
    addTransfer({ id: createId('transfer'), productId, productName: selectedProduct.name, quantity, fromBranchId: fromBranch, toBranchId: toBranch, status: 'pending', createdAt: new Date().toISOString() });
    toast.success('Stock transfer requested');
  };
  const startDrawer = () => {
    openDrawer({ id: createId('drawer'), branchId: drawerBranch, userId: currentUser?.id || 'unknown', userName: currentUser?.name || 'Staff', openingAmount, status: 'open', openedAt: new Date().toISOString() });
    toast.success('Cash drawer opened');
  };
  const connectTerminal = () => { setTerminal({ ...terminal, connected: !terminal.connected, provider: terminal.provider || 'Demo Terminal', updatedAt: new Date().toISOString() }); };
  const requestPayment = () => { if (terminalAmount <= 0) return toast.error('Enter an amount'); setTerminal({ ...terminal, lastStatus: 'waiting', lastAmount: terminalAmount, updatedAt: new Date().toISOString() }); toast('Payment request sent to terminal'); };

  const tabs = [['transfers', 'Stock transfers'], ['returns', 'Returns'], ['drawer', 'Cash drawer'], ['forecast', 'Forecast'], ['terminal', 'Payment terminal'], ['orders', 'Mobile orders']] as const;
  return <div className="container"><div className="section-card">
    <div className="section-header"><div><div className="eyebrow">Operations</div><h1>Operations Center</h1><p className="section-description">Manage branch movement, returns, cash control, forecasting, payments, and online orders.</p></div><span className={`status-pill ${navigator.onLine ? 'online' : 'offline'}`}>{navigator.onLine ? 'Online' : 'Offline ready'}</span></div>
    <div className="filter-tabs mt-6">{tabs.map(([key, label]) => <button key={key} className={`filter-pill ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'transfers' && <div className="grid-wide mt-6"><section className="panel-card"><h2>New branch transfer</h2><div className="field-grid mt-3"><label className="form-field"><span>Product</span><select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="form-field"><span>From branch</span><select className="input" value={fromBranch} onChange={(e) => setFromBranch(e.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="form-field"><span>To branch</span><select className="input" value={toBranch} onChange={(e) => setToBranch(e.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="form-field"><span>Quantity</span><input className="input" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label><button className="btn" onClick={createTransfer}>Request transfer</button></div></section><section className="panel-card"><h2>Transfer queue</h2>{transfers.length === 0 && <p>No transfers yet.</p>}{transfers.map((transfer) => <div className="list-item-card" key={transfer.id}><div><strong>{transfer.productName}</strong><div>{transfer.quantity} units • {transfer.fromBranchId} to {transfer.toBranchId}</div></div>{transfer.status === 'pending' && <><button className="btn" onClick={() => { processTransfer(transfer.id, 'completed'); toast.success('Transfer completed'); }}>Complete</button><button className="btn secondary" onClick={() => processTransfer(transfer.id, 'cancelled')}>Cancel</button></>}</div>)}</section></div>}
    {tab === 'returns' && <section className="panel-card mt-6"><h2>Returns and exchanges</h2><p>Process a return to restore the sold quantity to the original branch inventory.</p>{returns.length === 0 && <p>No return requests.</p>}{returns.map((request) => <div className="list-item-card" key={request.id}><div><strong>{request.item}</strong><div>{request.saleId} • Qty {request.quantity} • {request.reason}</div></div>{request.status === 'pending' && <button className="btn" onClick={() => { processReturn(request.id, 'processed'); toast.success('Return processed and stock restored'); }}>Process return</button>}</div>)}</section>}
    {tab === 'drawer' && <section className="panel-card mt-6"><h2>Cash drawer management</h2><div className="grid-3col mt-3"><label className="form-field"><span>Branch</span><select className="input" value={drawerBranch} onChange={(e) => setDrawerBranch(e.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="form-field"><span>Opening cash</span><input className="input" type="number" min={0} value={openingAmount} onChange={(e) => setOpeningAmount(Number(e.target.value))} /></label><button className="btn" onClick={startDrawer}>Open drawer</button></div>{drawers.map((drawer) => <div className="list-item-card mt-3" key={drawer.id}><div><strong>{drawer.userName}</strong><div>{drawer.branchId} • Opening Le {drawer.openingAmount} • {drawer.status}</div></div>{drawer.status === 'open' && <><input className="input" type="number" min={0} value={closingAmount} onChange={(e) => setClosingAmount(Number(e.target.value))} /><button className="btn" onClick={() => { closeDrawer(drawer.id, closingAmount); toast.success('Drawer closed'); }}>Close drawer</button></>}</div>)}</section>}
    {tab === 'forecast' && <section className="panel-card mt-6"><h2>Inventory forecasting</h2><p>Estimated days of stock uses recorded sales and current inventory.</p>{forecast.map(({ product, stock, averageDaily, days }) => <div className="list-item-card" key={product.id}><div><strong>{product.name}</strong><div>{stock} units available • {averageDaily.toFixed(1)} average sold per day</div></div><strong>{days === null ? 'No sales history' : `${days} days of stock`}</strong></div>)}</section>}
    {tab === 'terminal' && <section className="panel-card mt-6"><h2>Payment terminal integration</h2><p>Connect a supported terminal adapter here. Demo mode records the handoff state without charging a customer.</p><div className="row mt-3"><span className={`status-pill ${terminal.connected ? 'online' : 'offline'}`}>{terminal.connected ? `${terminal.provider} connected` : 'Terminal disconnected'}</span><button className="btn secondary" onClick={connectTerminal}>{terminal.connected ? 'Disconnect' : 'Connect terminal'}</button></div>{terminal.connected && <div className="row mt-4"><input className="input" type="number" min={0} placeholder="Amount (Le)" value={terminalAmount || ''} onChange={(e) => setTerminalAmount(Number(e.target.value))} /><button className="btn" onClick={requestPayment}>Send payment request</button></div>}<p className="mt-4">Last status: {terminal.lastStatus}{terminal.lastAmount ? ` • Le ${terminal.lastAmount}` : ''}</p></section>}
    {tab === 'orders' && <section className="panel-card mt-6 mobile-orders-section"><div className="section-header mobile-orders-header"><div><h2>Customer orders</h2><p>{selectedBranch === 'all' ? 'All branch orders' : `${selectedBranchRecord?.name || 'Selected branch'} • ${selectedBranchRecord?.location || 'Branch location'}`}</p></div><button className="btn" onClick={copyOrderLink}>Copy customer order link</button></div><div className="mobile-order-stats"><div><span>Orders</span><strong>{branchOrders.length}</strong></div><div><span>New</span><strong>{newOrderCount}</strong></div><div><span>Order value</span><strong>Le {branchOrderTotal.toFixed(2)}</strong></div></div>{branchOrders.length === 0 && <p>No mobile orders for this branch yet.</p>}<div className="mobile-order-admin-list">{branchOrders.map((order) => {
      const orderBranchName = branches.find((branch) => branch.id === order.branchId)?.name || 'Unknown branch';
      return <article className="mobile-order-admin-card" key={order.id}><div className="mobile-order-admin-card-top"><div><strong>{order.customerName}</strong><span>{order.phone} • {orderBranchName}</span></div><div className="mobile-order-admin-total"><strong>Le {order.total.toFixed(2)}</strong><span>{new Date(order.createdAt).toLocaleString()}</span></div></div><button className="mobile-order-view-button" type="button" onClick={() => setSelectedOrder(order)}>View order details</button><div className="mobile-order-admin-footer"><span className={`status-pill ${order.status === 'new' ? 'online' : ''}`}>{order.status}</span><select className="input" value={order.status} onChange={(e) => void changeOrderStatus(order.id, e.target.value as typeof order.status)} aria-label={`Update status for ${order.customerName}`}><option>new</option><option>accepted</option><option>ready</option><option>completed</option><option>cancelled</option></select><button className="btn danger" type="button" onClick={() => { if (!window.confirm(`Delete ${order.customerName}'s order?`)) return; void removeOrder(order.id); }}>Delete order</button></div></article>;
    })}</div></section>}
    {selectedOrder && <div className="mobile-order-dialog-overlay" role="presentation" onClick={() => setSelectedOrder(null)}><section className="mobile-order-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-order-dialog-title" onClick={(event) => event.stopPropagation()}><div className="mobile-order-dialog-header"><div><span className="eyebrow">Incoming customer order</span><h2 id="mobile-order-dialog-title">{selectedOrder.customerName}</h2><p>{selectedOrder.phone} • {branches.find((branch) => branch.id === selectedOrder.branchId)?.name || 'Branch'}</p></div><button type="button" className="mobile-order-dialog-close" aria-label="Close order details" onClick={() => setSelectedOrder(null)}>×</button></div><div className="mobile-order-dialog-total"><span>Total</span><strong>Le {selectedOrder.total.toFixed(2)}</strong></div><div className="mobile-order-dialog-items"><strong>Requested products</strong>{selectedOrder.items.map((item) => <div className="mobile-order-dialog-item" key={`${selectedOrder.id}-${item.productId || item.name}`}><span>{item.name} × {item.quantity}</span><strong>Le {(item.price * item.quantity).toFixed(2)}</strong></div>)}</div>{selectedOrder.note && <div className="mobile-order-admin-note">Customer note: {selectedOrder.note}</div>}<label className="form-field"><span>Order status</span><select className="input" value={selectedOrder.status} onChange={(event) => { const status = event.target.value as typeof selectedOrder.status; void changeOrderStatus(selectedOrder.id, status); setSelectedOrder({ ...selectedOrder, status }); }}><option>new</option><option>accepted</option><option>ready</option><option>completed</option><option>cancelled</option></select></label><button type="button" className="btn mobile-order-dialog-done" onClick={() => setSelectedOrder(null)}>Done</button></section></div>}
  </div></div>;
}
