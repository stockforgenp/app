/**
 * Top Application Header
 * Follows the 3-zone contract: Breadcrumb trail on left, status & actions on right.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, ShoppingCart, Search, Keyboard, Sun, Moon, Languages, Store, LogOut } from 'lucide-react';
import { NavTab } from './Sidebar.tsx';
import { MODIFIER_LABEL } from '../../lib/hooks/useGlobalShortcuts.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface HeaderProps {
  currentTab: NavTab;
  onNewSaleClick: () => void;
  onNewProductClick: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutsHelp?: () => void;
  currencySymbol?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNewSaleClick,
  onNewProductClick,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  currencySymbol: propCurrency,
}) => {
  const { toggleTheme, isDark } = useTheme();
  const { t, language, toggleLanguage, isNepali, currencySymbol: ctxCurrency } = useLanguage();
  const { currentShop, logout } = useAuth();
  const currencySymbol = propCurrency || ctxCurrency || (isNepali ? 'रु.' : 'Rs.');

  const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: t('nav_dashboard'),
      subtitle: isNepali ? 'कार्यकारी सारांश र मुख्य वित्तीय सूचकहरू' : 'Executive overview & key metrics',
    },
    products: {
      title: t('nav_products'),
      subtitle: isNepali ? 'सामानको विवरण, मूल्य र मौज्दात व्यवस्थापन' : 'Manage product catalog and default pricing',
    },
    sales: {
      title: t('nav_sales'),
      subtitle: isNepali ? 'अनुकूलित मूल्य र छुट सहित नयाँ बिक्री बिलिङ' : 'Process multi-item transaction with custom pricing',
    },
    purchases: {
      title: t('nav_purchases', 'Purchases'),
      subtitle: isNepali ? 'आपूर्तिकर्ताबाट बहु-वस्तु खरिद दाखिला, बिलिङ र मौज्दात वृद्धि' : 'Multi-item goods received, supplier billing, and stock inflow',
    },
    inventory: {
      title: t('nav_inventory'),
      subtitle: isNepali ? 'मौज्दात परिमाण, मूल्याङ्कन र कारोबार अडिट' : 'Stock quantities, valuation, and movements',
    },
    vendors: {
      title: t('nav_vendors', 'Vendors'),
      subtitle: isNepali ? 'आपूर्तिकर्ता सूची, PAN/VAT विवरण र खरिद अभिलेख' : 'Supplier directory, PAN/VAT registry, and purchase logs',
    },
    customers: {
      title: t('nav_customers', 'Customers'),
      subtitle: isNepali ? 'ग्राहक विवरण, PAN/VAT सूची र खरिद कारोबार इतिहास' : 'Customer directory, PAN/VAT records, and order history',
    },
    history: {
      title: t('nav_history'),
      subtitle: isNepali ? 'सम्पन्न बिक्री कारोबार तथा रसिदहरूको अभिलेख' : 'Audit log of completed transactions and snapshots',
    },
    expenses: {
      title: t('nav_expenses'),
      subtitle: isNepali ? 'पसलको भाडा, बिजुली, पानी र अन्य सञ्चालन खर्च' : 'Track shop operating expenses, bills, rent, and supplies',
    },
    staff: {
      title: t('nav_staff'),
      subtitle: isNepali ? 'कर्मचारी विवरण, पद, सम्पर्क र मासिक तलब' : 'Employee records, designations, contact info, and status',
    },
    payroll: {
      title: t('nav_payroll'),
      subtitle: isNepali ? 'तलब भुक्तानी, बोनस/कट्टी र तलब भौचरहरू' : 'Salary disbursements, wage ledger, and printable pay vouchers',
    },
    analytics: {
      title: t('nav_analytics'),
      subtitle: isNepali ? 'व्यापार नाफा, बिक्री गति र उत्पादन विश्लेषण' : 'Financial performance and product rankings',
    },
    settings: {
      title: t('nav_settings'),
      subtitle: isNepali ? 'मुद्रा, भाषा, मौज्दात नियम, ब्याकअप र परीक्षण' : 'Currency, stock rules, backup, and test diagnostics',
    },
  };

  return (
    <header className="h-14 px-6 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
      {/* Zone 1: Current Tab Title & Subtitle */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-neutral-100 flex items-center gap-2 truncate">
            {TAB_TITLES[currentTab]?.title || 'StockForge'}
          </h1>
          <p className="text-[11px] text-neutral-400 hidden md:block truncate">
            {TAB_TITLES[currentTab]?.subtitle}
          </p>
        </div>

        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenCommandPalette}
            className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-lg transition-colors cursor-pointer ml-2"
            title={`Open Command Palette (${MODIFIER_LABEL}+K)`}
          >
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-[11px] text-neutral-400">
              {isNepali ? 'खोज्नुहोस् वा जानुहोस्...' : 'Search or jump to...'}
            </span>
            <kbd className="inline-flex items-center text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.2 rounded border border-neutral-700/60">
              {MODIFIER_LABEL}+K
            </kbd>
          </motion.button>
        )}
      </div>

      {/* Zone 3: Quick Actions, Command Palette & Currency Badge */}
      <div className="flex items-center justify-between gap-2">
        {/* Language Toggle Button (EN <-> NP) */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-neutral-100 bg-neutral-950/80 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/70 hover:border-emerald-500/50 cursor-pointer shadow-xs"
          title={isNepali ? 'Switch to English (Alt+L)' : 'नेपाली भाषामा बदल्नुहोस् (Alt+L)'}
          aria-label="Toggle Language"
        >
          <Languages className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-semibold text-emerald-400 font-mono">
            {isNepali ? 'नेपाली' : 'EN'}
          </span>
          <kbd className="hidden md:inline-flex text-[9px] font-mono text-neutral-500 bg-neutral-900 px-1 py-0.2 rounded border border-neutral-800">
            Alt+L
          </kbd>
        </motion.button>

        {/* Currency Symbol Indicator Badge (Automatically converts Rs. <-> रु.) */}
        <div
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-300 bg-neutral-950/80 border border-neutral-800/70 rounded-lg shadow-xs"
          title={isNepali ? 'सक्रिय मुद्रा संकेत (नेपाली रुपैयाँ: रु.)' : 'Active Currency Symbol (Rs.)'}
        >
          <span className="text-[10px] text-neutral-400 font-medium">
            {isNepali ? 'मुद्रा:' : 'Currency:'}
          </span>
          <span className="text-[11px] font-bold text-emerald-400 font-mono">
            {currencySymbol}
          </span>
        </div>

        {/* Active Shop Badge & Logout */}
        {currentShop && (
          <div className="hidden lg:flex items-center gap-1.5 pl-1.5 border-l border-neutral-800/80">
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-neutral-950/80 border border-neutral-800/70 shadow-xs max-w-[200px]"
              title={`${currentShop.name} (${currentShop.shop_type || 'Retail'}) - ${currentShop.email}`}
            >
              <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="truncate text-left leading-tight">
                <span className="text-[11px] font-bold text-neutral-200 block truncate">
                  {currentShop.name}
                </span>
                <span className="text-[9px] text-neutral-400 block truncate">
                  {currentShop.shop_type}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/60 hover:border-rose-500/30 cursor-pointer"
              title={isNepali ? 'पसल खाताबाट बाहिरिनुहोस् (Logout)' : 'Log out of shop'}
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Theme Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/60 hover:border-neutral-700 cursor-pointer"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-[11px] font-medium text-neutral-300">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-neutral-500" />
              <span className="hidden sm:inline text-[11px] font-medium text-neutral-400">Dark</span>
            </>
          )}
        </motion.button>

        {/* Shortcuts Guide Button */}
        {onOpenShortcutsHelp && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenShortcutsHelp}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800/60 hover:border-neutral-700 cursor-pointer"
            title="Keyboard Shortcuts Cheatsheet (?)"
            aria-label="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </motion.button>
        )}

        {/* New Sale Button with Ctrl+N hint */}
        {currentTab !== 'sales' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNewSaleClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            title={`Ring up New Sale (${MODIFIER_LABEL}+N)`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{t('nav_sales')}</span>
            <kbd className="hidden sm:inline-flex text-[9px] font-mono bg-emerald-700/80 text-emerald-100 px-1 py-0.2 rounded">
              {MODIFIER_LABEL}+N
            </kbd>
          </motion.button>
        )}

        {/* Add Product Button with Ctrl+Shift+P hint */}
        {currentTab === 'products' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onNewProductClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            title={`Add New Product (${MODIFIER_LABEL}+Shift+P)`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('prod_add_button')}</span>
            <kbd className="hidden sm:inline-flex text-[9px] font-mono bg-neutral-900 text-neutral-400 px-1 py-0.2 rounded border border-neutral-700/60">
              {MODIFIER_LABEL}+⇧+P
            </kbd>
          </motion.button>
        )}
      </div>
    </header>
  );
};
