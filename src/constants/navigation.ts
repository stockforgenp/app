/**
 * Navigation Constants & Menu Hierarchy Definitions
 * Groups, tabs, icons, and keyboard shortcuts for application sidebar navigation.
 */
import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Receipt,
  UserCheck,
  Boxes,
  History,
  Truck,
  FileText,
  Building2,
  ReceiptText,
  Users,
  CreditCard,
  Settings,
  Headphones,
  Database,
} from 'lucide-react';
import { MODIFIER_LABEL } from './shortcuts.ts';

export type NavTab =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'purchase-history'
  | 'inventory'
  | 'movements'
  | 'vendors'
  | 'customers'
  | 'history'
  | 'expenses'
  | 'staff'
  | 'payroll'
  | 'analytics'
  | 'settings'
  | 'backup'
  | 'support';

export const NAV_TABS: readonly NavTab[] = [
  'dashboard',
  'sales',
  'purchases',
  'purchase-history',
  'inventory',
  'movements',
  'vendors',
  'customers',
  'history',
  'expenses',
  'staff',
  'payroll',
  'analytics',
  'settings',
  'backup',
  'support',
] as const;

export interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  shortcut: string;
  badge?: number;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const getNavGroups = (
  t: (key: string, fallback?: string) => string,
  lowStockCount: number = 0,
  isNepali: boolean = false,
): NavGroup[] => [
  {
    id: 'overview',
    title: t('nav_group_overview', 'OVERVIEW'),
    items: [
      {
        id: 'dashboard',
        label: t('nav_dashboard'),
        icon: LayoutDashboard,
        shortcut: `${MODIFIER_LABEL}+D`,
      },
      {
        id: 'analytics',
        label: t('nav_analytics'),
        icon: BarChart3,
        shortcut: 'Alt+A',
      },
    ],
  },
  {
    id: 'sales',
    title: t('nav_group_sales', 'SALES'),
    items: [
      {
        id: 'sales',
        label: t('nav_sales'),
        icon: ShoppingCart,
        shortcut: `${MODIFIER_LABEL}+N`,
      },
      {
        id: 'history',
        label: t('nav_history'),
        icon: Receipt,
        shortcut: `${MODIFIER_LABEL}+H`,
      },
      {
        id: 'customers',
        label: t('nav_customers', 'Customers'),
        icon: UserCheck,
        shortcut: `${MODIFIER_LABEL}+C`,
      },
    ],
  },
  {
    id: 'inventory',
    title: t('nav_group_inventory', 'INVENTORY'),
    items: [
      {
        id: 'inventory',
        label: isNepali
          ? 'सामान तथा मौज्दात'
          : t('nav_inventory', 'Stock Ledger'),
        icon: Boxes,
        shortcut: `${MODIFIER_LABEL}+I`,
        badge: lowStockCount > 0 ? lowStockCount : undefined,
      },
      {
        id: 'movements',
        label: isNepali ? 'चलान अडिट लग' : t('nav_movements', 'Movement Log'),
        icon: History,
        shortcut: `${MODIFIER_LABEL}+M`,
      },
    ],
  },
  {
    id: 'procurement',
    title: t('nav_group_procurement', 'PROCUREMENT'),
    items: [
      {
        id: 'purchases',
        label: t('nav_purchases', 'New Purchase'),
        icon: Truck,
        shortcut: `${MODIFIER_LABEL}+B`,
      },
      {
        id: 'purchase-history',
        label: isNepali
          ? 'खरिद बिल इतिहास'
          : t('nav_purchase_history', 'Purchase History'),
        icon: FileText,
        shortcut: `${MODIFIER_LABEL}+⇧+B`,
      },
      {
        id: 'vendors',
        label: t('nav_vendors', 'Vendors'),
        icon: Building2,
        shortcut: `${MODIFIER_LABEL}+V`,
      },
    ],
  },
  {
    id: 'finance_hr',
    title: t('nav_group_finance_hr', 'FINANCE & HR'),
    items: [
      {
        id: 'expenses',
        label: t('nav_expenses'),
        icon: ReceiptText,
        shortcut: `${MODIFIER_LABEL}+E`,
      },
      {
        id: 'staff',
        label: t('nav_staff'),
        icon: Users,
        shortcut: `${MODIFIER_LABEL}+U`,
      },
      {
        id: 'payroll',
        label: t('nav_payroll'),
        icon: CreditCard,
        shortcut: `${MODIFIER_LABEL}+Y`,
      },
    ],
  },
  {
    id: 'system',
    title: t('nav_group_system', 'SYSTEM'),
    items: [
      {
        id: 'settings',
        label: t('nav_settings'),
        icon: Settings,
        shortcut: `${MODIFIER_LABEL}+,`,
      },
      {
        id: 'backup',
        label: isNepali
          ? 'ब्याकअप र पुनर्स्थापना'
          : t('nav_backup', 'Backup & Restore'),
        icon: Database,
        shortcut: `${MODIFIER_LABEL}+Shift+D`,
      },
      {
        id: 'support',
        label: isNepali
          ? 'प्राविधिक सहयोग'
          : t('nav_support', 'Technical Support'),
        icon: Headphones,
        shortcut: 'Alt+H',
      },
    ],
  },
];

export const NAV_GROUPS = getNavGroups;

