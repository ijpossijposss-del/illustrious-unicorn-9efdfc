import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';

export default function InventoryManagement() {
  const products = useStore((state) => state.products);
  const branches = useStore((state) => state.branches);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const setSelectedBranch = useStore((state) => state.setSelectedBranch);
  const receiveInventory = useStore((state) => state.receiveInventory);
  const deleteProduct = useStore((state) => state.deleteProduct);
  const restoreProduct = useStore((state) => state.restoreProduct);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [receiveBranchId, setReceiveBranchId] = useState(selectedBranch || branches[0]?.id || '');
  const [receiveQuantity, setReceiveQuantity] = useState(10);
  const [receiveCost, setReceiveCost] = useState('');
  const [receivePrice, setReceivePrice] = useState('');
  const [receiveDialogProductId, setReceiveDialogProductId] = useState<string | null>(null);
  const [viewBranch, setViewBranch] = useState(selectedBranch || 'all');

  useEffect(() => {
    setViewBranch(selectedBranch || 'all');
    setReceiveBranchId(selectedBranch && selectedBranch !== 'all' ? selectedBranch : branches[0]?.id || '');
  }, [selectedBranch, branches]);

  const filteredProducts = useMemo(
    () => products.filter((product) => {
      const lowerSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !lowerSearch ||
        product.name.toLowerCase().includes(lowerSearch) ||
        product.category.toLowerCase().includes(lowerSearch) ||
        String(product.price).includes(lowerSearch) ||
        String(product.cost).includes(lowerSearch) ||
        String(product.barcode ?? '').includes(lowerSearch);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? product.active && !product.deleted : product.deleted);

      const matchesBranch = viewBranch === 'all' || product.branchId === viewBranch || Object.prototype.hasOwnProperty.call(product.stock, viewBranch);

      return matchesSearch && matchesStatus && matchesBranch;
    }),
    [products, searchTerm, statusFilter, viewBranch],
  );

  const handleReceiveStock = () => {
    if (!selectedProductId || !receiveBranchId || receiveQuantity <= 0) return;
    receiveInventory(selectedProductId, receiveBranchId, Number(receiveQuantity), receiveCost === '' ? undefined : Number(receiveCost), receivePrice === '' ? undefined : Number(receivePrice));
    setReceiveQuantity(10);
    setReceiveCost('');
    setReceivePrice('');
    setReceiveDialogProductId(null);
  };

  const handleToggleProduct = (productId: string, isDeleted: boolean) => {
    if (isDeleted) {
      restoreProduct(productId);
    } else {
      if (window.confirm('Archive this product? It will be removed from the active catalog.')) deleteProduct(productId);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1>Inventory Management</h1>
            <p style={{ color: '#6b7280', margin: 0 }}>
              Review stock across branches, search items, and receive inventory in one place.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 10, alignItems: 'center', gridAutoFlow: 'column' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label htmlFor="viewBranch" style={{ color: '#6b7280' }}>View branch:</label>
              <select
                id="viewBranch"
                className="input"
                style={{ width: 200, margin: 0 }}
                value={viewBranch}
                onChange={(event) => {
                  setViewBranch(event.target.value);
                  setSelectedBranch(event.target.value);
                }}
              >
                <option value="all">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label htmlFor="statusFilter" style={{ color: '#6b7280' }}>Status:</label>
              <select
                id="statusFilter"
                className="input"
                style={{ width: 160, margin: 0 }}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'deleted')}
              >
                <option value="all">All products</option>
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="card p-5">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>Product inventory</h2>
                <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
                  Showing {filteredProducts.length} of {products.length} products.
                </p>
              </div>
              <input
                className="input"
                placeholder="Search name, category, barcode"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                style={{ maxWidth: 320 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginTop: 18 }}>
              {filteredProducts.length === 0 && (
                <div className="p-5" style={{ borderRadius: 14, background: '#f8fafc', color: '#4b5563' }}>
                  No matching products found. Try a different search or choose a different status.
                </div>
              )}

              {filteredProducts.map((product) => {
                const selectedBranchStock = viewBranch === 'all'
                  ? Object.values(product.stock).reduce((sum, value) => sum + (value || 0), 0)
                  : product.stock[viewBranch] ?? 0;
                const totalStock = Object.values(product.stock).reduce((sum, value) => sum + (value || 0), 0);
                return (
                  <div
                    key={product.id}
                    className="card"
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      opacity: product.deleted ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ fontSize: 15 }}>{product.name}</strong>
                        <div style={{ color: '#6b7280', marginTop: 4, fontSize: 13 }}>
                          {product.category} • {product.barcode ?? 'No barcode'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button className="btn secondary" type="button" onClick={() => { setSelectedProductId(product.id); setReceiveBranchId(viewBranch === 'all' ? product.branchId : viewBranch); setReceiveDialogProductId(product.id); }}>
                          Receive stock
                        </button>
                        <button className="btn" onClick={() => handleToggleProduct(product.id, Boolean(product.deleted))}>
                          {product.deleted ? 'Restore' : 'Archive'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
                      <div className="p-3" style={{ borderRadius: 10, background: '#f9fafb', padding: 10 }}>
                        <div style={{ color: '#6b7280', marginBottom: 4, fontSize: 12 }}>Stock</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedBranchStock}</div>
                      </div>
                      <div className="p-3" style={{ borderRadius: 10, background: '#f9fafb', padding: 10 }}>
                        <div style={{ color: '#6b7280', marginBottom: 4, fontSize: 12 }}>Total</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{totalStock}</div>
                      </div>
                      <div className="p-3" style={{ borderRadius: 10, background: '#f9fafb', padding: 10 }}>
                        <div style={{ color: '#6b7280', marginBottom: 4, fontSize: 12 }}>Price</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>₺{product.price.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {receiveDialogProductId && (() => {
        const receiveProduct = products.find((product) => product.id === receiveDialogProductId);
        if (!receiveProduct) return null;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.48)' }} onClick={() => setReceiveDialogProductId(null)}>
            <div className="card" style={{ width: 'min(100%, 520px)', padding: 24 }} onClick={(event) => event.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Receive Stock</h2>
                  <p style={{ margin: '8px 0 0', color: '#6b7280' }}>{receiveProduct.name}</p>
                </div>
                <button className="btn secondary" type="button" onClick={() => setReceiveDialogProductId(null)}>Close</button>
              </div>
              <div style={{ display: 'grid', gap: 14, marginTop: 20 }}>
                <label style={{ display: 'grid', gap: 6 }}>Quantity to receive *<input className="input" type="number" min={1} value={receiveQuantity} onChange={(event) => setReceiveQuantity(Number(event.target.value))} /></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6 }}>Cost price (optional)<input className="input" type="number" min={0} placeholder={`Current: ${receiveProduct.cost}`} value={receiveCost} onChange={(event) => setReceiveCost(event.target.value)} /></label>
                  <label style={{ display: 'grid', gap: 6 }}>Selling price (optional)<input className="input" type="number" min={0} placeholder={`Current: ${receiveProduct.price}`} value={receivePrice} onChange={(event) => setReceivePrice(event.target.value)} /></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn secondary" type="button" onClick={() => setReceiveDialogProductId(null)}>Cancel</button>
                  <button className="btn" type="button" onClick={handleReceiveStock} disabled={!receiveQuantity || receiveQuantity < 1}>Receive stock</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
