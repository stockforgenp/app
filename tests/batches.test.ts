/**
 * Feature: Product Batches & FEFO Expiry Management Suite
 * Tests:
 * 1. createOrAddBatch creates a new product batch with batch number, expiry date, and unit cost
 * 2. createOrAddBatch adds quantity to existing batch when identical product_id and batch_number is supplied
 * 3. getBatchesForFEFO retrieves active batches ordered strictly by earliest expiry date (FEFO)
 * 4. getProductBatches retrieves all batches for a product with includeEmpty toggle
 * 5. getBatchById returns batch details with joined product metadata
 * 6. depleteBatchStock and addBatchStock manipulate batch quantity
 * 7. getAllBatches filters by status (HEALTHY, EXPIRING_SOON, EXPIRED) and keyword search
 * 8. Real CRUD on Product Batches: raw SQL INSERT into product_batches, direct SELECT, UPDATE, and DELETE
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';

const {
  createOrAddBatch,
  getBatchesForFEFO,
  getProductBatches,
  getBatchById,
  depleteBatchStock,
  addBatchStock,
  getAllBatches,
  getNearExpiryBatches,
  getExpiredBatches,
} = await import('../src/lib/services/batchService.ts');

const {
  createProduct,
} = await import('../src/lib/services/productService.ts');

const { queryOne, query, run } = await import('../src/lib/db/sqliteEngine.ts');

describe('Feature: Product Batches & FEFO Inventory', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. createOrAddBatch creates a new product batch with batch number, expiry date, and unit cost', () => {
    const prod = createProduct({ name: 'Paracetamol 500mg', cost_price: 150, selling_price: 250, current_stock: 100 });

    const batch = createOrAddBatch({
      productId: prod.id,
      batchNumber: 'PARA-2026-A',
      expiryDate: '2027-06-30',
      mfgDate: '2025-06-01',
      costPrice: 150,
      sellingPrice: 250,
      quantity: 50,
    });

    assert.ok(batch.id > 0);
    assert.equal(batch.product_id, prod.id);
    assert.equal(batch.batch_number, 'PARA-2026-A');
    assert.equal(batch.expiry_date, '2027-06-30');
    assert.equal(batch.mfg_date, '2025-06-01');
    assert.equal(batch.cost_price, 150);
    assert.equal(batch.quantity, 50);
  });

  test('2. createOrAddBatch adds quantity to existing batch when identical product_id and batch_number is supplied', () => {
    const prod = createProduct({ name: 'Dettol Antiseptic', cost_price: 12000, selling_price: 15000, current_stock: 40 });

    const b1 = createOrAddBatch({
      productId: prod.id,
      batchNumber: 'DET-BATCH-01',
      expiryDate: '2027-12-31',
      costPrice: 12000,
      quantity: 20,
    });

    const b2 = createOrAddBatch({
      productId: prod.id,
      batchNumber: 'det-batch-01', // case-insensitive match
      expiryDate: '2027-12-31',
      costPrice: 12500, // updated cost
      quantity: 15,
    });

    assert.equal(b2.id, b1.id);
    assert.equal(b2.quantity, 35); // 20 + 15
    assert.equal(b2.cost_price, 12500);
  });

  test('3. getBatchesForFEFO retrieves active batches ordered strictly by earliest expiry date (FEFO)', () => {
    const prod = createProduct({ name: 'Fresh Milk 500ml', cost_price: 4500, selling_price: 5500, current_stock: 100 });

    // Insert batches in non-chronological order
    createOrAddBatch({ productId: prod.id, batchNumber: 'LOT-MAY', expiryDate: '2026-05-10', costPrice: 4500, quantity: 20 });
    createOrAddBatch({ productId: prod.id, batchNumber: 'LOT-APR', expiryDate: '2026-04-20', costPrice: 4500, quantity: 15 });
    createOrAddBatch({ productId: prod.id, batchNumber: 'LOT-JUN', expiryDate: '2026-06-01', costPrice: 4500, quantity: 30 });
    createOrAddBatch({ productId: prod.id, batchNumber: 'LOT-EMPTY', expiryDate: '2026-04-10', costPrice: 4500, quantity: 0 }); // empty

    const fefoBatches = getBatchesForFEFO(prod.id);
    assert.equal(fefoBatches.length, 3, 'Empty batches must be omitted from FEFO picking');
    assert.equal(fefoBatches[0].batch_number, 'LOT-APR');
    assert.equal(fefoBatches[1].batch_number, 'LOT-MAY');
    assert.equal(fefoBatches[2].batch_number, 'LOT-JUN');
  });

  test('4. getProductBatches retrieves all batches for a product with includeEmpty toggle', () => {
    const prod = createProduct({ name: 'Juice Pack', cost_price: 2500, selling_price: 3500, current_stock: 50 });

    createOrAddBatch({ productId: prod.id, batchNumber: 'B1', expiryDate: '2026-08-01', costPrice: 2500, quantity: 10 });
    createOrAddBatch({ productId: prod.id, batchNumber: 'B2', expiryDate: '2026-09-01', costPrice: 2500, quantity: 0 });

    const allBatches = getProductBatches(prod.id, true);
    assert.equal(allBatches.length, 2);

    const nonZeroBatches = getProductBatches(prod.id, false);
    assert.equal(nonZeroBatches.length, 1);
    assert.equal(nonZeroBatches[0].batch_number, 'B1');
  });

  test('5. getBatchById returns batch details with joined product metadata', () => {
    const prod = createProduct({ name: 'Glucose Powder', sku: 'GLU-101', unit: 'jar', cost_price: 9000, selling_price: 12000, current_stock: 10 });
    const b = createOrAddBatch({ productId: prod.id, batchNumber: 'GLU-99', expiryDate: '2027-01-01', costPrice: 9000, quantity: 5 });

    const fetched = getBatchById(b.id);
    assert.ok(fetched);
    assert.equal(fetched.id, b.id);
    assert.equal(fetched.product_name, 'Glucose Powder');
    assert.equal(fetched.product_sku, 'GLU-101');
    assert.equal(fetched.product_unit, 'jar');
  });

  test('6. depleteBatchStock and addBatchStock manipulate batch quantity', () => {
    const prod = createProduct({ name: 'Tea Pack', cost_price: 5000, selling_price: 6500, current_stock: 50 });
    const b = createOrAddBatch({ productId: prod.id, batchNumber: 'TEA-01', expiryDate: '2027-01-01', costPrice: 5000, quantity: 20 });

    depleteBatchStock(b.id, 8);
    let updated = getBatchById(b.id);
    assert.equal(updated?.quantity, 12); // 20 - 8

    addBatchStock(b.id, 15);
    updated = getBatchById(b.id);
    assert.equal(updated?.quantity, 27); // 12 + 15
  });

  test('7. getAllBatches filters by status (HEALTHY, EXPIRING_SOON, EXPIRED) and keyword search', () => {
    const prod = createProduct({ name: 'Biscuits', cost_price: 2000, selling_price: 2500, current_stock: 60 });

    // Expired
    createOrAddBatch({ productId: prod.id, batchNumber: 'EXP-1', expiryDate: '2025-01-01', costPrice: 2000, quantity: 10 });
    // Healthy far future
    createOrAddBatch({ productId: prod.id, batchNumber: 'HLT-1', expiryDate: '2028-12-31', costPrice: 2000, quantity: 20 });

    const expiredList = getAllBatches({ status: 'EXPIRED' });
    assert.ok(expiredList.some((b) => b.batch_number === 'EXP-1'));

    const healthyList = getAllBatches({ status: 'HEALTHY' });
    assert.ok(healthyList.some((b) => b.batch_number === 'HLT-1'));

    const searchResult = getAllBatches({ search: 'HLT-1' });
    assert.equal(searchResult.length, 1);
    assert.equal(searchResult[0].batch_number, 'HLT-1');
  });

  test('8. Real CRUD on Product Batches: raw SQL INSERT into product_batches, direct SELECT, UPDATE, and DELETE', () => {
    const prod = createProduct({ name: 'Direct SQL Product', cost_price: 500, selling_price: 800, current_stock: 20 });
    const now = new Date().toISOString();

    // 1. RAW SQL INSERT
    run(
      `INSERT INTO product_batches (
        product_id, batch_number, mfg_date, expiry_date, cost_price, selling_price, quantity, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prod.id, 'RAW-SQL-BATCH', '2025-01-01', '2027-01-01', 500, 800, 10, now, now]
    );

    const bId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id')?.id ?? 0;
    assert.ok(bId > 0);

    // 2. RAW SQL SELECT
    const fetched = queryOne<{
      id: number;
      product_id: number;
      batch_number: string;
      quantity: number;
      cost_price: number;
    }>('SELECT * FROM product_batches WHERE id = ?', [bId]);

    assert.ok(fetched);
    assert.equal(fetched.product_id, prod.id);
    assert.equal(fetched.batch_number, 'RAW-SQL-BATCH');
    assert.equal(fetched.quantity, 10);
    assert.equal(fetched.cost_price, 500);

    // 3. RAW SQL UPDATE
    run('UPDATE product_batches SET quantity = 25, selling_price = 900 WHERE id = ?', [bId]);
    const updated = queryOne<{ quantity: number; selling_price: number }>(
      'SELECT quantity, selling_price FROM product_batches WHERE id = ?',
      [bId]
    );
    assert.equal(updated?.quantity, 25);
    assert.equal(updated?.selling_price, 900);

    // 4. RAW SQL DELETE
    run('DELETE FROM product_batches WHERE id = ?', [bId]);
    assert.equal(queryOne('SELECT * FROM product_batches WHERE id = ?', [bId]), null);
  });
});

