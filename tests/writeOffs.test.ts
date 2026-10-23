/**
 * Feature: Stock Write-Offs, Spoilage & Scrap Vouchers Suite
 * Tests:
 * 1. createStockWriteOff generates sequential voucher number (WO-XXXXX) and deducts product stock
 * 2. createStockWriteOff deducts stock from batch when batchId is provided
 * 3. createStockWriteOff logs negative stock movement with voucher reference
 * 4. createStockWriteOff with recordAsExpense=true records overhead in expenses table under 'Inventory Loss / Spoilage'
 * 5. getExpiredBatchCandidates identifies batches past expiry date with remaining inventory
 * 6. getWriteOffSummary aggregates total loss amount, units written off, and breakdown by reason
 * 7. getAllStockWriteOffs retrieves all vouchers in descending order
 * 8. Real CRUD on Stock Write-Offs: raw SQL INSERT into stock_write_offs, direct SELECT verification, UPDATE voucher, and DELETE
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';

const {
  createStockWriteOff,
  getAllStockWriteOffs,
  getWriteOffSummary,
  getExpiredBatchCandidates,
} = await import('../src/lib/services/writeOffService.ts');

const {
  createProduct,
  getProductById,
} = await import('../src/lib/services/productService.ts');

const {
  createOrAddBatch,
} = await import('../src/lib/services/batchService.ts');

const {
  getStockMovements,
} = await import('../src/lib/services/inventoryService.ts');

const { queryOne, query, run } = await import('../src/lib/db/sqliteEngine.ts');

describe('Feature: Stock Write-Offs & Spoilage', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. createStockWriteOff generates sequential voucher number (WO-XXXXX) and deducts product stock', () => {
    const product = createProduct({
      name: 'Fresh Cow Milk 1L',
      cost_price: 9000, // Rs 90
      selling_price: 11000,
      current_stock: 50,
      unit: 'packet',
    });

    const writeOff1 = createStockWriteOff({
      productId: product.id,
      quantity: 5,
      reason: 'SPOILED_LEAKED',
      action: 'DISPOSAL',
      approvedBy: 'Binod Manager',
      notes: 'Punctured during transit',
    });

    assert.equal(writeOff1.voucher_number, 'WO-00001');
    assert.equal(writeOff1.product_id, product.id);
    assert.equal(writeOff1.quantity, 5);
    assert.equal(writeOff1.unit_cost, 9000);
    assert.equal(writeOff1.total_loss, 45000); // 5 * 9000
    assert.equal(writeOff1.reason, 'SPOILED_LEAKED');
    assert.equal(writeOff1.action, 'DISPOSAL');
    assert.equal(writeOff1.approved_by, 'Binod Manager');

    // Verify product stock deducted
    const updatedProd = getProductById(product.id);
    assert.equal(updatedProd?.current_stock, 45); // 50 - 5

    // Second write-off gets next sequential voucher number
    const writeOff2 = createStockWriteOff({
      productId: product.id,
      quantity: 2,
      reason: 'DAMAGED',
    });
    assert.equal(writeOff2.voucher_number, 'WO-00002');
  });

  test('2. createStockWriteOff deducts stock from batch when batchId is provided', () => {
    const product = createProduct({
      name: 'Amul Butter 500g',
      cost_price: 45000,
      selling_price: 52000,
      current_stock: 30,
    });

    const batch = createOrAddBatch({
      productId: product.id,
      batchNumber: 'AMUL-B-2025',
      expiryDate: '2026-03-31',
      costPrice: 45000,
      quantity: 20,
    });

    const writeOff = createStockWriteOff({
      productId: product.id,
      batchId: batch.id,
      batchNumber: batch.batch_number,
      quantity: 4,
      reason: 'EXPIRED',
      action: 'DISPOSAL',
    });

    assert.equal(writeOff.batch_id, batch.id);
    assert.equal(writeOff.batch_number, 'AMUL-B-2025');

    // Verify batch stock is deducted
    const updatedBatch = queryOne<{ quantity: number }>('SELECT quantity FROM product_batches WHERE id = ?', [batch.id]);
    assert.equal(updatedBatch?.quantity, 16); // 20 - 4
  });

  test('3. createStockWriteOff logs negative stock movement with voucher reference', () => {
    const product = createProduct({
      name: 'Britannia Biscuits',
      cost_price: 2500,
      selling_price: 3000,
      current_stock: 100,
    });

    const writeOff = createStockWriteOff({
      productId: product.id,
      quantity: 10,
      reason: 'LOST_STOLEN',
      notes: 'Shrinkage discovered during inventory count',
    });

    const movements = getStockMovements({ productId: product.id });
    const woMovement = movements.find((m) => m.note?.includes(writeOff.voucher_number));
    assert.ok(woMovement, 'Must record stock movement for write-off');
    assert.equal(woMovement.quantity, -10);
    assert.equal(woMovement.type, 'ADJUSTMENT');
  });

  test('4. createStockWriteOff with recordAsExpense=true records overhead in expenses table under "Inventory Loss / Spoilage"', () => {
    const product = createProduct({
      name: 'Basmati Rice 25kg Sack',
      cost_price: 280000,
      selling_price: 320000,
      current_stock: 10,
    });

    const writeOff = createStockWriteOff({
      productId: product.id,
      quantity: 1,
      reason: 'DAMAGED',
      recordAsExpense: true,
      notes: 'Water damage during rainfall leak',
    });

    const exp = queryOne<{
      category: string;
      amount: number;
      receipt_reference: string;
      payment_method: string;
      note: string;
    }>('SELECT * FROM expenses WHERE receipt_reference = ?', [writeOff.voucher_number]);

    assert.ok(exp, 'Expense record should be created when recordAsExpense is true');
    assert.equal(exp.category, 'Inventory Loss / Spoilage');
    assert.equal(exp.amount, 280000);
    assert.equal(exp.payment_method, 'Non-Cash Loss');
    assert.ok(exp.note.includes('Basmati Rice 25kg Sack'));
  });

  test('5. getExpiredBatchCandidates identifies batches past expiry date with remaining inventory', () => {
    const product = createProduct({
      name: 'Yogurt Dahi 500ml',
      cost_price: 5000,
      selling_price: 6500,
      current_stock: 40,
    });

    // Expired batch with stock
    createOrAddBatch({
      productId: product.id,
      batchNumber: 'DAHI-EXP-01',
      expiryDate: '2026-01-01',
      costPrice: 5000,
      quantity: 15,
    });

    // Valid unexpired batch
    createOrAddBatch({
      productId: product.id,
      batchNumber: 'DAHI-FRESH-02',
      expiryDate: '2027-12-31',
      costPrice: 5000,
      quantity: 25,
    });

    const candidates = getExpiredBatchCandidates();
    assert.ok(candidates.length >= 1);
    const expiredMatch = candidates.find((c) => c.batchNumber === 'DAHI-EXP-01');
    assert.ok(expiredMatch);
    assert.equal(expiredMatch.quantity, 15);
    assert.equal(expiredMatch.costPrice, 5000);
    assert.equal(expiredMatch.totalLossValue, 75000); // 15 * 5000
  });

  test('6. getWriteOffSummary aggregates total loss amount, units written off, and breakdown by reason', () => {
    const product = createProduct({
      name: 'Digestive Biscuits',
      cost_price: 4000,
      selling_price: 5000,
      current_stock: 100,
    });

    createStockWriteOff({ productId: product.id, quantity: 10, reason: 'EXPIRED' }); // Loss: 40,000
    createStockWriteOff({ productId: product.id, quantity: 5, reason: 'DAMAGED' }); // Loss: 20,000
    createStockWriteOff({ productId: product.id, quantity: 3, reason: 'LOST_STOLEN' }); // Loss: 12,000

    const summary = getWriteOffSummary();
    assert.equal(summary.totalVouchersCount, 3);
    assert.equal(summary.totalUnitsWrittenOff, 18);
    assert.equal(summary.totalLossAmount, 72000);

    const expiredStat = summary.breakdownByReason.find((b) => b.reason === 'EXPIRED');
    assert.equal(expiredStat?.count, 1);
    assert.equal(expiredStat?.amount, 40000);

    const damagedStat = summary.breakdownByReason.find((b) => b.reason === 'DAMAGED');
    assert.equal(damagedStat?.count, 1);
    assert.equal(damagedStat?.amount, 20000);
  });

  test('7. getAllStockWriteOffs retrieves all vouchers in descending order', () => {
    const product = createProduct({ name: 'Snack A', cost_price: 1000, selling_price: 1500, current_stock: 50 });
    createStockWriteOff({ productId: product.id, quantity: 2, reason: 'EXPIRED' });
    createStockWriteOff({ productId: product.id, quantity: 3, reason: 'DAMAGED' });

    const all = getAllStockWriteOffs();
    assert.equal(all.length, 2);
    assert.equal(all[0].voucher_number, 'WO-00002');
    assert.equal(all[1].voucher_number, 'WO-00001');
  });

  test('8. Real CRUD on Stock Write-Offs: raw SQL INSERT into stock_write_offs, direct SELECT verification, UPDATE voucher, and DELETE', () => {
    const product = createProduct({ name: 'Raw Soap Pack', cost_price: 3500, selling_price: 4500, current_stock: 20 });
    const now = new Date().toISOString();

    // 1. RAW SQL INSERT
    run(
      `INSERT INTO stock_write_offs (
        voucher_number, product_id, product_name, quantity, unit_cost, total_loss,
        batch_id, batch_number, reason, action, approved_by, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'WO-RAW-999',
        product.id,
        product.name,
        4,
        3500,
        14000,
        null,
        null,
        'DEAD_STOCK',
        'QUARANTINE',
        'Store Admin',
        'Direct raw SQL scrap record',
        now,
      ]
    );

    const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const insertedId = row?.id ?? 0;
    assert.ok(insertedId > 0);

    // 2. RAW SQL SELECT
    const dbRow = queryOne<{
      id: number;
      voucher_number: string;
      product_name: string;
      quantity: number;
      total_loss: number;
      reason: string;
      action: string;
    }>('SELECT * FROM stock_write_offs WHERE id = ?', [insertedId]);

    assert.ok(dbRow);
    assert.equal(dbRow.voucher_number, 'WO-RAW-999');
    assert.equal(dbRow.product_name, 'Raw Soap Pack');
    assert.equal(dbRow.quantity, 4);
    assert.equal(dbRow.total_loss, 14000);
    assert.equal(dbRow.reason, 'DEAD_STOCK');
    assert.equal(dbRow.action, 'QUARANTINE');

    // 3. RAW SQL UPDATE
    run('UPDATE stock_write_offs SET action = ?, approved_by = ? WHERE id = ?', ['DISPOSAL', 'Owner', insertedId]);
    const updated = queryOne<{ action: string; approved_by: string }>(
      'SELECT action, approved_by FROM stock_write_offs WHERE id = ?',
      [insertedId]
    );
    assert.equal(updated?.action, 'DISPOSAL');
    assert.equal(updated?.approved_by, 'Owner');

    // 4. RAW SQL DELETE
    run('DELETE FROM stock_write_offs WHERE id = ?', [insertedId]);
    const deleted = queryOne('SELECT * FROM stock_write_offs WHERE id = ?', [insertedId]);
    assert.equal(deleted, null, 'Deleted stock write-off must be absent from stock_write_offs table');
  });
});

