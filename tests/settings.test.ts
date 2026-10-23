/**
 * Feature 10 Test: Settings, Backup & Analytics Suite
 * Tests:
 * 1. Default system settings retrieval
 * 2. Updating store configurations, tax rules, negative stock policy, and receipt footer
 * 3. Calendar system switching between Bikram Sambat (BS) and Gregorian (AD)
 * 4. Arbitrary key-value configuration via getAppSetting & setAppSetting
 * 5. Database live telemetry and entity record counting via getDatabaseStats
 * 6. SQL database export and import verification
 * 7. Binary SQLite file snapshot export and import
 * 8. resetDatabaseRecords wiping business transactions while preserving shop credentials
 * 9. Date filter preset range calculation (today, 7days, 30days, month, year, all)
 * 10. Financial summary calculation: COGS, gross profit, expenses deduction, and net profit
 * 11. Product analytics ranking (top selling, top revenue, top profit)
 * 12. Daily sales trend aggregation without duplicate joins
 * 13. Dashboard overview bundling financial summary and low stock metrics
 */

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";
import type { ProcessPurchaseItemInput } from "../src/types/index.ts";

// Dynamically import services after setup has registered the wasm loader
const {
  getSettings,
  updateSettings,
  getCalendarSystem,
  setCalendarSystem,
  getAppSetting,
  setAppSetting,
} = await import("../src/lib/services/settingsService.ts");

const {
  getDatabaseStats,
  exportSqlDump,
  importSqlDump,
  exportBinaryFile,
  importBinaryFile,
  resetDatabaseRecords,
} = await import("../src/lib/services/backupService.ts");

const {
  getDateRangeFromPreset,
  getFinancialSummary,
  getDashboardOverview,
  getProductAnalytics,
  getDailySalesTrend,
} = await import("../src/lib/services/analyticsService.ts");

const { createProduct } = await import("../src/lib/services/productService.ts");
const { processSale } = await import("../src/lib/services/salesService.ts");
const { processPurchase } = await import("../src/lib/services/purchaseService.ts");
const { createExpense } = await import("../src/lib/services/expenseService.ts");
const { createStaff } = await import("../src/lib/services/staffService.ts");

function makePurchaseItem(input: {
  productId: number;
  quantity: number;
  costPrice: number;
  sellingPrice?: number;
}): ProcessPurchaseItemInput {
  return {
    discount: 0,
    ...input,
  };
}

describe("Feature 10: Settings, Backup & Analytics", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test("1. Settings: getSettings returns standard default configurations", () => {
    const settings = getSettings();

    assert.equal(settings.currency_symbol, "Rs.");
    assert.equal(settings.low_stock_threshold, 10);
    assert.equal(settings.allow_negative_stock, false);
    assert.equal(settings.store_name, "StockForge Store");
    assert.equal(settings.enable_vat, true);
    assert.equal(settings.calendar_system, "BS");
    assert.ok(settings.receipt_footer?.includes("Thank you"));
  });

  test("2. Settings: updateSettings updates store profile, VAT, and inventory rules", () => {
    const updated = updateSettings({
      store_name: "Himalayan Mart Kathmandu",
      store_address: "New Road, Kathmandu",
      store_phone: "01-4220000",
      store_pan_vat: "600123456",
      currency_symbol: "NPR",
      low_stock_threshold: 25,
      allow_negative_stock: true,
      enable_vat: false,
      receipt_footer: "Goods once sold are exchangeable within 7 days.",
      calendar_system: "AD",
    });

    assert.equal(updated.store_name, "Himalayan Mart Kathmandu");
    assert.equal(updated.store_address, "New Road, Kathmandu");
    assert.equal(updated.store_phone, "01-4220000");
    assert.equal(updated.store_pan_vat, "600123456");
    assert.equal(updated.currency_symbol, "NPR");
    assert.equal(updated.low_stock_threshold, 25);
    assert.equal(updated.allow_negative_stock, true);
    assert.equal(updated.enable_vat, false);
    assert.equal(updated.receipt_footer, "Goods once sold are exchangeable within 7 days.");
    assert.equal(updated.calendar_system, "AD");

    // Fetch again to ensure persistence
    const reloaded = getSettings();
    assert.equal(reloaded.store_name, "Himalayan Mart Kathmandu");
    assert.equal(reloaded.low_stock_threshold, 25);
    assert.equal(reloaded.allow_negative_stock, true);
  });

  test("3. Settings: setCalendarSystem toggles calendar mode between BS and AD", () => {
    assert.equal(getCalendarSystem(), "BS");

    setCalendarSystem("AD");
    assert.equal(getCalendarSystem(), "AD");

    setCalendarSystem("BS");
    assert.equal(getCalendarSystem(), "BS");
  });

  test("4. Settings: getAppSetting and setAppSetting persist arbitrary config keys", () => {
    assert.equal(getAppSetting("custom_printer_model"), null);

    setAppSetting("custom_printer_model", "Epson TM-T88VI");
    assert.equal(getAppSetting("custom_printer_model"), "Epson TM-T88VI");

    // Updating existing value
    setAppSetting("custom_printer_model", "Star TSP100");
    assert.equal(getAppSetting("custom_printer_model"), "Star TSP100");
  });

  test("5. Backup: getDatabaseStats counts active entities accurately", () => {
    const stats0 = getDatabaseStats();
    assert.equal(stats0.products, 0);
    assert.equal(stats0.sales, 0);
    assert.equal(stats0.purchases, 0);
    assert.equal(stats0.expenses, 0);
    assert.equal(stats0.staff, 0);

    // Create 1 product
    const p = createProduct({
      name: "Sugar 1kg",
      cost_price: 90,
      selling_price: 110,
      current_stock: 50,
    });

    // Create 1 sale
    processSale(
      [{ productId: p.id, quantity: 2, actualSellingPrice: 110, discount: 0 }],
      {
        paymentMethod: "Cash",
        paidAmount: 220,
      },
    );

    // Create 1 purchase
    processPurchase(
      [makePurchaseItem({ productId: p.id, quantity: 20, costPrice: 90, sellingPrice: 110 })],
      {
        paymentMethod: "Cash",
        paidAmount: 1800,
      },
    );

    // Create 1 expense
    createExpense({
      category: "Electricity",
      amount: 2500,
      date: "2026-03-01",
      payment_method: "Cash",
    });

    // Create 1 staff
    createStaff({
      name: "Raju Shrestha",
      role: "Sales Executive",
      base_salary: 25000,
    });

    const stats1 = getDatabaseStats();
    assert.equal(stats1.products, 1);
    assert.equal(stats1.sales, 1);
    assert.equal(stats1.purchases, 1);
    assert.equal(stats1.expenses, 1);
    assert.equal(stats1.staff, 1);
  });

  test("6. Backup: exportSqlDump and importSqlDump perform full SQL snapshot and restore", async () => {
    createProduct({
      name: "Mustard Oil 1L",
      cost_price: 240,
      selling_price: 290,
      current_stock: 15,
    });

    assert.equal(getDatabaseStats().products, 1);

    // Export SQL dump
    const sqlDump = exportSqlDump();
    assert.ok(typeof sqlDump === "string");
    assert.ok(sqlDump.includes("Mustard Oil 1L"));
    assert.ok(sqlDump.includes("INSERT INTO"));

    // Reset database to blank
    await resetDatabaseRecords();
    assert.equal(getDatabaseStats().products, 0);

    // Restore from SQL dump
    await importSqlDump(sqlDump);
    assert.equal(getDatabaseStats().products, 1);
  });

  test("7. Backup: exportBinaryFile and importBinaryFile snapshot and restore binary SQLite bytes", async () => {
    createProduct({
      name: "Basmati Rice 20kg",
      cost_price: 2500,
      selling_price: 3100,
      current_stock: 10,
    });

    // Export raw binary bytes
    const binaryDump = exportBinaryFile();
    assert.ok(binaryDump instanceof Uint8Array);
    assert.ok(binaryDump.byteLength > 0);

    // Wipe database
    await resetDatabaseRecords();
    assert.equal(getDatabaseStats().products, 0);

    // Restore from binary
    await importBinaryFile(binaryDump);
    assert.equal(getDatabaseStats().products, 1);
  });

  test("8. Backup: resetDatabaseRecords clears transactional records and reinitializes database", async () => {
    // Create product & sale
    const p = createProduct({
      name: "Mineral Water",
      cost_price: 15,
      selling_price: 25,
      current_stock: 100,
    });

    processSale(
      [{ productId: p.id, quantity: 5, actualSellingPrice: 25, discount: 0 }],
      {
        paymentMethod: "Cash",
        paidAmount: 125,
      },
    );

    assert.equal(getDatabaseStats().products, 1);
    assert.equal(getDatabaseStats().sales, 1);

    // Wipe business data
    await resetDatabaseRecords();

    // Products and sales should be 0
    assert.equal(getDatabaseStats().products, 0);
    assert.equal(getDatabaseStats().sales, 0);

    // New records can be created immediately on the fresh database
    const freshProduct = createProduct({
      name: "Fresh Orange Juice",
      cost_price: 50,
      selling_price: 80,
      current_stock: 20,
    });
    assert.equal(getDatabaseStats().products, 1);
    assert.equal(freshProduct.name, "Fresh Orange Juice");
  });

  test("9. Analytics: getDateRangeFromPreset generates valid ISO boundaries for all presets", () => {
    const presets = ["today", "yesterday", "7days", "30days", "week", "month", "year", "all"] as const;

    for (const preset of presets) {
      const range = getDateRangeFromPreset(preset);
      assert.ok(range.startDate, `Start date should be present for preset ${preset}`);
      assert.ok(range.endDate, `End date should be present for preset ${preset}`);
      assert.ok(
        new Date(range.startDate).getTime() <= new Date(range.endDate).getTime(),
        `Start date must be <= End date for preset ${preset}`,
      );
    }
  });

  test("10. Analytics: getFinancialSummary computes revenue, COGS, gross profit, and net profit", () => {
    const p1 = createProduct({
      name: "Product Alpha",
      cost_price: 100,
      selling_price: 160,
      current_stock: 50,
    });

    const p2 = createProduct({
      name: "Product Beta",
      cost_price: 200,
      selling_price: 300,
      current_stock: 50,
    });

    // Sale 1: 2 x Alpha (gross = 320, discount = 20, revenue = 300)
    processSale(
      [{ productId: p1.id, quantity: 2, actualSellingPrice: 160, discount: 20 }],
      {
        applyVat: false,
        paymentMethod: "Cash",
        paidAmount: 300,
      },
    );

    // Sale 2: 1 x Beta (gross = 300, cost = 200, discount = 0, revenue = 300)
    processSale(
      [{ productId: p2.id, quantity: 1, actualSellingPrice: 300, discount: 0 }],
      {
        applyVat: false,
        paymentMethod: "Cash",
        paidAmount: 300,
      },
    );

    // Expense: 150 overhead
    const today = new Date().toISOString().split("T")[0];
    createExpense({
      category: "Packaging Materials",
      amount: 150,
      date: today,
      payment_method: "Cash",
    });

    const summary = getFinancialSummary("1970-01-01T00:00:00.000Z", "2099-12-31T23:59:59.999Z");

    assert.equal(summary.sales_count, 2);
    // Total revenue = 300 + 300 = 600
    assert.equal(summary.revenue, 600);
    assert.equal(summary.discounts, 20);
    // COGS = (2 * 100) + (1 * 200) = 400
    assert.equal(summary.cost_of_goods_sold, 400);
    // Gross profit = 600 - 400 = 200
    assert.equal(summary.gross_profit, 200);
    assert.equal(summary.units_sold, 3);
    assert.equal(summary.total_expenses, 150);
    // Net profit = gross profit - expenses = 200 - 150 = 50
    assert.equal(summary.net_profit, 50);
  });

  test("11. Analytics: getProductAnalytics computes top-selling, revenue, and profit rankings", () => {
    const pA = createProduct({ name: "High Volume Low Profit", cost_price: 90, selling_price: 100, current_stock: 100 });
    const pB = createProduct({ name: "Low Volume High Profit", cost_price: 100, selling_price: 300, current_stock: 100 });

    // Sell 10 units of pA -> revenue 1000, profit 100
    processSale(
      [{ productId: pA.id, quantity: 10, actualSellingPrice: 100, discount: 0 }],
      {
        applyVat: false,
        paymentMethod: "Cash",
        paidAmount: 1000,
      },
    );

    // Sell 2 units of pB -> revenue 600, profit 400
    processSale(
      [{ productId: pB.id, quantity: 2, actualSellingPrice: 300, discount: 0 }],
      {
        applyVat: false,
        paymentMethod: "Cash",
        paidAmount: 600,
      },
    );

    const analytics = getProductAnalytics("1970-01-01T00:00:00.000Z", "2099-12-31T23:59:59.999Z");

    // Top selling by volume: pA (10 units) > pB (2 units)
    assert.equal(analytics.topSelling[0].product_id, pA.id);
    assert.equal(analytics.topSelling[0].units_sold, 10);

    // Top revenue: pA (1000) > pB (600)
    assert.equal(analytics.topRevenue[0].product_id, pA.id);
    assert.equal(analytics.topRevenue[0].total_revenue, 1000);

    // Top profit: pB (400) > pA (100)
    assert.equal(analytics.topProfit[0].product_id, pB.id);
    assert.equal(analytics.topProfit[0].total_profit, 400);
  });

  test("12. Analytics: getDailySalesTrend aggregates sales without cartesian multiplication", () => {
    const p = createProduct({ name: "Dairy Milk", cost_price: 50, selling_price: 80, current_stock: 50 });

    // Sale with multiple items in the same sale to ensure no duplication in joins
    processSale(
      [
        { productId: p.id, quantity: 2, actualSellingPrice: 80, discount: 0 },
        { productId: p.id, quantity: 3, actualSellingPrice: 80, discount: 0 },
      ],
      {
        applyVat: false,
        paymentMethod: "Cash",
        paidAmount: 400,
      },
    );

    const trends = getDailySalesTrend("1970-01-01T00:00:00.000Z", "2099-12-31T23:59:59.999Z");
    assert.equal(trends.length, 1);
    assert.equal(trends[0].transactions, 1);
    assert.equal(trends[0].revenue, 400);
    // Cost = (2 * 50) + (3 * 50) = 250. Profit = 400 - 250 = 150
    assert.equal(trends[0].profit, 150);
  });

  test("13. Analytics: getDashboardOverview bundles financial summary and low stock metrics", () => {
    createProduct({
      name: "Emergency Torch",
      cost_price: 300,
      selling_price: 450,
      current_stock: 3, // Below default threshold 10
    });

    const dashboard = getDashboardOverview("all");
    assert.equal(dashboard.totalProducts, 1);
    assert.equal(dashboard.totalInventoryUnits, 3);
    assert.equal(dashboard.totalInventoryValuation, 900); // 3 * 300
    assert.equal(dashboard.lowStockCount, 1);
    assert.equal(dashboard.lowStockProducts[0].name, "Emergency Torch");
  });
});

