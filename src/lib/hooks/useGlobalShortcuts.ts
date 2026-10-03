/**
 * Global Keyboard Shortcuts Hook & Registry
 * StockForge Desktop & Web POS
 */
import { useEffect } from 'react';
import { NavTab } from '../../components/layout/Sidebar.tsx';

export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

export const MODIFIER_LABEL = isMac ? '⌘' : 'Ctrl';

export interface ShortcutDefinition {
  id: string;
  category: 'Navigation' | 'Point of Sale' | 'General & Quick Actions';
  label: string;
  description: string;
  keys: string[];
  displayKeys: string;
}

export const SHORTCUT_REGISTRY: ShortcutDefinition[] = [
  {
    id: 'nav-sales',
    category: 'Navigation',
    label: 'New Sale (POS)',
    description: 'Open Point of Sale to ring up a new transaction',
    keys: ['ctrl+n', 'cmd+n', 'alt+n'],
    displayKeys: `${MODIFIER_LABEL}+N`,
  },
  {
    id: 'nav-products',
    category: 'Navigation',
    label: 'Products Catalog',
    description: 'Manage products, inventory items, and price points',
    keys: ['ctrl+p', 'cmd+p', 'alt+p'],
    displayKeys: `${MODIFIER_LABEL}+P`,
  },
  {
    id: 'nav-dashboard',
    category: 'Navigation',
    label: 'Dashboard',
    description: 'View sales overview, KPIs, and revenue metrics',
    keys: ['ctrl+d', 'cmd+d', 'alt+d'],
    displayKeys: `${MODIFIER_LABEL}+D`,
  },
  {
    id: 'nav-inventory',
    category: 'Navigation',
    label: 'Inventory & Stock',
    description: 'Stock valuation, low stock warnings, and reordering',
    keys: ['ctrl+i', 'cmd+i', 'alt+i'],
    displayKeys: `${MODIFIER_LABEL}+I`,
  },
  {
    id: 'nav-history',
    category: 'Navigation',
    label: 'Sales History',
    description: 'View audit logs, receipts, and past transactions',
    keys: ['ctrl+h', 'cmd+h', 'alt+h'],
    displayKeys: `${MODIFIER_LABEL}+H`,
  },
  {
    id: 'nav-expenses',
    category: 'Navigation',
    label: 'Expenses & Overheads',
    description: 'Track shop bills, rent, packaging, and operating costs',
    keys: ['ctrl+e', 'cmd+e', 'alt+e'],
    displayKeys: `${MODIFIER_LABEL}+E`,
  },
  {
    id: 'nav-staff',
    category: 'Navigation',
    label: 'Staff Management',
    description: 'Employee directory, designations, and wage structures',
    keys: ['ctrl+u', 'cmd+u', 'alt+u'],
    displayKeys: `${MODIFIER_LABEL}+U`,
  },
  {
    id: 'nav-payroll',
    category: 'Navigation',
    label: 'Payroll Management',
    description: 'Salary disbursements, wage ledger, and printable pay vouchers',
    keys: ['ctrl+y', 'cmd+y', 'alt+y'],
    displayKeys: `${MODIFIER_LABEL}+Y`,
  },
  {
    id: 'nav-analytics',
    category: 'Navigation',
    label: 'Analytics & Reports',
    description: 'Product ranking, profitability, and trends',
    keys: ['alt+a', 'ctrl+shift+a', 'cmd+shift+a'],
    displayKeys: `Alt+A`,
  },
  {
    id: 'nav-settings',
    category: 'Navigation',
    label: 'App Settings',
    description: 'Manage base currency, low stock alert rules, and backups',
    keys: ['ctrl+,', 'cmd+,', 'alt+,'],
    displayKeys: `${MODIFIER_LABEL}+,`,
  },
  {
    id: 'action-command-palette',
    category: 'General & Quick Actions',
    label: 'Command Palette',
    description: 'Quickly search all screens, commands, and catalog items',
    keys: ['ctrl+k', 'cmd+k'],
    displayKeys: `${MODIFIER_LABEL}+K`,
  },
  {
    id: 'action-add-product',
    category: 'General & Quick Actions',
    label: 'Add New Product',
    description: 'Open the product creation form from anywhere',
    keys: ['ctrl+shift+p', 'cmd+shift+p'],
    displayKeys: `${MODIFIER_LABEL}+Shift+P`,
  },
  {
    id: 'action-help',
    category: 'General & Quick Actions',
    label: 'Shortcuts Cheatsheet',
    description: 'Show this keyboard shortcuts guide',
    keys: ['?', 'ctrl+/', 'cmd+/'],
    displayKeys: '?',
  },
  {
    id: 'pos-focus-sku',
    category: 'Point of Sale',
    label: 'Focus Barcode / SKU Input',
    description: 'Focus barcode scanner or quick SKU input field in POS',
    keys: ['ctrl+b', 'cmd+b'],
    displayKeys: `${MODIFIER_LABEL}+B`,
  },
  {
    id: 'pos-complete-sale',
    category: 'Point of Sale',
    label: 'Complete Sale',
    description: 'Process current cart transaction without leaving the keyboard',
    keys: ['f2', 'ctrl+enter', 'cmd+enter'],
    displayKeys: 'F2 / ' + MODIFIER_LABEL + '+↵',
  },
  {
    id: 'general-escape',
    category: 'General & Quick Actions',
    label: 'Close / Cancel',
    description: 'Close active modal, command palette, or dismiss sheet',
    keys: ['escape'],
    displayKeys: 'Esc',
  },
  {
    id: 'general-toggle-theme',
    category: 'General & Quick Actions',
    label: 'Toggle Light / Dark Theme',
    description: 'Switch between light daylight and dark obsidian mode',
    keys: ['alt+t', 'ctrl+shift+t', 'cmd+shift+t'],
    displayKeys: 'Alt+T',
  },
  {
    id: 'general-toggle-language',
    category: 'General & Quick Actions',
    label: 'Switch Language (EN <-> NP)',
    description: 'Toggle UI language between English and Nepali',
    keys: ['alt+l', 'ctrl+shift+l', 'cmd+shift+l'],
    displayKeys: 'Alt+L',
  },
];

export interface UseGlobalShortcutsOptions {
  onNavigate: (tab: NavTab) => void;
  onOpenCommandPalette: () => void;
  onOpenShortcutsHelp: () => void;
  onCloseModals?: () => void;
  onOpenCreateProduct?: () => void;
  onToggleTheme?: () => void;
  onToggleLanguage?: () => void;
}

export function isTypingInInput(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    Boolean(target.isContentEditable)
  );
}

export function useGlobalShortcuts({
  onNavigate,
  onOpenCommandPalette,
  onOpenShortcutsHelp,
  onCloseModals,
  onOpenCreateProduct,
  onToggleTheme,
  onToggleLanguage,
}: UseGlobalShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = e.key.toLowerCase();

      // Toggle Theme: Alt+T or Ctrl+Shift+T (works everywhere)
      if ((isAlt && key === 't') || (isModifier && e.shiftKey && key === 't')) {
        e.preventDefault();
        if (onToggleTheme) {
          onToggleTheme();
        }
        return;
      }

      // Toggle Language: Alt+L or Ctrl+Shift+L (works everywhere)
      if ((isAlt && key === 'l') || (isModifier && e.shiftKey && key === 'l')) {
        e.preventDefault();
        if (onToggleLanguage) {
          onToggleLanguage();
        }
        return;
      }
      const inInput = isTypingInInput(e);

      // Escape key
      if (e.key === 'Escape') {
        if (onCloseModals) {
          onCloseModals();
        }
        return;
      }

      // Command Palette: Ctrl+K or Cmd+K
      if (isModifier && key === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // Shortcuts Help: "?" (when not in input) or Ctrl+/ or Cmd+/
      if ((!inInput && e.key === '?') || (isModifier && key === '/')) {
        e.preventDefault();
        onOpenShortcutsHelp();
        return;
      }

      // Create Product: Ctrl+Shift+P or Cmd+Shift+P
      if (isModifier && e.shiftKey && key === 'p') {
        e.preventDefault();
        if (onOpenCreateProduct) {
          onOpenCreateProduct();
        } else {
          onNavigate('products');
        }
        return;
      }

      // Ctrl+N / Cmd+N or Alt+N: New Sale (POS)
      // High priority power-user request
      if ((isModifier && !e.shiftKey && key === 'n') || (isAlt && key === 'n') || (isAlt && key === 's')) {
        e.preventDefault();
        onNavigate('sales');
        return;
      }

      // Ctrl+P / Cmd+P or Alt+P: Products Catalog
      // Prevents browser print dialog and navigates directly to Products
      if ((isModifier && !e.shiftKey && key === 'p') || (isAlt && key === 'p')) {
        e.preventDefault();
        onNavigate('products');
        return;
      }

      // Ctrl+D / Cmd+D or Alt+D: Dashboard
      // Prevents browser bookmark dialog and navigates directly to Dashboard
      if ((isModifier && !e.shiftKey && key === 'd') || (isAlt && key === 'd')) {
        e.preventDefault();
        onNavigate('dashboard');
        return;
      }

      // Ctrl+I / Cmd+I or Alt+I: Inventory
      if ((isModifier && !e.shiftKey && key === 'i') || (isAlt && key === 'i')) {
        e.preventDefault();
        onNavigate('inventory');
        return;
      }

      // Ctrl+H / Cmd+H or Alt+H: Sales History
      if ((isModifier && !e.shiftKey && key === 'h') || (isAlt && key === 'h')) {
        e.preventDefault();
        onNavigate('history');
        return;
      }

      // Ctrl+E / Cmd+E or Alt+E: Expenses
      if ((isModifier && !e.shiftKey && key === 'e') || (isAlt && key === 'e')) {
        e.preventDefault();
        onNavigate('expenses');
        return;
      }

      // Ctrl+U / Cmd+U or Alt+U: Staff Management
      if ((isModifier && !e.shiftKey && key === 'u') || (isAlt && key === 'u')) {
        e.preventDefault();
        onNavigate('staff');
        return;
      }

      // Ctrl+Y / Cmd+Y or Alt+Y: Payroll Management
      if ((isModifier && !e.shiftKey && key === 'y') || (isAlt && key === 'y')) {
        e.preventDefault();
        onNavigate('payroll');
        return;
      }

      // Alt+A or Ctrl+Shift+A: Analytics
      if ((isAlt && key === 'a') || (isModifier && e.shiftKey && key === 'a')) {
        e.preventDefault();
        onNavigate('analytics');
        return;
      }

      // Ctrl+, or Cmd+, or Alt+,: Settings
      if ((isModifier && (key === ',' || e.code === 'Comma')) || (isAlt && (key === ',' || e.code === 'Comma'))) {
        e.preventDefault();
        onNavigate('settings');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onOpenCommandPalette, onOpenShortcutsHelp, onCloseModals, onOpenCreateProduct, onToggleTheme]);
}
