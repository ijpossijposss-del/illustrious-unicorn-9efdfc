import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { removeItem } from '../utils/safeStorage';
import { enqueueSync, flush } from '../sync/outgoingSync';
import { auth, database, publicOrdersPath } from '../sync/firebase';
import { ref, remove } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { DEFAULT_STAFF_PERMISSIONS } from '../auth/credentials';
import { getSaleTimestamp } from '../utils/salesMetrics';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'seller' | 'staff';
  position: string;
  password?: string;
  email?: string;
  phone?: string;
  branchId: string;
  permissions?: string[];
  staffNumber: string;
  active: boolean;
  createdAt: string;
}

export function normalizeUsers(users: User[]) {
  const normalized = new Map<string, User>();
  users.forEach((user) => {
    if (!user || typeof user.id !== 'string' || !user.id) return;
    const { password: _legacyPassword, ...safeUser } = user;
    normalized.set(safeUser.id, safeUser);
  });
  return Array.from(normalized.values());
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  region: string;
  phone: string;
  active: boolean;
  openingHours: string;
  closingHours: string;
  allowExtendedHours: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: Record<string, number>;
  branchId: string;
  active: boolean;
  deleted?: boolean;
  barcode?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageFit?: 'cover' | 'contain' | 'fill';
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  size?: string;
  barcode?: string;
  stock: Record<string, number>;
  cost: number;
  price: number;
  color?: string;
  expiry?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  cost: number;
  quantity: number;
  branchId: string;
  variantId?: string;
  variantName?: string;
}

export interface Sale {
  id: string;
  receiptNo: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  additionalCharge?: number;
  total: number;
  profit: number;
  paymentMethod: string;
  orderType?: string;
  branchId: string;
  sellerId: string;
  sellerName: string;
  staffNumber: string;
  date: string;
  time: string;
  timestamp: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyId?: string;
  active: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  branchId: string;
  date: string;
  category: string;
}

export interface AssetCheckout {
  id: string;
  item: string;
  checkedOutBy: string;
  branchId: string;
  dueDate: string;
  status: 'checked-out' | 'returned';
  notes?: string;
  createdAt: string;
}

export interface RefundRequest {
  id: string;
  saleId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
}

export interface ReturnRequest {
  id: string;
  saleId: string;
  item: string;
  quantity: number;
  reason: string;
  status: 'pending' | 'processed' | 'cancelled';
  requestedAt: string;
  productId?: string;
  branchId?: string;
  processedAt?: string;
}

export interface StockTransfer {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  fromBranchId: string;
  toBranchId: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

export interface CashDrawerSession {
  id: string;
  branchId: string;
  userId: string;
  userName: string;
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
}

export interface MobileOrder {
  id: string;
  customerName: string;
  phone: string;
  items: CartItem[];
  total: number;
  branchId: string;
  status: 'new' | 'accepted' | 'ready' | 'completed' | 'cancelled';
  createdAt: string;
  note?: string;
}

export interface PaymentTerminalState {
  connected: boolean;
  provider: string;
  lastStatus: 'idle' | 'waiting' | 'approved' | 'declined';
  lastAmount?: number;
  updatedAt?: string;
}

export interface ReceiptSettings {
  storeName?: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
  includeLogo?: boolean;
  footerMessage?: string;
  showTaxLine?: boolean;
}

export interface PrinterSettings {
  printerName: string;
  paperSize: '58mm' | '80mm' | '100mm' | 'A4';
  dpi: number;
  showDateTime: boolean;
}

interface StoreState {
  currentUser: User | null;
  products: Product[];
  customers: Customer[];
  users: User[];
  branches: Branch[];
  categories: string[];
  sales: Sale[];
  expenses: Expense[];
  notifications: any[];
  staffPermissions: Record<string, Record<string, string[]>>;
  selectedBranch: string;
  loading: boolean;
  firebaseSynced: boolean;
  syncStatus: 'offline' | 'syncing' | 'synced' | 'retrying';
  isAuthenticated: boolean;
  rememberMe: boolean;
  favorites: string[];
  lastUpdate: string;
  printerSettings: PrinterSettings;
  receiptSettings: ReceiptSettings;
  assetCheckouts: AssetCheckout[];
  refundRequests: RefundRequest[];
  returnRequests: ReturnRequest[];
  stockTransfers: StockTransfer[];
  cashDrawerSessions: CashDrawerSession[];
  mobileOrders: MobileOrder[];
  paymentTerminal: PaymentTerminalState;
  cart: CartItem[];
  discount: number;
  logout: () => void;
  seedData: () => void;
  reorderCategories: (categories: string[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  restoreProduct: (id: string) => void;
  receiveInventory: (productId: string, branchId: string, quantity: number, cost?: number, price?: number) => void;
  smartUpsertProduct: (product: Product) => void;
  bulkSmartUpsertProducts: (products: Product[]) => void;
  bulkImportProducts: (rows: any[]) => void;
  deduplicateProducts: () => void;
  cleanAllDuplicates: () => void;
  clearAllProducts: () => void;
  nukeAllData: () => void;
  addBranch: (branch: Branch) => void;
  updateBranch: (branch: Branch) => void;
  deleteBranch: (id: string) => void;
  toggleBranchActive: (id: string) => void;
  createStaffAccount: (user: User) => void;
  bulkCreateStaffAccounts: (users: User[]) => void;
  updateStaffAccount: (user: User) => void;
  deleteUser: (id: string) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  addAssetCheckout: (checkout: AssetCheckout) => void;
  returnAsset: (checkoutId: string) => void;
  addRefundRequest: (request: RefundRequest) => void;
  processRefundRequest: (id: string, status: 'approved' | 'denied') => void;
  addReturnRequest: (request: ReturnRequest) => void;
  processReturnRequest: (id: string, status: 'processed' | 'cancelled') => void;
  addStockTransfer: (transfer: StockTransfer) => void;
  processStockTransfer: (id: string, status: 'completed' | 'cancelled') => void;
  openCashDrawer: (session: CashDrawerSession) => void;
  closeCashDrawer: (id: string, closingAmount: number) => void;
  setPaymentTerminal: (terminal: PaymentTerminalState) => void;
  addMobileOrder: (order: MobileOrder) => void;
  updateMobileOrder: (id: string, status: MobileOrder['status']) => void;
  deleteMobileOrder: (id: string) => void;
  setMobileOrders: (orders: MobileOrder[]) => void;
  grantPermission: (userId: string, branchId: string, permission: string) => void;
  revokePermission: (userId: string, branchId: string, permission: string) => void;
  hasPermission: (key: string) => boolean;
  canViewProfit: () => boolean;
  setSelectedBranch: (branchId: string) => void;
  setSyncStatus: (status: StoreState['syncStatus']) => void;
  setProducts: (products: Product[]) => void;
  setCategories: (categories: string[]) => void;
  setBranches: (branches: Branch[]) => void;
  setSales: (sales: Sale[], sync?: boolean) => void;
  recordSale: (sale: Sale) => void;
  applySalesFromRemote: (sales: Sale[]) => void;
  setUsers: (users: User[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setExpenses: (expenses: Expense[]) => void;
  setAssetCheckouts: (checkouts: AssetCheckout[]) => void;
  setRefundRequests: (requests: RefundRequest[]) => void;
  setReturnRequests: (requests: ReturnRequest[]) => void;
  setStaffPermissions: (permissions: Record<string, Record<string, string[]>>) => void;
  setPrinterSettings: (settings: any) => void;
  setReceiptSettings: (settings: any) => void;
  forceRefreshFromFirebase: () => void;
  addToCart: (product: Product, variant?: ProductVariant) => boolean;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateCartQuantity: (productId: string, quantity: number, variantId?: string) => boolean;
  clearCart: () => void;
  setDiscount: (value: number) => void;
  deleteSale: (saleId: string) => void;
  clearRecords: (mode: 'sales' | 'branch' | 'reset', branchId: string, startDate?: string, endDate?: string) => Promise<void>;
}

const defaultBranch: Branch = {
  id: 'b1',
  name: 'Main Branch',
  location: 'Freetown',
  region: 'Western Area',
  phone: '+232-xx-xxxx',
  active: true,
  openingHours: '08:00',
  closingHours: '20:00',
  allowExtendedHours: false,
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      products: [],
      customers: [],
      users: [],
      branches: [defaultBranch],
      categories: ['General'],
      sales: [],
      expenses: [],
      notifications: [],
      staffPermissions: {},
      selectedBranch: 'b1',
      loading: false,
      firebaseSynced: false,
      syncStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'syncing' : 'offline',
      isAuthenticated: false,
      rememberMe: false,
      favorites: [],
      lastUpdate: new Date().toISOString(),
      printerSettings: { printerName: 'System Default Printer', paperSize: '80mm', dpi: 203, showDateTime: true },
      receiptSettings: {
        storeName: defaultBranch.name,
        address: defaultBranch.location,
        phone: defaultBranch.phone,
        vatNumber: '87576746747655',
        includeLogo: true,
        footerMessage: 'Thank you for shopping with us',
        showTaxLine: true,
      },
      assetCheckouts: [],
      refundRequests: [],
      returnRequests: [],
      stockTransfers: [],
      cashDrawerSessions: [],
      mobileOrders: [],
      paymentTerminal: { connected: false, provider: 'Demo Terminal', lastStatus: 'idle' },
      cart: [],
      discount: 0,

      logout: () => {
        void signOut(auth).catch((error: unknown) => console.error('Firebase sign-out failed.', error));
        set({ currentUser: null, isAuthenticated: false, rememberMe: false, cart: [] });
        removeItem('local', 'jann-pos-auth-user');
        removeItem('local', 'jann-pos-authenticated');
        removeItem('local', 'jann-pos-selected-branch');
        removeItem('local', 'jann-pos-remember');
        removeItem('local', 'jann-pos-username');
      },

      seedData: () => {
        removeItem('local', 'jann-pos-auth-user');
        removeItem('local', 'jann-pos-authenticated');
        const usersList = normalizeUsers(get().users || []);

        const existingBranches = get().branches?.length ? get().branches : [defaultBranch];
        const existingCategories = get().categories?.length ? get().categories : ['General'];
        const existingProducts = get().products || [];
        set({ users: usersList, branches: existingBranches, categories: existingCategories, products: existingProducts, currentUser: null, isAuthenticated: false });
        // ensure existing users have permission entries
        const defaultPermissions = [
          'create-receipt','edit-receipt','print-receipt','edit-receipt-content','edit-receipt-text',
          'add-products','edit-products','upload-images','view-products','bulk-import',
          'record-stock','view-customers','add-customers','generate-reports','view-eod','view-profit',
          'use-voice-ai','view-settings','manage-staff','clear-records'
        ];
        const nextPermissions: Record<string, Record<string, string[]>> = { ...get().staffPermissions };
        usersList.forEach((u) => {
          const baseline = u.role === 'admin' ? defaultPermissions : DEFAULT_STAFF_PERMISSIONS;
          if (!nextPermissions[u.id]) nextPermissions[u.id] = { [u.branchId]: baseline };
          else if (!nextPermissions[u.id][u.branchId]) nextPermissions[u.id][u.branchId] = baseline;
        });
        set({ staffPermissions: nextPermissions });
      },

      reorderCategories: (categories) => set({ categories: Array.from(new Set(categories.filter(Boolean))) }),

      addProduct: (product) => set((state) => {
        const next = { products: [...state.products.filter((item) => item.id !== product.id), product] };
        try { enqueueSync('addProduct', product); } catch {}
        return next;
      }),
      updateProduct: (product) => set((state) => {
        const next = { products: state.products.map((item) => (item.id === product.id ? product : item)) };
        try { enqueueSync('updateProduct', product); } catch {}
        return next;
      }),
      deleteProduct: (id) => set((state) => {
        const next = { products: state.products.map((item) => (item.id === id ? { ...item, deleted: true, active: false } : item)) };
        try { enqueueSync('deleteProduct', { id }); } catch {}
        return next;
      }),
      restoreProduct: (id) => set((state) => {
        const next = { products: state.products.map((item) => (item.id === id ? { ...item, deleted: false, active: true } : item)) };
        try { enqueueSync('restoreProduct', { id }); } catch {}
        return next;
      }),
      receiveInventory: (productId, branchId, quantity, cost, price) => set((state) => {
        const next = { products: state.products.map((product) => product.id === productId ? {
          ...product,
          stock: { ...product.stock, [branchId]: (product.stock[branchId] || 0) + quantity },
          ...(typeof cost === 'number' && cost >= 0 ? { cost } : {}),
          ...(typeof price === 'number' && price >= 0 ? { price } : {}),
        } : product) };
        try { enqueueSync('receiveInventory', { productId, branchId, quantity, cost, price }); } catch {}
        return next;
      }),
      smartUpsertProduct: (product) => set((state) => ({ products: [...state.products.filter((item) => item.id !== product.id), product] })),
      bulkSmartUpsertProducts: (products) => {
        if (products.length > 900) return;
        set((state) => {
          const incoming = products.map((product) => {
            const local = state.products.find((item) => item.id === product.id);
            return local?.deleted ? local : product;
          });
          return { products: [...state.products.filter((item) => !products.some((p) => p.id === item.id)), ...incoming] };
        });
        try { enqueueSync('bulkImportProducts', products); } catch {}
      },
      bulkImportProducts: (products) => {
        if (products.length > 900) return;
        get().bulkSmartUpsertProducts(products as Product[]);
      },
      deduplicateProducts: () => set((state) => ({ products: state.products.filter((product, index, arr) => arr.findIndex((item) => item.id === product.id) === index) })),
      cleanAllDuplicates: () => get().deduplicateProducts(),
      clearAllProducts: () => set({ products: [] }),
      nukeAllData: () => set({ products: [], customers: [], users: [], branches: [], categories: [], sales: [], expenses: [], notifications: [], assetCheckouts: [], refundRequests: [], returnRequests: [], stockTransfers: [], cashDrawerSessions: [], mobileOrders: [], paymentTerminal: { connected: false, provider: 'Demo Terminal', lastStatus: 'idle' }, staffPermissions: {}, currentUser: null, isAuthenticated: false }),
      addBranch: (branch) => set((state) => {
        const next = { branches: [...state.branches.filter((item) => item.id !== branch.id), branch] };
        try { enqueueSync('addBranch', branch); } catch {}
        return next;
      }),
      updateBranch: (branch) => set((state) => {
        const next = { branches: state.branches.map((item) => (item.id === branch.id ? branch : item)) };
        try { enqueueSync('updateBranch', branch); } catch {}
        return next;
      }),
      deleteBranch: (id) => set((state) => {
        const next = { branches: state.branches.filter((item) => item.id !== id) };
        try { enqueueSync('deleteBranch', { id }); } catch {}
        return next;
      }),
      toggleBranchActive: (id) => set((state) => {
        const next = { branches: state.branches.map((item) => item.id === id ? { ...item, active: !item.active } : item) };
        try { enqueueSync('toggleBranchActive', { id }); } catch {}
        return next;
      }),
      createStaffAccount: (user) => set((state) => {
        const newUser = { ...user };
        const nextUsers = normalizeUsers([...state.users, newUser]);
        const nextPermissions = { ...state.staffPermissions };
        if (!nextPermissions[newUser.id]?.[newUser.branchId]) {
          nextPermissions[newUser.id] = { ...(nextPermissions[newUser.id] || {}), [newUser.branchId]: DEFAULT_STAFF_PERMISSIONS };
        }
        try { enqueueSync('createStaffAccount', newUser); } catch {}
        return { users: nextUsers, staffPermissions: nextPermissions };
      }),
      bulkCreateStaffAccounts: (users) => set((state) => {
        const toAdd = users.map((user) => ({ ...user }));
        const merged = [...state.users.filter((item) => !users.some((newUser) => newUser.id === item.id)), ...toAdd];
        const nextPermissions = { ...state.staffPermissions };
        toAdd.forEach((u) => {
          if (!nextPermissions[u.id]?.[u.branchId]) {
            nextPermissions[u.id] = { ...(nextPermissions[u.id] || {}), [u.branchId]: DEFAULT_STAFF_PERMISSIONS };
          }
        });
        try { enqueueSync('bulkCreateStaffAccounts', toAdd); } catch {}
        return { users: merged, staffPermissions: nextPermissions };
      }),
      updateStaffAccount: (user) => set((state) => ({ users: state.users.map((item) => (item.id === user.id ? user : item)), ...(state.currentUser?.id === user.id && !user.active ? { currentUser: null, isAuthenticated: false } : {}) })),
      deleteUser: (id) => {
        try { enqueueSync('deleteUser', { id }); } catch {}
        return set((state) => ({ users: state.users.filter((item) => item.id !== id), ...(state.currentUser?.id === id ? { currentUser: null, isAuthenticated: false } : {}) }));
      },
      addCustomer: (customer) => set((state) => {
        const next = { customers: [...state.customers.filter((item) => item.id !== customer.id), customer] };
        try { enqueueSync('addCustomer', customer); } catch {}
        return next;
      }),
      updateCustomer: (customer) => set((state) => {
        const next = { customers: state.customers.map((item) => (item.id === customer.id ? customer : item)) };
        try { enqueueSync('updateCustomer', customer); } catch {}
        return next;
      }),
      deleteCustomer: (id) => set((state) => {
        const next = { customers: state.customers.filter((item) => item.id !== id) };
        try { enqueueSync('deleteCustomer', { id }); } catch {}
        return next;
      }),
      addExpense: (expense) => set((state) => {
        const next = { expenses: [...state.expenses.filter((item) => item.id !== expense.id), expense] };
        try { enqueueSync('addExpense', expense); } catch {}
        return next;
      }),
      updateExpense: (expense) => set((state) => {
        const next = { expenses: state.expenses.map((item) => (item.id === expense.id ? expense : item)) };
        try { enqueueSync('updateExpense', expense); } catch {}
        return next;
      }),
      deleteExpense: (id) => set((state) => {
        const next = { expenses: state.expenses.filter((item) => item.id !== id) };
        try { enqueueSync('deleteExpense', { id }); } catch {}
        return next;
      }),
      addAssetCheckout: (checkout) => set((state) => ({ assetCheckouts: [...state.assetCheckouts, checkout] })),
      returnAsset: (checkoutId) => set((state) => ({ assetCheckouts: state.assetCheckouts.map((item) => (item.id === checkoutId ? { ...item, status: 'returned' } : item)) })),
      addRefundRequest: (request) => set((state) => ({ refundRequests: [...state.refundRequests, request] })),
      processRefundRequest: (id, status) => set((state) => ({ refundRequests: state.refundRequests.map((item) => (item.id === id ? { ...item, status } : item)) })),
      addReturnRequest: (request) => set((state) => ({ returnRequests: [...state.returnRequests, request] })),
      processReturnRequest: (id, status) => set((state) => {
        const request = state.returnRequests.find((item) => item.id === id);
        if (!request || request.status !== 'pending' || status !== 'processed') return { returnRequests: state.returnRequests.map((item) => (item.id === id ? { ...item, status } : item)) };
        const sale = state.sales.find((item) => item.id === request.saleId);
        const saleItem = sale?.items.find((item) => item.productId === request.productId || item.name === request.item);
        if (!saleItem) return { returnRequests: state.returnRequests.map((item) => (item.id === id ? { ...item, status } : item)) };
        const branchId = request.branchId || sale?.branchId || state.selectedBranch;
        const products = state.products.map((product) => product.id === saleItem.productId ? { ...product, stock: { ...product.stock, [branchId]: (product.stock[branchId] || 0) + Math.min(request.quantity, saleItem.quantity) } } : product);
        return { products, returnRequests: state.returnRequests.map((item) => (item.id === id ? { ...item, status, processedAt: new Date().toISOString() } : item)) };
      }),
      addStockTransfer: (transfer) => set((state) => ({ stockTransfers: [...state.stockTransfers, transfer] })),
      processStockTransfer: (id, status) => set((state) => {
        const transfer = state.stockTransfers.find((item) => item.id === id);
        if (!transfer || transfer.status !== 'pending') return {};
        if (status !== 'completed') return { stockTransfers: state.stockTransfers.map((item) => item.id === id ? { ...item, status } : item) };
        const products = state.products.map((product) => {
          if (product.id !== transfer.productId) return product;
          const from = product.stock[transfer.fromBranchId] || 0;
          return { ...product, stock: { ...product.stock, [transfer.fromBranchId]: Math.max(0, from - transfer.quantity), [transfer.toBranchId]: (product.stock[transfer.toBranchId] || 0) + transfer.quantity } };
        });
        return { products, stockTransfers: state.stockTransfers.map((item) => item.id === id ? { ...item, status, completedAt: new Date().toISOString() } : item) };
      }),
      openCashDrawer: (session) => set((state) => ({ cashDrawerSessions: [...state.cashDrawerSessions, session] })),
      closeCashDrawer: (id, closingAmount) => set((state) => ({ cashDrawerSessions: state.cashDrawerSessions.map((item) => item.id === id ? { ...item, closingAmount, status: 'closed', closedAt: new Date().toISOString() } : item) })),
      setPaymentTerminal: (paymentTerminal) => set({ paymentTerminal }),
      addMobileOrder: (order) => {
        try { enqueueSync('addMobileOrder', order); } catch {}
        return set((state) => ({ mobileOrders: [...state.mobileOrders.filter((item) => item.id !== order.id), order] }));
      },
      updateMobileOrder: (id, status) => {
        try { enqueueSync('updateMobileOrder', { id, status }); } catch {}
        return set((state) => ({ mobileOrders: state.mobileOrders.map((item) => item.id === id ? { ...item, status } : item) }));
      },
      deleteMobileOrder: (id) => {
        try { enqueueSync('deleteMobileOrder', { id }); } catch {}
        return set((state) => ({ mobileOrders: state.mobileOrders.filter((item) => item.id !== id) }));
      },
      setMobileOrders: (mobileOrders) => set({ mobileOrders }),
      grantPermission: (userId, branchId, permission) => set((state) => ({ staffPermissions: { ...state.staffPermissions, [userId]: { ...(state.staffPermissions[userId] || {}), [branchId]: Array.from(new Set([...(state.staffPermissions[userId]?.[branchId] || []), permission])) } } })),
      revokePermission: (userId, branchId, permission) => set((state) => ({ staffPermissions: { ...state.staffPermissions, [userId]: { ...(state.staffPermissions[userId] || {}), [branchId]: (state.staffPermissions[userId]?.[branchId] || []).filter((item) => item !== permission) } } })),
      hasPermission: (key) => {
        const user = get().currentUser;
        if (!user) return false;
        if (user.role === 'admin') return true;
        const branchId = user.branchId;
        const storedPermissions = get().staffPermissions[user.id]?.[branchId] || [];
        return storedPermissions.includes(key);
      },
      canViewProfit: () => get().hasPermission('view-profit'),
      setSelectedBranch: (branchId) => set((state) => ({
        selectedBranch: state.currentUser && state.currentUser.role !== 'admin'
          ? state.currentUser.branchId
          : branchId,
      })),
      setSyncStatus: (syncStatus) => set({ syncStatus, firebaseSynced: syncStatus === 'synced' }),
      setProducts: (products) => set({ products }),
      setCategories: (categories) => set({ categories }),
      setBranches: (branches) => set({ branches }),
      setSales: (sales, sync = true) => {
        const uniqueSales = Array.from(new Map(sales.map((sale) => [sale.id, sale])).values());
        if (sync) {
          try { enqueueSync('setSales', uniqueSales); } catch {}
        }
        return set({ sales: uniqueSales });
      },
      recordSale: (sale) => {
        const nextSales = Array.from(new Map([...get().sales, sale].map((item) => [item.id, item])).values());
        try { enqueueSync('setSales', nextSales); } catch {}
        set({ sales: nextSales });
      },
      applySalesFromRemote: (sales) => {
        const uniqueSales = Array.from(new Map(sales.map((sale) => [sale.id, sale])).values());
        return set({ sales: uniqueSales });
      },
      deleteSale: (saleId) => set((state) => {
        const sale = state.sales.find((s) => s.id === saleId);
        if (!sale) return {};

        const nextProducts = state.products.map((product) => {
          const items = sale.items.filter((item) => item.productId === product.id);
          if (!items.length) return product;
          const stock = { ...product.stock };
          const variants = product.variants?.map((variant) => {
            const variantQuantity = items
              .filter((item) => item.variantId === variant.id)
              .reduce((sum, item) => sum + item.quantity, 0);
            if (!variantQuantity) return variant;
            const branchId = items.find((item) => item.variantId === variant.id)?.branchId || sale.branchId;
            return { ...variant, stock: { ...variant.stock, [branchId]: (variant.stock?.[branchId] || 0) + variantQuantity } };
          });
          items.filter((item) => !item.variantId).forEach((item) => {
            const branchId = item.branchId || sale.branchId;
            stock[branchId] = (stock[branchId] || 0) + item.quantity;
          });
          return { ...product, stock, variants };
        });

        const nextSales = state.sales.filter((s) => s.id !== saleId);
        try { enqueueSync('deleteSale', { saleId }); } catch {}
        return { products: nextProducts, sales: nextSales };
      }),
      clearRecords: async (mode, branchId, startDate, endDate) => {
        const state = get();
        if (state.currentUser?.role !== 'admin') throw new Error('Only an admin can clear system records.');

        const matchesDate = (timestamp: number) => {
          if (!timestamp) return false;
          const date = new Date(timestamp);
          if (startDate && date < new Date(`${startDate}T00:00:00`)) return false;
          if (endDate && date > new Date(`${endDate}T23:59:59.999`)) return false;
          return true;
        };
        const matchesBranch = (value: string | undefined) => branchId === 'all' || value === branchId;
        const isAllBranches = mode === 'reset' || (mode === 'branch' && branchId === 'all');
        const removedSaleIds = new Set(state.sales
          .filter((sale) => matchesBranch(sale.branchId) && (mode === 'branch' || (mode === 'sales' && (!startDate && !endDate || matchesDate(getSaleTimestamp(sale))))))
          .map((sale) => sale.id));
        if (mode !== 'sales') {
          const removedOrders = state.mobileOrders.filter((order) => isAllBranches || order.branchId === branchId);
          await Promise.all(removedOrders.map((order) => remove(ref(database, `${publicOrdersPath}/${order.branchId}/${order.id}`))));
        }

        if (mode === 'sales') {
          set({
            sales: state.sales.filter((sale) => !removedSaleIds.has(sale.id)),
            refundRequests: state.refundRequests.filter((request) => !removedSaleIds.has(request.saleId)),
            returnRequests: state.returnRequests.filter((request) => !removedSaleIds.has(request.saleId)),
            lastUpdate: new Date().toISOString(),
          });
        } else if (mode === 'reset' || isAllBranches) {
          const adminUsers = state.users.filter((user) => user.role === 'admin');
          const adminUserIds = new Set(adminUsers.map((user) => user.id));
          const staffPermissions = Object.fromEntries(
            Object.entries(state.staffPermissions).filter(([userId]) => adminUserIds.has(userId)),
          );
          set({
            products: [],
            customers: [],
            users: adminUsers,
            branches: [defaultBranch],
            categories: ['General'],
            sales: [],
            expenses: [],
            notifications: [],
            staffPermissions,
            assetCheckouts: [],
            refundRequests: [],
            returnRequests: [],
            stockTransfers: [],
            cashDrawerSessions: [],
            mobileOrders: [],
            paymentTerminal: { connected: false, provider: 'Demo Terminal', lastStatus: 'idle' },
            selectedBranch: defaultBranch.id,
            cart: [],
            discount: 0,
            lastUpdate: new Date().toISOString(),
          });
        } else {
          const remainingUsers = state.users.filter((user) => user.role === 'admin' || user.branchId !== branchId);
          const remainingUserIds = new Set(remainingUsers.map((user) => user.id));
          const remainingBranches = state.branches.filter((branch) => branch.id !== branchId);
          const nextBranches = remainingBranches.length ? remainingBranches : [defaultBranch];
          const products = state.products.flatMap((product) => {
            const stock = { ...product.stock };
            delete stock[branchId];
            const remainingStockBranches = Object.keys(stock);
            if (product.branchId === branchId && !remainingStockBranches.length) return [];
            return [{
              ...product,
              ...(product.branchId === branchId ? { branchId: remainingStockBranches[0] || nextBranches[0].id } : {}),
              stock,
              variants: product.variants?.map((variant) => {
                const variantStock = { ...variant.stock };
                delete variantStock[branchId];
                return { ...variant, stock: variantStock };
              }),
            }];
          });
          set({
            branches: nextBranches,
            products,
            users: remainingUsers,
            staffPermissions: Object.fromEntries(Object.entries(state.staffPermissions).filter(([userId]) => remainingUserIds.has(userId))),
            sales: state.sales.filter((sale) => !matchesBranch(sale.branchId)),
            expenses: state.expenses.filter((expense) => !matchesBranch(expense.branchId)),
            assetCheckouts: state.assetCheckouts.filter((checkout) => !matchesBranch(checkout.branchId)),
            refundRequests: state.refundRequests.filter((request) => !removedSaleIds.has(request.saleId)),
            returnRequests: state.returnRequests.filter((request) => !removedSaleIds.has(request.saleId)),
            stockTransfers: state.stockTransfers.filter((transfer) => !matchesBranch(transfer.fromBranchId) && !matchesBranch(transfer.toBranchId)),
            cashDrawerSessions: state.cashDrawerSessions.filter((session) => !matchesBranch(session.branchId)),
            mobileOrders: state.mobileOrders.filter((order) => !matchesBranch(order.branchId)),
            selectedBranch: state.selectedBranch === branchId ? nextBranches[0].id : state.selectedBranch,
            lastUpdate: new Date().toISOString(),
          });
        }

        await flush();
        if (get().syncStatus !== 'synced') throw new Error('The records were cleared on this device, but Firebase could not confirm the changes. Check the connection and retry.');
      },
      setUsers: (users) => set({ users: normalizeUsers(users) }),
      setCustomers: (customers) => set({ customers }),
      setExpenses: (expenses) => set({ expenses }),
      setAssetCheckouts: (assetCheckouts) => set({ assetCheckouts }),
      setRefundRequests: (refundRequests) => set({ refundRequests }),
      setReturnRequests: (returnRequests) => set({ returnRequests }),
      setStaffPermissions: (staffPermissions) => set({ staffPermissions }),
      setPrinterSettings: (printerSettings) => set((state) => ({ printerSettings: { ...state.printerSettings, ...printerSettings } })),
      setReceiptSettings: (receiptSettings) => set({ receiptSettings }),
      forceRefreshFromFirebase: () => undefined,
      addToCart: (product, variant) => {
        let added = false;
        set((state) => {
          const branchId = state.selectedBranch === 'all' ? product.branchId : state.selectedBranch || product.branchId;
          if (state.selectedBranch === 'all' && state.cart.some((item) => item.branchId !== branchId)) return {};
          const stock = variant?.stock?.[branchId] ?? product.stock?.[branchId] ?? product.stock?.[product.branchId] ?? 0;
          const existing = state.cart.find((item) => item.productId === product.id && item.variantId === variant?.id);
          const currentQty = existing?.quantity ?? 0;
          if (stock <= 0 || currentQty >= stock) return {};

          added = true;
          if (existing) {
            return { cart: state.cart.map((item) => item.productId === product.id && item.variantId === variant?.id ? { ...item, quantity: item.quantity + 1 } : item) };
          }
          return { cart: [...state.cart, { productId: product.id, name: product.name, price: variant?.price ?? product.price, cost: variant?.cost ?? product.cost, quantity: 1, branchId, variantId: variant?.id, variantName: variant?.name }] };
        });
        return added;
      },
      removeFromCart: (productId, variantId) => set((state) => ({ cart: state.cart.filter((item) => !(item.productId === productId && item.variantId === variantId)) })),
      updateCartQuantity: (productId, quantity, variantId) => {
        let updated = false;
        set((state) => {
          const product = state.products.find((item) => item.id === productId);
          if (!product) return {};

          const branchId = state.selectedBranch === 'all' ? product.branchId : state.selectedBranch || product.branchId;
          const existing = state.cart.find((item) => item.productId === productId && item.variantId === variantId);
          if (!existing) return {};

          const variant = product.variants?.find((item) => item.id === variantId);
          const stock = variant?.stock?.[branchId] ?? product.stock?.[branchId] ?? product.stock?.[product.branchId] ?? 0;

          if (quantity <= 0) {
            updated = true;
            return { cart: state.cart.filter((item) => !(item.productId === productId && item.variantId === variantId)) };
          }

          if (stock <= 0) return {};

          const nextQty = Math.min(quantity, stock);
          if (nextQty === existing.quantity) return {};

          updated = true;
          return { cart: state.cart.map((item) => item.productId === productId && item.variantId === variantId ? { ...item, quantity: nextQty } : item) };
        });
        return updated;
      },
      clearCart: () => set({ cart: [] }),
      setDiscount: (value) => set({ discount: Number.isFinite(value) ? Math.max(0, value) : 0 }),
    }),
    {
      name: 'jann-pos-store',
      partialize: (state) => ({
        currentUser: state.currentUser,
        users: state.users,
        products: state.products,
        branches: state.branches,
        categories: state.categories,
        sales: state.sales,
        customers: state.customers,
        expenses: state.expenses,
        assetCheckouts: state.assetCheckouts,
        refundRequests: state.refundRequests,
        returnRequests: state.returnRequests,
        stockTransfers: state.stockTransfers,
        cashDrawerSessions: state.cashDrawerSessions,
        mobileOrders: state.mobileOrders,
        paymentTerminal: state.paymentTerminal,
        printerSettings: state.printerSettings,
        receiptSettings: state.receiptSettings,
        staffPermissions: state.staffPermissions,
        selectedBranch: state.selectedBranch,
        isAuthenticated: state.isAuthenticated,
        rememberMe: true,
        cart: state.cart,
        discount: state.discount,
      }),
    },
  ),
);

useStore.getState().seedData();
