/**
 * Dashboard View
 * Provides real-time financial metrics, date filtering, and low stock warnings.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  Receipt,
  ReceiptText,
  ShoppingCart,
  Boxes,
  PlusCircle,
  Tag,
} from 'lucide-react';
import { DateFilterPreset, getDashboardOverview } from '../../lib/services/analyticsService.ts';
import { formatCurrency, formatNumber } from '../../lib/utils/format.ts';
import { Product } from '../../types/index.ts';
import { subscribeToDbChanges } from '../../lib/db/sqliteEngine.ts';
import { NavTab } from '../layout/Sidebar.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';

interface DashboardViewProps {
  currencySymbol: string;
  onNavigateToTab: (tab: NavTab) => void;
  onRestockClick: (product: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currencySymbol,
  onNavigateToTab,
  onRestockClick,
}) => {
  const { t, isNepali, formatNumberByLang } = useLanguage();
  const [filterPreset, setFilterPreset] = useState<DateFilterPreset>('today');
  const [data, setData] = useState(() => getDashboardOverview('today'));

  const refreshData = useCallback(() => {
    try {
      setData(getDashboardOverview(filterPreset));
    } catch (e) {
      console.error('Error refreshing dashboard:', e);
    }
  }, [filterPreset]);

  useEffect(() => {
    refreshData();
    const unsubscribe = subscribeToDbChanges(() => {
      refreshData();
    });
    return unsubscribe;
  }, [refreshData]);

  const presetLabels: Record<DateFilterPreset, string> = isNepali
    ? {
        today: 'आज',
        yesterday: 'हिजो',
        '7days': '७ दिन',
        '30days': '३० दिन',
        week: 'यस हप्ता',
        month: 'यो महिना',
        year: 'यस वर्ष',
        all: 'सबै समय',
        custom: 'कस्टम',
      }
    : {
        today: 'Today',
        yesterday: 'Yesterday',
        '7days': 'Last 7 Days',
        '30days': 'Last 30 Days',
        week: 'This Week',
        month: 'This Month',
        year: 'This Year',
        all: 'All Time',
        custom: 'Custom',
      };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-150 ">
      {/* Top Header & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">
            {t('dash_title')}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {t('dash_subtitle')}
          </p>
        </div>

        {/* Date Presets Segmented Tabs */}
        <div className="flex items-center gap-1 p-1 bg-neutral-950 rounded-lg border border-neutral-800 shrink-0">
          {(['today', 'yesterday', '7days', '30days', 'month', 'all'] as DateFilterPreset[]).map(
            (p) => (
              <motion.button
                key={p}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFilterPreset(p)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  filterPreset === p
                    ? 'text-neutral-100 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {filterPreset === p && (
                  <motion.div
                    layoutId="dashboardFilterHighlight"
                    className="absolute inset-0 bg-neutral-800 rounded-md shadow-xs"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}
                <span className="relative z-10">{presetLabels[p]}</span>
              </motion.button>
            )
          )}
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Net Revenue */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">{t('dash_today_revenue')}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-100 font-mono tabular-nums">
              {formatCurrency(data.revenue, currencySymbol)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {isNepali ? (
                <>
                  <span className="font-mono text-neutral-200">{formatNumberByLang(data.sales_count)}</span> बिलबाट (
                  <span className="font-mono text-neutral-200">{formatNumberByLang(data.units_sold)}</span> एकाइ)
                </>
              ) : (
                <>
                  From <span className="font-mono text-neutral-200">{data.sales_count}</span> sales (
                  <span className="font-mono text-neutral-200">{data.units_sold}</span> units)
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Cost of Goods Sold (COGS) */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">
              {isNepali ? 'कुल लागत (COGS)' : 'Cost of Goods (COGS)'}
            </span>
            <Package className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-neutral-200 font-mono tabular-nums">
              {formatCurrency(data.cost_of_goods_sold, currencySymbol)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {isNepali ? 'बिक्रीको समयको लागत' : 'Snapshot cost at sale'}
            </div>
          </div>
        </motion.div>

        {/* Gross Profit */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">{t('dash_gross_profit')}</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              {formatCurrency(data.gross_profit, currencySymbol)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {isNepali ? 'नाफा दर:' : 'Margin:'}{' '}
              <span className="font-mono text-neutral-200 font-medium">
                {data.revenue > 0
                  ? `${((data.gross_profit / data.revenue) * 100).toFixed(1)}%`
                  : '0.0%'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Operating Expenses */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          onClick={() => onNavigateToTab('expenses')}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-rose-500/40 flex flex-col justify-between transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium group-hover:text-rose-300 transition-colors">
              {t('dash_operating_expenses')}
            </span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
              {formatCurrency(data.total_expenses ?? 0, currencySymbol)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
              <span>{isNepali ? 'भाडा, बिजुली, प्याकेजिङ' : 'Rent, utilities, packaging'}</span>
              <span className="text-rose-400 text-[10px] group-hover:underline">
                {isNepali ? 'हेर्नुहोस् →' : 'View →'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Net Profit */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-medium">{t('dash_net_profit')}</span>
            <Tag className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                (data.net_profit ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(data.net_profit ?? 0, currencySymbol)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {isNepali ? 'कुल नाफा घटाउ सञ्चालन खर्च' : 'Gross Profit minus Overheads'}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Secondary Stock & Operational Stat Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Catalog Products */}
        <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-400">Total Products</div>
            <div className="text-xl font-bold text-neutral-100 font-mono tabular-nums mt-1">
              {formatNumber(data.totalProducts)}
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('inventory')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
          >
            Manage Catalog →
          </button>
        </div>

        {/* Total Inventory Units */}
        <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-400">Total In-Stock Units</div>
            <div className="text-xl font-bold text-neutral-100 font-mono tabular-nums mt-1">
              {formatNumber(data.totalInventoryUnits)}{' '}
              <span className="text-xs text-neutral-400 font-normal">units</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-neutral-400">Inventory Value</div>
            <div className="text-xs font-mono font-semibold text-neutral-200 mt-0.5">
              {formatCurrency(data.totalInventoryValuation, currencySymbol)}
            </div>
          </div>
        </div>

        {/* Low Stock Counter */}
        <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-400">Low Stock Alert (≤ {data.lowStockThreshold})</div>
            <div
              className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                data.lowStockCount > 0 ? 'text-amber-400' : 'text-neutral-100'
              }`}
            >
              {data.lowStockCount} {data.lowStockCount === 1 ? 'product' : 'products'}
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('inventory')}
            className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
          >
            View Inventory →
          </button>
        </div>
      </div>

      {/* Low Stock Action Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-neutral-100">
              Low Stock Warnings
            </h2>
            <span className="text-xs text-neutral-400">
              · {data.lowStockCount} items at or below threshold of {data.lowStockThreshold} units
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab('inventory')}
            className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Open Full Inventory
          </button>
        </div>

        {data.lowStockProducts.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            ✓ All products have adequate stock levels. No replenishments required.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-6">Product</th>
                  <th className="py-2.5 px-4 font-mono">SKU</th>
                  <th className="py-2.5 px-4 text-right font-mono">Cost</th>
                  <th className="py-2.5 px-4 text-right font-mono">Selling</th>
                  <th className="py-2.5 px-4 text-right font-mono">Stock Level</th>
                  <th className="py-2.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {data.lowStockProducts.slice(0, 5).map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-6 font-medium text-neutral-200">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-neutral-400">{p.sku || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-400">
                      {formatCurrency(p.cost_price, currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-neutral-300">
                      {formatCurrency(p.selling_price, currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {p.current_stock}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        onClick={() => onRestockClick(p)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded border border-emerald-500/30 transition-colors cursor-pointer"
                      >
                        + Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Launchpad Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <button
          onClick={() => onNavigateToTab('sales')}
          className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-neutral-900 border border-emerald-500/30 hover:border-emerald-500/50 flex items-center justify-between transition-all group text-left cursor-pointer"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <ShoppingCart className="w-4 h-4" />
              <span>Launch New Sale Checkout</span>
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              Scan or select items, configure prices, apply discounts
            </div>
          </div>
          <span className="text-xs text-emerald-400 group-hover:translate-x-1 transition-transform">
            Sale →
          </span>
        </button>

        <button
          onClick={() => onNavigateToTab('expenses')}
          className="p-5 rounded-xl bg-gradient-to-r from-rose-950/40 to-neutral-900 border border-rose-500/30 hover:border-rose-500/50 flex items-center justify-between transition-all group text-left cursor-pointer"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
              <ReceiptText className="w-4 h-4" />
              <span>Track Store Expenses</span>
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              Record shop rent, utility bills, packaging, and operating costs
            </div>
          </div>
          <span className="text-xs text-rose-400 group-hover:translate-x-1 transition-transform">
            Expenses →
          </span>
        </button>

        <button
          onClick={() => onNavigateToTab('history')}
          className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 flex items-center justify-between transition-all group text-left cursor-pointer"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <Receipt className="w-4 h-4 text-neutral-400" />
              <span>View Historical Transactions</span>
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              Inspect snapshot item costs, receipts, and sales logs
            </div>
          </div>
          <span className="text-xs text-neutral-400 group-hover:translate-x-1 transition-transform">
            Sales Log →
          </span>
        </button>
      </div>
    </div>
  );
};
