/**
 * Analytics View
 * Implements Section 10:
 * - Period selector: Today, Yesterday, Last 7 days, Last 30 days, This month, Custom range
 * - Core financial metrics: Revenue, Discounts, COGS, Gross Profit, Transactions, Units Sold
 * - Product rankings: Best-selling by quantity, Highest revenue, Highest profit
 * - Interactive daily trend bar chart
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Tag,
  Receipt,
  ReceiptText,
  Boxes,
  Calendar,
  Layers,
} from "lucide-react";
import { Input } from "../common/Input.tsx";
import { DateFilterBar } from "../common/DateFilterBar.tsx";
import { DatePreset } from "../../lib/utils/dateFilters.ts";
import {
  DateFilterPreset,
  getDateRangeFromPreset,
  getFinancialSummary,
  getProductAnalytics,
  getDailySalesTrend,
} from "../../lib/services/analyticsService.ts";
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from "../../lib/utils/format.ts";
import {
  FinancialSummary,
  ProductAnalytics,
  DailySalesData,
} from "../../types/index.ts";
import { subscribeToDbChanges } from "../../lib/db/sqliteEngine.ts";

interface AnalyticsViewProps {
  currencySymbol: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  currencySymbol,
}) => {
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [summary, setSummary] = useState<FinancialSummary>({
    sales_count: 0,
    revenue: 0,
    discounts: 0,
    cost_of_goods_sold: 0,
    gross_profit: 0,
    units_sold: 0,
  });

  const [topSelling, setTopSelling] = useState<ProductAnalytics[]>([]);
  const [topRevenue, setTopRevenue] = useState<ProductAnalytics[]>([]);
  const [topProfit, setTopProfit] = useState<ProductAnalytics[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailySalesData[]>([]);

  const [activeTab, setActiveTab] = useState<"selling" | "revenue" | "profit">(
    "selling",
  );

  const activeRange = useMemo(() => {
    if (datePreset === "custom" && startDate && endDate) {
      return {
        startDate: `${startDate}T00:00:00.000Z`,
        endDate: `${endDate}T23:59:59.999Z`,
      };
    }
    if (datePreset === "all") {
      return {
        startDate: "1970-01-01T00:00:00.000Z",
        endDate: "2099-12-31T23:59:59.999Z",
      };
    }
    return getDateRangeFromPreset(datePreset as DateFilterPreset);
  }, [datePreset, startDate, endDate]);

  const loadData = () => {
    try {
      const sum = getFinancialSummary(
        activeRange.startDate,
        activeRange.endDate,
      );
      setSummary(sum);

      const productsData = getProductAnalytics(
        activeRange.startDate,
        activeRange.endDate,
      );
      setTopSelling(productsData.topSelling);
      setTopRevenue(productsData.topRevenue);
      setTopProfit(productsData.topProfit);

      const trend = getDailySalesTrend(
        activeRange.startDate,
        activeRange.endDate,
      );
      setDailyTrend(trend);
    } catch (e) {
      console.error("Error loading analytics:", e);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToDbChanges(loadData);
    return unsubscribe;
  }, [activeRange]);

  const maxTrendRevenue = useMemo(() => {
    return Math.max(...dailyTrend.map((d) => d.revenue), 1);
  }, [dailyTrend]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-150">
      {/* Header & Date Range Selection */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100">
            Financial Analytics
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Aggregated revenue, costs of goods sold, profit margins, and volume
            analytics
          </p>
        </div>

        <DateFilterBar
          preset={datePreset}
          onPresetChange={(p, start, end) => {
            setDatePreset(p);
            setStartDate(start);
            setEndDate(end);
          }}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          hasActiveFilters={datePreset !== 'all'}
          onClear={() => {
            setDatePreset('all');
            setStartDate('');
            setEndDate('');
          }}
        />
      </div>

      {/* Core Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Net Revenue</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-neutral-100 mt-2 tabular-nums">
            {formatCurrency(summary.revenue, currencySymbol)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            {summary.sales_count} sales · {summary.units_sold} units
          </div>
        </motion.div>

        {/* Cost of Goods Sold */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>COGS (Cost)</span>
            <Package className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-xl font-bold font-mono text-neutral-200 mt-2 tabular-nums">
            {formatCurrency(summary.cost_of_goods_sold, currencySymbol)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Snapshot cost of sold items
          </div>
        </motion.div>

        {/* Gross Profit */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 rounded-xl bg-neutral-900 border border-neutral-800"
        >
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Gross Profit</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-2 tabular-nums">
            {formatCurrency(summary.gross_profit, currencySymbol)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Margin:{" "}
            {summary.revenue > 0
              ? `${((summary.gross_profit / summary.revenue) * 100).toFixed(1)}%`
              : "0.0%"}
          </div>
        </motion.div>

        {/* Operating Expenses */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Operating Expenses</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400 mt-2 tabular-nums">
            - {formatCurrency(summary.total_expenses ?? 0, currencySymbol)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Rent, utilities & shop overheads
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 sm:col-span-2 lg:col-span-2">
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Net Profit (Bottom Line)</span>
            <ReceiptText className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-3 mt-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                (summary.net_profit ?? 0) >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {formatCurrency(summary.net_profit ?? 0, currencySymbol)}
            </span>
            <span className="text-xs text-neutral-400">
              {summary.revenue > 0
                ? `${(((summary.net_profit ?? 0) / summary.revenue) * 100).toFixed(1)}% net margin`
                : ""}
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Gross Profit ({formatCurrency(summary.gross_profit, currencySymbol)}
            ) minus Total Expenses (
            {formatCurrency(summary.total_expenses ?? 0, currencySymbol)})
          </div>
        </div>

        {/* Discounts */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Discounts Applied</span>
            <Tag className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-2 tabular-nums">
            {formatCurrency(summary.discounts, currencySymbol)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            Line-item deductions
          </div>
        </div>

        {/* Volume & Transactions */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <div className="text-[11px] text-neutral-400 font-medium flex items-center justify-between">
            <span>Volume Summary</span>
            <Receipt className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-sm font-bold font-mono text-neutral-100 mt-2">
            {summary.sales_count}{" "}
            <span className="text-[11px] font-normal text-neutral-400">
              transactions
            </span>
          </div>
          <div className="text-xs font-mono text-neutral-300 mt-0.5">
            {summary.units_sold}{" "}
            <span className="text-[11px] font-normal text-neutral-400">
              units sold
            </span>
          </div>
        </div>
      </div>

      {/* Daily Sales Trend Visual Bar Chart */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">
              Daily Sales & Gross Profit Trend
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Comparison of daily revenue (dark bar) vs daily gross profit
              (emerald bar)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-neutral-700 inline-block" />
              <span className="text-neutral-400">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
              <span className="text-neutral-300">Profit</span>
            </div>
          </div>
        </div>

        {dailyTrend.length === 0 ? (
          <div className="py-12 text-center text-xs text-neutral-500">
            No sales recorded in the selected period.
          </div>
        ) : (
          <div className="pt-4 pb-2">
            <div className="flex items-end gap-3 h-48 border-b border-neutral-800 px-2 overflow-x-auto">
              {dailyTrend.map((day) => {
                const revenueHeightPercent = Math.max(
                  8,
                  (day.revenue / maxTrendRevenue) * 100,
                );
                const profitHeightPercent = Math.max(
                  4,
                  (Math.max(0, day.profit) / maxTrendRevenue) * 100,
                );

                return (
                  <div
                    key={day.date}
                    className="flex-1 min-w-[48px] flex flex-col items-center gap-1 h-full justify-end group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-14 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-[10px] text-neutral-200 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap shadow-xl">
                      <div>{formatDate(day.date)}</div>
                      <div className="text-neutral-300 font-mono">
                        Rev: {formatCurrency(day.revenue, currencySymbol)}
                      </div>
                      <div className="text-emerald-400 font-mono">
                        Profit: {formatCurrency(day.profit, currencySymbol)}
                      </div>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-full pb-1">
                      {/* Revenue Bar */}
                      <div
                        style={{ height: `${revenueHeightPercent}%` }}
                        className="w-1/2 bg-neutral-700 hover:bg-neutral-600 rounded-t transition-all"
                      />
                      {/* Profit Bar */}
                      <div
                        style={{ height: `${profitHeightPercent}%` }}
                        className="w-1/2 bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all"
                      />
                    </div>

                    <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                      {day.date.substring(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Product-Level Performance Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">
              Product Performance Analytics
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Inspect underlying sales numbers without subjective ranking labels
            </p>
          </div>

          {/* Segmented Filter for View Type */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setActiveTab("selling")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === "selling"
                  ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              By Units Sold
            </button>
            <button
              onClick={() => setActiveTab("revenue")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === "revenue"
                  ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              By Total Revenue
            </button>
            <button
              onClick={() => setActiveTab("profit")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === "profit"
                  ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              By Gross Profit
            </button>
          </div>
        </div>

        {/* Selected Product Ranking Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
              <tr>
                <th className="py-2.5 px-6">Product</th>
                <th className="py-2.5 px-4 font-mono">SKU</th>
                <th className="py-2.5 px-4 text-right font-mono">
                  Current Stock
                </th>
                <th className="py-2.5 px-4 text-right font-mono">Units Sold</th>
                <th className="py-2.5 px-4 text-right font-mono">
                  Total Revenue
                </th>
                <th className="py-2.5 px-4 text-right font-mono">Total Cost</th>
                <th className="py-2.5 px-6 text-right font-mono">
                  Gross Profit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {(() => {
                const list =
                  activeTab === "selling"
                    ? topSelling
                    : activeTab === "revenue"
                      ? topRevenue
                      : topProfit;

                if (list.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center text-neutral-500"
                      >
                        No product sales recorded in the selected date range.
                      </td>
                    </tr>
                  );
                }

                return list.map((item, idx) => (
                  <tr
                    key={item.product_id}
                    className="hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="py-3 px-6">
                      <div className="font-semibold text-neutral-200 flex items-center gap-2">
                        <span className="font-mono text-neutral-500 text-[11px] w-4">
                          {idx + 1}.
                        </span>
                        <span>{item.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-neutral-400">
                      {item.sku || "—"}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-neutral-300">
                      {item.current_stock}
                    </td>

                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        activeTab === "selling"
                          ? "text-emerald-400"
                          : "text-neutral-200"
                      }`}
                    >
                      {item.units_sold}
                    </td>

                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums ${
                        activeTab === "revenue"
                          ? "text-emerald-400 font-bold"
                          : "text-neutral-300"
                      }`}
                    >
                      {formatCurrency(item.total_revenue, currencySymbol)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                      {formatCurrency(item.total_cost, currencySymbol)}
                    </td>

                    <td
                      className={`py-3 px-6 text-right font-mono font-bold tabular-nums ${
                        activeTab === "profit"
                          ? "text-emerald-400"
                          : "text-emerald-400/90"
                      }`}
                    >
                      {formatCurrency(item.total_profit, currencySymbol)}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
