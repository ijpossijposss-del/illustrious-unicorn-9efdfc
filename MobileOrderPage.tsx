import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStore } from '../store/useStore';
import { database, publicCatalogPath, publicOrdersPath } from '../sync/firebase';
import { onValue, ref, set } from 'firebase/database';
import { createId } from '../utils/createId';

interface OrderRow {
  id: string;
  productId: string;
  quantity: number;
  productSearch: string;
}

export default function MobileOrderPage() {
  const allProducts = useStore((state) => state.products);
  const allBranches = useStore((state) => state.branches);
  const addOrder = useStore((state) => state.addMobileOrder);
  const products = useMemo(() => allProducts.filter((product) => product.active), [allProducts]);
  const branches = useMemo(() => allBranches.filter((branch) => branch.active), [allBranches]);
  const [searchParams] = useSearchParams();
  const linkedBranchId = searchParams.get('branch');
  const linkedBranch = branches.find((branch) => branch.id === linkedBranchId);
  const hasBranchLink = Boolean(linkedBranchId);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [branchId, setBranchId] = useState(linkedBranch?.id || branches[0]?.id || '');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const orderSubmitting = useRef(false);
  const [rows, setRows] = useState<OrderRow[]>([{ id: createId('row'), productId: '', quantity: 1, productSearch: '' }]);

  useEffect(() => onValue(ref(database, publicCatalogPath), (snapshot) => {
    const catalog = snapshot.val() as { branches?: unknown; products?: unknown } | null;
    if (Array.isArray(catalog?.branches)) useStore.getState().setBranches(catalog.branches as ReturnType<typeof useStore.getState>['branches']);
    if (Array.isArray(catalog?.products)) useStore.getState().setProducts(catalog.products as ReturnType<typeof useStore.getState>['products']);
  }, (error) => {
    console.warn('Public product catalog could not be loaded from Firebase.', error);
    toast.error('The store catalog is unavailable. Please try again later.');
  }), []);

  useEffect(() => {
    if (linkedBranchId && linkedBranch) {
      setBranchId(linkedBranch.id);
    }
  }, [linkedBranchId, linkedBranch]);

  const branchProducts = useMemo(() => products.filter((product) => {
    const hasBranchStock = Object.prototype.hasOwnProperty.call(product.stock || {}, branchId);
    return product.branchId === branchId || hasBranchStock;
  }), [products, branchId]);
  useEffect(() => {
    setRows((current) => current.map((row) => ({ ...row, productId: '', productSearch: '' })));
  }, [branchId]);

  const resolvedRows = useMemo(() => rows.map((row) => {
    const matchedProduct = row.productId
      ? branchProducts.find((product) => product.id === row.productId)
      : undefined;
    const productName = matchedProduct?.name || '';
    const quantity = Number(row.quantity) > 0 ? Number(row.quantity) : 0;
    const unitPrice = matchedProduct?.price ?? 0;
    const availableStock = matchedProduct ? matchedProduct.stock?.[branchId] ?? 0 : 0;
    return {
      ...row,
      productName,
      matchedProduct,
      quantity,
      unitPrice,
      availableStock,
      lineTotal: matchedProduct ? unitPrice * quantity : 0,
    };
  }), [branchProducts, branchId, rows]);

  const total = resolvedRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const validRows = resolvedRows.filter((row) => row.matchedProduct && row.quantity > 0);

  const updateRow = (id: string, changes: Partial<OrderRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  };

  const addRow = () => {
    setRows((current) => [...current, { id: createId('row'), productId: '', quantity: 1, productSearch: '' }]);
  };

  const removeRow = (id: string) => {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current);
  };

  const submit = async () => {
    if (orderSubmitting.current) return;
    if (hasBranchLink && !linkedBranch) return toast.error('This ordering link is not assigned to an active branch');
    if (!customerName.trim() || !phone.trim()) return toast.error('Enter your name and phone number');
    const manualRows = resolvedRows.filter((row) => !row.matchedProduct && row.productSearch.trim());
    if (!validRows.length && !manualRows.length) return toast.error('Add a product or type a product name for the branch to check');

    const outOfStockRow = validRows.find((row) => row.quantity > (row.matchedProduct?.stock?.[branchId] ?? 0));
    if (outOfStockRow) return toast.error(`${outOfStockRow.matchedProduct?.name} does not have enough stock for that quantity`);

    orderSubmitting.current = true;
    setSubmitting(true);
    try {
    const items = [...validRows, ...manualRows].map((row) => ({
      productId: row.matchedProduct?.id || createId('manual'),
      name: row.matchedProduct?.name || row.productSearch.trim(),
      price: row.matchedProduct?.price || 0,
      cost: row.matchedProduct?.cost || 0,
      quantity: row.quantity,
      branchId,
    }));

    const order = {
      id: createId('order'),
      customerName: customerName.trim(),
      phone: phone.trim(),
      items,
      total,
      branchId,
      status: 'new' as const,
      createdAt: new Date().toISOString(),
      note: note.trim() || undefined,
    };

    addOrder(order);
    toast.success('Order sent to the store');
    try {
      await Promise.race([
        set(ref(database, `${publicOrdersPath}/${branchId}/${order.id}`), JSON.parse(JSON.stringify(order))),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Firebase order write timed out')), 8000)),
      ]);
    } catch {
      console.warn('Order saved locally; remote store sync is unavailable.', order.id);
    }

    setRows([{ id: createId('row'), productId: '', quantity: 1, productSearch: '' }]);
    setNote('');
    setCustomerName('');
    setPhone('');
    } finally {
      orderSubmitting.current = false;
      setSubmitting(false);
    }
  };

  if (hasBranchLink && !linkedBranch) {
    return <div className="container mobile-order-page"><div className="section-card"><div className="eyebrow">Customer ordering</div><h1>Branch unavailable</h1><p className="section-description">This order link is expired or its branch is currently inactive. Please ask the store for a new link.</p></div></div>;
  }

  const selectedBranchDetails = branches.find((branch) => branch.id === branchId);

  return <div className="container mobile-order-page"><div className="section-card mobile-order-card">
    <div className="mobile-order-brand" aria-label="Super POS Investment">
      <div className="mobile-order-brand-mark">S</div>
      <strong>SUPER POS</strong>
      <span>Investment</span>
    </div>
    <div className="section-header"><div><div className="eyebrow">Customer ordering</div><h1>Order from your phone</h1><p className="section-description">Choose products and send your order to {linkedBranch?.name || 'the selected branch'}.</p></div></div>
    <div className="mobile-order-layout mt-6">
      <section className="panel-card mobile-order-panel">
        <h2>Customer details</h2>
        <div className="field-grid mt-3">
          <label className="form-field"><span>Name</span><input className="input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" /></label>
          <label className="form-field"><span>Phone</span><input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" /></label>
          <label className="form-field"><span>Pickup branch</span><select className="input" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} — {branch.location} — {branch.phone}</option>)}
          </select></label>
          {selectedBranchDetails && <div className="branch-summary-card">
            <strong>{selectedBranchDetails.name}</strong>
            <span>{selectedBranchDetails.location}</span>
            <small>{selectedBranchDetails.phone}</small>
          </div>}
        </div>
      </section>
      <section className="panel-card mobile-order-panel"><h2>Your order</h2><div className="field-grid mt-3">
        {resolvedRows.map((row) => {
          const searchTerm = row.productSearch.trim().toLowerCase();
          const visibleProducts = branchProducts.filter((product) => product.id === row.productId || product.name.toLowerCase().includes(searchTerm));
          const matchedText = row.matchedProduct
            ? `Price: Le ${row.unitPrice.toFixed(2)} • Stock: ${row.availableStock}`
            : row.productName ? 'Not available in this branch' : 'Type a product name from this branch';

          return <div key={row.id} className="list-item-card mobile-order-item" style={{ display: 'grid', gap: 10 }}>
            <div className="mobile-order-product-controls">
              <input
                className="input mobile-product-search"
                value={row.productSearch}
                onChange={(event) => updateRow(row.id, {
                  productSearch: event.target.value,
                  productId: row.matchedProduct?.name === event.target.value ? row.productId : '',
                })}
                placeholder="Search products in this branch"
                aria-label="Search products"
              />
              {row.productSearch.trim() && !row.matchedProduct && <div className="mobile-product-suggestions" role="listbox" aria-label="Product suggestions">
                {visibleProducts.length > 0 ? visibleProducts.map((product) => <button
                  type="button"
                  className="mobile-product-suggestion"
                  key={product.id}
                  onClick={() => updateRow(row.id, { productId: product.id, productSearch: product.name })}
                >
                  <span>{product.name}</span>
                  <small>Le {product.price.toFixed(2)} • {product.stock?.[branchId] ?? 0} in stock</small>
                </button>) : <div className="mobile-product-not-found" role="status">No matching product found. You can submit this as a manual request for the branch to check.</div>}
              </div>}
              <select
                className="input mobile-product-select"
                value={row.productId}
                onChange={(event) => updateRow(row.id, { productId: event.target.value, productSearch: '' })}
                aria-label="Product name"
                required
              >
                <option value="">Choose a product from {selectedBranchDetails?.name || 'this branch'}</option>
                {visibleProducts.map((product) => <option key={product.id} value={product.id}>{product.name} — Le {product.price.toFixed(2)} — {product.stock?.[branchId] ?? 0} in stock</option>)}
              </select>
              <input
                className="input"
                type="number"
                min={1}
                value={row.quantity}
                onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value) || 0 })}
                placeholder="Quantity"
                style={{ width: 110 }}
              />
              <button type="button" className="btn secondary" onClick={() => removeRow(row.id)} disabled={resolvedRows.length === 1}>Remove</button>
            </div>
            {!branchProducts.length && <div className="mobile-order-empty">No active products are assigned to {selectedBranchDetails?.name || 'this branch'} yet. Add or import products for this branch in the main system.</div>}
            <div style={{ color: '#64748b', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{row.productSearch.trim() && !row.matchedProduct ? 'Manual request will be sent to the branch to check availability' : matchedText}</span>
              <strong>{row.matchedProduct ? `Le ${(row.lineTotal).toFixed(2)}` : 'Le 0.00'}</strong>
            </div>
            {row.matchedProduct && <div style={{ color: '#475569', fontSize: 12 }}>Line total for {row.productName}: Le {row.lineTotal.toFixed(2)}</div>}
          </div>;
        })}
        <div className="mobile-order-summary-bar">
          <button type="button" className="btn secondary" onClick={addRow}>Add product</button>
          <span>Total: Le {total.toFixed(2)}</span>
        </div>
        <label className="form-field" style={{ marginTop: 8 }}>
          <span>Optional note</span>
          <textarea className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional short note" rows={3} />
        </label>
        <button className="btn mobile-submit-btn" type="button" onClick={() => void submit()} disabled={submitting}>{submitting ? 'Sending order…' : 'Send order'}</button>
      </div></section>
    </div>
  </div></div>;
}
