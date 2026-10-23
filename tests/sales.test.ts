/**
 * Feature 3 Test: Sales & Billing Suite
 * Tests:
 * 1. Input validation (empty items, invalid quantities, non-existent product IDs)
 * 2. Negative stock policy enforcement (blocks when disabled, permits when enabled)
 * 3. Standard retail cash sale (stock deduction, snapshot cost price, sequential bill number, stock movements)
 * 4. Item discounts, taxable amount, and VAT calculations (13% VAT enabled vs disabled)
 * 5. Wholesale pricing tier checkout
 * 6. Credit (Khata/Udharo) partial payment sale and automatic customer linkage
 * 7. Overpayment handling (excess payment auto-settles customer's previous outstanding dues)
 * 8. Multi-Unit packaging sale (multipliers convert packaged units into base stocking units)
 * 9. Batch/Lot depletion with FEFO auto-allocation
 * 10. Low stock alert triggering when post-sale inventory falls below alert threshold
 * 11. Historical querying via getSales, getSaleWithItems (gross profit, item count, previous dues)
 * 12. Atomic sale modification via updateSale (reverts previous stock, applies new quantities)
 * 13. Full sale return via returnSale (restores inventory, logs RETURN movements, preserves audit history)
 * 14. Partial item return with Credit Note (CN) generation via processSaleReturn
 */

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";

// Dynamically import after setup has registered the wasm loader
const {
  processSale,
  getSales,
  getSaleWithItems,
  getSalesCount,
  updateSale,
  returnSale,
} = await import("../src/lib/services/salesService.ts");

const { createProduct, getProductById } =
  await import("../src/lib/services/productService.ts");

const { getStockMovements } =
  await import("../src/lib/services/inventoryService.ts");

const { createPackaging } =
  await import("../src/lib/services/packagingService.ts");

const { createOrAddBatch, getBatchById } =
  await import("../src/lib/services/batchService.ts");

const { getCustomerTotalDue, findOrCreateCustomer } =
  await import("../src/lib/services/customerService.ts");

const { processSaleReturn } =
  await import("../src/lib/services/returnsService.ts");

const { updateSettings } =
  await import("../src/lib/services/settingsService.ts");

const { queryOne, query } = await import("../src/lib/db/sqliteEngine.ts");

describe("Feature 3: Sales & Billing", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test("1. processSale rejects empty items, invalid quantities, and non-existent products", () => {
    assert.throws(
      () => processSale([]),
      /contain at least one item/i,
      "Should reject empty item list",
    );

    const product = createProduct({
      name: "Wai Wai Noodles",
      cost_price: 2000,
      selling_price: 2500,
      current_stock: 50,
    });

    assert.throws(
      () =>
        processSale([
          {
            productId: product.id,
            quantity: 0,
            actualSellingPrice: 2500,
            discount: 0,
          },
        ]),
      /greater than 0/i,
      "Should reject zero quantity",
    );

    assert.throws(
      () =>
        processSale([
          {
            productId: product.id,
            quantity: -2,
            actualSellingPrice: 2500,
            discount: 0,
          },
        ]),
      /greater than 0/i,
      "Should reject negative quantity",
    );

    assert.throws(
      () =>
        processSale([
          {
            productId: 99999,
            quantity: 1,
            actualSellingPrice: 2500,
            discount: 0,
          },
        ]),
      /was not found/i,
      "Should reject non-existent product ID",
    );
  });

  test("2. Negative stock policy blocks overdrafts by default and permits them when enabled", () => {
    const product = createProduct({
      name: "Limited Stock Juice",
      cost_price: 5000,
      selling_price: 7000,
      current_stock: 5,
    });

    // Default: allow_negative_stock is false -> requesting 10 should fail
    assert.throws(
      () =>
        processSale([
          {
            productId: product.id,
            quantity: 10,
            actualSellingPrice: 7000,
            discount: 0,
          },
        ]),
      /Insufficient stock/i,
      "Should reject sale exceeding available inventory",
    );

    // Enable allow_negative_stock
    updateSettings({ allow_negative_stock: true });

    // Now requesting 10 should succeed
    const sale = processSale([
      {
        productId: product.id,
        quantity: 10,
        actualSellingPrice: 7000,
        discount: 0,
      },
    ]);
    assert.ok(sale.id > 0);

    const updated = getProductById(product.id);
    assert.equal(
      updated?.current_stock,
      -5,
      "Product current_stock should drop to -5",
    );
  });

  test("3. Standard cash sale deducts stock, snapshots cost price, and logs ledger movement", () => {
    const product = createProduct({
      name: "Tokla Tea 500g",
      sku: "TEA-001",
      cost_price: 15000, // Rs. 150 cost
      selling_price: 20000, // Rs. 200 selling
      current_stock: 40,
    });

    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 4,
          actualSellingPrice: 20000,
          discount: 0,
        },
      ],
      {
        paymentMethod: "Cash",
        applyVat: false, // VAT disabled for clean base test
      },
    );

    assert.ok(sale.id > 0);
    assert.match(
      sale.bill_number ?? "",
      /^BILL-\d{5}$/,
      "Sequential bill number format",
    );
    assert.equal(sale.subtotal, 80000); // 4 * 20000
    assert.equal(sale.discount, 0);
    assert.equal(sale.total, 80000);
    assert.equal(sale.paid_amount, 80000);
    assert.equal(sale.due_amount, 0);
    assert.equal(sale.status, "COMPLETED");

    // Verify product current_stock reduction
    const updatedProduct = getProductById(product.id);
    assert.equal(
      updatedProduct?.current_stock,
      36,
      "Stock should decrease from 40 to 36",
    );

    // Verify stock movement ledger entry
    const movements = getStockMovements({ productId: product.id });
    const saleMovement = movements.find((m) => m.type === "SALE");
    assert.ok(saleMovement, "Stock movement must have SALE record");
    assert.equal(saleMovement.quantity, -4);
    assert.equal(saleMovement.reference_id, sale.id);

    // Verify snapshot cost price on sale_items
    const saleDetails = getSaleWithItems(sale.id);
    assert.ok(saleDetails);
    assert.equal(saleDetails.items.length, 1);
    assert.equal(
      saleDetails.items[0].cost_price,
      15000,
      "Cost price snapshot must be preserved",
    );
    assert.equal(saleDetails.items[0].selling_price, 20000);
    assert.equal(saleDetails.items[0].total, 80000);
  });

  test("4. Line discounts and 13% VAT calculation", () => {
    const product = createProduct({
      name: "Dairy Milk Family Pack",
      cost_price: 10000,
      selling_price: 15000,
      current_stock: 20,
    });

    // 2 units at Rs. 150 = 30000, item discount 2000 -> taxable = 28000
    // 13% VAT on 28000 = 3640 -> grand total = 31640
    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 2,
          actualSellingPrice: 15000,
          discount: 2000,
        },
      ],
      {
        applyVat: true,
      },
    );

    assert.equal(sale.subtotal, 30000);
    assert.equal(sale.discount, 2000);
    assert.equal(sale.taxable_amount, 28000);
    assert.equal(sale.vat_rate, 13.0);
    assert.equal(sale.vat_amount, 3640);
    assert.equal(sale.grand_total, 31640);
    assert.equal(sale.total, 31640);
    assert.equal(sale.paid_amount, 31640);
  });

  test("5. Wholesale pricing tier checkout", () => {
    const product = createProduct({
      name: "Basmati Rice Sack 25kg",
      cost_price: 200000,
      selling_price: 250000,
      wholesale_price: 220000,
      wholesale_min_qty: 5,
      current_stock: 50,
    });

    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 10,
          actualSellingPrice: 220000,
          discount: 0,
          pricingTier: "WHOLESALE",
        },
      ],
      {
        applyVat: false,
      },
    );

    assert.equal(sale.total, 2200000); // 10 * 220000
    const details = getSaleWithItems(sale.id);
    assert.equal(details?.items[0].pricing_tier, "WHOLESALE");
    assert.equal(details?.items[0].selling_price, 220000);
  });

  test("6. Credit (Khata/Udharo) partial payment sale links customer and tracks due balance", () => {
    const product = createProduct({
      name: "Cooking Oil 5L",
      cost_price: 90000,
      selling_price: 120000,
      current_stock: 20,
    });

    // Total = 120000, Customer pays Rs. 500 (50000 paisa), remaining due = 70000 paisa
    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 1,
          actualSellingPrice: 120000,
          discount: 0,
        },
      ],
      {
        customerName: "Ram Bahadur",
        customerPhone: "9841000001",
        customerAddress: "Birgunj-4",
        paidAmount: 50000,
        applyVat: false,
      },
    );

    assert.ok(sale.customer_id);
    assert.equal(sale.customer_name, "Ram Bahadur");
    assert.equal(sale.paid_amount, 50000);
    assert.equal(sale.due_amount, 70000);

    // Verify customer's aggregate outstanding due in the khata ledger
    const totalDue = getCustomerTotalDue(sale.customer_id);
    assert.equal(totalDue, 70000, "Customer total due must reflect 70000");
  });

  test("7. Overpayment auto-settles customer previous outstanding dues", () => {
    const customer = findOrCreateCustomer({
      name: "Sita Devi",
      phone: "9841000002",
    });
    assert.ok(customer, "Customer must be created");

    // 1st sale: Due of 30000 paisa
    const p1 = createProduct({
      name: "Soap A",
      cost_price: 2000,
      selling_price: 30000,
      current_stock: 10,
    });
    processSale(
      [
        {
          productId: p1.id,
          quantity: 1,
          actualSellingPrice: 30000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 0, applyVat: false },
    );
    assert.equal(getCustomerTotalDue(customer.id), 30000);

    // 2nd sale: Bill total is 20000 paisa, but customer hands over 45000 paisa (excess 25000 paisa)
    const p2 = createProduct({
      name: "Soap B",
      cost_price: 2000,
      selling_price: 20000,
      current_stock: 10,
    });
    const sale2 = processSale(
      [
        {
          productId: p2.id,
          quantity: 1,
          actualSellingPrice: 20000,
          discount: 0,
        },
      ],
      { customerId: customer.id, paidAmount: 45000, applyVat: false },
    );

    assert.equal(sale2.paid_amount, 20000); // This sale paid in full
    assert.equal(sale2.due_amount, 0);

    // Remaining customer due should now be: 30000 - 25000 = 5000
    const remainingDue = getCustomerTotalDue(customer.id);
    assert.equal(
      remainingDue,
      5000,
      "Excess payment must reduce previous outstanding khata balance",
    );
  });

  test("8. Multi-Unit packaging converts package units to base units", () => {
    const product = createProduct({
      name: "Mineral Water 500ml",
      unit: "bottle",
      cost_price: 1500,
      selling_price: 2500,
      current_stock: 100, // 100 bottles
    });

    // Packaging: 1 Crate = 24 bottles
    const crate = createPackaging({
      productId: product.id,
      packageName: "Crate",
      packageUnit: "crate",
      multiplier: 24,
      sellingPrice: 50000, // Rs. 500 per crate
    });

    // Sell 3 Crates = 3 * 24 = 72 bottles
    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 3,
          actualSellingPrice: 50000,
          discount: 0,
          packagingId: crate.id,
          packageMultiplier: 24,
        },
      ],
      { applyVat: false },
    );

    assert.equal(sale.total, 150000);

    // Stock should be 100 - 72 = 28 bottles
    const updated = getProductById(product.id);
    assert.equal(
      updated?.current_stock,
      28,
      "Must deduct 72 base units from inventory",
    );

    // Sale items verification
    const details = getSaleWithItems(sale.id);
    assert.equal(details?.items[0].packaging_name, "Crate");
    assert.equal(details?.items[0].package_multiplier, 24);
  });

  test("9. FEFO batch lot auto-allocation and stock depletion", () => {
    const product = createProduct({
      name: "Amoxicillin Capsules",
      cost_price: 5000,
      selling_price: 8000,
      current_stock: 50,
    });

    // Batch 1: Expiring earlier
    const batch1 = createOrAddBatch({
      productId: product.id,
      batchNumber: "LOT-EARLY",
      expiryDate: "2026-11-01",
      costPrice: 5000,
      sellingPrice: 8000,
      quantity: 20,
    });

    // Batch 2: Expiring later
    const batch2 = createOrAddBatch({
      productId: product.id,
      batchNumber: "LOT-LATE",
      expiryDate: "2027-05-01",
      costPrice: 5000,
      sellingPrice: 8000,
      quantity: 30,
    });

    // Sale without specifying batch should automatically pick LOT-EARLY via FEFO
    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 15,
          actualSellingPrice: 8000,
          discount: 0,
        },
      ],
      { applyVat: false },
    );

    const details = getSaleWithItems(sale.id);
    assert.equal(details?.items[0].batch_number, "LOT-EARLY");

    // Verify batch1 stock depleted from 20 to 5
    const b1 = getBatchById(batch1.id);
    assert.equal(b1?.quantity, 5);

    // Batch 2 remains untouched at 30
    const b2 = getBatchById(batch2.id);
    assert.equal(b2?.quantity, 30);
  });

  test("10. Low stock alerts triggered when inventory drops at or below alert threshold", () => {
    const product = createProduct({
      name: "Special Tea Leaf",
      cost_price: 10000,
      selling_price: 14000,
      current_stock: 12,
      min_stock_alert: 5,
    });

    // Sell 8 units -> remaining stock 4 (which is <= 5)
    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 8,
          actualSellingPrice: 14000,
          discount: 0,
        },
      ],
      { applyVat: false },
    );

    assert.ok(sale.lowStockAlerts);
    assert.equal(sale.lowStockAlerts.length, 1);
    assert.equal(sale.lowStockAlerts[0].productId, product.id);
    assert.equal(sale.lowStockAlerts[0].remainingStock, 4);
    assert.equal(sale.lowStockAlerts[0].threshold, 5);
  });

  test("11. getSales and getSaleWithItems calculate gross profit and previous dues", () => {
    const p1 = createProduct({
      name: "Item Alpha",
      cost_price: 4000,
      selling_price: 6000,
      current_stock: 20,
    });
    const p2 = createProduct({
      name: "Item Beta",
      cost_price: 8000,
      selling_price: 12000,
      current_stock: 20,
    });

    const sale = processSale(
      [
        {
          productId: p1.id,
          quantity: 2,
          actualSellingPrice: 6000,
          discount: 0,
        }, // cost: 8000, rev: 12000
        {
          productId: p2.id,
          quantity: 1,
          actualSellingPrice: 12000,
          discount: 0,
        }, // cost: 8000, rev: 12000
      ],
      {
        customerName: "Gita Sharma",
        customerPhone: "9800000000",
        applyVat: false,
      },
    );

    assert.equal(getSalesCount(), 1);

    // Query sales list
    const sales = getSales({ search: "Gita" });
    assert.equal(sales.length, 1);
    assert.equal(sales[0].id, sale.id);
    assert.equal(sales[0].total, 24000);
    assert.equal(sales[0].cost_total, 16000); // 8000 + 8000
    assert.equal(sales[0].gross_profit, 8000); // 24000 - 16000

    // Detailed sale inspection
    const full = getSaleWithItems(sale.id);
    assert.ok(full);
    assert.equal(full.items.length, 2);
    assert.equal(full.sale.gross_profit, 8000);
  });

  test("12. updateSale atomic modification reverts old stock and applies new items", () => {
    const p1 = createProduct({
      name: "Product A",
      cost_price: 1000,
      selling_price: 2000,
      current_stock: 20,
    });
    const p2 = createProduct({
      name: "Product B",
      cost_price: 3000,
      selling_price: 5000,
      current_stock: 20,
    });

    // Initial sale: 5 units of Product A
    const originalSale = processSale(
      [
        {
          productId: p1.id,
          quantity: 5,
          actualSellingPrice: 2000,
          discount: 0,
        },
      ],
      { applyVat: false },
    );
    assert.equal(getProductById(p1.id)?.current_stock, 15);

    // Update sale: Change to 2 units of Product A and 3 units of Product B
    const updatedSale = updateSale(
      originalSale.id,
      [
        {
          productId: p1.id,
          quantity: 2,
          actualSellingPrice: 2000,
          discount: 0,
        },
        {
          productId: p2.id,
          quantity: 3,
          actualSellingPrice: 5000,
          discount: 0,
        },
      ],
      { applyVat: false },
    );

    assert.equal(updatedSale.id, originalSale.id);
    assert.equal(updatedSale.total, 19000); // (2 * 2000) + (3 * 5000)

    // Verify stock reversion and re-deduction:
    // Product A: 20 - 2 = 18
    assert.equal(getProductById(p1.id)?.current_stock, 18);
    // Product B: 20 - 3 = 17
    assert.equal(getProductById(p2.id)?.current_stock, 17);
  });

  test("13. returnSale restores inventory, logs RETURN movements, and marks status RETURNED", () => {
    const product = createProduct({
      name: "Refunder T-Shirt",
      cost_price: 50000,
      selling_price: 80000,
      current_stock: 10,
    });

    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 3,
          actualSellingPrice: 80000,
          discount: 0,
        },
      ],
      { applyVat: false },
    );
    assert.equal(getProductById(product.id)?.current_stock, 7);

    // Return the sale
    const result = returnSale(sale.id);
    assert.equal(result.id, sale.id);
    assert.equal(result.restoredItemCount, 1);

    // Stock should be restored back to 10
    const restoredProduct = getProductById(product.id);
    assert.equal(
      restoredProduct?.current_stock,
      10,
      "Stock must be restored to 10",
    );

    // Sale record must remain in database with status 'RETURNED'
    const saleAfter = getSaleWithItems(sale.id);
    assert.ok(saleAfter);
    assert.equal(saleAfter.sale.status, "RETURNED");
    assert.ok(saleAfter.sale.returned_at);

    // Stock movements must contain 'RETURN'
    const movements = getStockMovements({ productId: product.id });
    const returnMovement = movements.find((m) => m.type === "RETURN");
    assert.ok(returnMovement, "Must log RETURN movement");
    assert.equal(returnMovement.quantity, 3);

    // Attempting to return again must fail
    assert.throws(
      () => returnSale(sale.id),
      /already been returned/i,
      "Should block duplicate return",
    );
  });

  test("14. Partial item return with Credit Note (CN) generation via processSaleReturn", () => {
    const product = createProduct({
      name: "Ceramic Mug Set",
      cost_price: 15000,
      selling_price: 25000,
      current_stock: 20,
    });

    const sale = processSale(
      [
        {
          productId: product.id,
          quantity: 5,
          actualSellingPrice: 25000,
          discount: 0,
        },
      ],
      { customerName: "Binod KC", applyVat: false },
    );
    assert.equal(getProductById(product.id)?.current_stock, 15);

    // Customer returns 2 of the 5 mugs
    const { returnRecord, items } = processSaleReturn({
      saleId: sale.id,
      billNumber: sale.bill_number,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      refundMethod: "CASH",
      reason: "DEFECTIVE",
      items: [
        {
          productId: product.id,
          quantity: 2,
          unitPrice: 25000,
          action: "RESTOCK",
        },
      ],
    });

    assert.match(
      returnRecord.return_number,
      /^CN-\d{5}$/,
      "Credit note format CN-XXXXX",
    );
    assert.equal(returnRecord.total_refund, 50000); // 2 * 25000
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 2);

    // Product stock should increase by 2 from 15 to 17
    const productAfter = getProductById(product.id);
    assert.equal(
      productAfter?.current_stock,
      17,
      "Returned quantity must be restocked into inventory",
    );
  });

  test("15. Real CRUD on Sales: INSERT into db, FETCH sale & items, UPDATE sale, and RETURN with stock reversal", () => {
    const p1 = createProduct({ name: "Digestive Biscuit", cost_price: 3000, selling_price: 5000, current_stock: 40 });
    const p2 = createProduct({ name: "Real Apple Juice 1L", cost_price: 15000, selling_price: 22000, current_stock: 30 });

    // 1. CREATE / INSERT into db
    const sale = processSale(
      [
        { productId: p1.id, quantity: 2, actualSellingPrice: 5000, discount: 0 },
        { productId: p2.id, quantity: 1, actualSellingPrice: 22000, discount: 0 },
      ],
      { paymentMethod: "Cash", paidAmount: 32000, applyVat: false }
    );

    // 2. READ / FETCH directly from SQLite sales table
    const dbSale = queryOne<{
      id: number;
      bill_number: string;
      subtotal: number;
      total: number;
      paid_amount: number;
      payment_method: string;
      status: string;
    }>("SELECT * FROM sales WHERE id = ?", [sale.id]);

    assert.ok(dbSale);
    assert.equal(dbSale.id, sale.id);
    assert.equal(dbSale.subtotal, 32000); // (2*5000) + (1*22000) = 32000
    assert.equal(dbSale.total, 32000);
    assert.equal(dbSale.paid_amount, 32000);
    assert.equal(dbSale.status, "COMPLETED");

    // Fetch sale items directly from sale_items table
    const dbItems = query<{
      sale_id: number;
      product_id: number;
      quantity: number;
      cost_price: number;
      selling_price: number;
      total: number;
    }>("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY product_id ASC", [sale.id]);

    assert.equal(dbItems.length, 2);
    assert.equal(dbItems[0].product_id, p1.id);
    assert.equal(dbItems[0].quantity, 2);
    assert.equal(dbItems[0].cost_price, 3000);
    assert.equal(dbItems[1].product_id, p2.id);
    assert.equal(dbItems[1].quantity, 1);
    assert.equal(dbItems[1].cost_price, 15000);

    // Stocks in products table were decremented
    assert.equal(getProductById(p1.id)?.current_stock, 38);
    assert.equal(getProductById(p2.id)?.current_stock, 29);

    // 3. UPDATE in SQLite database
    updateSale(
      sale.id,
      [{ productId: p1.id, quantity: 3, actualSellingPrice: 5000, discount: 0 }],
      { paymentMethod: "Cash", paidAmount: 15000, applyVat: false }
    );

    const updatedDbSale = queryOne<{ total: number; paid_amount: number }>(
      "SELECT total, paid_amount FROM sales WHERE id = ?",
      [sale.id]
    );
    assert.ok(updatedDbSale);
    assert.equal(updatedDbSale.total, 15000);
    assert.equal(updatedDbSale.paid_amount, 15000);

    const updatedDbItems = query("SELECT * FROM sale_items WHERE sale_id = ?", [sale.id]);
    assert.equal(updatedDbItems.length, 1);

    // Reverted p2 stock to 30, and p1 stock became 40 - 3 = 37
    assert.equal(getProductById(p1.id)?.current_stock, 37);
    assert.equal(getProductById(p2.id)?.current_stock, 30);

    // 4. RETURN / VOID in SQLite database
    returnSale(sale.id);

    const returnedDbSale = queryOne<{ status: string }>("SELECT status FROM sales WHERE id = ?", [sale.id]);
    assert.ok(returnedDbSale);
    assert.equal(returnedDbSale.status, "RETURNED");

    // Stock for p1 is fully restored back to 40
    assert.equal(getProductById(p1.id)?.current_stock, 40);
  });
});
