/**
 * CommandPaletteModal Component
 * Power-user quick launcher, navigation switcher, and catalog search (Ctrl+K / Cmd+K)
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingCart,
  Package,
  LayoutDashboard,
  Boxes,
  Receipt,
  ReceiptText,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  PlusCircle,
  Keyboard,
  ArrowRight,
  Sun,
  Moon,
  Languages,
} from 'lucide-react';
import { NavTab } from '../layout/Sidebar.tsx';
import { Product } from '../../types/index.ts';
import { getAllProducts } from '../../lib/services/productService.ts';
import { formatCurrency, fromMinorUnits } from '../../lib/utils/format.ts';
import { MODIFIER_LABEL } from '../../lib/hooks/useGlobalShortcuts.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenCreateProduct: () => void;
  onOpenShortcutsHelp: () => void;
  onStartSaleWithProduct?: (product: Product) => void;
  currencySymbol: string;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  shortcut?: string;
  category: 'Screens' | 'Quick Actions' | 'Products';
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenCreateProduct,
  onOpenShortcutsHelp,
  onStartSaleWithProduct,
  currencySymbol,
}) => {
  const { toggleTheme, isDark } = useTheme();
  const { toggleLanguage, isNepali, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load products when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      try {
        setProducts(getAllProducts());
      } catch {
        setProducts([]);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Base navigation & action items
  const baseItems: PaletteItem[] = useMemo(
    () => [
      {
        id: 'nav-sales',
        title: 'New Sale (Point of Sale)',
        subtitle: 'Process multi-product transaction and generate receipt',
        icon: ShoppingCart,
        shortcut: `${MODIFIER_LABEL}+N`,
        category: 'Screens',
        action: () => {
          onNavigate('sales');
          onClose();
        },
      },
      {
        id: 'nav-products',
        title: 'Products Catalog',
        subtitle: 'Manage catalog items, pricing, and master data',
        icon: Package,
        shortcut: `${MODIFIER_LABEL}+P`,
        category: 'Screens',
        action: () => {
          onNavigate('products');
          onClose();
        },
      },
      {
        id: 'action-add-product',
        title: 'Add New Product',
        subtitle: 'Create a new catalog item with SKU, cost & selling price',
        icon: PlusCircle,
        shortcut: `${MODIFIER_LABEL}+Shift+P`,
        category: 'Quick Actions',
        action: () => {
          onOpenCreateProduct();
          onClose();
        },
      },
      {
        id: 'nav-inventory',
        title: 'Inventory & Stock Valuation',
        subtitle: 'Monitor stock quantities, reorder points, and adjustments',
        icon: Boxes,
        shortcut: `${MODIFIER_LABEL}+I`,
        category: 'Screens',
        action: () => {
          onNavigate('inventory');
          onClose();
        },
      },
      {
        id: 'nav-dashboard',
        title: 'Dashboard Overview',
        subtitle: 'Key business metrics, recent sales, and top products',
        icon: LayoutDashboard,
        shortcut: `${MODIFIER_LABEL}+D`,
        category: 'Screens',
        action: () => {
          onNavigate('dashboard');
          onClose();
        },
      },
      {
        id: 'nav-history',
        title: 'Sales History',
        subtitle: 'Audit log of completed sales transactions',
        icon: Receipt,
        shortcut: `${MODIFIER_LABEL}+H`,
        category: 'Screens',
        action: () => {
          onNavigate('history');
          onClose();
        },
      },
      {
        id: 'nav-expenses',
        title: 'Expenses & Overheads',
        subtitle: 'Track shop bills, utilities, rent, and packaging expenses',
        icon: ReceiptText,
        shortcut: `${MODIFIER_LABEL}+E`,
        category: 'Screens',
        action: () => {
          onNavigate('expenses');
          onClose();
        },
      },
      {
        id: 'nav-staff',
        title: 'Staff Management',
        subtitle: 'Employee directory, designations, and contact profiles',
        icon: Users,
        shortcut: `${MODIFIER_LABEL}+U`,
        category: 'Screens',
        action: () => {
          onNavigate('staff');
          onClose();
        },
      },
      {
        id: 'nav-payroll',
        title: 'Payroll Management',
        subtitle: 'Salary disbursements, wage ledger, and printable pay vouchers',
        icon: CreditCard,
        shortcut: `${MODIFIER_LABEL}+Y`,
        category: 'Screens',
        action: () => {
          onNavigate('payroll');
          onClose();
        },
      },
      {
        id: 'nav-analytics',
        title: 'Analytics & Financial Performance',
        subtitle: 'Revenue curves, gross margins, and profit breakdown',
        icon: BarChart3,
        shortcut: `Alt+A`,
        category: 'Screens',
        action: () => {
          onNavigate('analytics');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        title: 'Application Settings',
        subtitle: 'Currency symbols, stock rules, and database tools',
        icon: Settings,
        shortcut: `${MODIFIER_LABEL}+,`,
        category: 'Screens',
        action: () => {
          onNavigate('settings');
          onClose();
        },
      },
      {
        id: 'action-shortcuts',
        title: 'Keyboard Shortcuts Cheatsheet',
        subtitle: 'View all keyboard shortcuts and hotkeys',
        icon: Keyboard,
        shortcut: `?`,
        category: 'Quick Actions',
        action: () => {
          onClose();
          onOpenShortcutsHelp();
        },
      },
      {
        id: 'action-toggle-theme',
        title: isDark ? 'Switch to Light Theme (Default)' : 'Switch to Dark Theme',
        subtitle: isDark ? 'Change interface to bright daylight mode' : 'Change interface to deep obsidian night mode',
        icon: isDark ? Sun : Moon,
        shortcut: `Alt+T`,
        category: 'Quick Actions',
        action: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'action-toggle-language',
        title: isNepali ? 'Switch to English Language (अंग्रेजी)' : 'नेपाली भाषामा बदल्नुहोस् (Switch to Nepali)',
        subtitle: isNepali ? 'Set interface display language to English' : 'प्रयोगकर्ता इन्टरफेस नेपाली भाषामा रूपान्तरण गर्नुहोस्',
        icon: Languages,
        shortcut: `Alt+L`,
        category: 'Quick Actions',
        action: () => {
          toggleLanguage();
          onClose();
        },
      },
    ],
    [onNavigate, onOpenCreateProduct, onOpenShortcutsHelp, onClose, isDark, toggleTheme, isNepali, toggleLanguage]
  );

  // Filter items and include matching products if user types a query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return baseItems;
    }

    const matchedBase = baseItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );

    const matchedProducts: PaletteItem[] = products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 5)
      .map((p) => ({
        id: `prod-${p.id}`,
        title: `Product: ${p.name}`,
        subtitle: `Stock: ${p.current_stock} · Price: ${formatCurrency(fromMinorUnits(p.selling_price), currencySymbol)}${p.sku ? ` · SKU: ${p.sku}` : ''}`,
        icon: ShoppingCart,
        shortcut: 'Enter to Sell',
        category: 'Products',
        action: () => {
          if (onStartSaleWithProduct) {
            onStartSaleWithProduct(p);
          } else {
            onNavigate('sales');
          }
          onClose();
        },
      }));

    return [...matchedBase, ...matchedProducts];
  }, [query, baseItems, products, currencySymbol, onStartSaleWithProduct, onNavigate, onClose]);

  // Adjust selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Keep selected item scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cmd-palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            key="cmd-palette-box"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 420, mass: 0.5 }}
            className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[75vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-800 bg-neutral-950/70 gap-3">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isNepali
                ? 'कमान्ड, स्क्रिन वा सामानको नाम टाइप गर्नुहोस्...'
                : 'Type a screen, command, or search product...'
            }
            className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 text-sm focus:outline-hidden"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-800 border border-neutral-700 rounded">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="p-2 overflow-y-auto max-h-[55vh] space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-neutral-500 space-y-1">
              <p>No matching commands or products found</p>
              <p className="text-[11px] text-neutral-600">Try searching for &quot;sale&quot;, &quot;product&quot;, or &quot;inventory&quot;</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={item.id}
                  data-index={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-800/90 text-neutral-100'
                      : 'text-neutral-300 hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.category === 'Products' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Product
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd className="px-2 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-700/80 rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer controls hint */}
        <div className="px-4 py-2 border-t border-neutral-800/80 bg-neutral-950/60 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono text-[10px] bg-neutral-800 px-1 rounded mr-1">↑↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className="font-mono text-[10px] bg-neutral-800 px-1 rounded mr-1">↵</kbd>
              Select
            </span>
          </div>
          <div>
            <span>
              <kbd className="font-mono text-[10px] bg-neutral-800 px-1 rounded mr-1">?</kbd>
              Shortcuts guide
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
