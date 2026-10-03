/**
 * StockForge - Offline Desktop Inventory & Sales Management
 * React + TypeScript + SQLite WASM + Tailwind CSS
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getDatabase, subscribeToDbChanges } from './lib/db/sqliteEngine.ts';
import { getSettings } from './lib/services/settingsService.ts';
import { queryOne } from './lib/db/sqliteEngine.ts';
import { Product, AppSettings } from './types/index.ts';
import { ToastProvider } from './context/ToastContext.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { DashboardView } from './components/views/DashboardView.tsx';
import { ProductsView } from './components/views/ProductsView.tsx';
import { SalesView } from './components/views/SalesView.tsx';
import { InventoryView } from './components/views/InventoryView.tsx';
import { SalesHistoryView } from './components/views/SalesHistoryView.tsx';
import { ExpensesView } from './components/views/ExpensesView.tsx';
import { StaffView } from './components/views/StaffView.tsx';
import { PayrollView } from './components/views/PayrollView.tsx';
import { AnalyticsView } from './components/views/AnalyticsView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { HardDrive, Loader2 } from 'lucide-react';
import { useGlobalShortcuts } from './lib/hooks/useGlobalShortcuts.ts';
import { ShortcutsHelpModal } from './components/common/ShortcutsHelpModal.tsx';
import { CommandPaletteModal } from './components/common/CommandPaletteModal.tsx';
import { useTheme } from './context/ThemeContext.tsx';
import { useLanguage } from './context/LanguageContext.tsx';
import { useAuth } from './context/AuthContext.tsx';
import { AuthView } from './components/auth/AuthView.tsx';

export default function App() {
  const { toggleTheme } = useTheme();
  const { toggleLanguage, language } = useLanguage();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Derive active tab from URL path
  const currentTab: NavTab = useMemo(() => {
    const path = location.pathname.replace(/^\//, '').split('/')[0];
    const validTabs: NavTab[] = [
      'dashboard',
      'products',
      'sales',
      'inventory',
      'history',
      'expenses',
      'staff',
      'payroll',
      'analytics',
      'settings',
    ];
    return validTabs.includes(path as NavTab) ? (path as NavTab) : 'dashboard';
  }, [location.pathname]);

  const [settings, setSettings] = useState<AppSettings>({
    currency_symbol: 'Rs.',
    low_stock_threshold: 10,
    allow_negative_stock: false,
  });

  // Automatically adapt Rs. <-> Nepali rupee symbol रु. based on active language
  const effectiveCurrencySymbol = useMemo(() => {
    const raw = (settings.currency_symbol || '').trim();
    if (language === 'np') {
      if (
        !raw ||
        raw === 'Rs.' ||
        raw === 'Rs' ||
        raw.toLowerCase() === 'rs' ||
        raw.toLowerCase() === 'rs.' ||
        raw.toUpperCase() === 'NRS' ||
        raw.toUpperCase() === 'NRS.'
      ) {
        return 'रु.';
      }
    } else {
      if (
        !raw ||
        raw === 'रु.' ||
        raw === 'रु' ||
        raw === 'रू.' ||
        raw === 'रू'
      ) {
        return 'Rs.';
      }
    }
    return raw || (language === 'np' ? 'रु.' : 'Rs.');
  }, [settings.currency_symbol, language]);

  const [lowStockCount, setLowStockCount] = useState(0);

  // Power user modal states
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [initialOpenCreateProduct, setInitialOpenCreateProduct] = useState(false);

  // Cross-view shortcuts
  const [activeRestockProduct, setActiveRestockProduct] = useState<Product | null>(null);
  const [activeAdjustProduct, setActiveAdjustProduct] = useState<Product | null>(null);
  const [activeMovementsProduct, setActiveMovementsProduct] = useState<Product | null>(null);
  const [initialSaleProducts, setInitialSaleProducts] = useState<Array<{ product: Product; quantity?: number }>>([]);

  const handleClearActiveModals = useCallback(() => {
    setActiveRestockProduct(null);
    setActiveAdjustProduct(null);
    setActiveMovementsProduct(null);
  }, []);

  const handleNavigate = useCallback(
    (tab: NavTab) => {
      handleClearActiveModals();
      navigate(`/${tab}`);
    },
    [handleClearActiveModals, navigate]
  );

  const handleStartSaleWithProducts = useCallback(
    (items: Array<{ product: Product; quantity?: number }>) => {
      setInitialSaleProducts(items);
      handleClearActiveModals();
      navigate('/sales');
    },
    [handleClearActiveModals, navigate]
  );
  
  const [toggleSidebar, setToggleSidebar] = useState(false);

  // Wire up global keyboard shortcuts across the app (Ctrl+N, Ctrl+P, Ctrl+D, Ctrl+I, Ctrl+K, ?, etc.)
  useGlobalShortcuts({
    onNavigate: handleNavigate,
    onOpenCommandPalette: () => {
      setIsCommandPaletteOpen((prev) => !prev);
    },
    onOpenShortcutsHelp: () => {
      setIsShortcutsHelpOpen(true);
    },
    onCloseModals: () => {
      setIsCommandPaletteOpen(false);
      setIsShortcutsHelpOpen(false);
      handleClearActiveModals();
    },
    onOpenCreateProduct: () => {
      handleClearActiveModals();
      setInitialOpenCreateProduct(true);
      navigate('/products');
    },
    onToggleTheme: toggleTheme,
    onToggleLanguage: toggleLanguage,
  });

  // Initialize SQLite Database
  useEffect(() => {
    getDatabase()
      .then(() => {
        const s = getSettings();
        setSettings(s);
        setDbReady(true);
      })
      .catch((err) => {
        console.error('Failed to initialize local SQLite database:', err);
        setDbError((err as Error).message || 'SQLite initialization error');
      });
  }, []);

  // Update low stock badge
  const updateLowStockBadge = useCallback(() => {
    if (!dbReady) return;
    try {
      const res = queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM products WHERE current_stock <= ?`,
        [settings.low_stock_threshold]
      );
      setLowStockCount(res?.count ?? 0);
    } catch {
      // Ignore if DB is reloading
    }
  }, [dbReady, settings.low_stock_threshold]);

  useEffect(() => {
    if (dbReady) {
      updateLowStockBadge();
      const unsubscribe = subscribeToDbChanges(() => {
        updateLowStockBadge();
        const s = getSettings();
        setSettings(s);
      });
      return unsubscribe;
    }
  }, [dbReady, updateLowStockBadge]);

  const handleRestockFromAnywhere = (product: Product) => {
    setActiveRestockProduct(product);
    setActiveAdjustProduct(null);
    setActiveMovementsProduct(null);
    navigate('/inventory');
  };

  const handleAdjustFromAnywhere = (product: Product) => {
    setActiveAdjustProduct(product);
    setActiveRestockProduct(null);
    setActiveMovementsProduct(null);
    navigate('/inventory');
  };

  const handleMovementsFromAnywhere = (product: Product) => {
    setActiveMovementsProduct(product);
    setActiveRestockProduct(null);
    setActiveAdjustProduct(null);
    navigate('/inventory');
  };

  if (dbError) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
            <HardDrive className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-neutral-100">Database Initialization Error</h2>
          <p className="text-xs text-neutral-400">{dbError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
          >
            Retry Launch
          </button>
        </div>
      </div>
    );
  }

  if (!dbReady || isAuthLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <div className="text-xs font-mono text-neutral-400">Loading SQLite Offline Engine...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <AuthView onSuccess={() => navigate('/dashboard')} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleNavigate}
          toggleSidebar={toggleSidebar}
          setToggleSidebar={() => setToggleSidebar((prev) => !prev)}
          lowStockCount={lowStockCount}
          onOpenShortcuts={() => setIsShortcutsHelpOpen(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-neutral-950">
          {/* Header */}
          <Header
            currentTab={currentTab}
            currencySymbol={effectiveCurrencySymbol}
            onNewSaleClick={() => handleNavigate('sales')}
            onNewProductClick={() => {
              handleClearActiveModals();
              setInitialOpenCreateProduct(true);
              handleNavigate('products');
            }}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
          />

          {/* Active View Container with React Router Routes */}
          <main className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className="h-full"
              >
                <Routes location={location}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <DashboardView
                    currencySymbol={effectiveCurrencySymbol}
                    onNavigateToTab={handleNavigate}
                    onRestockClick={handleRestockFromAnywhere}
                  />
                }
              />
              <Route
                path="/products"
                element={
                  <ProductsView
                    currencySymbol={effectiveCurrencySymbol}
                    lowStockThreshold={settings.low_stock_threshold}
                    onRestockClick={handleRestockFromAnywhere}
                    onAdjustClick={handleAdjustFromAnywhere}
                    onViewMovements={handleMovementsFromAnywhere}
                    onStartSaleWithProducts={handleStartSaleWithProducts}
                    initialOpenCreate={initialOpenCreateProduct}
                    onClearInitialOpenCreate={() => setInitialOpenCreateProduct(false)}
                  />
                }
              />
              <Route
                path="/sales"
                element={
                  <SalesView
                    currencySymbol={effectiveCurrencySymbol}
                    allowNegativeStock={settings.allow_negative_stock}
                    initialProducts={initialSaleProducts}
                    onClearInitialProducts={() => setInitialSaleProducts([])}
                    onRestockProduct={handleRestockFromAnywhere}
                    onSaleCompleted={() => {
                      updateLowStockBadge();
                    }}
                  />
                }
              />
              <Route
                path="/inventory"
                element={
                  <InventoryView
                    currencySymbol={effectiveCurrencySymbol}
                    lowStockThreshold={settings.low_stock_threshold}
                    allowNegativeStock={settings.allow_negative_stock}
                    activeRestockProduct={activeRestockProduct}
                    activeAdjustProduct={activeAdjustProduct}
                    activeMovementsProduct={activeMovementsProduct}
                    onClearActiveModals={handleClearActiveModals}
                    onEditProduct={() => handleNavigate('products')}
                    onStartSaleWithProducts={handleStartSaleWithProducts}
                  />
                }
              />
              <Route
                path="/history"
                element={<SalesHistoryView currencySymbol={effectiveCurrencySymbol} />}
              />
              <Route
                path="/expenses"
                element={<ExpensesView currencySymbol={effectiveCurrencySymbol} />}
              />
              <Route
                path="/staff"
                element={<StaffView currencySymbol={effectiveCurrencySymbol} />}
              />
              <Route
                path="/payroll"
                element={<PayrollView currencySymbol={effectiveCurrencySymbol} />}
              />
              <Route
                path="/analytics"
                element={<AnalyticsView currencySymbol={effectiveCurrencySymbol} />}
              />
              <Route
                path="/settings"
                element={
                  <SettingsView
                    onSettingsUpdated={(newSettings) => {
                      setSettings(newSettings);
                      updateLowStockBadge();
                    }}
                  />
                }
              />
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
        </div>
      </div>

      {/* Global Shortcuts Cheatsheet Modal */}
      <ShortcutsHelpModal
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onOpenCreateProduct={() => {
          handleClearActiveModals();
          setInitialOpenCreateProduct(true);
          handleNavigate('products');
        }}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
        onStartSaleWithProduct={(product) => {
          handleStartSaleWithProducts([{ product, quantity: 1 }]);
        }}
        currencySymbol={effectiveCurrencySymbol}
      />
    </ToastProvider>
  );
}
