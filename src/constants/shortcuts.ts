/**
 * Global Keyboard Shortcut Constants
 */

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
    id: 'nav-purchases',
    category: 'Navigation',
    label: 'Purchases (Goods Inflow)',
    description: 'Process multi-item purchase entries and supplier billing',
    keys: ['ctrl+b', 'cmd+b', 'alt+b'],
    displayKeys: `${MODIFIER_LABEL}+B`,
  },
  {
    id: 'nav-purchase-history',
    category: 'Navigation',
    label: 'Purchase History',
    description: 'View supplier invoice audit records and billing history',
    keys: ['ctrl+shift+b', 'cmd+shift+b', 'alt+shift+b'],
    displayKeys: `${MODIFIER_LABEL}+Shift+B`,
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
    label: 'Inventory & Products',
    description: 'Stock valuation, product catalog, and movement adjustments',
    keys: ['ctrl+i', 'cmd+i', 'alt+i', 'ctrl+p', 'cmd+p', 'alt+p'],
    displayKeys: `${MODIFIER_LABEL}+I`,
  },
  {
    id: 'nav-movements',
    category: 'Navigation',
    label: 'Stock Movement Log',
    description: 'Immutable ledger of all stock ins, outs, restocks, and adjustments',
    keys: ['ctrl+m', 'cmd+m', 'alt+m'],
    displayKeys: `${MODIFIER_LABEL}+M`,
  },
  {
    id: 'nav-vendors',
    category: 'Navigation',
    label: 'Vendors & Suppliers',
    description: 'Manage supplier directory, PAN/VAT info, and purchase records',
    keys: ['ctrl+v', 'cmd+v', 'alt+v'],
    displayKeys: `${MODIFIER_LABEL}+V`,
  },
  {
    id: 'nav-customers',
    category: 'Navigation',
    label: 'Customers Directory',
    description: 'Manage customer records, PAN/VAT info, and order history',
    keys: ['alt+c', 'ctrl+shift+c', 'cmd+shift+c'],
    displayKeys: 'Alt+C',
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
    id: 'nav-daybook',
    category: 'Navigation',
    label: 'Daily Book (Day Book)',
    description: 'Daily cash journal, sales, purchases, expenses & dues ledger',
    keys: ['ctrl+j', 'cmd+j', 'alt+j'],
    displayKeys: `${MODIFIER_LABEL}+J`,
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
    description: 'Staff directory, designations, and wage arrangements',
    keys: ['ctrl+u', 'cmd+u', 'alt+u'],
    displayKeys: `${MODIFIER_LABEL}+U`,
  },
  {
    id: 'nav-payroll',
    category: 'Navigation',
    label: 'Payroll Ledger',
    description: 'Disburse monthly employee wages and maintain salary vouchers',
    keys: ['ctrl+y', 'cmd+y', 'alt+y'],
    displayKeys: `${MODIFIER_LABEL}+Y`,
  },
  {
    id: 'nav-analytics',
    category: 'Navigation',
    label: 'Analytics & Reports',
    description: 'Product ranking, profitability, and trends',
    keys: ['alt+a', 'ctrl+shift+a', 'cmd+shift+a'],
    displayKeys: 'Alt+A',
  },
  {
    id: 'nav-settings',
    category: 'Navigation',
    label: 'App Settings',
    description: 'Manage store information, currency, and tax configurations',
    keys: ['ctrl+,', 'cmd+,', 'alt+,'],
    displayKeys: `${MODIFIER_LABEL}+,`,
  },
  {
    id: 'nav-backup',
    category: 'Navigation',
    label: 'Backup & Restore',
    description: 'Export and restore SQLite / SQL dumps and database state',
    keys: ['ctrl+shift+d', 'cmd+shift+d', 'alt+shift+d'],
    displayKeys: `${MODIFIER_LABEL}+Shift+D`,
  },
  {
    id: 'nav-support',
    category: 'Navigation',
    label: 'Technical Support',
    description: 'Direct contact with developer and technical support team',
    keys: ['alt+h', 'ctrl+shift+h', 'cmd+shift+h'],
    displayKeys: 'Alt+H',
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
    label: 'Complete Transaction',
    description: 'Open the payment modal to finalize cart',
    keys: ['ctrl+enter', 'cmd+enter', 'f9'],
    displayKeys: `${MODIFIER_LABEL}+Enter`,
  },
  {
    id: 'pos-clear-cart',
    category: 'Point of Sale',
    label: 'Clear Current Cart',
    description: 'Remove all products from the active POS cart',
    keys: ['ctrl+backspace', 'cmd+backspace', 'f8'],
    displayKeys: `${MODIFIER_LABEL}+Backspace`,
  },
  {
    id: 'pos-print-last',
    category: 'Point of Sale',
    label: 'Print Recent Invoice',
    description: 'Reprint the last generated customer bill',
    keys: ['ctrl+shift+l', 'cmd+shift+l'],
    displayKeys: `${MODIFIER_LABEL}+Shift+L`,
  },
];
