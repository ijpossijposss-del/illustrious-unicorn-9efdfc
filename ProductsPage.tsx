import { useMemo, useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useStore, type ProductVariant } from '../store/useStore';
import { createId } from '../utils/createId';

export default function ProductsPage() {
  const products = useStore((state) => state.products);
  const branches = useStore((state) => state.branches);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const categories = useStore((state) => state.categories);
  const addProduct = useStore((state) => state.addProduct);
  const updateProduct = useStore((state) => state.updateProduct);
  const deleteProduct = useStore((state) => state.deleteProduct);
  const restoreProduct = useStore((state) => state.restoreProduct);
  const hasPermission = useStore((state) => state.hasPermission);
  const canAddProducts = hasPermission('add-products');
  const canEditProducts = hasPermission('edit-products');

  const [showFormModal, setShowFormModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [branchId, setBranchId] = useState('');
  const [barcode, setBarcode] = useState('');
  const [stockQty, setStockQty] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(10);
  const [expiry, setExpiry] = useState('');
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState(100);
  const [imageHeight, setImageHeight] = useState(100);
  const [imageFit, setImageFit] = useState<'cover' | 'contain' | 'fill'>('cover');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    setCategory(categories[0] || 'General');
    setBranchId(selectedBranch !== 'all' && branches.some((branch) => branch.id === selectedBranch) ? selectedBranch : branches[0]?.id || '');
  }, [categories, branches, selectedBranch]);

  const activeProducts = useMemo(() => products.filter((product) => product.active && (selectedBranch === 'all' || product.branchId === selectedBranch)), [products, selectedBranch]);
  const archivedProducts = useMemo(() => products.filter((product) => (!product.active || product.deleted) && (selectedBranch === 'all' || product.branchId === selectedBranch)), [products, selectedBranch]);

  const openNew = () => {
    setEditingId(null);
    setName(''); setCategory(categories[0] || 'General'); setPrice(0); setCost(0); setStockQty(0); setReorderLevel(10); setBarcode(''); setExpiry(''); setSupplier(''); setDescription(''); setHasVariants(false); setVariants([]); setImagePreview(null); setImageWidth(100); setImageHeight(100); setImageFit('cover');
    setBranchId(selectedBranch !== 'all' && branches.some((branch) => branch.id === selectedBranch) ? selectedBranch : branches[0]?.id || '');
    setShowFormModal(true);
  };

  const startEdit = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setPrice(p.price);
    setCost(p.cost);
    setBranchId(p.branchId);
    setBarcode(p.barcode || '');
    setStockQty(p.stock[p.branchId] ?? 0);
    setHasVariants(Boolean(p.variants?.length));
    setVariants(p.variants || []);
    setImagePreview((p as any).image || null);
    setImageWidth(p.imageWidth || 100);
    setImageHeight(p.imageHeight || 100);
    setImageFit(p.imageFit || 'cover');
    setShowFormModal(true);
  };

  const handleImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const source = new Image();
      source.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return setImagePreview(String(reader.result));
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        setImagePreview(canvas.toDataURL('image/jpeg', 0.82));
      };
      source.onerror = () => setImagePreview(String(reader.result));
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim() || price <= 0) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const productId = editingId || createId('p');
      const image = imagePreview?.startsWith('data:image/')
        ? await (await import('../sync/firebaseStorage')).uploadProductImage(imagePreview, branchId, productId)
        : imagePreview || '';
      const productObj: any = {
        id: productId,
        name: name.trim(),
        category,
        price,
        cost,
        stock: { [branchId]: stockQty },
        branchId,
        active: true,
        barcode: barcode.trim(),
        image,
        imageWidth,
        imageHeight,
        imageFit,
        description,
        supplier,
        expiry,
        reorderLevel,
        variants: hasVariants ? variants : undefined,
      };

      if (editingId) {
        updateProduct(productObj);
      } else {
        addProduct(productObj);
      }
      setShowFormModal(false);
    } catch (error) {
      console.error('Product could not be saved.', error);
      toast.error(error instanceof Error ? error.message : 'Product could not be saved.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setConfirmId(id);
  };

  return (
    <div className="container">
      {canAddProducts && <div className="section-actions product-toolbar"><button className="btn" onClick={openNew}>+ Add Product</button></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {activeProducts.map((product) => (
          <div key={product.id} className="card product-card" style={{ cursor: 'default' }}>
            <div className="product-thumb">
              { (product as any).image ? <img src={(product as any).image} alt={product.name} style={{ width: `${product.imageWidth || 100}%`, height: `${product.imageHeight || 100}%`, objectFit: product.imageFit || 'cover' }} /> : '📦' }
            </div>
            <div style={{ flex: 1 }}>
              <p className="product-title">{product.name}</p>
              <p className="product-subtitle">{product.category}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>Le {product.price}</span>
              <span className="stock-pill in-stock">{product.stock[product.branchId] ?? 0}</span>
            </div>
            {(canEditProducts || canAddProducts) && <div style={{ display: 'flex', gap: 8 }}>
              {canEditProducts && <button className="btn secondary" style={{ flex: 1 }} onClick={() => startEdit(product.id)}>Edit</button>}
              {canEditProducts && <button className="btn secondary" style={{ flex: 1 }} onClick={() => confirmDelete(product.id)}>Delete</button>}
            </div>}
          </div>
        ))}
      </div>

      {archivedProducts.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h3>Archived products</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {archivedProducts.map((p) => (
              <div key={p.id} className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{p.name}</strong>
                  <div style={{ color: '#6b7280' }}>{p.category} • Le {p.price.toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => restoreProduct(p.id)}>Restore</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1300, display: 'grid', placeItems: 'center' }}>
          <div className="card modal-card" style={{ width: 420, padding: 18 }}>
            <h3 style={{ margin: 0 }}>Archive product</h3>
            <p style={{ marginTop: 8, color: '#6b7280' }}>Are you sure you want to archive this product? It will be removed from the catalog.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button className="btn secondary" onClick={() => setConfirmId(null)} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e6e6e6' }}>Cancel</button>
              <button className="btn" onClick={() => { if (confirmId) deleteProduct(confirmId); setConfirmId(null); }} style={{ background: 'linear-gradient(135deg, #f97316, #ff8a00)', color: '#fff' }}>Archive</button>
            </div>
          </div>
        </div>
      )}

      {showFormModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: 24 }}>
          <div className="card modal-card" style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center', color: '#2563eb' }}>📦</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>New Product</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{editingId ? 'Edit product details' : 'Add a product to the catalog'}</div>
                </div>
              </div>
              <button aria-label="Close" onClick={() => setShowFormModal(false)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>PRODUCT IMAGE</div>
                  <div style={{ border: '2px dashed #e6e9ee', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
                    {imagePreview ? (
                      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                        <img src={imagePreview} alt="preview" style={{ width: `${imageWidth}%`, height: `${imageHeight}px`, maxWidth: '100%', objectFit: imageFit, borderRadius: 8 }} />
                        <button type="button" className="btn secondary" onClick={() => setImagePreview(null)}>Delete image</button>
                      </div>
                    ) : (
                      <label style={{ display: 'block', textAlign: 'center', color: '#9aa4b2', cursor: 'pointer' }}>
                        <div style={{ fontSize: 28 }}>🖼️</div>
                        <div>Click to upload image · JPG, PNG</div>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleImage(e.target.files?.[0])} />
                      </label>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                    <label className="form-field"><span>Image width (%)</span><input className="input" aria-label="Image width" type="number" min={10} max={100} value={imageWidth} onChange={(e) => setImageWidth(Math.min(100, Math.max(10, Number(e.target.value) || 10)))} /></label>
                    <label className="form-field"><span>Image height (px)</span><input className="input" aria-label="Image height" type="number" min={40} max={400} value={imageHeight} onChange={(e) => setImageHeight(Math.min(400, Math.max(40, Number(e.target.value) || 40)))} /></label>
                    <label className="form-field"><span>Image fit</span><select className="input" value={imageFit} onChange={(e) => setImageFit(e.target.value as 'cover' | 'contain' | 'fill')}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></label>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>PRODUCT NAME *</div>
                  <input className="input" placeholder="Enter product name" value={name} onChange={(e) => setName(e.target.value)} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>SELLING PRICE *</div>
                      <input className="input" aria-label="Selling price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>COST PRICE</div>
                      <input className="input" aria-label="Cost price" type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>STOCK QUANTITY</div>
                      <input className="input" aria-label="Stock quantity" type="number" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>REORDER LEVEL</div>
                      <input className="input" aria-label="Reorder level" type="number" value={reorderLevel} onChange={(e) => setReorderLevel(Number(e.target.value))} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>BARCODE</div>
                      <input className="input" placeholder="Auto-generated if empty" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>CATEGORY</div>
                      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>EXPIRY DATE</div>
                      <input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>SUPPLIER</div>
                      <input className="input" placeholder="Supplier name" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>DESCRIPTION</div>
                    <textarea className="input" style={{ minHeight: 92 }} placeholder="Product description" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input id="variant" type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} />
                    <label htmlFor="variant" style={{ fontSize: 13 }}>This product has variants (e.g., different sizes, colors)</label>
                  </div>
                  {hasVariants && (
                    <div className="product-variants-panel">
                      <div className="product-variants-header">
                        <strong>Product variants</strong>
                        <button type="button" className="btn secondary" onClick={() => setVariants((current) => [...current, { id: createId('variant'), name: `Variant ${current.length + 1}`, size: '', barcode: '', stock: { [branchId]: 0 }, cost: 0, price: 0, color: '', expiry: '' }])}>+ Add Variant</button>
                      </div>
                      {variants.length === 0 && <div className="variant-empty">Add sizes, colors, or other sellable options.</div>}
                      {variants.map((variant, index) => {
                        const updateVariant = (changes: Partial<ProductVariant>) => setVariants((current) => current.map((item) => item.id === variant.id ? { ...item, ...changes } : item));
                        return (
                          <div className="variant-editor" key={variant.id}>
                            <div className="variant-editor-title"><span>Variant {index + 1}</span><button type="button" aria-label={`Remove variant ${index + 1}`} onClick={() => setVariants((current) => current.filter((item) => item.id !== variant.id))}>×</button></div>
                            <div className="variant-grid">
                              <label className="form-field"><span>Variant name *</span><input className="input" value={variant.name} onChange={(e) => updateVariant({ name: e.target.value })} /></label>
                              <label className="form-field"><span>Size / volume</span><input className="input" placeholder="e.g. 500ml, 1kg" value={variant.size || ''} onChange={(e) => updateVariant({ size: e.target.value })} /></label>
                              <label className="form-field variant-wide"><span>Barcode</span><input className="input" placeholder="Scan or enter barcode" value={variant.barcode || ''} onChange={(e) => updateVariant({ barcode: e.target.value })} /></label>
                              <label className="form-field"><span>Stock qty</span><input className="input" type="number" min={0} value={variant.stock[branchId] || 0} onChange={(e) => updateVariant({ stock: { ...variant.stock, [branchId]: Number(e.target.value) } })} /></label>
                              <label className="form-field"><span>Cost price</span><input className="input" type="number" min={0} value={variant.cost} onChange={(e) => updateVariant({ cost: Number(e.target.value) })} /></label>
                              <label className="form-field"><span>Selling price</span><input className="input" type="number" min={0} value={variant.price} onChange={(e) => updateVariant({ price: Number(e.target.value) })} /></label>
                              <label className="form-field"><span>Color</span><input className="input" placeholder="Hex or name" value={variant.color || ''} onChange={(e) => updateVariant({ color: e.target.value })} /></label>
                              <label className="form-field"><span>Expiry date</span><input className="input" type="date" value={variant.expiry || ''} onChange={(e) => updateVariant({ expiry: e.target.value })} /></label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: 16, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn secondary" onClick={() => setShowFormModal(false)} style={{ background: '#fff', color: '#0f172a', border: '1px solid #e6e6e6' }}>Cancel</button>
              <button className="btn" onClick={() => void handleSave()} disabled={saving} style={{ background: 'linear-gradient(135deg, #f97316, #ff8a00)', color: '#fff' }}>{saving ? 'Saving…' : 'Save Product'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
