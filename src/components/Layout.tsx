import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useStore, type Product } from '../store/useStore';
import { AppIcon, type AppIconName } from './AppIcon';

interface NavItem {
  path: string;
  label: string;
  icon: AppIconName;
  permission?: string;
}

const adminNav: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/pos', label: 'POS', icon: 'receipt' },
  { path: '/products', label: 'Products', icon: 'box' },
  { path: '/inventory-mgmt', label: 'Inventory', icon: 'box' },
  { path: '/categories', label: 'Categories', icon: 'categories' },
  { path: '/branches', label: 'Branches', icon: 'branch' },
  { path: '/staff', label: 'Staff', icon: 'users' },
  { path: '/admin-control', label: 'Admin Control', icon: 'tools' },
  { path: '/leaderboard', label: 'Leaderboard', icon: 'trophy' },
  { path: '/transactions', label: 'Transactions', icon: 'receipt' },
  { path: '/eod', label: 'End of Day', icon: 'moon' },
  { path: '/operations', label: 'Operations', icon: 'activity', permission: 'view-operations' },
  { path: '/customers', label: 'Customers', icon: 'handshake' },
  { path: '/expenses', label: 'Expenses', icon: 'wallet' },
  { path: '/reports', label: 'Reports', icon: 'chart' },
  { path: '/returns', label: 'Returns', icon: 'return' },
  { path: '/asset-checkout', label: 'Asset Checkout', icon: 'briefcase' },
  { path: '/analytics', label: 'Analytics', icon: 'chart' },
  { path: '/ai-analytics', label: 'AI Analytics', icon: 'activity' },
  { path: '/bulk-import', label: 'Bulk Import', icon: 'box' },
  { path: '/fraud-detection', label: 'Fraud Detection', icon: 'shield' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
  { path: '/receipt-settings', label: 'Receipt Settings', icon: 'receipt', permission: 'manage-receipts' },
  { path: '/my-permissions', label: 'My Permissions', icon: 'lock' },
  { path: '/clear-records', label: 'Clear Records', icon: 'broom' },
];

const sellerNav: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', permission: 'view-dashboard' },
  { path: '/pos', label: 'POS', icon: 'receipt', permission: 'use-pos' },
  { path: '/products', label: 'Products', icon: 'box', permission: 'view-products' },
  { path: '/customers', label: 'Customers', icon: 'handshake', permission: 'view-customers' },
  { path: '/transactions', label: 'Transactions', icon: 'receipt', permission: 'view-transactions' },
  { path: '/reports', label: 'Reports', icon: 'chart', permission: 'generate-reports' },
  { path: '/eod', label: 'End of Day', icon: 'moon', permission: 'view-eod' },
  { path: '/returns', label: 'Returns', icon: 'return', permission: 'view-returns' },
  { path: '/my-permissions', label: 'My Permissions', icon: 'lock' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useStore((state) => state.currentUser);
  const branches = useStore((state) => state.branches);
  const selectedBranch = useStore((state) => state.selectedBranch);
  const hasPermission = useStore((state) => state.hasPermission);
  const staffPermissions = useStore((state) => state.staffPermissions);
  const products = useStore((state) => state.products);
  const mobileOrders = useStore((state) => state.mobileOrders);
  const stockTransfers = useStore((state) => state.stockTransfers);
  const setSelectedBranch = useStore((state) => state.setSelectedBranch);
  const logout = useStore((state) => state.logout);
  const syncStatus = useStore((state) => state.syncStatus);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('jann-pos-theme') === 'dark');
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => JSON.parse(localStorage.getItem('jann-pos-read-notifications') || '[]'));

  useEffect(() => {
    localStorage.setItem('jann-pos-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const navItems = currentUser?.role === 'admin' ? adminNav : sellerNav;
  void staffPermissions;
  const activeBranch = branches.find((branch) => branch.id === selectedBranch) || branches[0];
  const activeBranchLabel = currentUser?.role === 'admin' && selectedBranch === 'all' ? 'All Branches' : activeBranch?.name ?? 'Assigned branch';
  const greeting = currentTime.getHours() < 12 ? 'Good morning' : currentTime.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const userInitial = currentUser?.name?.trim()?.[0]?.toUpperCase() || 'U';
  const notificationScope = currentUser?.role === 'admin' ? selectedBranch : currentUser?.branchId;
  const notifications = useMemo(() => {
    const inScope = (branchId: string) => notificationScope === 'all' || branchId === notificationScope;
    const items: Array<{ id: string; title: string; detail: string; path: string; tone: 'warning' | 'info' | 'success' }> = [];
    products.filter((product) => product.active && inScope(product.branchId)).forEach((product) => {
      const stock = product.stock?.[product.branchId] ?? 0;
      const reorderLevel = Number((product as Product & { reorderLevel?: number }).reorderLevel ?? 10);
      if (stock <= reorderLevel) items.push({ id: `stock-${product.id}`, title: `${product.name} needs restock`, detail: `${stock} left • reorder level ${reorderLevel}`, path: '/inventory-mgmt', tone: stock === 0 ? 'warning' : 'info' });
    });
    mobileOrders.filter((order) => inScope(order.branchId) && order.status === 'new').forEach((order) => items.push({ id: `order-${order.id}`, title: 'Incoming customer order', detail: `${order.customerName} • Le ${order.total.toFixed(2)}`, path: '/operations', tone: 'success' }));
    stockTransfers.filter((transfer) => transfer.status === 'pending' && (inScope(transfer.fromBranchId) || inScope(transfer.toBranchId))).forEach((transfer) => items.push({ id: `transfer-${transfer.id}`, title: 'Incoming stock transfer', detail: `${transfer.productName} • ${transfer.quantity} units`, path: '/operations', tone: 'info' }));
    return items.slice(0, 12);
  }, [products, mobileOrders, stockTransfers, notificationScope]);
  const unreadNotifications = notifications.filter((notification) => !readNotificationIds.includes(notification.id));
  const markNotificationRead = (id: string) => {
    setReadNotificationIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      localStorage.setItem('jann-pos-read-notifications', JSON.stringify(next));
      return next;
    });
  };
  const pageTitles: Record<string, string> = {
    '/dashboard': 'Admin Dashboard',
    '/pos': 'Point of Sale',
    '/products': 'Products',
    '/categories': 'Category Manager',
    '/branches': 'Branches',
    '/staff': 'Staff Management',
    '/inventory-mgmt': 'Inventory Management',
    '/customers': 'Customers',
    '/transactions': 'Transactions',
    '/eod': 'End of Day Reconciliation',
    '/operations': 'Operations Center',
    '/returns': 'Returns',
    '/expenses': 'Expenses',
    '/reports': 'Reports',
    '/asset-checkout': 'Asset Checkout Log',
    '/branch-sales-report': 'Branch Sales Report',
    '/branch-transactions': 'Branch Transaction History',
    '/analytics': 'Analytics',
    '/ai-analytics': 'AI Insights',
    '/bulk-import': 'Bulk Product Import',
    '/staff-bulk-import': 'Staff Bulk Import',
    '/admin-control': 'Admin Control Panel',
    '/fraud-detection': 'Fraud Detection',
    '/settings': 'Printer Settings',
    '/receipt-settings': 'Receipt Settings',
    '/my-permissions': 'Staff Permissions',
    '/clear-records': 'Clear Records',
  };
  const pageTitle = location.pathname === '/dashboard' && currentUser?.role !== 'admin'
    ? 'Staff Dashboard'
    : pageTitles[location.pathname] || 'Operations Center';
  const starField = [
    { left: '8%', top: '16%', size: 4, delay: 0 },
    { left: '24%', top: '24%', size: 3, delay: 0.4 },
    { left: '70%', top: '18%', size: 5, delay: 0.9 },
    { left: '82%', top: '28%', size: 3, delay: 1.2 },
    { left: '63%', top: '64%', size: 4, delay: 1.6 },
    { left: '16%', top: '68%', size: 3, delay: 2.1 },
  ];

  return (
    <div className={`app-shell${darkMode ? ' dark-mode' : ''}`}>
      <div className="system-titlebar">
        <div className="system-title"><span className="system-logo">S</span> Super POS Investment</div>
      </div>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">S</div>
            <div><strong>SUPER POS</strong><span>Investment</span></div>
          </div>
          <div className="sidebar-nav">
            {navItems.map((item) => {
              if (item.permission && !hasPermission(item.permission) && currentUser?.role !== 'admin') return null;
              return (
                <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span className="nav-icon"><AppIcon name={item.icon} size={18} /></span>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
          <div className="sidebar-account">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{userInitial}</div>
              <div className="sidebar-user-copy">
                <strong>{currentUser?.name ?? 'Guest'}</strong>
              </div>
            </div>
            <button className="sidebar-logout" aria-label="Logout" title="Logout" onClick={() => { logout(); navigate('/login'); }}>
              <span>↪</span>
              <span>Logout</span>
            </button>
          </div>
        </aside>
        <main className="content-area">
          <header className="workspace-header">
            <button className="workspace-back" aria-label="Go back" onClick={() => navigate(-1)}>‹</button>
            {currentUser?.role === 'admin' ? (
              <label className="workspace-branch-select">
                <span aria-hidden="true">⛽</span>
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} aria-label="Select branch">
                  <option value="all">All Branches</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            ) : (
              <span className="workspace-branch">⛽ <strong>{activeBranch?.name ?? 'Assigned branch'}</strong></span>
            )}
            <span className="workspace-status">{syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'retrying' ? 'Sync retry' : online ? 'Synced' : 'Offline ready'}</span>
            <div className="workspace-actions">
              <button className="theme-toggle" type="button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                {darkMode ? '☀' : '☾'}
              </button>
              <span className={`status-pill ${syncStatus === 'synced' ? 'online' : 'offline'}`}>{syncStatus === 'synced' ? 'SYNCED' : syncStatus === 'syncing' ? 'SYNCING' : syncStatus === 'retrying' ? 'RETRYING' : 'OFFLINE'}</span>
              <div className="notification-menu">
                <button className="workspace-bell" type="button" aria-label={`Open notifications${unreadNotifications.length ? `, ${unreadNotifications.length} unread` : ''}`} onClick={() => setShowNotifications((value) => !value)}>
                  ♧
                  {unreadNotifications.length > 0 && <span className="notification-count">{unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}</span>}
                </button>
                {showNotifications && <div className="notification-panel">
                  <div className="notification-panel-header"><strong>Notifications</strong><span>{unreadNotifications.length} unread</span></div>
                  {unreadNotifications.length === 0 ? <div className="notification-empty">You are all caught up.</div> : unreadNotifications.map((notification) => <button className={`notification-item ${notification.tone}`} type="button" key={notification.id} onClick={() => { markNotificationRead(notification.id); setShowNotifications(false); navigate(notification.path); }}><strong>{notification.title}</strong><span>{notification.detail}</span><small>Open {notification.path === '/operations' ? 'Operations' : 'Inventory'}</small></button>)}
                </div>}
              </div>
              <span className="workspace-avatar">{userInitial}</span>
            </div>
          </header>
          <motion.div className={`content-wrapper${location.pathname === '/dashboard' ? ' dashboard-content' : ' compact-content'}${location.pathname === '/pos' ? ' pos-content-wrapper' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {location.pathname !== '/pos' && <section className={`section-heading-hero${location.pathname === '/dashboard' ? ' dashboard-heading-hero' : ' compact-heading-hero'}`} aria-label={`${pageTitle} heading`}>
              <div className="section-heading-stars" aria-hidden="true">
                {starField.map((star, index) => (
                  <motion.span
                    key={index}
                    className="section-heading-star"
                    initial={{ opacity: 0.2, scale: 0.7 }}
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.2, 0.7] }}
                    transition={{ duration: 2.8 + index * 0.35, repeat: Infinity, delay: star.delay }}
                    style={{ left: star.left, top: star.top, width: star.size, height: star.size }}
                  />
                ))}
              </div>
              <div className="section-heading-copy">
                <div className="section-heading-greeting">✣ {greeting}, {currentUser?.name ?? 'Guest'}</div>
                <h1>{pageTitle}</h1>
                <p>{activeBranchLabel} <span>•</span> {currentUser?.role ?? 'User'}</p>
              </div>
            </section>}
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
