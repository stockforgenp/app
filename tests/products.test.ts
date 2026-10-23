/**
 * Feature 2 Test: Stock Ledger & Product Management Suite
 * Tests:
 * 1. createProduct with custom SKU, pricing, wholesale tiers, and initial stock movement
 * 2. createProduct with zero initial stock (no spurious movement)
 * 3. generateProductSku auto-generation & collision prevention
 * 4. createProductsBatch bulk creation in atomic transaction
 * 5. updateProduct modifies pricing and metadata without corrupting current_stock
 * 6. getAllProducts search and filtering by name and SKU
 * 7. restockProduct increases inventory and logs RESTOCK movement in stock ledger
 * 8. restockProduct validation (rejects <= 0 quantity and invalid product ID)
 * 9. adjustStock performs manual inventory audit reconciliation (positive & negative deltas)
 * 10. adjustStock respects allow_negative_stock configuration
 * 11. getStockMovements query and filtering by product, type, and keyword
 * 12. getLowStockProducts and getLowStockCount threshold alerts
 * 13. getProductCount, getTotalInventoryUnits, and getTotalInventoryValuation aggregations
 * 14. Multi-Unit Packaging rules via packagingService (create, list, delete)
 * 15. FEFO (First Expiring, First Out) batch & expiry tracking via batchService
 * 16. deleteProduct safety checks (blocks deletion if linked to sales or purchases; cascades otherwise)
 */

import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";

// Dynamically import after setup has registered the wasm loader
const {
  createProduct,
  createProductsBatch,
  updateProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  getProductCount,
  getTotalInventoryUnits,
  getTotalInventoryValuation,
  getLowStockProducts,
  getLowStockCount,
  generateProductSku,
} = await import("../src/lib/services/productService.ts");

const { restockProduct, adjustStock, getStockMovements } =
  await import("../src/lib/services/inventoryService.ts");

const { createPackaging, getProductPackagings, deletePackaging } =
  await import("../src/lib/services/packagingService.ts");

const {
  createOrAddBatch,
  getBatchesForFEFO,
  depleteBatchStock,
  addBatchStock,
} = await import("../src/lib/services/batchService.ts");

const { updateSettings } =
  await import("../src/lib/services/settingsService.ts");
const { run, query } = await import("../src/lib/db/sqliteEngine.ts");

describe("Feature 2: Stock Ledger & Product Management", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test("1. createProduct persists item and records initial stock in stock_movements", () => {
    const product = createProduct({
      name: "tokla tea gold",
      sku: "TTG-001",
      unit: "packet",
      cost_price: 12000, // Rs. 120.00
      selling_price: 15000, // Rs. 150.00
      wholesale_price: 13500, // Rs. 135.00
      wholesale_min_qty: 12,
      current_stock: 50,
      min_stock_alert: 10,
    });

    assert.ok(product.id > 0, "Product should receive auto-incremented ID");
    assert.equal(
      product.name,
      "Tokla Tea Gold",
      "Name should be automatically title-cased",
    );
    assert.equal(product.sku, "TTG-001");
    assert.equal(product.unit, "packet");
    assert.equal(product.cost_price, 12000);
    assert.equal(product.selling_price, 15000);
    assert.equal(product.wholesale_price, 13500);
    assert.equal(product.wholesale_min_qty, 12);
    assert.equal(product.current_stock, 50);
    assert.equal(product.min_stock_alert, 10);

    // Verify initial stock movement in ledger
    const movements = getStockMovements({ productId: product.id });
    assert.equal(
      movements.length,
      1,
      "Initial stock should create exactly 1 stock movement",
    );
    assert.equal(movements[0].type, "RESTOCK");
    assert.equal(movements[0].quantity, 50);
    assert.equal(movements[0].note, "Initial stock for new product");
  });

  test("2. createProduct with 0 initial stock does not log empty stock movement", () => {
    const product = createProduct({
      name: "Zero Stock Biscuit",
      cost_price: 2000,
      selling_price: 2500,
      current_stock: 0,
    });

    assert.equal(product.current_stock, 0);
    const movements = getStockMovements({ productId: product.id });
    assert.equal(
      movements.length,
      0,
      "No stock movement should be generated for 0 initial stock",
    );
  });

  test("3. generateProductSku creates clean standard prefixes and handles collisions", () => {
    // Multi-word name prefix derivation
    const sku1 = generateProductSku("Wai Wai Quick Chowmein");
    assert.match(
      sku1,
      /^WWQ-\d{4}$/,
      "Should generate prefix from first letters of words",
    );

    // Single word name prefix derivation
    const sku2 = generateProductSku("Horlicks");
    assert.match(
      sku2,
      /^HOR-\d{4}$/,
      "Should take first 3 letters for single words",
    );

    // Default prefix fallback
    const sku3 = generateProductSku("");
    assert.match(
      sku3,
      /^SKU-\d{4}$/,
      "Should fall back to SKU prefix when empty",
    );

    // Collision handling: inserting a product with candidate SKU
    const p1 = createProduct({
      name: "Milk Powder",
      sku: "MIL-0001",
      cost_price: 3000,
      selling_price: 3500,
      current_stock: 5,
    });
    assert.equal(p1.sku, "MIL-0001");

    // Auto-generation for similar product should skip MIL-0001
    const generated = generateProductSku("Milk Powder");
    assert.notEqual(
      generated,
      "MIL-0001",
      "Should increment suffix to avoid collision with existing SKU",
    );
  });

  test("4. createProductsBatch inserts multiple products inside an ACID transaction", () => {
    const batchInput = [
      {
        name: "Red Apple",
        cost_price: 10000,
        selling_price: 14000,
        current_stock: 20,
      },
      {
        name: "Green Pear",
        cost_price: 12000,
        selling_price: 16000,
        current_stock: 15,
      },
      {
        name: "Yellow Banana",
        cost_price: 5000,
        selling_price: 8000,
        current_stock: 30,
      },
    ];

    const created = createProductsBatch(batchInput);
    assert.equal(created.length, 3);
    assert.equal(getProductCount(), 3);

    const totalUnits = getTotalInventoryUnits();
    assert.equal(
      totalUnits,
      65,
      "Total units should equal sum of current_stock (20 + 15 + 30)",
    );
  });

  test("5. updateProduct modifies metadata and pricing without corrupting current_stock", () => {
    const product = createProduct({
      name: "Original Mustard Oil",
      sku: "OIL-001",
      cost_price: 25000,
      selling_price: 30000,
      current_stock: 45,
    });

    updateProduct(product.id, {
      name: "Pure Mustard Oil 1L",
      sku: "OIL-001-MOD",
      unit: "litre",
      cost_price: 26000,
      selling_price: 32000,
      wholesale_price: 29000,
      wholesale_min_qty: 10,
      min_stock_alert: 8,
    });

    const updated = getProductById(product.id);
    assert.ok(updated);
    assert.equal(updated.name, "Pure Mustard Oil 1L");
    assert.equal(updated.sku, "OIL-001-MOD");
    assert.equal(updated.unit, "litre");
    assert.equal(updated.cost_price, 26000);
    assert.equal(updated.selling_price, 32000);
    assert.equal(updated.wholesale_price, 29000);
    assert.equal(updated.wholesale_min_qty, 10);
    assert.equal(updated.min_stock_alert, 8);
    // Stock must stay 45!
    assert.equal(
      updated.current_stock,
      45,
      "updateProduct must not mutate current_stock directly",
    );
  });

  test("6. getAllProducts filters correctly by search keyword (name and SKU)", () => {
    createProduct({
      name: "Coca Cola 500ml",
      sku: "COKE-500",
      cost_price: 5000,
      selling_price: 6500,
      current_stock: 10,
    });
    createProduct({
      name: "Sprite 500ml",
      sku: "SPR-500",
      cost_price: 5000,
      selling_price: 6500,
      current_stock: 10,
    });
    createProduct({
      name: "Fanta Orange",
      sku: "FAN-500",
      cost_price: 5000,
      selling_price: 6500,
      current_stock: 10,
    });

    // Search by partial name
    const cokeResults = getAllProducts("coca");
    assert.equal(cokeResults.length, 1);
    assert.equal(cokeResults[0].sku, "COKE-500");

    // Search by SKU
    const skuResults = getAllProducts("SPR");
    assert.equal(skuResults.length, 1);
    assert.equal(skuResults[0].name, "Sprite 500ml");

    // General search returning all
    const all = getAllProducts();
    assert.equal(all.length, 3);
  });

  test("7. restockProduct increases stock and appends RESTOCK ledger movement", () => {
    const product = createProduct({
      name: "Basmati Rice 25kg",
      cost_price: 240000,
      selling_price: 280000,
      current_stock: 10,
    });

    restockProduct(
      product.id,
      25,
      "Container delivery restock",
      101,
      "Everest Agro Suppliers",
    );

    const updated = getProductById(product.id);
    assert.equal(
      updated?.current_stock,
      35,
      "Stock should increase from 10 to 35",
    );

    const movements = getStockMovements({ productId: product.id });
    assert.equal(movements.length, 2); // Initial stock (10) + restock (25)

    const latest = movements[0];
    assert.equal(latest.type, "RESTOCK");
    assert.equal(latest.quantity, 25);
    assert.equal(latest.vendor_id, 101);
    assert.equal(latest.vendor_name, "Everest Agro Suppliers");
    assert.equal(latest.note, "Container delivery restock");
  });

  test("8. restockProduct validation rejects invalid quantities and missing products", () => {
    const product = createProduct({
      name: "Sugar 1kg",
      cost_price: 8000,
      selling_price: 9500,
      current_stock: 10,
    });

    assert.throws(
      () => restockProduct(product.id, 0),
      /greater than zero/i,
      "Should reject 0 quantity restock",
    );

    assert.throws(
      () => restockProduct(product.id, -5),
      /greater than zero/i,
      "Should reject negative quantity restock",
    );

    assert.throws(
      () => restockProduct(99999, 10),
      /Product not found/i,
      "Should reject restock for non-existent product",
    );
  });

  test("9. adjustStock performs audit adjustments with correct positive and negative deltas", () => {
    const product = createProduct({
      name: "Green Cardamom",
      cost_price: 35000,
      selling_price: 45000,
      current_stock: 50,
    });

    // Upward adjustment: physical count found 55 (+5)
    adjustStock(product.id, 55, "Physical inventory recount surplus");
    let p = getProductById(product.id);
    assert.equal(p?.current_stock, 55);

    let movements = getStockMovements({ productId: product.id });
    assert.equal(movements[0].type, "ADJUSTMENT");
    assert.equal(movements[0].quantity, 5);

    // Downward adjustment: physical count found 48 (-7)
    adjustStock(product.id, 48, "Breakage & spillage adjustment");
    p = getProductById(product.id);
    assert.equal(p?.current_stock, 48);

    movements = getStockMovements({ productId: product.id });
    assert.equal(movements[0].type, "ADJUSTMENT");
    assert.equal(movements[0].quantity, -7);

    // Same stock: no change
    const movementsBeforeNoop = movements.length;
    adjustStock(product.id, 48, "Identical count");
    movements = getStockMovements({ productId: product.id });
    assert.equal(
      movements.length,
      movementsBeforeNoop,
      "No movement logged if delta is 0",
    );
  });

  test("10. adjustStock respects allow_negative_stock setting", () => {
    const product = createProduct({
      name: "Coffee Beans",
      cost_price: 15000,
      selling_price: 20000,
      current_stock: 5,
    });

    // Default setting: allow_negative_stock is false
    assert.throws(
      () => adjustStock(product.id, -2),
      /Negative stock is not permitted/i,
      "Should block negative stock when setting is disabled",
    );

    // Enable allow_negative_stock
    updateSettings({ allow_negative_stock: true });

    // Now adjustment to negative should succeed
    adjustStock(product.id, -2, "Backorder overdraft");
    const p = getProductById(product.id);
    assert.equal(p?.current_stock, -2);
  });

  test("11. getStockMovements allows filtering by type, product, and search text", () => {
    const p1 = createProduct({
      name: "Chowmein Packet",
      cost_price: 2000,
      selling_price: 3000,
      current_stock: 10,
    });
    const p2 = createProduct({
      name: "Salt Packet",
      cost_price: 1000,
      selling_price: 2000,
      current_stock: 20,
    });

    restockProduct(p1.id, 15, "Urgent stock reload");
    adjustStock(p2.id, 18, "Damaged pack deduction");

    // Filter by type RESTOCK
    const restocks = getStockMovements({ type: "RESTOCK" });
    assert.ok(
      restocks.length >= 3,
      "Should include initial stocks + restock movement",
    );
    assert.ok(restocks.every((m) => m.type === "RESTOCK"));

    // Filter by type ADJUSTMENT
    const adjustments = getStockMovements({ type: "ADJUSTMENT" });
    assert.equal(adjustments.length, 1);
    assert.equal(adjustments[0].product_id, p2.id);

    // Filter by note search
    const searched = getStockMovements({ search: "urgent" });
    assert.equal(searched.length, 1);
    assert.equal(searched[0].product_id, p1.id);
  });

  test("12. getLowStockProducts and getLowStockCount track products below threshold", () => {
    createProduct({
      name: "Item High",
      cost_price: 1000,
      selling_price: 1500,
      current_stock: 25,
    });
    createProduct({
      name: "Item Low 1",
      cost_price: 1000,
      selling_price: 1500,
      current_stock: 8,
    });
    createProduct({
      name: "Item Low 2",
      cost_price: 1000,
      selling_price: 1500,
      current_stock: 2,
    });
    createProduct({
      name: "Item Empty",
      cost_price: 1000,
      selling_price: 1500,
      current_stock: 0,
    });

    // With threshold 10
    const lowCount = getLowStockCount(10);
    assert.equal(lowCount, 3, "Three items have stock <= 10");

    const lowProducts = getLowStockProducts(10);
    assert.equal(lowProducts.length, 3);
    // Ordered by current_stock ASC: 0, 2, 8
    assert.equal(lowProducts[0].name, "Item Empty");
    assert.equal(lowProducts[1].name, "Item Low 2");
    assert.equal(lowProducts[2].name, "Item Low 1");
  });

  test("13. getProductCount, getTotalInventoryUnits, and getTotalInventoryValuation calculation", () => {
    createProduct({
      name: "Product A",
      cost_price: 10000, // 100
      selling_price: 15000,
      current_stock: 10, // val = 10 * 10000 = 100000
    });
    createProduct({
      name: "Product B",
      cost_price: 20000, // 200
      selling_price: 30000,
      current_stock: 5, // val = 5 * 20000 = 100000
    });
    createProduct({
      name: "Product C",
      cost_price: 50000,
      selling_price: 70000,
      current_stock: 0, // val = 0
    });

    assert.equal(getProductCount(), 3);
    assert.equal(getTotalInventoryUnits(), 15);
    assert.equal(getTotalInventoryValuation(), 200000);
  });

  test("14. Multi-Unit Packaging rules (create, list, delete) via packagingService", () => {
    const product = createProduct({
      name: "Soap Bar 100g",
      unit: "pcs",
      cost_price: 3000,
      selling_price: 4000,
      current_stock: 120,
    });

    // Create 1 Carton = 24 pcs
    const carton = createPackaging({
      productId: product.id,
      packageName: "Carton",
      packageUnit: "ctn",
      multiplier: 24,
      sellingPrice: 90000, // Rs. 900 bulk discount
      barcode: "8901234567890",
    });

    assert.ok(carton.id > 0);
    assert.equal(carton.product_id, product.id);
    assert.equal(carton.package_name, "Carton");
    assert.equal(carton.multiplier, 24);
    assert.equal(carton.selling_price, 90000);
    assert.equal(carton.barcode, "8901234567890");

    // Create 1 Box = 6 pcs
    createPackaging({
      productId: product.id,
      packageName: "Box",
      packageUnit: "box",
      multiplier: 6,
      sellingPrice: 23500,
    });

    // Retrieve packagings
    const packagings = getProductPackagings(product.id);
    assert.equal(packagings.length, 2);
    // Ordered by multiplier ASC
    assert.equal(packagings[0].multiplier, 6);
    assert.equal(packagings[1].multiplier, 24);

    // Delete packaging
    deletePackaging(carton.id);
    const afterDelete = getProductPackagings(product.id);
    assert.equal(afterDelete.length, 1);
    assert.equal(afterDelete[0].package_name, "Box");
  });

  test("15. FEFO (First Expiring, First Out) batch & expiry tracking via batchService", () => {
    const product = createProduct({
      name: "Dairy Milk Chocolate",
      cost_price: 5000,
      selling_price: 8000,
      current_stock: 60,
    });

    // Batch A: expires in 60 days
    const batchA = createOrAddBatch({
      productId: product.id,
      batchNumber: "LOT-2026-A",
      expiryDate: "2026-12-01",
      costPrice: 5000,
      sellingPrice: 8000,
      quantity: 20,
    });

    // Batch B: expires earlier in 15 days
    const batchB = createOrAddBatch({
      productId: product.id,
      batchNumber: "LOT-2026-B",
      expiryDate: "2026-10-15",
      costPrice: 5000,
      sellingPrice: 8000,
      quantity: 40,
    });

    // FEFO should return Batch B before Batch A because 2026-10-15 < 2026-12-01
    const fefoBatches = getBatchesForFEFO(product.id);
    assert.equal(fefoBatches.length, 2);
    assert.equal(fefoBatches[0].batch_number, "LOT-2026-B");
    assert.equal(fefoBatches[1].batch_number, "LOT-2026-A");

    // Deplete stock from batch
    depleteBatchStock(batchB.id, 15);
    const updatedFefo = getBatchesForFEFO(product.id);
    assert.equal(updatedFefo[0].quantity, 25);

    // Add stock back to batch
    addBatchStock(batchB.id, 5);
    const reloadedFefo = getBatchesForFEFO(product.id);
    assert.equal(reloadedFefo[0].quantity, 30);

    // Adding existing batch number merges quantity
    createOrAddBatch({
      productId: product.id,
      batchNumber: "LOT-2026-A",
      expiryDate: "2026-12-01",
      costPrice: 5000,
      quantity: 10,
    });
    const mergedBatches = getBatchesForFEFO(product.id);
    const batchARecord = mergedBatches.find(
      (b) => b.batch_number === "LOT-2026-A",
    );
    assert.equal(
      batchARecord?.quantity,
      30,
      "Existing batch quantity should increase by 10 (20 + 10 = 30)",
    );
  });

  test("16. deleteProduct referential integrity checks and safe deletion", () => {
    const product = createProduct({
      name: "Temporary Promo Item",
      cost_price: 1000,
      selling_price: 1500,
      current_stock: 5,
    });

    // Deleting product without sale/purchase references succeeds and cleans up stock_movements
    deleteProduct(product.id);
    assert.equal(getProductById(product.id), null);
    const orphanedMovements = getStockMovements({ productId: product.id });
    assert.equal(
      orphanedMovements.length,
      0,
      "Movements for deleted product should be removed",
    );

    // Create another product and link a dummy sale item
    const soldProduct = createProduct({
      name: "Protected Selling Item",
      cost_price: 2000,
      selling_price: 3000,
      current_stock: 10,
    });

    // Simulate an existing sale record in sale_items table
    run(
      `INSERT INTO sales (bill_number, subtotal, discount, total, payment_method, status, created_at)
       VALUES ('INV-TEST-001', 3000, 0, 3000, 'Cash', 'COMPLETED', datetime('now'))`,
    );
    const saleId = query<{ id: number }>("SELECT last_insert_rowid() as id")[0]
      .id;
    run(
      `INSERT INTO sale_items (sale_id, product_id, quantity, cost_price, selling_price, total)
       VALUES (?, ?, 1, 2000, 3000, 3000)`,
      [saleId, soldProduct.id],
    );

    // Attempting to delete soldProduct must throw an error
    assert.throws(
      () => deleteProduct(soldProduct.id),
      /historical sales records/i,
      "Should block deletion of product referenced in sales",
    );
    assert.ok(
      getProductById(soldProduct.id) !== null,
      "Product must remain intact",
    );

    // Create another product and link a purchase item
    const purchasedProduct = createProduct({
      name: "Protected Purchased Item",
      cost_price: 2000,
      selling_price: 3000,
      current_stock: 10,
    });

    run(
      `INSERT INTO purchases (bill_number, subtotal, discount, total, payment_method, created_at)
       VALUES ('PUR-TEST-001', 2000, 0, 2000, 'Cash', datetime('now'))`,
    );
    const purchaseId = query<{ id: number }>(
      "SELECT last_insert_rowid() as id",
    )[0].id;
    run(
      `INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price, total)
       VALUES (?, ?, 1, 2000, 2000)`,
      [purchaseId, purchasedProduct.id],
    );

    assert.throws(
      () => deleteProduct(purchasedProduct.id),
      /historical purchase records/i,
      "Should block deletion of product referenced in purchases",
    );
    assert.ok(
      getProductById(purchasedProduct.id) !== null,
      "Product must remain intact",
    );
  });
});
