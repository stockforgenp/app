/**
 * Feature: Returns & Credit/Debit Notes Management Suite
 * Tests:
 * 1. processSaleReturn generates sequential Credit Note (CN-XXXXX) and calculates total refund
 * 2. processSaleReturn with action='RESTOCK' restores product stock and logs RESTOCK movement
 * 3. processSaleReturn with action='DAMAGED' avoids restocking salable product inventory
 * 4. processSaleReturn links to saleId, updates status to PARTIAL_RETURN or RETURNED, and reduces due on CREDIT_NOTE
 * 5. processPurchaseReturn generates sequential Debit Note (DN-XXXXX) and deducts product stock
 * 6. processPurchaseReturn with batchId reduces batch inventory and logs ADJUSTMENT movement
 * 7. getAllSaleReturns and getSaleReturnItems retrieve returns and line items
 * 8. getAllPurchaseReturns and getPurchaseReturnItems retrieve debit notes and line items
 * 9. Real CRUD on Sale Returns: raw SQL INSERT into sale_returns and sale_return_items, SELECT, UPDATE, and DELETE
 * 10. Real CRUD on Purchase Returns: raw SQL INSERT into purchase_returns and purchase_return_items, SELECT, UPDATE, and DELETE
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';

const {
  processSaleReturn,
  getAllSaleReturns,
  getSaleReturnItems,
  processPurchaseReturn,
  getAllPurchaseReturns,
  getPurchaseReturnItems,
} = await import('../src/lib/services/returnsService.ts');

const {
  createProduct,
  getProductById,
} = await import('../src/lib/services/productService.ts');

const {
  processSale,
} = await import('../src/lib/services/salesService.ts');

const {
  processPurchase,
} = await import('../src/lib/services/purchaseService.ts');

const {
  createOrAddBatch,
} = await import('../src/lib/services/batchService.ts');

const {
  findOrCreateCustomer,
} = await import('../src/lib/services/customerService.ts');

const {
  findOrCreateVendor,
} = await import('../src/lib/services/vendorService.ts');

const { getStockMovements } = await import('../src/lib/services/inventoryService.ts');
const { queryOne, query, run } = await import('../src/lib/db/sqliteEngine.ts');

describe('Feature: Returns & Credit/Debit Notes', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. processSaleReturn generates sequential Credit Note (CN-XXXXX) and calculates total refund', () => {
    const prod1 = createProduct({ name: 'Shampoo 200ml', cost_price: 15000, selling_price: 22000, current_stock: 50 });
    const prod2 = createProduct({ name: 'Soap Bar', cost_price: 3000, selling_price: 4500, current_stock: 100 });

    const ret1 = processSaleReturn({
      items: [
        { productId: prod1.id, quantity: 2, unitPrice: 22000 },
        { productId: prod2.id, quantity: 4, unitPrice: 4500 },
      ],
      refundMethod: 'CASH',
      reason: 'CUSTOMER_CANCELLED',
      notes: 'Customer bought extra items by mistake',
    });

    assert.equal(ret1.returnRecord.return_number, 'CN-00001');
    assert.equal(ret1.returnRecord.total_refund, 2 * 22000 + 4 * 4500); // 44000 + 18000 = 62000
    assert.equal(ret1.returnRecord.refund_method, 'CASH');
    assert.equal(ret1.items.length, 2);

    const ret2 = processSaleReturn({
      items: [{ productId: prod1.id, quantity: 1, unitPrice: 22000 }],
      refundMethod: 'CASH',
    });
    assert.equal(ret2.returnRecord.return_number, 'CN-00002');
  });

  test('2. processSaleReturn with action="RESTOCK" restores product stock and logs RESTOCK movement', () => {
    const prod = createProduct({ name: 'Cooking Oil 1L', cost_price: 20000, selling_price: 26000, current_stock: 20 });

    processSaleReturn({
      items: [{ productId: prod.id, quantity: 3, unitPrice: 26000, action: 'RESTOCK' }],
      refundMethod: 'CASH',
    });

    const updatedProd = getProductById(prod.id);
    assert.equal(updatedProd?.current_stock, 23); // 20 + 3

    const movements = getStockMovements({ productId: prod.id });
    const retMv = movements.find((m) => m.type === 'RESTOCK' && m.note?.includes('CN-00001'));
    assert.ok(retMv);
    assert.equal(retMv.quantity, 3);
  });

  test('3. processSaleReturn with action="DAMAGED" avoids restocking salable product inventory', () => {
    const prod = createProduct({ name: 'Glass Tumbler', cost_price: 8000, selling_price: 12000, current_stock: 15 });

    processSaleReturn({
      items: [{ productId: prod.id, quantity: 2, unitPrice: 12000, action: 'DAMAGED' }],
      reason: 'DEFECTIVE',
    });

    const updatedProd = getProductById(prod.id);
    assert.equal(updatedProd?.current_stock, 15, 'Damaged return items must not be added back to sellable stock');
  });

  test('4. processSaleReturn links to saleId, updates status to PARTIAL_RETURN or RETURNED, and reduces due on CREDIT_NOTE', () => {
    const prod = createProduct({ name: 'Rice Bag 20kg', cost_price: 180000, selling_price: 240000, current_stock: 10 });
    const cust = findOrCreateCustomer({ name: 'Hari Prasad', phone: '9841112233' });
    assert.ok(cust);

    // Sale with 2 bags (Total: 480,000, Paid: 200,000, Due: 280,000)
    const sale = processSale(
      [{ productId: prod.id, quantity: 2, actualSellingPrice: 240000, discount: 0 }],
      {
        customerId: cust.id,
        paidAmount: 200000,
        paymentMethod: 'Cash',
        applyVat: false,
      }
    );

    const saleId = sale.id;

    // Return 1 bag via CREDIT_NOTE (Value: 240,000)
    processSaleReturn({
      saleId,
      billNumber: sale.bill_number,
      items: [{ productId: prod.id, quantity: 1, unitPrice: 240000 }],
      refundMethod: 'CREDIT_NOTE',
    });

    const saleRow = queryOne<{ status: string; due_amount: number }>('SELECT status, due_amount FROM sales WHERE id = ?', [saleId]);
    assert.equal(saleRow?.status, 'PARTIAL_RETURN');
    // Due was 280,000. Reduced by 240,000 => Remaining due: 40,000
    assert.equal(saleRow?.due_amount, 40000);

    // Return the 2nd bag (Full return)
    processSaleReturn({
      saleId,
      billNumber: sale.bill_number,
      items: [{ productId: prod.id, quantity: 1, unitPrice: 240000 }],
      refundMethod: 'CREDIT_NOTE',
    });

    const fullReturnedSale = queryOne<{ status: string; due_amount: number }>('SELECT status, due_amount FROM sales WHERE id = ?', [saleId]);
    assert.equal(fullReturnedSale?.status, 'RETURNED');
    assert.equal(fullReturnedSale?.due_amount, 0);
  });

  test('5. processPurchaseReturn generates sequential Debit Note (DN-XXXXX) and deducts product stock', () => {
    const prod = createProduct({ name: 'Flour Bag 50kg', cost_price: 320000, selling_price: 380000, current_stock: 25 });
    const vendor = findOrCreateVendor({ name: 'Himalayan Mills' });
    assert.ok(vendor);

    const ret = processPurchaseReturn({
      vendorId: vendor.id,
      vendorName: vendor.name,
      items: [{ productId: prod.id, quantity: 5, costPrice: 320000 }],
      refundMethod: 'VENDOR_CREDIT',
      reason: 'DEFECTIVE',
      notes: 'Bags torn upon unloading',
    });

    assert.equal(ret.returnRecord.return_number, 'DN-00001');
    assert.equal(ret.returnRecord.total_refund, 5 * 320000); // 1,600,000
    assert.equal(ret.returnRecord.vendor_id, vendor.id);
    assert.equal(ret.returnRecord.refund_method, 'VENDOR_CREDIT');

    // Physical stock deducted
    const updatedProd = getProductById(prod.id);
    assert.equal(updatedProd?.current_stock, 20); // 25 - 5
  });

  test('6. processPurchaseReturn with batchId reduces batch inventory and logs ADJUSTMENT movement', () => {
    const prod = createProduct({ name: 'Tea Pack 1kg', cost_price: 65000, selling_price: 80000, current_stock: 40 });
    const batch = createOrAddBatch({
      productId: prod.id,
      batchNumber: 'TEA-LOT-77',
      expiryDate: '2027-05-15',
      costPrice: 65000,
      quantity: 30,
    });

    processPurchaseReturn({
      items: [{ productId: prod.id, quantity: 6, costPrice: 65000, batchId: batch.id, batchNumber: batch.batch_number }],
      reason: 'WRONG_ITEM',
    });

    // Check batch quantity
    const updatedBatch = queryOne<{ quantity: number }>('SELECT quantity FROM product_batches WHERE id = ?', [batch.id]);
    assert.equal(updatedBatch?.quantity, 24); // 30 - 6

    // Check stock movement
    const movements = getStockMovements({ productId: prod.id });
    const dnMovement = movements.find((m) => m.note?.includes('DN-00001'));
    assert.ok(dnMovement);
    assert.equal(dnMovement.quantity, -6);
  });

  test('7. getAllSaleReturns and getSaleReturnItems retrieve returns and line items', () => {
    const prod = createProduct({ name: 'Juice Bottle', cost_price: 5000, selling_price: 7500, current_stock: 50 });
    const ret = processSaleReturn({
      items: [{ productId: prod.id, quantity: 2, unitPrice: 7500 }],
    });

    const allReturns = getAllSaleReturns();
    assert.equal(allReturns.length, 1);
    assert.equal(allReturns[0].id, ret.returnRecord.id);

    const items = getSaleReturnItems(ret.returnRecord.id);
    assert.equal(items.length, 1);
    assert.equal(items[0].product_name, 'Juice Bottle');
    assert.equal(items[0].quantity, 2);
  });

  test('8. getAllPurchaseReturns and getPurchaseReturnItems retrieve debit notes and line items', () => {
    const prod = createProduct({ name: 'Coffee Beans 1kg', cost_price: 120000, selling_price: 160000, current_stock: 20 });
    const ret = processPurchaseReturn({
      items: [{ productId: prod.id, quantity: 3, costPrice: 120000 }],
    });

    const allDebitNotes = getAllPurchaseReturns();
    assert.equal(allDebitNotes.length, 1);
    assert.equal(allDebitNotes[0].id, ret.returnRecord.id);

    const items = getPurchaseReturnItems(ret.returnRecord.id);
    assert.equal(items.length, 1);
    assert.equal(items[0].cost_price, 120000);
    assert.equal(items[0].quantity, 3);
  });

  test('9. Real CRUD on Sale Returns: raw SQL INSERT into sale_returns and sale_return_items, SELECT, UPDATE, and DELETE', () => {
    const prod = createProduct({ name: 'Direct SQL Product', cost_price: 1000, selling_price: 1500, current_stock: 10 });
    const now = new Date().toISOString();

    // 1. RAW SQL INSERT into sale_returns
    run(
      `INSERT INTO sale_returns (
        return_number, sale_id, bill_number, customer_id, customer_name,
        total_refund, refund_method, reason, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['CN-RAW-001', null, 'BILL-999', null, 'Cash Customer', 3000, 'CASH', 'CUSTOMER_CANCELLED', 'Raw SQL entry', now]
    );

    const retId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id')?.id ?? 0;
    assert.ok(retId > 0);

    // RAW SQL INSERT into sale_return_items
    run(
      `INSERT INTO sale_return_items (
        return_id, product_id, product_name, quantity, unit_price, total,
        batch_id, batch_number, action, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [retId, prod.id, prod.name, 2, 1500, 3000, null, null, 'RESTOCK', now]
    );

    const itemId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id')?.id ?? 0;
    assert.ok(itemId > 0);

    // 2. RAW SQL SELECT
    const fetchedReturn = queryOne<{ return_number: string; total_refund: number }>('SELECT * FROM sale_returns WHERE id = ?', [retId]);
    assert.equal(fetchedReturn?.return_number, 'CN-RAW-001');
    assert.equal(fetchedReturn?.total_refund, 3000);

    const fetchedItem = queryOne<{ product_name: string; quantity: number }>('SELECT * FROM sale_return_items WHERE id = ?', [itemId]);
    assert.equal(fetchedItem?.product_name, 'Direct SQL Product');
    assert.equal(fetchedItem?.quantity, 2);

    // 3. RAW SQL UPDATE
    run('UPDATE sale_returns SET notes = ? WHERE id = ?', ['Updated raw note', retId]);
    const updated = queryOne<{ notes: string }>('SELECT notes FROM sale_returns WHERE id = ?', [retId]);
    assert.equal(updated?.notes, 'Updated raw note');

    // 4. RAW SQL DELETE
    run('DELETE FROM sale_return_items WHERE return_id = ?', [retId]);
    run('DELETE FROM sale_returns WHERE id = ?', [retId]);
    assert.equal(queryOne('SELECT * FROM sale_returns WHERE id = ?', [retId]), null);
    assert.equal(queryOne('SELECT * FROM sale_return_items WHERE id = ?', [itemId]), null);
  });

  test('10. Real CRUD on Purchase Returns: raw SQL INSERT into purchase_returns and purchase_return_items, SELECT, UPDATE, and DELETE', () => {
    const prod = createProduct({ name: 'Vendor Return Item', cost_price: 2000, selling_price: 3000, current_stock: 10 });
    const now = new Date().toISOString();

    // 1. RAW SQL INSERT into purchase_returns
    run(
      `INSERT INTO purchase_returns (
        return_number, purchase_id, bill_number, vendor_id, vendor_name,
        total_refund, refund_method, reason, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['DN-RAW-001', null, 'PUR-BILL-11', null, 'Vendor Alpha', 4000, 'VENDOR_CREDIT', 'DEFECTIVE', 'Raw entry', now]
    );

    const retId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id')?.id ?? 0;
    assert.ok(retId > 0);

    // RAW SQL INSERT into purchase_return_items
    run(
      `INSERT INTO purchase_return_items (
        return_id, product_id, product_name, quantity, cost_price, total,
        batch_id, batch_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [retId, prod.id, prod.name, 2, 2000, 4000, null, null, now]
    );

    const itemId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id')?.id ?? 0;
    assert.ok(itemId > 0);

    // 2. RAW SQL SELECT
    const fetchedDN = queryOne<{ return_number: string; total_refund: number }>('SELECT * FROM purchase_returns WHERE id = ?', [retId]);
    assert.equal(fetchedDN?.return_number, 'DN-RAW-001');

    // 3. RAW SQL UPDATE
    run('UPDATE purchase_returns SET reason = ? WHERE id = ?', ['EXPIRED', retId]);
    const updated = queryOne<{ reason: string }>('SELECT reason FROM purchase_returns WHERE id = ?', [retId]);
    assert.equal(updated?.reason, 'EXPIRED');

    // 4. RAW SQL DELETE
    run('DELETE FROM purchase_return_items WHERE return_id = ?', [retId]);
    run('DELETE FROM purchase_returns WHERE id = ?', [retId]);
    assert.equal(queryOne('SELECT * FROM purchase_returns WHERE id = ?', [retId]), null);
    assert.equal(queryOne('SELECT * FROM purchase_return_items WHERE id = ?', [itemId]), null);
  });
});
