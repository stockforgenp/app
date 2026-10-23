/**
 * Feature 4 Test: Purchases & Restocking Suite
 * Tests:
 * 1. Input validation (empty items, invalid quantities, non-existent product IDs)
 * 2. Standard cash purchase (stock increase, cost/selling price update, sequential PUR-XXXXX bill number, ledger entry)
 * 3. Line discounts and 13% VAT calculations (VAT enabled vs disabled)
 * 4. External supplier invoice number and custom notes preservation
 * 5. Credit (Vendor Due/Udharo) purchase and vendor ledger linkage
 * 6. Overpayment handling (excess payment auto-settles vendor's previous outstanding dues)
 * 7. Multi-Unit packaging purchase (converts cartons/sacks into base stocking units)
 * 8. Batch & Expiry lot inflow with manufacturing date linking
 * 9. Historical querying via getPurchases, getPurchaseWithItems, and getPurchasesCount
 * 10. Atomic purchase modification via updatePurchase (reverts old stock, applies new quantities)
 * 11. Full purchase return via returnPurchase (negative stock check, stock deduction, status update to RETURNED)
 * 12. Partial vendor return with Debit Note (DN) generation via processPurchaseReturn
 */

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";
import type { ProcessPurchaseItemInput } from "../src/types/index.ts";

// Dynamically import after setup has registered the wasm loader
const {
  processPurchase,
  getPurchases,
  getPurchaseWithItems,
  getPurchasesCount,
  updatePurchase,
  returnPurchase,
} = await import("../src/lib/services/purchaseService.ts");

const { createProduct, getProductById } =
  await import("../src/lib/services/productService.ts");

const { getStockMovements } =
  await import("../src/lib/services/inventoryService.ts");

const { createPackaging } =
  await import("../src/lib/services/packagingService.ts");

const { getBatchesForFEFO } =
  await import("../src/lib/services/batchService.ts");

const { findOrCreateVendor, getVendorTotalDue } =
  await import("../src/lib/services/vendorService.ts");

const { processPurchaseReturn } =
  await import("../src/lib/services/returnsService.ts");

const { queryOne, query } = await import("../src/lib/db/sqliteEngine.ts");

const { updateSettings } =
  await import("../src/lib/services/settingsService.ts");
const { run } = await import("../src/lib/db/sqliteEngine.ts");

// Helper to construct purchase item with default discount = 0
function makeItem(input: {
  productId: number;
  quantity: number;
  costPrice: number;
  sellingPrice?: number;
  discount?: number;
  batchNumber?: string;
  expiryDate?: string;
  mfgDate?: string;
  packagingId?: number | null;
  packageMultiplier?: number;
}): ProcessPurchaseItemInput {
  return {
    discount: 0,
    ...input,
  };
}

describe("Feature 4: Purchases & Restocking", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test("1. processPurchase rejects empty items, invalid quantities, and missing products", () => {
    assert.throws(
      () => processPurchase([]),
      /contain at least one item/i,
      "Should reject empty item list",
    );

    const product = createProduct({
      name: "Sunflower Oil 1L",
      cost_price: 20000,
      selling_price: 24000,
      current_stock: 10,
    });

    assert.throws(
      () =>
        processPurchase([
          makeItem({ productId: product.id, quantity: 0, costPrice: 20000 }),
        ]),
      /greater than 0/i,
      "Should reject 0 quantity",
    );

    assert.throws(
      () =>
        processPurchase([
          makeItem({ productId: product.id, quantity: -5, costPrice: 20000 }),
        ]),
      /greater than 0/i,
      "Should reject negative quantity",
    );

    assert.throws(
      () =>
        processPurchase([
          makeItem({ productId: 99999, quantity: 10, costPrice: 20000 }),
        ]),
      /was not found/i,
      "Should reject non-existent product",
    );
  });

  test("2. Standard cash purchase increases stock, updates pricing, and logs RESTOCK movement", () => {
    const product = createProduct({
      name: "Sugar 1kg",
      sku: "SUG-001",
      cost_price: 8000, // Rs. 80
      selling_price: 9500, // Rs. 95
      current_stock: 20,
    });

    const purchase = processPurchase(
      [
        makeItem({
          productId: product.id,
          quantity: 50,
          costPrice: 8500, // Cost price increased to Rs. 85
          sellingPrice: 10000, // Selling price updated to Rs. 100
        }),
      ],
      {
        vendorName: "Everest Wholesalers",
        vendorPhone: "9855012345",
        paymentMethod: "Cash",
        applyVat: false,
      },
    );

    assert.ok(purchase.id > 0);
    assert.match(
      purchase.bill_number ?? "",
      /^PUR-\d{5}$/,
      "Sequential purchase bill format",
    );
    assert.equal(purchase.subtotal, 425000); // 50 * 8500
    assert.equal(purchase.total, 425000);
    assert.equal(purchase.paid_amount, 425000);
    assert.equal(purchase.due_amount, 0);

    // Verify product inventory and pricing updates
    const updatedProduct = getProductById(product.id);
    assert.ok(updatedProduct);
    assert.equal(
      updatedProduct.current_stock,
      70,
      "Stock must increase from 20 to 70 (20 + 50)",
    );
    assert.equal(
      updatedProduct.cost_price,
      8500,
      "Product cost price should be updated",
    );
    assert.equal(
      updatedProduct.selling_price,
      10000,
      "Product selling price should be updated",
    );

    // Verify RESTOCK movement in stock ledger
    const movements = getStockMovements({ productId: product.id });
    const restockMovement = movements.find(
      (m) => m.reference_id === purchase.id && m.type === "RESTOCK",
    );
    assert.ok(restockMovement, "Must log RESTOCK movement for purchase");
    assert.equal(restockMovement.quantity, 50);
    assert.equal(restockMovement.vendor_name, "Everest Wholesalers");
  });

  test("3. Line discounts and 13% VAT calculations on purchases", () => {
    const product = createProduct({
      name: "Fortune Basmati Rice",
      cost_price: 200000,
      selling_price: 250000,
      current_stock: 5,
    });

    // 2 sacks at cost 200000 = 400000, discount = 20000 -> taxable = 380000
    // 13% VAT on 380000 = 49400 -> grand total = 429400
    const purchase = processPurchase(
      [
        makeItem({
          productId: product.id,
          quantity: 2,
          costPrice: 200000,
          discount: 20000,
        }),
      ],
      {
        applyVat: true,
      },
    );

    assert.equal(purchase.subtotal, 400000);
    assert.equal(purchase.discount, 20000);
    assert.equal(purchase.taxable_amount, 380000);
    assert.equal(purchase.vat_rate, 13.0);
    assert.equal(purchase.vat_amount, 49400);
    assert.equal(purchase.grand_total, 429400);
    assert.equal(purchase.total, 429400);
    assert.equal(purchase.paid_amount, 429400);
  });

  test("4. External supplier invoice number and custom notes preservation", () => {
    const product = createProduct({
      name: "Detergent Powder 5kg",
      cost_price: 45000,
      selling_price: 55000,
      current_stock: 10,
    });

    const purchase = processPurchase(
      [
        makeItem({
          productId: product.id,
          quantity: 10,
          costPrice: 45000,
        }),
      ],
      {
        vendorName: "Himalayan Cleaners",
        invoiceNumber: "TAX-INV-88992",
        notes: "Delivered via Nepal Transport truck #102",
        applyVat: false,
      },
    );

    assert.equal(purchase.invoice_number, "TAX-INV-88992");
    assert.equal(purchase.notes, "Delivered via Nepal Transport truck #102");

    const details = getPurchaseWithItems(purchase.id);
    assert.equal(details?.purchase.invoice_number, "TAX-INV-88992");
  });

  test("5. Credit (Vendor Due/Udharo) purchase links vendor and tracks payable ledger balance", () => {
    const product = createProduct({
      name: "Flour Atta 10kg",
      cost_price: 70000,
      selling_price: 85000,
      current_stock: 15,
    });

    // Total = 70000 * 5 = 350000. Shopkeeper pays Rs. 1500 (150000 paisa), remaining due = 200000 paisa
    const purchase = processPurchase(
      [
        makeItem({
          productId: product.id,
          quantity: 5,
          costPrice: 70000,
        }),
      ],
      {
        vendorName: "Pashupati Flour Mills",
        vendorPhone: "9845011223",
        vendorPanVat: "102938475",
        paidAmount: 150000,
        applyVat: false,
      },
    );

    assert.ok(purchase.vendor_id);
    assert.equal(purchase.vendor_name, "Pashupati Flour Mills");
    assert.equal(purchase.paid_amount, 150000);
    assert.equal(purchase.due_amount, 200000);

    // Verify vendor's aggregate outstanding due in the supplier ledger
    const totalDue = getVendorTotalDue(purchase.vendor_id);
    assert.equal(
      totalDue,
      200000,
      "Vendor total payable due must reflect 200000",
    );
  });

  test("6. Overpayment auto-settles vendor previous outstanding dues", () => {
    const vendor = findOrCreateVendor({
      name: "Annapurna Spices",
      phone: "9851000999",
    });
    assert.ok(vendor);

    // 1st purchase: Full credit (paid 0, due 50000 paisa)
    const p1 = createProduct({
      name: "Chilli Powder 1kg",
      cost_price: 50000,
      selling_price: 65000,
      current_stock: 5,
    });
    processPurchase(
      [makeItem({ productId: p1.id, quantity: 1, costPrice: 50000 })],
      { vendorId: vendor.id, paidAmount: 0, applyVat: false },
    );
    assert.equal(getVendorTotalDue(vendor.id), 50000);

    // 2nd purchase: Bill total is 30000 paisa, but shopkeeper pays 65000 paisa (excess 35000 paisa)
    const p2 = createProduct({
      name: "Turmeric 1kg",
      cost_price: 30000,
      selling_price: 40000,
      current_stock: 5,
    });
    const purchase2 = processPurchase(
      [makeItem({ productId: p2.id, quantity: 1, costPrice: 30000 })],
      { vendorId: vendor.id, paidAmount: 65000, applyVat: false },
    );

    assert.equal(purchase2.paid_amount, 30000); // Current purchase fully paid
    assert.equal(purchase2.due_amount, 0);

    // Remaining vendor payable should now be: 50000 - 35000 = 15000
    const remainingDue = getVendorTotalDue(vendor.id);
    assert.equal(
      remainingDue,
      15000,
      "Excess payment must reduce vendor previous payable balance",
    );
  });

  test("7. Multi-Unit packaging purchase converts bulk units into base stocking units", () => {
    const product = createProduct({
      name: "Noodles 75g",
      unit: "packet",
      cost_price: 1800,
      selling_price: 2500,
      current_stock: 30, // 30 packets
    });

    // Packaging: 1 Carton = 30 packets
    const carton = createPackaging({
      productId: product.id,
      packageName: "Carton",
      packageUnit: "ctn",
      multiplier: 30,
    });

    // Purchase 4 Cartons = 4 * 30 = 120 packets
    const purchase = processPurchase(
      [
        makeItem({
          productId: product.id,
          quantity: 4,
          costPrice: 50000, // Rs. 500 per carton
          packagingId: carton.id,
          packageMultiplier: 30,
        }),
      ],
      { applyVat: false },
    );

    assert.equal(purchase.total, 200000); // 4 * 50000

    // Product stock should increase by 120 packets (30 + 120 = 150)
    const updated = getProductById(product.id);
    assert.equal(
      updated?.current_stock,
      150,
      "Must inflow 120 base units into inventory",
    );

    const details = getPurchaseWithItems(purchase.id);
    assert.equal(details?.items[0].quantity, 4);
  });

  test("8. Batch & Expiry lot inflow with manufacturing date linking", () => {
    const product = createProduct({
      name: "Paracetamol 500mg",
      cost_price: 200,
      selling_price: 350,
      current_stock: 100,
    });

    const purchase = processPurchase(
      [
        makeItem({
          productId: product.id,
          quantity: 500,
          costPrice: 200,
          batchNumber: "LOT-MED-2026",
          expiryDate: "2028-06-30",
          mfgDate: "2026-01-01",
        }),
      ],
      { applyVat: false },
    );

    // Verify batch was created and linked to purchase item
    const details = getPurchaseWithItems(purchase.id);
    assert.ok(
      details?.items[0].batch_id,
      "Purchase item must link to batch_id",
    );
    assert.equal(details?.items[0].batch_number, "LOT-MED-2026");
    assert.equal(details?.items[0].expiry_date, "2028-06-30");
    assert.equal(details?.items[0].mfg_date, "2026-01-01");

    // Verify batch is in the active inventory batches
    const batches = getBatchesForFEFO(product.id);
    const createdBatch = batches.find((b) => b.batch_number === "LOT-MED-2026");
    assert.ok(createdBatch);
    assert.equal(createdBatch.quantity, 500);
    assert.equal(createdBatch.expiry_date, "2028-06-30");
  });

  test("9. Querying purchases via getPurchases, getPurchaseWithItems, and getPurchasesCount", () => {
    const p1 = createProduct({
      name: "Item X",
      cost_price: 1000,
      selling_price: 1500,
      current_stock: 10,
    });

    const purchase = processPurchase(
      [makeItem({ productId: p1.id, quantity: 10, costPrice: 1000 })],
      {
        vendorName: "Janakpur Distributors",
        invoiceNumber: "INV-JD-001",
        applyVat: false,
      },
    );

    assert.equal(getPurchasesCount(), 1);

    // Search by vendor name
    const byVendor = getPurchases({ search: "Janakpur" });
    assert.equal(byVendor.length, 1);
    assert.equal(byVendor[0].id, purchase.id);

    // Search by invoice number
    const byInv = getPurchases({ search: "INV-JD-001" });
    assert.equal(byInv.length, 1);
    assert.equal(byInv[0].id, purchase.id);

    // Full purchase details
    const full = getPurchaseWithItems(purchase.id);
    assert.ok(full);
    assert.equal(full.items.length, 1);
    assert.equal(full.purchase.total, 10000);
  });

  test("10. updatePurchase atomic modification reverts old stock and applies new quantities", () => {
    const p1 = createProduct({
      name: "Stock Product A",
      cost_price: 5000,
      selling_price: 7000,
      current_stock: 20,
    });
    const p2 = createProduct({
      name: "Stock Product B",
      cost_price: 8000,
      selling_price: 11000,
      current_stock: 30,
    });

    // Initial purchase: 10 units of Product A -> stock becomes 20 + 10 = 30
    const originalPurchase = processPurchase(
      [makeItem({ productId: p1.id, quantity: 10, costPrice: 5000 })],
      { applyVat: false },
    );
    assert.equal(getProductById(p1.id)?.current_stock, 30);

    // Update purchase: Change to 5 units of Product A and 15 units of Product B
    const updated = updatePurchase(
      originalPurchase.id,
      [
        makeItem({ productId: p1.id, quantity: 5, costPrice: 5000 }),
        makeItem({ productId: p2.id, quantity: 15, costPrice: 8000 }),
      ],
      { applyVat: false },
    );

    assert.equal(updated.id, originalPurchase.id);
    assert.equal(updated.total, 145000); // (5 * 5000) + (15 * 8000)

    // Verify stock reversion and re-application:
    // Product A: 20 + 5 = 25 (original +10 was reverted)
    assert.equal(getProductById(p1.id)?.current_stock, 25);
    // Product B: 30 + 15 = 45
    assert.equal(getProductById(p2.id)?.current_stock, 45);
  });

  test("11. returnPurchase checks negative stock constraints and deducts inventory safely", () => {
    const product = createProduct({
      name: "Returnable Cement Bag",
      cost_price: 75000,
      selling_price: 90000,
      current_stock: 10,
    });

    // Purchase 20 bags -> stock becomes 30
    const purchase = processPurchase(
      [makeItem({ productId: product.id, quantity: 20, costPrice: 75000 })],
      { applyVat: false },
    );
    assert.equal(getProductById(product.id)?.current_stock, 30);

    // Scenario A: If products were sold and current_stock is less than purchased quantity (e.g. stock down to 5)
    // and allow_negative_stock is false, returning 20 bags should be blocked
    run("UPDATE products SET current_stock = 5 WHERE id = ?", [product.id]);
    assert.throws(
      () => returnPurchase(purchase.id),
      /result in negative stock/i,
      "Should block return that would drive stock below 0",
    );

    // Scenario B: Restore stock to 25 and proceed with valid return
    run("UPDATE products SET current_stock = 25 WHERE id = ?", [product.id]);
    const returnResult = returnPurchase(purchase.id);
    assert.equal(returnResult.id, purchase.id);
    assert.equal(returnResult.deductedItemCount, 1);

    // Stock should be deducted by 20 (25 - 20 = 5)
    const afterReturn = getProductById(product.id);
    assert.equal(afterReturn?.current_stock, 5);

    // Purchase status must be 'RETURNED'
    const full = getPurchaseWithItems(purchase.id);
    assert.equal(full?.purchase.status, "RETURNED");
    assert.ok(full?.purchase.returned_at);

    // Cannot return twice
    assert.throws(
      () => returnPurchase(purchase.id),
      /already been returned/i,
      "Should block duplicate purchase return",
    );
  });

  test("12. Partial vendor return with Debit Note (DN) generation via processPurchaseReturn", () => {
    const product = createProduct({
      name: "Steel Rods 12mm",
      cost_price: 85000,
      selling_price: 110000,
      current_stock: 50,
    });

    const purchase = processPurchase(
      [makeItem({ productId: product.id, quantity: 20, costPrice: 85000 })],
      { vendorName: "Bhairahawa Steels", applyVat: false },
    );
    assert.equal(getProductById(product.id)?.current_stock, 70);

    // Return 5 damaged rods back to vendor
    const { returnRecord, items } = processPurchaseReturn({
      purchaseId: purchase.id,
      billNumber: purchase.bill_number,
      vendorId: purchase.vendor_id,
      vendorName: purchase.vendor_name,
      refundMethod: "CASH",
      reason: "DEFECTIVE",
      items: [
        {
          productId: product.id,
          quantity: 5,
          costPrice: 85000,
        },
      ],
    });

    assert.match(
      returnRecord.return_number,
      /^DN-\d{5}$/,
      "Debit note format DN-XXXXX",
    );
    assert.equal(returnRecord.total_refund, 425000); // 5 * 85000
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 5);

    // Inventory should be reduced by 5 from 70 to 65
    const afterReturn = getProductById(product.id);
    assert.equal(
      afterReturn?.current_stock,
      65,
      "Returned stock must be deducted from inventory",
    );
  });

  test("13. Real CRUD on Purchases: INSERT into db, FETCH purchase & items, UPDATE purchase, and RETURN with stock reversal", () => {
    const p1 = createProduct({ name: "Rice 25kg Bag", cost_price: 200000, selling_price: 250000, current_stock: 10 });
    const p2 = createProduct({ name: "Sunflower Oil 5L", cost_price: 110000, selling_price: 140000, current_stock: 15 });

    // 1. CREATE / INSERT into db
    const purchase = processPurchase(
      [
        makeItem({ productId: p1.id, quantity: 5, costPrice: 200000 }),
        makeItem({ productId: p2.id, quantity: 10, costPrice: 110000 }),
      ],
      { paymentMethod: "Cash", paidAmount: 2100000, applyVat: false }
    );

    // 2. READ / FETCH directly from SQLite purchases table
    const dbPurchase = queryOne<{
      id: number;
      bill_number: string;
      subtotal: number;
      total: number;
      paid_amount: number;
      payment_method: string;
      status: string;
    }>("SELECT * FROM purchases WHERE id = ?", [purchase.id]);

    assert.ok(dbPurchase);
    assert.equal(dbPurchase.id, purchase.id);
    assert.equal(dbPurchase.subtotal, 2100000); // (5*200000) + (10*110000) = 2100000
    assert.equal(dbPurchase.total, 2100000);
    assert.equal(dbPurchase.paid_amount, 2100000);
    assert.equal(dbPurchase.status, "COMPLETED");

    // Fetch purchase items directly from purchase_items table
    const dbItems = query<{
      purchase_id: number;
      product_id: number;
      quantity: number;
      cost_price: number;
      total: number;
    }>("SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY product_id ASC", [purchase.id]);

    assert.equal(dbItems.length, 2);
    assert.equal(dbItems[0].product_id, p1.id);
    assert.equal(dbItems[0].quantity, 5);
    assert.equal(dbItems[0].cost_price, 200000);
    assert.equal(dbItems[1].product_id, p2.id);
    assert.equal(dbItems[1].quantity, 10);
    assert.equal(dbItems[1].cost_price, 110000);

    // Stocks in products table were incremented
    assert.equal(getProductById(p1.id)?.current_stock, 15);
    assert.equal(getProductById(p2.id)?.current_stock, 25);

    // 3. UPDATE in SQLite database
    updatePurchase(
      purchase.id,
      [makeItem({ productId: p1.id, quantity: 8, costPrice: 200000 })],
      { paymentMethod: "Cash", paidAmount: 1600000, applyVat: false }
    );

    const updatedDbPurchase = queryOne<{ total: number; paid_amount: number }>(
      "SELECT total, paid_amount FROM purchases WHERE id = ?",
      [purchase.id]
    );
    assert.ok(updatedDbPurchase);
    assert.equal(updatedDbPurchase.total, 1600000);
    assert.equal(updatedDbPurchase.paid_amount, 1600000);

    const updatedDbItems = query("SELECT * FROM purchase_items WHERE purchase_id = ?", [purchase.id]);
    assert.equal(updatedDbItems.length, 1);

    // Reverted p2 stock to 15, and p1 stock became 10 + 8 = 18
    assert.equal(getProductById(p1.id)?.current_stock, 18);
    assert.equal(getProductById(p2.id)?.current_stock, 15);

    // 4. RETURN / VOID in SQLite database
    returnPurchase(purchase.id);

    const returnedDbPurchase = queryOne<{ status: string }>("SELECT status FROM purchases WHERE id = ?", [purchase.id]);
    assert.ok(returnedDbPurchase);
    assert.equal(returnedDbPurchase.status, "RETURNED");

    // Stock for p1 is fully reversed back to 10
    assert.equal(getProductById(p1.id)?.current_stock, 10);
  });
});
