/**
 * StockForge - Offline Desktop Inventory & Sales Management
 * React + TypeScript + SQLite WASM + Tailwind CSS
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getDatabase, subscribeToDbChanges } from "./lib/db/sqliteEngine.ts";
import { getSettings } from "./lib/services/settingsService.ts";
import { getLowStockCount } from "./lib/services/productService.ts";
import { Product, AppSettings } from "./types/index.ts";
import { ToastProvider } from "./context/ToastContext.tsx";
import { Sidebar, NavTab } from "./components/layout/Sidebar.tsx";
import { DEFAULT_APP_SETTINGS } from "./constants/index.ts";
import { Header } from "./components/layout/Header.tsx";
import { DashboardView } from "./views/DashboardView.tsx";
import { SalesView } from "./views/SalesView.tsx";
import { PurchasesView } from "./views/PurchasesView.tsx";
import { PurchaseHistoryView } from "./views/PurchaseHistoryView.tsx";
import { InventoryView } from "./views/InventoryView.tsx";
import { StockMovementsView } from "./views/StockMovementsView.tsx";
import { VendorsView } from "./views/VendorsView.tsx";
import { CustomersView } from "./views/CustomersView.tsx";
import { SalesHistoryView } from "./views/SalesHistoryView.tsx";
import { ExpensesView } from "./views/ExpensesView.tsx";
import { StaffView } from "./views/StaffView.tsx";
import { PayrollView } from "./views/PayrollView.tsx";
import { AnalyticsView } from "./views/AnalyticsView.tsx";
import { SettingsView } from "./views/SettingsView.tsx";
import { BackupRestoreView } from "./views/BackupRestoreView.tsx";
import { TechnicalSupportView } from "./views/TechnicalSupportView.tsx";
import { HardDrive, Loader2 } from "lucide-react";
import { useGlobalShortcuts } from "./lib/hooks/useGlobalShortcuts.ts";
import { ShortcutsHelpModal } from "./components/common/ShortcutsHelpModal.tsx";
import { CommandPaletteModal } from "./components/common/CommandPaletteModal.tsx";
import { useTheme } from "./context/ThemeContext.tsx";
import { useLanguage } from "./context/LanguageContext.tsx";
import { useAuth } from "./context/AuthContext.tsx";
import { AuthView } from "./views/AuthView.tsx";
import { SubscriptionExpiredView } from "./views/SubscriptionExpiredView.tsx";
import { isSubscriptionExpired } from "./lib/services/authService.ts";
import stockforgeLogo from "@/src-tauri/icons/icon.png";

export default function App() {
  const { toggleTheme } = useTheme();
  const { toggleLanguage, language } = useLanguage();
  const { isAuthenticated, isLoading: isAuthLoading, currentShop } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Automatically adapt Rs. <-> Nepali rupee symbol रु. based on active language
  const effectiveCurrencySymbol = useMemo(() => {
    const raw = (settings.currency_symbol || "").trim();
    if (language === "np") {
      if (
        !raw ||
        raw === "Rs." ||
        raw === "Rs" ||
        raw.toLowerCase() === "rs" ||
        raw.toLowerCase() === "rs." ||
        raw.toUpperCase() === "NRS" ||
        raw.toUpperCase() === "NRS."
      ) {
        return "रु.";
      }
    } else {
      if (
        !raw ||
        raw === "रु." ||
        raw === "रु" ||
        raw === "रू." ||
        raw === "रू"
      ) {
        return "Rs.";
      }
    }
    return raw || (language === "np" ? "रु." : "Rs.");
  }, [settings.currency_symbol, language]);

  const [lowStockCount, setLowStockCount] = useState(0);

  // Power user modal states
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [initialOpenCreateProduct, setInitialOpenCreateProduct] =
    useState(false);

  // Cross-view shortcuts
  const [activeRestockProduct, setActiveRestockProduct] =
    useState<Product | null>(null);
  const [activeAdjustProduct, setActiveAdjustProduct] =
    useState<Product | null>(null);
  const [activeMovementsProduct, setActiveMovementsProduct] =
    useState<Product | null>(null);
  const [initialSaleProducts, setInitialSaleProducts] = useState<
    Array<{ product: Product; quantity?: number }>
  >([]);

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
    [handleClearActiveModals, navigate],
  );

  const handleStartSaleWithProducts = useCallback(
    (items: Array<{ product: Product; quantity?: number }>) => {
      setInitialSaleProducts(items);
      handleClearActiveModals();
      navigate("/sales");
    },
    [handleClearActiveModals, navigate],
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
      navigate("/products");
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
        console.error("Failed to initialize local SQLite database:", err);
        setDbError((err as Error).message || "SQLite initialization error");
      });
  }, []);

  // Update low stock badge
  const updateLowStockBadge = useCallback(() => {
    if (!dbReady) return;
    try {
      const count = getLowStockCount(settings.low_stock_threshold);
      setLowStockCount(count);
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
    navigate("/inventory");
  };

  if (dbError) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-neutral-950 border border-rose-500/30 p-2.5 mx-auto flex items-center justify-center">
            <img
              src={stockforgeLogo}
              alt="StockForge"
              className="w-full h-full object-contain grayscale opacity-60"
            />
          </div>
          <h2 className="text-base font-bold text-neutral-100">
            Database Initialization Error
          </h2>
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
      <div className="min-h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30 relative overflow-hidden select-none">
        {/* Subtle background ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center relative z-10 max-w-sm">
          {/* Logo with pulsing halo ring */}
          <div className="relative mb-5">
            <div className="absolute -inset-2.5 bg-emerald-500/20 rounded-3xl blur-md animate-pulse" />
            <div className="w-20 h-20 rounded-2xl bg-neutral-900 border border-neutral-800/80 p-3.5 flex items-center justify-center shadow-2xl relative">
              <img
                src={stockforgeLogo}
                alt="StockForge Logo"
                className="w-full h-full object-contain drop-shadow-md"
              />
            </div>
          </div>

          {/* StockForge Brand Text */}
          <h1 className="text-2xl font-black tracking-tight text-neutral-100">
            StockForge
          </h1>

          {/* Brand Motto */}
          <p className="text-xs text-neutral-400 font-medium mt-1 mb-6 max-w-xs leading-relaxed">
            {language === "np"
              ? "अफलाइन डेस्कटप इन्भेन्टरी तथा बिक्री व्यवस्थापन प्रणाली"
              : "Offline Desktop Inventory & Sales Management"}
          </p>

          {/* Loading status indicator */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-neutral-300 text-xs shadow-xs">
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
            <span className="font-mono text-[11px] text-neutral-400">
              {language === "np"
                ? "SQLite अफलाइन इन्जिन लोड हुँदैछ..."
                : "Loading SQLite Offline Engine..."}
            </span>
          </div>
        </div>

        {/* Bottom subtle metadata */}
        <div className="absolute bottom-6 text-[10px] text-neutral-600 font-mono">
          ACID Safe · Local-First SQLite Database
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <AuthView onSuccess={() => navigate("/dashboard")} />
      </ToastProvider>
    );
  }

  if (isSubscriptionExpired(currentShop)) {
    return (
      <ToastProvider>
        <SubscriptionExpiredView />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
        {/* Left Sidebar */}
        <Sidebar
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
            currencySymbol={effectiveCurrencySymbol}
            onNewSaleClick={() => handleNavigate("sales")}
            onNewProductClick={() => {
              handleClearActiveModals();
              setInitialOpenCreateProduct(true);
              handleNavigate("inventory");
            }}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
          />

          {/* Active View Container with React Router Routes */}
          <main className="flex-1 min-h-0 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="h-full"
              >
                <Routes location={location}>
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />
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
                    element={<Navigate to="/inventory" replace />}
                  />
                  <Route
                    path="/sales"
                    element={
                      <SalesView
                        currencySymbol={effectiveCurrencySymbol}
                        allowNegativeStock={settings.allow_negative_stock}
                        enableVat={settings.enable_vat !== false}
                        initialProducts={initialSaleProducts}
                        onClearInitialProducts={() =>
                          setInitialSaleProducts([])
                        }
                        onRestockProduct={handleRestockFromAnywhere}
                        onSaleCompleted={() => {
                          updateLowStockBadge();
                        }}
                      />
                    }
                  />
                  <Route
                    path="/purchases"
                    element={
                      <PurchasesView
                        currencySymbol={effectiveCurrencySymbol}
                        enableVat={settings.enable_vat !== false}
                        onOpenCreateProduct={() => {
                          handleClearActiveModals();
                          setInitialOpenCreateProduct(true);
                          handleNavigate("inventory");
                        }}
                      />
                    }
                  />
                  <Route
                    path="/purchase-history"
                    element={
                      <PurchaseHistoryView
                        currencySymbol={effectiveCurrencySymbol}
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
                        onStartSaleWithProducts={handleStartSaleWithProducts}
                        initialOpenCreate={initialOpenCreateProduct}
                        onClearInitialOpenCreate={() =>
                          setInitialOpenCreateProduct(false)
                        }
                      />
                    }
                  />
                  <Route
                    path="/movements"
                    element={
                      <StockMovementsView
                        currencySymbol={effectiveCurrencySymbol}
                      />
                    }
                  />
                  <Route
                    path="/vendors"
                    element={
                      <VendorsView
                        currencySymbol={effectiveCurrencySymbol}
                        onNavigateToProducts={() => handleNavigate("inventory")}
                      />
                    }
                  />
                  <Route
                    path="/customers"
                    element={
                      <CustomersView
                        currencySymbol={effectiveCurrencySymbol}
                        onNavigateToSales={() => handleNavigate("sales")}
                      />
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <SalesHistoryView
                        currencySymbol={effectiveCurrencySymbol}
                      />
                    }
                  />
                  <Route
                    path="/expenses"
                    element={
                      <ExpensesView currencySymbol={effectiveCurrencySymbol} />
                    }
                  />
                  <Route
                    path="/staff"
                    element={
                      <StaffView currencySymbol={effectiveCurrencySymbol} />
                    }
                  />
                  <Route
                    path="/payroll"
                    element={
                      <PayrollView currencySymbol={effectiveCurrencySymbol} />
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <AnalyticsView currencySymbol={effectiveCurrencySymbol} />
                    }
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
                  <Route
                    path="/backup"
                    element={
                      <BackupRestoreView
                        onDatabaseRestored={() => {
                          const s = getSettings();
                          setSettings(s);
                          updateLowStockBadge();
                        }}
                      />
                    }
                  />
                  <Route
                    path="/backup-restore"
                    element={<Navigate to="/backup" replace />}
                  />
                  <Route path="/support" element={<TechnicalSupportView />} />
                  <Route
                    path="/technical-support"
                    element={<Navigate to="/support" replace />}
                  />
                  {/* Fallback route */}
                  <Route
                    path="*"
                    element={<Navigate to="/dashboard" replace />}
                  />
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
          handleNavigate("inventory");
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
