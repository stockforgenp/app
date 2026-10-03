/**
 * Financial Analytics & Dashboard Service
 * Implements exact formulas:
 * gross = qty * selling_price
 * net revenue = gross - discount
 * cost = qty * cost_price (using snapshot)
 * gross profit = net revenue - cost
 */
import { DailySalesData, FinancialSummary, Product, ProductAnalytics } from '../../types/index.ts';
import { query, queryOne } from '../db/sqliteEngine.ts';
import { getSettings } from './settingsService.ts';

export type DateFilterPreset = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'custom' | 'all';

export interface DateRange {
  startDate: string; // ISO string or YYYY-MM-DD
  endDate: string;
}

export function getDateRangeFromPreset(preset: DateFilterPreset): DateRange {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.toISOString();
  };
  const endOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy.toISOString();
  };

  if (preset === 'today') {
    return {
      startDate: startOfDay(now),
      endDate: endOfDay(now),
    };
  }

  if (preset === 'yesterday') {
    const yest = new Date(now.getTime() - 86400000);
    return {
      startDate: startOfDay(yest),
      endDate: endOfDay(yest),
    };
  }

  if (preset === '7days') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    return {
      startDate: startOfDay(sevenDaysAgo),
      endDate: endOfDay(now),
    };
  }

  if (preset === '30days') {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    return {
      startDate: startOfDay(thirtyDaysAgo),
      endDate: endOfDay(now),
    };
  }

  if (preset === 'month') {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: startOfDay(firstOfMonth),
      endDate: endOfDay(now),
    };
  }

  // 'all'
  return {
    startDate: '1970-01-01T00:00:00.000Z',
    endDate: '2099-12-31T23:59:59.999Z',
  };
}

export function getFinancialSummary(startDate: string, endDate: string): FinancialSummary {
  const salesStats = queryOne<{ count: number; revenue: number; discount: number }>(
    `SELECT 
       COUNT(*) as count,
       COALESCE(SUM(total), 0) as revenue,
       COALESCE(SUM(discount), 0) as discount
     FROM sales
     WHERE created_at >= ? AND created_at <= ?`,
    [startDate, endDate]
  );

  const itemsStats = queryOne<{ units: number; cogs: number }>(
    `SELECT 
       COALESCE(SUM(si.quantity), 0) as units,
       COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
     FROM sale_items si
     JOIN sales s ON si.sale_id = s.id
     WHERE s.created_at >= ? AND s.created_at <= ?`,
    [startDate, endDate]
  );

  const salesCount = salesStats?.count ?? 0;
  const revenue = salesStats?.revenue ?? 0;
  const discounts = salesStats?.discount ?? 0;
  const costOfGoodsSold = itemsStats?.cogs ?? 0;
  const grossProfit = revenue - costOfGoodsSold;
  const unitsSold = itemsStats?.units ?? 0;

  const sDate = startDate.includes('T') ? startDate.split('T')[0] : startDate;
  const eDate = endDate.includes('T') ? endDate.split('T')[0] : endDate;

  let totalExpenses = 0;
  try {
    const expenseStats = queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE date >= ? AND date <= ?`,
      [sDate, eDate]
    );
    totalExpenses = expenseStats?.total ?? 0;
  } catch {
    // If expenses table not yet ready during initialization
    totalExpenses = 0;
  }

  const netProfit = grossProfit - totalExpenses;

  return {
    sales_count: salesCount,
    revenue,
    discounts,
    cost_of_goods_sold: costOfGoodsSold,
    gross_profit: grossProfit,
    units_sold: unitsSold,
    total_expenses: totalExpenses,
    net_profit: netProfit,
  };
}

export function getDashboardOverview(preset: DateFilterPreset = 'today') {
  const range = getDateRangeFromPreset(preset);
  const summary = getFinancialSummary(range.startDate, range.endDate);

  const productCountRes = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM products`);
  const totalProducts = productCountRes?.count ?? 0;

  const stockUnitsRes = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(current_stock), 0) as total FROM products`
  );
  const totalInventoryUnits = stockUnitsRes?.total ?? 0;

  const settings = getSettings();
  const lowStockThreshold = settings.low_stock_threshold;

  const lowStockProducts = query<Product>(
    `SELECT * FROM products WHERE current_stock <= ? ORDER BY current_stock ASC`,
    [lowStockThreshold]
  );

  // Total valuation of current inventory (current stock * cost price)
  const valuationRes = queryOne<{ valuation: number }>(
    `SELECT COALESCE(SUM(current_stock * cost_price), 0) as valuation FROM products WHERE current_stock > 0`
  );
  const totalInventoryValuation = valuationRes?.valuation ?? 0;

  return {
    ...summary,
    totalProducts,
    totalInventoryUnits,
    totalInventoryValuation,
    lowStockThreshold,
    lowStockProducts,
    lowStockCount: lowStockProducts.length,
    dateRange: range,
  };
}

export function getProductAnalytics(startDate: string, endDate: string): {
  topSelling: ProductAnalytics[];
  topRevenue: ProductAnalytics[];
  topProfit: ProductAnalytics[];
} {
  const rows = query<ProductAnalytics>(
    `SELECT 
       p.id as product_id,
       p.name,
       p.sku,
       p.current_stock,
       COALESCE(SUM(si.quantity), 0) as units_sold,
       COALESCE(SUM(si.total), 0) as total_revenue,
       COALESCE(SUM(si.quantity * si.cost_price), 0) as total_cost,
       COALESCE(SUM(si.total - (si.quantity * si.cost_price)), 0) as total_profit
     FROM products p
     LEFT JOIN sale_items si ON p.id = si.product_id
     LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= ? AND s.created_at <= ?
     GROUP BY p.id
     HAVING units_sold > 0`,
    [startDate, endDate]
  );

  const topSelling = [...rows].sort((a, b) => b.units_sold - a.units_sold).slice(0, 10);
  const topRevenue = [...rows].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10);
  const topProfit = [...rows].sort((a, b) => b.total_profit - a.total_profit).slice(0, 10);

  return {
    topSelling,
    topRevenue,
    topProfit,
  };
}

export function getDailySalesTrend(startDate: string, endDate: string): DailySalesData[] {
  // Aggregate sales by date string (YYYY-MM-DD)
  const rows = query<{
    day: string;
    revenue: number;
    transactions: number;
    cogs: number;
  }>(
    `SELECT 
       substr(s.created_at, 1, 10) as day,
       COALESCE(SUM(s.total), 0) as revenue,
       COUNT(DISTINCT s.id) as transactions,
       COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
     FROM sales s
     LEFT JOIN sale_items si ON s.id = si.sale_id
     WHERE s.created_at >= ? AND s.created_at <= ?
     GROUP BY substr(s.created_at, 1, 10)
     ORDER BY day ASC`,
    [startDate, endDate]
  );

  return rows.map(r => ({
    date: r.day,
    revenue: r.revenue,
    profit: r.revenue - r.cogs,
    transactions: r.transactions,
  }));
}
