import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useStore, type Product, type ProductVariant } from '../store/useStore';
import { AppIcon } from '../components/AppIcon';
import { sanitizeReceiptHtml } from '../utils/sanitizeReceiptHtml';
import { createId } from '../utils/createId';

export default function POSPage() {
  const products = useStore((state) => state.products);
  const printerSettings = useStore((state) => state.printerSettings);
  const cart = useStore((state) => state.cart);
  const addToCart = useStore((state) => state.addToCart);
  const addProduct = useStore((state) => state.addProduct);
  const setCategories = useStore((state) => state.setCategories);
  const reorderCategories = useStore((state) => state.reorderCategories);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const updateCartQuantity = useStore((state) => state.updateCartQuantity);
  const clearCart = useStore((state) => state.clearCart);
  const discount = useStore((state) => state.discount);
  const setDiscount = useStore((state) => state.setDiscount);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const currentUser = useStore((state) => state.currentUser);
  const categories = useStore((state) => state.categories);
  const branches = useStore((state) => state.branches);
  const receiptSettings = useStore((state) => state.receiptSettings);

  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [isFinalizingSale, setIsFinalizingSale] = useState(false);
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [additionalCharge, setAdditionalCharge] = useState(0);
  const [chargeInput, setChargeInput] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [printPreviewMarkup, setPrintPreviewMarkup] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [savingScannedProduct, setSavingScannedProduct] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', price: 0, cost: 0, stock: 0, reorderLevel: 10, barcode: '', branchId: '', expiry: '', supplier: '', description: '', image: '' });
  const [unknownHasVariants, setUnknownHasVariants] = useState(false);
  const [unknownVariants, setUnknownVariants] = useState<ProductVariant[]>([]);
  const [receipt, setReceipt] = useState<{ receiptNo: string; paymentMethod: string; items: typeof cart; subtotal: number; discount: number; additionalCharge: number; total: number; date: string; qrCode?: string } | null>(null);

  const receiptRef = useRef<HTMLDivElement | null>(null);
  const finalizingSale = useRef(false);
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);
  const scanTimer = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  const uniqueCategories = useMemo(() => {
    const cats = ['All Items', ...categories, ...products.map(p => p.category)];
    return Array.from(new Set(cats.filter(c => c)));
  }, [categories, products]);

  const saveCategory = () => {
    const category = newCategory.trim();
    if (!category) return;
    if (!categories.some((item) => item.toLowerCase() === category.toLowerCase())) {
      setCategories([...categories, category]);
    }
    setSelectedCategory(category);
    setNewCategory('');
    setShowCategoryForm(false);
  };

  const movePosCategory = (targetCategory: string) => {
    if (!draggedCategory || draggedCategory === targetCategory || targetCategory === 'All Items') return;
    const next = [...categories];
    const fromIndex = next.indexOf(draggedCategory);
    const toIndex = next.indexOf(targetCategory);
    if (fromIndex < 0 || toIndex < 0) return;
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, draggedCategory);
    reorderCategories(next);
    setDraggedCategory(null);
    setDragOverCategory(null);
  };

  const activeBranch = useMemo(() => {
    const branchId = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId || selectedBranch;
    return branches.find((branch) => branch.id === branchId) || branches[0] || { id: branchId, name: 'Store', location: '', phone: '' };
  }, [branches, currentUser, selectedBranch]);

  const operationalBranchId = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId || selectedBranch;

  const filteredProducts = useMemo(() => {
    let filtered = products.filter((product) => product.active && (operationalBranchId === 'all' || product.branchId === operationalBranchId));

    if (selectedCategory !== 'All Items') {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }

    if (search.trim()) {
      const value = search.toLowerCase();
      filtered = filtered.filter((product) => 
        product.name.toLowerCase().includes(value) || product.barcode?.includes(value)
      );
    }

    return filtered;
  }, [products, search, selectedCategory, operationalBranchId]);

  const recordSale = useStore((state) => state.recordSale);
  const setProducts = useStore((state) => state.setProducts);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartQuantity = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const effectiveDiscount = useMemo(() => Math.min(Math.max(discount, 0), subtotal), [discount, subtotal]);
  const total = Math.max(subtotal - effectiveDiscount + additionalCharge, 0);

  const getAvailableStock = (product: typeof products[number]) => {
    if (product.variants?.length) {
      return product.variants.reduce((totalStock, variant) => {
        const branchId = operationalBranchId === 'all' ? product.branchId : operationalBranchId;
        const inCart = cart.find((item) => item.productId === product.id && item.variantId === variant.id)?.quantity ?? 0;
        return totalStock + Math.max(0, (variant.stock?.[branchId] ?? 0) - inCart);
      }, 0);
    }
    const branchId = operationalBranchId === 'all' ? product.branchId : operationalBranchId || product.branchId;
    const stock = product.stock?.[branchId] ?? product.stock?.[product.branchId] ?? 0;
    const inCart = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
    return Math.max(0, stock - inCart);
  };

  const buildReceiptPayload = async (paymentMethod: string): Promise<{
    receiptNo: string;
    paymentMethod: string;
    items: typeof cart;
    subtotal: number;
    discount: number;
    additionalCharge: number;
    total: number;
    date: string;
    qrCode?: string;
    receiptUrl?: string;
  }> => {
    const receiptNo = `RCPT-${createId('')}`;
    const date = new Date().toLocaleString();
    const payload = {
      receiptNo,
      paymentMethod,
      items: cart,
      subtotal,
      discount: effectiveDiscount,
      additionalCharge,
      total,
      date,
    };
    // Include the receipt data in the QR URL so another device does not need local storage.
    const portableReceipt = { ...payload, sellerName: currentUser?.name || 'Unknown seller' };
    const encodedReceipt = btoa(unescape(encodeURIComponent(JSON.stringify(portableReceipt))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const publicOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || window.location.origin;
    const receiptUrl = `${publicOrigin}/digital-receipt/${receiptNo}?data=${encodedReceipt}`;
    try {
      const qrCode = await QRCode.toDataURL(receiptUrl);
      return { ...payload, qrCode, receiptUrl };
    } catch (error) {
      console.error('Receipt QR generation failed; the sale can still be recorded.', error);
      return payload;
    }
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setReceipt(null);
  };

  const finalizeSale = async (paymentMethod: string) => {
    if (finalizingSale.current) return;
    finalizingSale.current = true;
    setIsFinalizingSale(true);
    try {
      if (cart.length === 0) {
        toast.error('Add products before charging');
        setShowPayment(false);
        return;
      }

      const payload = await buildReceiptPayload(paymentMethod);
      const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
      const costTotal = roundMoney(cart.reduce((sum, item) => sum + item.cost * item.quantity, 0));
      const timestamp = Date.now();
      const newSale = {
        id: createId('sale'),
        receiptNo: payload.receiptNo,
        items: cart,
        subtotal,
        discount: effectiveDiscount,
        additionalCharge,
        total,
        profit: roundMoney(total - costTotal),
        paymentMethod,
        orderType: 'Dine In',
        branchId: operationalBranchId === 'all' ? cart[0]?.branchId || selectedBranch : operationalBranchId,
        sellerId: currentUser?.id || 'unknown',
        sellerName: currentUser?.name || '',
        staffNumber: currentUser?.staffNumber || '',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        timestamp,
        ...(payload.qrCode ? { qrCode: payload.qrCode } : {}),
        ...(payload.receiptUrl ? { receiptUrl: payload.receiptUrl } : {}),
      };
      const soldQuantities = cart.reduce<Record<string, number>>((quantities, item) => {
        const key = `${item.productId}:${item.variantId || 'base'}`;
        quantities[key] = (quantities[key] || 0) + item.quantity;
        return quantities;
      }, {});
      setProducts(products.map((product) => {
        const productBranchId = operationalBranchId === 'all' ? product.branchId : operationalBranchId;
        const variants = product.variants?.map((variant) => {
          const quantity = soldQuantities[`${product.id}:${variant.id}`] || 0;
          if (!quantity) return variant;
          return { ...variant, stock: { ...variant.stock, [productBranchId]: Math.max(0, (variant.stock?.[productBranchId] ?? 0) - quantity) } };
        });
        const quantity = soldQuantities[`${product.id}:base`];
        if (!quantity && !variants?.some((variant, index) => variant !== product.variants?.[index])) return product;
        const currentStock = product.stock?.[productBranchId] ?? 0;
        return { ...product, variants, stock: { ...product.stock, [productBranchId]: Math.max(0, currentStock - (quantity || 0)) } };
      }));
      recordSale(newSale);
      setReceipt(payload);
      setShowPayment(false);
      setShowReceipt(true);
      clearCart();
      setDiscount(0);
      setAdditionalCharge(0);
      setChargeInput('');
      toast.success('Payment recorded');
    } catch (error) {
      console.error('Sale could not be completed.', error);
      toast.error('Sale could not be completed. Please retry.');
    } finally {
      finalizingSale.current = false;
      setIsFinalizingSale(false);
    }
  };

  const downloadReceipt = async () => {
    if (!receipt || !receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const width = 80;
    const height = (canvas.height * width) / canvas.width;
    const pdf = new jsPDF({ unit: 'mm', format: [width, height] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
    pdf.save(`${receipt.receiptNo}.pdf`);
  };

  const printReceipt = () => {
    if (!receiptRef.current) return;
    setPrintPreviewMarkup(sanitizeReceiptHtml(receiptRef.current.outerHTML));
  };

  const printReceiptNow = () => {
    if (!printPreviewMarkup) return;
    const content = printPreviewMarkup;

    const style = (() => {
      const base = `
        <style>
          html,body{margin:0;padding:0;background:#fff;color:#111827;font-family:Segoe UI, system-ui, -apple-system, Roboto, Arial, sans-serif}
          .receipt-printable{margin:0 auto;padding:6mm;box-sizing:border-box}
          .receipt-printable *{box-sizing:border-box}
          .receipt-printable img{max-width:100%;height:auto}
          .receipt-logo{display:none!important}
      `;
      if (printFormat === 'A4') {
        return base + `
          @media print{ @page{size:A4;margin:10mm} body{margin:0} .receipt-printable{width:190mm} }
        </style>`;
      }
        return base + `
          @media print{ @page{size:${printFormat} auto;margin:0} body{margin:0} .receipt-printable{width:${printFormat}} }
        </style>`;
    })();

    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('title', 'Receipt print frame');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.srcdoc = `<!doctype html><html><head><title>Receipt ${receipt?.receiptNo || ''}</title>${style}</head><body>${content}</body></html>`;
    document.body.appendChild(printFrame);
    const cleanup = () => printFrame.remove();
    printFrame.onload = () => {
      const printWindow = printFrame.contentWindow;
      if (!printWindow) return cleanup();
      printWindow.addEventListener('afterprint', cleanup, { once: true });
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        window.setTimeout(cleanup, 2000);
      }, 300);
    };
  };

  const [printFormat, setPrintFormat] = useState<'58mm' | '80mm' | '100mm' | 'A4'>(printerSettings.paperSize || '80mm');

  const handleScanComplete = (barcode: string) => {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) return;
    setScannedBarcode(normalizedBarcode);
    const match = products.find((product) => {
      const barcodeMatches = product.barcode === normalizedBarcode || product.variants?.some((variant) => variant.barcode === normalizedBarcode);
      const branchMatches = operationalBranchId === 'all' || product.branchId === operationalBranchId || Object.prototype.hasOwnProperty.call(product.stock, operationalBranchId);
      return barcodeMatches && branchMatches && product.active && !product.deleted;
    });
    if (match) {
      const matchedVariant = match.variants?.find((variant) => variant.barcode === normalizedBarcode);
      if (match.variants?.length && !matchedVariant) {
        setVariantProduct(match);
        return;
      }
      const added = addToCart(match, matchedVariant);
      if (added) {
        toast.success(`✓ Added ${match.name} to cart`);
      } else {
        toast.error(`${match.name} is out of stock`);
      }
      // Play a beep sound if available
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch {
        // Audio context not available, continue without beep
      }
    } else {
      setFormData({ name: '', category: categories[0] || '', price: 0, cost: 0, stock: 0, reorderLevel: 10, barcode, branchId: operationalBranchId === 'all' ? branches[0]?.id || 'b1' : operationalBranchId, expiry: '', supplier: '', description: '', image: '' });
      setUnknownHasVariants(false);
      setUnknownVariants([]);
      setShowProductForm(true);
      toast('Product not found. Please add it.');
    }
  };

  const handleSaveProduct = async () => {
    if (savingScannedProduct) return;
    if (!formData.name || formData.price <= 0) {
      toast.error('Please fill in required fields');
      return;
    }
    setSavingScannedProduct(true);
    try {
      const productId = createId('p');
      const image = formData.image.startsWith('data:image/')
        ? await (await import('../sync/firebaseStorage')).uploadProductImage(formData.image, formData.branchId, productId)
        : formData.image;
      const newProduct = {
        id: productId,
        name: formData.name,
        category: formData.category,
        price: formData.price,
        cost: formData.cost,
        stock: { [formData.branchId]: formData.stock },
        branchId: formData.branchId,
        active: true,
        barcode: formData.barcode,
        image,
        expiry: formData.expiry,
        supplier: formData.supplier,
        description: formData.description,
        reorderLevel: formData.reorderLevel,
        variants: unknownHasVariants ? unknownVariants : undefined,
      };
      addProduct(newProduct);
      const added = addToCart(newProduct);
      if (added) {
        toast.success('✓ Product added and added to cart');
      } else {
        toast.error(`${newProduct.name} is out of stock`);
      }
      setShowProductForm(false);
      setScannedBarcode('');
    } catch (error) {
      console.error('Scanned product could not be saved.', error);
      toast.error(error instanceof Error ? error.message : 'Product could not be saved.');
    } finally {
      setSavingScannedProduct(false);
    }
  };

  useEffect(() => {
    searchInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && target.id !== 'barcode-invisible-input';
      if (isTypingTarget && target?.id !== 'pos-search-input') return;
      if (target?.id === 'pos-search-input' && (event.key === 'Enter' || event.key === 'Tab')) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (barcodeBuffer.current.trim()) {
          event.preventDefault();
          handleScanComplete(barcodeBuffer.current.trim());
        }
        barcodeBuffer.current = '';
        return;
      }

      const now = Date.now();
      const timeGap = now - lastKeyTime.current;
      if (event.key.length !== 1 && event.key !== 'Enter' && event.key !== 'Tab') return;
      if (timeGap < 100) {
        barcodeBuffer.current += event.key;
      } else {
        barcodeBuffer.current = event.key;
      }
      lastKeyTime.current = now;

      if (scanTimer.current) window.clearTimeout(scanTimer.current);
      scanTimer.current = window.setTimeout(() => {
        if (barcodeBuffer.current.length >= 4 && target?.id === 'pos-search-input') {
          handleScanComplete(barcodeBuffer.current.trim());
          setSearch('');
        }
        barcodeBuffer.current = '';
      }, 120);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addToCart, addProduct, products, operationalBranchId, categories]);

  return (
    <div className="pos-layout">
      <button className="mobile-cart-trigger" type="button" aria-label={`Open cart${cartQuantity ? `, ${cartQuantity} items` : ''}`} onClick={() => setShowMobileCart(true)}>
        <AppIcon name="shopping-cart" size={20} />
        {cartQuantity > 0 && <span className="mobile-cart-count">{cartQuantity}</span>}
      </button>
      {/* Main Products Section */}
      <div className="card pos-products-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        {/* Search and barcode input share one scanner-ready field. */}
        <input
          ref={searchInputRef}
          id="pos-search-input"
          className="input" 
          placeholder="⌕  Scan barcode or search products..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            const scannedValue = e.currentTarget.value.trim();
            if ((e.key === 'Enter' || e.key === 'Tab') && scannedValue) {
              e.preventDefault();
              if (scanTimer.current) window.clearTimeout(scanTimer.current);
              barcodeBuffer.current = '';
              handleScanComplete(scannedValue);
              setSearch('');
            }
          }}
          style={{ width: '100%' }}
        />

        {/* Category Filter Tabs */}
        <div className="pos-category-filters" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {uniqueCategories.map((cat) => (
            <button
              key={cat}
              draggable={cat !== 'All Items'}
              onDragStart={() => setDraggedCategory(cat)}
              onDragOver={(event) => { event.preventDefault(); if (cat !== 'All Items') setDragOverCategory(cat); }}
              onDragLeave={() => setDragOverCategory(null)}
              onDrop={() => movePosCategory(cat)}
              onDragEnd={() => { setDraggedCategory(null); setDragOverCategory(null); }}
              onClick={() => setSelectedCategory(cat)}
              className={`filter-pill pos-category-pill ${selectedCategory === cat ? 'active' : ''}${dragOverCategory === cat ? ' drag-over' : ''}`}
              title={cat === 'All Items' ? 'Show all products' : 'Drag to rearrange POS categories'}
            >
              {cat}
            </button>
          ))}
          {showCategoryForm ? (
            <input
              className="category-add-input"
              autoFocus
              value={newCategory}
              placeholder="Category name"
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCategory(); if (e.key === 'Escape') setShowCategoryForm(false); }}
            />
          ) : (
            <button className="filter-pill add-category-pill" onClick={() => setShowCategoryForm(true)}>+ Add category</button>
          )}
        </div>

        {/* Product Grid */}
        <div className="pos-product-grid" style={{ display: 'grid', gap: 10, flex: 1 }}>
          {filteredProducts.map((product) => {
            const availableStock = getAvailableStock(product);
            const isOutOfStock = availableStock <= 0;
            return (
              <div 
                key={product.id} 
                className="card product-card" 
                style={{ 
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  opacity: isOutOfStock ? 0.75 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isOutOfStock) e.currentTarget.style.boxShadow = '0 8px 16px rgba(245, 158, 11, 0.2)';
                }}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
                onClick={() => { 
                  if (isOutOfStock) {
                    toast.error(`${product.name} is out of stock`);
                    return;
                  }
                  if (product.variants?.length) {
                    setVariantProduct(product);
                    return;
                  }
                  const added = addToCart(product);
                  if (added) {
                    toast.success(`✓ Added ${product.name} to cart`);
                  } else {
                    toast.error(`${product.name} is out of stock`);
                  }
                }}
              >
              {/* Product Image */}
              <div className="product-thumb">
                { (product as any).image ? (
                  <img src={(product as any).image} alt={product.name} style={{ width: `${product.imageWidth || 100}%`, height: `${product.imageHeight || 100}%`, objectFit: product.imageFit || 'cover' }} />
                ) : (
                  <div style={{ fontSize: 32 }}>📦</div>
                ) }
              </div>

              {/* Product Info */}
              <div style={{ flex: 1 }}>
                <p className="product-title">
                  {product.name}
                </p>
                <p className="product-subtitle">{product.category}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>Le {product.price}</span>
                  <span className={`stock-pill ${isOutOfStock ? 'out-of-stock' : 'in-stock'}`}>
                  {isOutOfStock ? 'Out of stock' : `${availableStock} left`}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
            <p>No products found</p>
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      {showMobileCart && <button className="mobile-cart-backdrop" type="button" aria-label="Close cart" onClick={() => setShowMobileCart(false)} />}
      <div className={`card pos-cart-panel${showMobileCart ? ' mobile-cart-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div>
          <div className="mobile-cart-header">
            <h3 style={{ margin: 0, color: '#1f2937', fontSize: 16 }}>Current Sale</h3>
            <button className="mobile-cart-close" type="button" aria-label="Close cart" onClick={() => setShowMobileCart(false)}>×</button>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: 12 }}>{cart.length} items</p>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
          {cart.length === 0 ? (
            <p className="cart-empty-state">No items yet</p>
          ) : (
            cart.map((item) => (
              <div key={`${item.productId}-${item.variantId || 'base'}`} className="cart-item compact-cart-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px 0', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{item.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>Le {item.price} × {item.quantity}</p>
                  </div>
                  <button 
                    className="btn secondary" 
                    style={{ padding: '4px 6px', fontSize: 11, minWidth: 'auto' }}
                    onClick={() => removeFromCart(item.productId, item.variantId)}
                  >
                    ✕
                  </button>
                </div>
                <div className="cart-quantity-controls">
                  <button 
                    className="btn secondary" 
                    style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}
                    onClick={() => updateCartQuantity(item.productId, Math.max(1, item.quantity - 1), item.variantId)}
                  >
                    −
                  </button>
                  <span style={{ padding: '6px 8px', fontSize: 11, color: '#1f2937', fontWeight: 600 }}>
                    {item.quantity}
                  </span>
                  <button 
                    className="btn secondary" 
                    style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}
                    onClick={() => {
                      const updated = updateCartQuantity(item.productId, item.quantity + 1, item.variantId);
                      if (!updated) {
                        toast.error(`${item.name} is out of stock`);
                      }
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Discount (Le)</label>
          <input 
            className="input" 
            type="number" 
            value={discount} 
            onChange={(e) => setDiscount(Number(e.target.value))} 
            min={0}
            style={{ fontSize: 12 }}
          />
        </div>
        <button className="btn secondary" type="button" style={{ width: '100%', fontSize: 12 }} onClick={() => { setChargeInput(additionalCharge ? String(additionalCharge) : ''); setShowChargeDialog(true); }}>+ Add charge</button>

        {/* Totals */}
        <div className="cart-total">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
            <span style={{ color: '#6b7280' }}>Subtotal:</span>
            <span style={{ color: '#1f2937', fontWeight: 600 }}>Le {subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
            <span style={{ color: '#6b7280' }}>Discount:</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Le {effectiveDiscount.toFixed(2)}</span>
          </div>
          {additionalCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}><span style={{ color: '#6b7280' }}>Additional charge:</span><span style={{ color: '#2563eb', fontWeight: 600 }}>Le {additionalCharge.toFixed(2)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d9cdb8', paddingTop: 6 }}>
            <span style={{ color: '#1f2937', fontWeight: 700, fontSize: 12 }}>Total:</span>
            <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 16 }}>Le {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Checkout */}
        <button className="btn" style={{ width: '100%', fontSize: 13 }} onClick={() => {
          if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
          }
          setShowPayment(true);
        }}>
          <AppIcon name="wallet" size={16} /> Charge
        </button>

        <button className="btn secondary" style={{ width: '100%', fontSize: 12 }} onClick={() => { clearCart(); setAdditionalCharge(0); setChargeInput(''); }}>
          Clear Cart
        </button>

        {showPayment && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
            <div className="card modal-card" style={{ width: '100%', maxWidth: 420, padding: 24, position: 'relative' }}>
              <button style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }} onClick={() => setShowPayment(false)}>✕</button>
              <div className="payment-modal-heading"><div className="payment-modal-icon"><AppIcon name="wallet" size={22} /></div><div><h2>Select Payment Method</h2><p>Choose how the customer will pay for this sale.</p></div></div>
              <div className="payment-method-list">
                <button className="payment-method-btn" disabled={isFinalizingSale} onClick={() => void finalizeSale('Cash')}><span className="payment-method-icon"><AppIcon name="cash" size={22} /></span><span><strong>Cash</strong><small>Pay at the counter</small></span><span className="payment-method-arrow">›</span></button>
                <button className="payment-method-btn" disabled={isFinalizingSale} onClick={() => void finalizeSale('Mobile Money')}><span className="payment-method-icon"><AppIcon name="coins" size={22} /></span><span><strong>Mobile Money</strong><small>Digital wallet payment</small></span><span className="payment-method-arrow">›</span></button>
                <button className="payment-method-btn" disabled={isFinalizingSale} onClick={() => void finalizeSale('Card')}><span className="payment-method-icon"><AppIcon name="card" size={22} /></span><span><strong>Card</strong><small>Debit or credit card</small></span><span className="payment-method-arrow">›</span></button>
              </div>
            </div>
          </div>
        )}

        {showChargeDialog && <div className="small-dialog-overlay" role="dialog" aria-modal="true" aria-label="Add charge"><div className="small-dialog"><h2>Add charge</h2><p>Enter an extra amount for this sale.</p><input className="input" type="number" min={0} step="0.01" value={chargeInput} onChange={(event) => setChargeInput(event.target.value)} placeholder="Amount (Le)" autoFocus /><div className="small-dialog-actions"><button className="btn secondary" type="button" onClick={() => setShowChargeDialog(false)}>Cancel</button><button className="btn" type="button" onClick={() => { const amount = Number(chargeInput); if (!Number.isFinite(amount) || amount < 0) return toast.error('Enter a valid charge amount'); setAdditionalCharge(Math.round(amount * 100) / 100); setShowChargeDialog(false); }}>Apply charge</button></div></div></div>}

        {showReceipt && receipt && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 360, maxHeight: '90vh', position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 60px rgba(15,23,42,0.25)', background: '#fff' }}>
              <button aria-label="Close receipt" style={{ position: 'absolute', top: 10, right: 10, border: 'none', background: '#fff', color: '#0f172a', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18, boxShadow: '0 6px 12px rgba(15,23,42,0.08)', zIndex: 2 }} onClick={closeReceipt}>✕</button>

              <div style={{ padding: 16, overflowY: 'auto', maxHeight: '90vh' }}>
                <div ref={receiptRef} className="receipt-printable" style={{ width: '80mm', margin: '0 auto', background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #eee', color: '#111827', fontSize: 12, fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <div className="receipt-logo receipt-brand-mark"><AppIcon name="branch" size={28} /></div>
                    <div style={{ fontWeight: 900, fontSize: 16, marginTop: 6 }}>{activeBranch.name}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{activeBranch.location}</div>
                    {activeBranch.phone && (
                      <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{activeBranch.phone}</div>
                    )}
                    <div style={{ marginTop: 8, fontWeight: 700, letterSpacing: 1, fontSize: 11 }}>CASH RECEIPT</div>
                  </div>

                  <div style={{ borderTop: '2px dashed #f97316', margin: '6px 0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10, marginBottom: 6 }}>
                    <div>Receipt No: <strong>{receipt.receiptNo}</strong></div>
                    {printerSettings.showDateTime !== false && <div style={{ textAlign: 'right' }}>Time: <strong>{new Date().toLocaleTimeString()}</strong></div>}
                    {printerSettings.showDateTime !== false && <div>Date: <strong>{receipt.date}</strong></div>}
                    <div style={{ textAlign: 'right' }}>Pay: <strong>{receipt.paymentMethod}</strong></div>
                    <div style={{ gridColumn: '1 / -1' }}>Seller: <strong>{currentUser?.name || 'POS'}</strong></div>
                  </div>

                  <div style={{ background: '#f97316', color: '#fff', padding: '6px 6px', borderRadius: 4, display: 'grid', gridTemplateColumns: '2.6fr 0.7fr 1fr 1fr', gap: 4, fontWeight: 700, textTransform: 'uppercase', fontSize: 9 }}>
                    <div>Item</div>
                    <div style={{ textAlign: 'center' }}>Qty</div>
                    <div style={{ textAlign: 'right' }}>Price</div>
                    <div style={{ textAlign: 'right' }}>Total</div>
                  </div>

                  {receipt.items.map((item) => (
                    <div key={item.productId} style={{ display: 'grid', gridTemplateColumns: '2.6fr 0.7fr 1fr 1fr', gap: 4, fontSize: 10, padding: '5px 0', alignItems: 'center' }}>
                      <div>{item.name}</div>
                      <div style={{ textAlign: 'center' }}>{item.quantity}</div>
                      <div style={{ textAlign: 'right' }}>Le {item.price.toFixed(2)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 700 }}>Le {(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0' }} />

                  <div style={{ display: 'grid', gap: 4, fontSize: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>Subtotal</div>
                      <div>Le {receipt.subtotal.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>Discount</div>
                      <div>Le {receipt.discount.toFixed(2)}</div>
                    </div>
                    {receipt.additionalCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><div>Additional charge</div><div>Le {receipt.additionalCharge.toFixed(2)}</div></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 12 }}>
                      <div>Total</div>
                      <div>Le {receipt.total.toFixed(2)}</div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />

                  <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11 }}>{receiptSettings.footerMessage || 'Thank you for shopping with us'}</div>
                  <div style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', marginTop: 4 }}>We appreciate your business.</div>

                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                    <img src={receipt.qrCode} alt="Receipt QR Code" style={{ width: 78, height: 78 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Print format</label>
                    <select value={printFormat} onChange={(e) => setPrintFormat(e.target.value as any)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e6e6e6' }}>
                      <option value="58mm">58mm (Receipt)</option>
                      <option value="80mm">80mm (Receipt)</option>
                      <option value="100mm">100mm (Receipt)</option>
                      <option value="A4">A4 (Paper)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn secondary" style={{ background: '#fff', color: '#0f172a', border: '1px solid #e6e6e6', boxShadow: 'none' }} onClick={downloadReceipt}>Download</button>
                    <button className="btn" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff' }} onClick={printReceipt}>Preview & Print</button>
                    <button className="btn secondary" style={{ background: '#fff', color: '#0f172a', border: '1px solid #e6e6e6' }} onClick={closeReceipt}>Done</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {printPreviewMarkup && <div className="thermal-preview-overlay" role="dialog" aria-modal="true" aria-label="Thermal receipt print preview">
        <div className="thermal-preview-dialog">
          <div className="thermal-preview-header"><div><strong>Thermal receipt preview</strong><span>80mm standard receipt size</span></div><button className="mobile-cart-close" type="button" onClick={() => setPrintPreviewMarkup(null)} aria-label="Close print preview">×</button></div>
          <div className="thermal-preview-paper" dangerouslySetInnerHTML={{ __html: printPreviewMarkup || '' }} />
          <div className="thermal-preview-actions"><button className="btn secondary" onClick={() => setPrintPreviewMarkup(null)}>Back</button><button className="btn" onClick={printReceiptNow}>Print now</button></div>
        </div>
      </div>}

      {/* Product Form Modal */}
      {showProductForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div className="card modal-card pos-full-product-modal" style={{ width: 'min(92vw, 760px)', maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#1f2937' }}>Add New Product</h2>
            <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Scanned barcode: <strong>{scannedBarcode}</strong></p>

            <div className="pos-full-product-grid">
              <div>
                <div className="product-form-image-box">
                  {formData.image ? <img src={formData.image} alt="Product preview" /> : <label>🖼️<span>Click to upload image</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setFormData((current) => ({ ...current, image: String(reader.result) })); reader.readAsDataURL(file); }} /></label>}
                </div>
                <div className="field-grid mt-3">
                  <label className="form-field"><span>Branch *</span><select className="input" value={formData.branchId} onChange={(event) => setFormData({ ...formData, branchId: event.target.value })}>{branches.filter((branch) => branch.active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
                  <label className="form-field"><span>Reorder level</span><input className="input" type="number" min={0} value={formData.reorderLevel} onChange={(event) => setFormData({ ...formData, reorderLevel: Number(event.target.value) })} /></label>
                </div>
              </div>
              <div className="field-grid">
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Product Name *</label>
                <input className="input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter product name" />
                <label className="form-field"><span>Category</span>
                <select className="input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                </label>

                <div className="variant-grid"><label className="form-field"><span>Price (Le) *</span><input className="input" type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} min={0} /></label><label className="form-field"><span>Cost (Le)</span><input className="input" type="number" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} min={0} /></label></div>

                <div className="variant-grid"><label className="form-field"><span>Stock quantity</span><input className="input" type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })} min={0} /></label><label className="form-field"><span>Barcode</span><input className="input" value={formData.barcode} readOnly /></label></div>

                <div className="variant-grid"><label className="form-field"><span>Expiry date</span><input className="input" type="date" value={formData.expiry} onChange={(e) => setFormData({ ...formData, expiry: e.target.value })} /></label><label className="form-field"><span>Supplier</span><input className="input" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} /></label></div>
                <label className="form-field"><span>Description</span><textarea className="input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} /></label>
              </div>
            </div>

            <label className="variant-toggle"><input type="checkbox" checked={unknownHasVariants} onChange={(event) => setUnknownHasVariants(event.target.checked)} /> This product has variants</label>
            {unknownHasVariants && <div className="product-variants-panel"><div className="product-variants-header"><strong>Product variants</strong><button type="button" className="btn secondary" onClick={() => setUnknownVariants((current) => [...current, { id: createId('variant'), name: `Variant ${current.length + 1}`, stock: { [formData.branchId]: 0 }, cost: 0, price: 0 }])}>+ Add Variant</button></div>{unknownVariants.map((variant, index) => <div className="variant-editor" key={variant.id}><div className="variant-editor-title"><span>Variant {index + 1}</span><button type="button" onClick={() => setUnknownVariants((current) => current.filter((item) => item.id !== variant.id))}>×</button></div><div className="variant-grid"><label className="form-field"><span>Variant name *</span><input className="input" value={variant.name} onChange={(event) => setUnknownVariants((current) => current.map((item) => item.id === variant.id ? { ...item, name: event.target.value } : item))} /></label><label className="form-field"><span>Size / volume</span><input className="input" value={variant.size || ''} onChange={(event) => setUnknownVariants((current) => current.map((item) => item.id === variant.id ? { ...item, size: event.target.value } : item))} /></label><label className="form-field"><span>Stock</span><input className="input" type="number" value={variant.stock[formData.branchId] || 0} onChange={(event) => setUnknownVariants((current) => current.map((item) => item.id === variant.id ? { ...item, stock: { ...item.stock, [formData.branchId]: Number(event.target.value) } } : item))} /></label><label className="form-field"><span>Cost</span><input className="input" type="number" value={variant.cost} onChange={(event) => setUnknownVariants((current) => current.map((item) => item.id === variant.id ? { ...item, cost: Number(event.target.value) } : item))} /></label><label className="form-field"><span>Selling price</span><input className="input" type="number" value={variant.price} onChange={(event) => setUnknownVariants((current) => current.map((item) => item.id === variant.id ? { ...item, price: Number(event.target.value) } : item))} /></label><label className="form-field"><span>Barcode</span><input className="input" value={variant.barcode || ''} onChange={(event) => setUnknownVariants((current) => current.map((item) => item.id === variant.id ? { ...item, barcode: event.target.value } : item))} /></label></div></div>)}</div>}

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => void handleSaveProduct()} disabled={savingScannedProduct}>{savingScannedProduct ? 'Saving…' : '✓ Save & Add to Cart'}</button>
              <button className="btn secondary" style={{ flex: 1 }} onClick={() => { setShowProductForm(false); setScannedBarcode(''); }}>Cancel</button>
            </div>
          </div>

        </div>
      )}
      {variantProduct && (
        <div className="variant-choice-overlay">
          <div className="card variant-choice-modal">
            <div className="variant-choice-header">
              <div><h2>Select {variantProduct.name} option</h2><p>Choose the exact size, color, or package to sell.</p></div>
              <button aria-label="Close variant choices" onClick={() => setVariantProduct(null)}>×</button>
            </div>
            <div className="variant-choice-list">
              {variantProduct.variants?.map((variant: ProductVariant) => {
                const branchId = operationalBranchId === 'all' ? variantProduct.branchId : operationalBranchId;
                const stock = variant.stock?.[branchId] ?? 0;
                return <button type="button" className="variant-choice" disabled={stock <= 0} key={variant.id} onClick={() => { if (addToCart(variantProduct, variant)) { setVariantProduct(null); toast.success(`✓ Added ${variantProduct.name} - ${variant.name}`); } }}><span><strong>{variant.name}</strong>{variant.size && ` • ${variant.size}`}{variant.color && ` • ${variant.color}`}</span><span>Le {variant.price.toFixed(2)} • {stock} left</span></button>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
