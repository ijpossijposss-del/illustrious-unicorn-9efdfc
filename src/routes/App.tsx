import { Navigate, Route, Routes } from 'react-router-dom';
import { motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuthSync } from '../auth/useAuthSync';
import { useFirebaseAuthSession } from '../auth/firebaseSession';
import { useFirebaseSync } from '../sync/useFirebaseSync';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useStore } from '../store/useStore';
import { getItem } from '../utils/safeStorage';

const LoginPage = lazy(() => import('../auth/LoginPage'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const POSPage = lazy(() => import('../pages/POSPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const InventoryManagement = lazy(() => import('../pages/InventoryManagement'));
const ReceiptView = lazy(() => import('../pages/ReceiptView'));
const CategoryManager = lazy(() => import('../pages/CategoryManager'));
const BranchesManager = lazy(() => import('../pages/BranchesManager'));
const StaffManagement = lazy(() => import('../pages/StaffManagement'));
const AdminControlPanel = lazy(() => import('../pages/AdminControlPanel'));
const StaffLeaderboard = lazy(() => import('../pages/StaffLeaderboard'));
const TransactionHistoryPage = lazy(() => import('../pages/TransactionHistoryPage'));
const EndOfDayReconciliation = lazy(() => import('../pages/EndOfDayReconciliation'));
const CustomersPage = lazy(() => import('../pages/CustomersPage'));
const ExpensesPage = lazy(() => import('../pages/ExpensesPage'));
const ReportGeneratorPage = lazy(() => import('../pages/ReportGeneratorPage'));
const ReturnsPage = lazy(() => import('../pages/ReturnsPage'));
const AssetCheckoutLog = lazy(() => import('../pages/AssetCheckoutLog'));
const BranchSalesReport = lazy(() => import('../pages/BranchSalesReport'));
const BranchTransactionHistory = lazy(() => import('../pages/BranchTransactionHistory'));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage'));
const AIAnalytics = lazy(() => import('../pages/AIAnalytics'));
const BulkProductImportPage = lazy(() => import('../pages/BulkProductImportPage'));
const StaffBulkImportPage = lazy(() => import('../pages/StaffBulkImportPage'));
const FraudDetection = lazy(() => import('../pages/FraudDetection'));
const PrinterSettingsPage = lazy(() => import('../pages/PrinterSettingsPage'));
const ReceiptSettingsPage = lazy(() => import('../pages/ReceiptSettingsPage'));
const StaffPermissionsView = lazy(() => import('../pages/StaffPermissionsView'));
const ClearRecordsPage = lazy(() => import('../pages/ClearRecordsPage'));
const CustomerDisplay = lazy(() => import('../pages/CustomerDisplay'));
const NotFound = lazy(() => import('../pages/NotFound'));
const OperationsCenter = lazy(() => import('../pages/OperationsCenter'));
const MobileOrderPage = lazy(() => import('../pages/MobileOrderPage'));
const DigitalReceiptPage = lazy(() => import('../pages/DigitalReceiptPage'));
import VoiceAssistant from '../components/VoiceAssistant';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [open, setOpen] = useState(false);
  const [manualInstallInstructions, setManualInstallInstructions] = useState('');

  useEffect(() => {
    if (installed || localStorage.getItem('jann-pos-install-dismissed') === 'true') return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const userAgent = navigator.userAgent;
    const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
    let showTimer: number | undefined;
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      showTimer = window.setTimeout(() => setOpen(true), 4500);
    };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos) {
      setManualInstallInstructions(isSafari
        ? 'Tap Share, then choose Add to Home Screen.'
        : 'Open the browser menu and choose Add to Home Screen.');
      showTimer = window.setTimeout(() => setOpen(true), 4500);
    }
    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  if (!open || installed) return null;

  const dismiss = () => {
    localStorage.setItem('jann-pos-install-dismissed', 'true');
    setOpen(false);
  };

  const install = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem('jann-pos-install-dismissed', 'true');
      }
    } finally {
      setInstallEvent(null);
      setOpen(false);
    }
  };

  return (
    <div className="install-overlay" role="dialog" aria-modal="true" aria-labelledby="install-super-pos-title">
      <div className="install-window">
        <button className="install-dismiss" aria-label="Dismiss install prompt" onClick={dismiss}>×</button>
        <div className="install-window-icon" aria-hidden="true">S</div>
        <h2 id="install-super-pos-title">Install Super POS</h2>
        <p>Keep POS, branch operations, and offline access one tap away.</p>
        {manualInstallInstructions ? (
          <div className="install-instructions">
            <strong>Install on this device</strong>
            <span>{manualInstallInstructions}</span>
          </div>
        ) : (
          <button className="btn install-now" type="button" onClick={() => void install()} disabled={!installEvent}>
            Install app
          </button>
        )}
        <button className="btn secondary install-later" type="button" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}

function FirebaseSyncWrapper({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const currentUser = useStore((state) => state.currentUser);
  useAuthSync();
  useFirebaseAuthSession();
  useFirebaseSync();

  useEffect(() => {
    const storedProducts = getItem('local', 'jann-pos-products-cache');
    const hasCachedData = Boolean(storedProducts || currentUser || isAuthenticated);
    const timer = window.setTimeout(() => setReady(true), 300);
    if (hasCachedData) {
      window.setTimeout(() => setReady(true), 150);
    }
    return () => window.clearTimeout(timer);
  }, [currentUser, isAuthenticated]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashDone(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!splashDone || !ready) return <SplashScreen />;

  return <>{children}</>;
}

function SplashScreen() {
  return <div className="app-splash" role="status" aria-label="Loading Super POS Investment">
    <motion.div className="app-splash-content" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="app-splash-mark">S</div>
      <h1>Super POS Investment</h1>
      <div className="app-splash-loader" aria-hidden="true"><span /></div>
      <p>Preparing your workspace</p>
    </motion.div>
  </div>;
}

export default function App() {
  return (
    <>
      <InstallPrompt />
      <FirebaseSyncWrapper>
        <VoiceAssistant />
        <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Loading page...</div>}>
          <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        <Route path="/customer" element={<CustomerDisplay />} />
        <Route path="/order" element={<MobileOrderPage />} />
        <Route path="/digital-receipt/:receiptNo" element={<DigitalReceiptPage />} />
        <Route path="/dashboard" element={<ProtectedRoute permission="view-dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute permission="use-pos"><POSPage /></ProtectedRoute>} />
        <Route path="/operations" element={<ProtectedRoute permission="view-operations"><OperationsCenter /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute permission="view-products"><ProductsPage /></ProtectedRoute>} />
        <Route path="/receipt/:receiptNo" element={<ReceiptView />} />
        <Route path="/inventory-mgmt" element={<ProtectedRoute permission="view-inventory"><InventoryManagement /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute permission="view-products"><CategoryManager /></ProtectedRoute>} />
        <Route path="/branches" element={<ProtectedRoute adminOnly><BranchesManager /></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute adminOnly><StaffManagement /></ProtectedRoute>} />
        <Route path="/admin-control" element={<ProtectedRoute adminOnly><AdminControlPanel /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute permission="view-leaderboard"><StaffLeaderboard /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute permission="view-transactions"><TransactionHistoryPage /></ProtectedRoute>} />
        <Route path="/eod" element={<ProtectedRoute permission="view-eod"><EndOfDayReconciliation /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute permission="view-customers"><CustomersPage /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute permission="view-expenses"><ExpensesPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute permission="generate-reports"><ReportGeneratorPage /></ProtectedRoute>} />
        <Route path="/report-generator" element={<Navigate to="/reports" replace />} />
        <Route path="/returns" element={<ProtectedRoute permission="view-returns"><ReturnsPage /></ProtectedRoute>} />
        <Route path="/asset-checkout" element={<ProtectedRoute permission="view-assets"><AssetCheckoutLog /></ProtectedRoute>} />
        <Route path="/branch-sales-report" element={<ProtectedRoute permission="view-branch-reports"><BranchSalesReport /></ProtectedRoute>} />
        <Route path="/branch-transactions" element={<ProtectedRoute permission="view-branch-transactions"><BranchTransactionHistory /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute permission="view-analytics"><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/ai-analytics" element={<ProtectedRoute permission="use-voice-ai"><AIAnalytics /></ProtectedRoute>} />
        <Route path="/bulk-import" element={<ProtectedRoute adminOnly><BulkProductImportPage /></ProtectedRoute>} />
        <Route path="/staff-bulk-import" element={<ProtectedRoute adminOnly><StaffBulkImportPage /></ProtectedRoute>} />
        <Route path="/fraud-detection" element={<ProtectedRoute adminOnly><FraudDetection /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><PrinterSettingsPage /></ProtectedRoute>} />
        <Route path="/receipt-settings" element={<ProtectedRoute adminOnly><ReceiptSettingsPage /></ProtectedRoute>} />
        <Route path="/my-permissions" element={<ProtectedRoute><StaffPermissionsView /></ProtectedRoute>} />
        <Route path="/clear-records" element={<ProtectedRoute adminOnly><ClearRecordsPage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </FirebaseSyncWrapper>
    </>
  );
}
