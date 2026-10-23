/**
 * Feature 7 Test: Vendors & Supplier Ledger Suite
 * Tests:
 * 1. Vendor creation, title-casing, input validation, and initial state
 * 2. Vendor profile update with automatic purchase and stock movements synchronization
 * 3. Safe vendor deletion (unlinks stock movements to preserve inventory integrity)
 * 4. Fast search and prioritized ranking in searchVendors (name match > PAN match > prefix)
 * 5. Auto-resolution and auto-enrichment via findOrCreateVendor (PAN/VAT, name, contact info)
 * 6. Vendor payable due calculations: getVendorTotalDue and getVendorPreviousDueForPurchase
 * 7. Debt settlement via recordVendorPayment with FIFO allocation across unpaid purchases
 * 8. Targeted purchase payment allocation to a specific bill
 * 9. Supplier Statement of Account (Supplier Ledger): running balance, purchases, payment vouchers, and debit notes
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';
import type { ProcessPurchaseItemInput } from '../src/types/index.ts';

// Dynamically import after setup has registered the wasm loader
const {
  createVendor,
  updateVendor,
  deleteVendor,
  getAllVendors,
  getVendorById,
  searchVendors,
  findOrCreateVendor,
  getVendorTotalDue,
  getVendorPreviousDueForPurchase,
  recordVendorPayment,
  getVendorPayments,
  getVendorStatement,
  getVendorCount,
} = await import('../src/lib/services/vendorService.ts');

const {
  createProduct,
  getProductById,
} = await import('../src/lib/services/productService.ts');

const {
  processPurchase,
  getPurchaseWithItems,
} = await import('../src/lib/services/purchaseService.ts');

const {
  processPurchaseReturn,
} = await import('../src/lib/services/returnsService.ts');

const {
  getStockMovements,
} = await import('../src/lib/services/inventoryService.ts');

const { queryOne, query } = await import('../src/lib/db/sqliteEngine.ts');

// Helper to construct purchase item with discount = 0
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

describe('Feature 7: Vendors & Supplier Ledger', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. Vendor creation, input validation, title-casing, and retrieval', () => {
    assert.throws(() => createVendor({ name: '' }), /name is required/i);
    assert.throws(() => createVendor({ name: '   ' }), /name is required/i);

    const vendor = createVendor({
      name: 'himalayan agro industries',
      email: 'himalayan@agro.np',
      phone: '9855011111',
      pan_vat: '300123456',
      address: 'Industrial Area, Birgunj',
      notes: 'Main wholesale supplier for grains and pulses',
    });

    assert.ok(vendor.id > 0);
    assert.equal(vendor.name, 'Himalayan Agro Industries', 'Name must be automatically capitalized');
    assert.equal(vendor.email, 'himalayan@agro.np');
    assert.equal(vendor.phone, '9855011111');
    assert.equal(vendor.pan_vat, '300123456');
    assert.equal(vendor.address, 'Industrial Area, Birgunj');
    assert.equal(getVendorCount(), 1);

    const retrieved = getVendorById(vendor.id);
    assert.ok(retrieved);
    assert.equal(retrieved.name, 'Himalayan Agro Industries');
  });

  test('2. Vendor profile update syncs denormalized vendor name in purchases and stock movements', () => {
    const vendor = createVendor({
      name: 'Initial Supplier Name',
      phone: '9845000001',
    });

    const product = createProduct({ name: 'Mustard Oil 1L', cost_price: 20000, selling_price: 24000, current_stock: 10 });

    const purchase = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 10, costPrice: 20000 })],
      { vendorId: vendor.id, applyVat: false }
    );
    assert.equal(purchase.vendor_name, 'Initial Supplier Name');

    // Verify stock movement has vendor name
    const movementsBefore = getStockMovements({ productId: product.id });
    const purchaseMovement = movementsBefore.find((m) => m.reference_id === purchase.id);
    assert.equal(purchaseMovement?.vendor_name, 'Initial Supplier Name');

    // Update vendor name
    updateVendor(vendor.id, {
      name: 'Updated Agro Suppliers Ltd',
      phone: '9845000099',
      address: 'Main Road, Birgunj',
    });

    // Check purchase table was updated with new vendor name
    const updatedPurchase = getPurchaseWithItems(purchase.id);
    assert.equal(updatedPurchase?.purchase.vendor_name, 'Updated Agro Suppliers Ltd');

    // Check stock movements table was updated with new vendor name
    const movementsAfter = getStockMovements({ productId: product.id });
    const movementAfter = movementsAfter.find((m) => m.reference_id === purchase.id);
    assert.equal(movementAfter?.vendor_name, 'Updated Agro Suppliers Ltd');
  });

  test('3. Safe vendor deletion unlinks stock movements to preserve inventory integrity', () => {
    const vendor = createVendor({ name: 'Short Term Vendor', phone: '9800001122' });
    const product = createProduct({ name: 'Spices Pack', cost_price: 5000, selling_price: 7000, current_stock: 20 });

    const purchase = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 5, costPrice: 5000 })],
      { vendorId: vendor.id, applyVat: false }
    );

    // Delete vendor
    deleteVendor(vendor.id);
    assert.equal(getVendorById(vendor.id), null);

    // Stock movements must remain intact with vendor_id set to null
    const movements = getStockMovements({ productId: product.id });
    const m = movements.find((row) => row.reference_id === purchase.id);
    assert.ok(m);
    assert.equal(m.vendor_id, null, 'Vendor reference must be unlinked safely without dropping movements');
  });

  test('4. Fast search and prioritized ranking in searchVendors', () => {
    createVendor({ name: 'Quality Foods Nepal', pan_vat: '50001', phone: '9855012345' });
    createVendor({ name: 'Shrestha Wholesalers', pan_vat: '50002', phone: '9855099999' });
    createVendor({ name: 'Quality Oils & Ghee', pan_vat: '50003', phone: '9800012345' });

    // Search by exact name
    const nameResults = searchVendors('Quality Foods Nepal');
    assert.ok(nameResults.length >= 1);
    assert.equal(nameResults[0].name, 'Quality Foods Nepal');

    // Search by partial prefix
    const qualityResults = searchVendors('Quality');
    assert.equal(qualityResults.length, 2);

    // Search by PAN
    const panResults = searchVendors('50002');
    assert.equal(panResults.length, 1);
    assert.equal(panResults[0].name, 'Shrestha Wholesalers');
  });

  test('5. Auto-resolution and auto-enrichment via findOrCreateVendor', () => {
    // 1. Initial creation via PAN/VAT lookup
    const v1 = findOrCreateVendor({
      pan_vat: '600123999',
      name: 'Narayani Traders',
      phone: '9845011223',
    });
    assert.ok(v1);
    assert.equal(v1.name, 'Narayani Traders');
    assert.equal(v1.pan_vat, '600123999');

    // 2. Secondary lookup with same PAN/VAT enriches missing address and email
    const v2 = findOrCreateVendor({
      pan_vat: '600123999',
      name: 'Narayani Traders',
      email: 'narayani@traders.np',
      address: 'Adarshnagar, Birgunj',
    });
    assert.ok(v2);
    assert.equal(v2.id, v1.id, 'Should resolve to same vendor record');
    assert.equal(v2.email, 'narayani@traders.np', 'Email should be enriched');
    assert.equal(v2.address, 'Adarshnagar, Birgunj', 'Address should be enriched');

    // 3. Lookup by Name
    const v3 = findOrCreateVendor({
      name: 'Narayani Traders',
    });
    assert.ok(v3);
    assert.equal(v3.id, v1.id);
  });

  test('6. Vendor payable due calculations: getVendorTotalDue and getVendorPreviousDueForPurchase', () => {
    const vendor = createVendor({ name: 'Pashupati Packaging', phone: '9845123999' });
    const product = createProduct({ name: 'Cardboard Box', cost_price: 3000, selling_price: 5000, current_stock: 100 });

    // Purchase 1: Total 300000, Paid 100000 -> Due = 200000
    const pur1 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 100, costPrice: 3000 })],
      { vendorId: vendor.id, paidAmount: 100000, applyVat: false }
    );

    // Purchase 2: Total 150000, Paid 50000 -> Due = 100000
    const pur2 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 50, costPrice: 3000 })],
      { vendorId: vendor.id, paidAmount: 50000, applyVat: false }
    );

    // Total due across all purchases
    const totalDue = getVendorTotalDue(vendor.id);
    assert.equal(totalDue, 300000, 'Total due must be 200000 + 100000 = 300000');

    // Previous due strictly prior to Purchase 2 must be Purchase 1's due (200000)
    const prevDuePur2 = getVendorPreviousDueForPurchase(pur2.id, vendor.id);
    assert.equal(prevDuePur2, 200000, 'Previous due before Purchase 2 must be 200000');

    // Previous due strictly prior to Purchase 1 must be 0
    const prevDuePur1 = getVendorPreviousDueForPurchase(pur1.id, vendor.id);
    assert.equal(prevDuePur1, 0, 'Previous due before Purchase 1 must be 0');
  });

  test('7. Debt settlement via recordVendorPayment with FIFO allocation across unpaid purchases', () => {
    const vendor = createVendor({ name: 'Birgunj Rice Mill', phone: '9855019283' });
    const product = createProduct({ name: 'Atta 20kg', cost_price: 100000, selling_price: 130000, current_stock: 30 });

    // Purchase 1: Due = 150000 (Paid 50000 of 200000)
    const pur1 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 2, costPrice: 100000 })],
      { vendorId: vendor.id, paidAmount: 50000, applyVat: false }
    );

    // Purchase 2: Due = 100000 (Paid 0 of 100000)
    const pur2 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 1, costPrice: 100000 })],
      { vendorId: vendor.id, paidAmount: 0, applyVat: false }
    );

    assert.equal(getVendorTotalDue(vendor.id), 250000);

    // Shopkeeper makes a debt payment voucher of Rs. 2000 (200000 paisa) to vendor
    // FIFO should settle Purchase 1 completely (150000) and remaining 50000 towards Purchase 2
    const payment = recordVendorPayment({
      vendorId: vendor.id,
      amount: 200000,
      paymentMethod: 'Bank Transfer',
      note: 'Part settlement via cheque #449911',
    });

    assert.match(payment.receipt_number ?? '', /^VCH-V-\d{5}$/, 'Voucher number format VCH-V-XXXXX');
    assert.equal(payment.amount, 200000);

    // Verify remaining vendor payable due is 50000 (250000 - 200000)
    assert.equal(getVendorTotalDue(vendor.id), 50000);

    // Inspect individual purchase records
    const p1 = getPurchaseWithItems(pur1.id);
    assert.equal(p1?.purchase.due_amount, 0, 'Purchase 1 must be fully cleared');
    assert.equal(p1?.purchase.paid_amount, 200000);

    const p2 = getPurchaseWithItems(pur2.id);
    assert.equal(p2?.purchase.due_amount, 50000, 'Purchase 2 remaining due must be 50000');
    assert.equal(p2?.purchase.paid_amount, 50000);
  });

  test('8. Targeted purchase payment allocation to a specific bill', () => {
    const vendor = createVendor({ name: 'Chitwan Poultry Feed', phone: '9845012399' });
    const product = createProduct({ name: 'Feed Sack', cost_price: 25000, selling_price: 35000, current_stock: 50 });

    const pur1 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 2, costPrice: 25000 })],
      { vendorId: vendor.id, paidAmount: 0, applyVat: false } // Due = 50000
    );

    const pur2 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 2, costPrice: 25000 })],
      { vendorId: vendor.id, paidAmount: 0, applyVat: false } // Due = 50000
    );

    // Specifically target Purchase 2 with payment of 40000
    recordVendorPayment({
      vendorId: vendor.id,
      purchaseId: pur2.id,
      amount: 40000,
      paymentMethod: 'Cash',
      note: 'Targeted payment for Purchase 2',
    });

    const p1 = getPurchaseWithItems(pur1.id);
    assert.equal(p1?.purchase.due_amount, 50000, 'Purchase 1 remains untouched');

    const p2 = getPurchaseWithItems(pur2.id);
    assert.equal(p2?.purchase.due_amount, 10000, 'Purchase 2 due reduced to 10000');
    assert.equal(p2?.purchase.paid_amount, 40000);
  });

  test('9. Supplier Statement of Account (Supplier Ledger): running balance, purchases, payments, and debit notes', () => {
    const vendor = createVendor({ name: 'Bhairahawa Sugar Mill', phone: '9855112233' });
    const product = createProduct({ name: 'Brown Sugar 50kg', cost_price: 300000, selling_price: 380000, current_stock: 20 });

    // Event 1: Purchase 1 with partial payment -> Due = 200000 (Paid 100000 of 300000)
    const pur1 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 1, costPrice: 300000 })],
      { vendorId: vendor.id, paidAmount: 100000, applyVat: false, createdAt: '2026-10-01T10:00:00Z' }
    );

    // Event 2: Payment Voucher of Rs. 1000 (100000 paisa) specifically targeting Purchase 1
    recordVendorPayment({
      vendorId: vendor.id,
      purchaseId: pur1.id,
      amount: 100000,
      paymentMethod: 'Bank Transfer',
      paymentDate: '2026-10-05T12:00:00Z',
      note: 'Part payment via ConnectIPS',
    });

    // Event 3: Purchase 2 fully on credit -> Due = 300000
    const pur2 = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 1, costPrice: 300000 })],
      { vendorId: vendor.id, paidAmount: 0, applyVat: false, createdAt: '2026-10-10T14:00:00Z' }
    );

    // Event 4: Debit Note (Purchase return) of Rs. 500 (50000 paisa)
    processPurchaseReturn({
      purchaseId: pur2.id,
      billNumber: pur2.bill_number,
      vendorId: vendor.id,
      refundMethod: 'VENDOR_CREDIT',
      reason: 'DEFECTIVE',
      items: [{ productId: product.id, quantity: 1, costPrice: 50000 }],
      createdAt: '2026-10-15T16:00:00Z',
    });

    // Retrieve Supplier Statement of Account
    const statement = getVendorStatement(vendor.id);
    assert.ok(statement);
    assert.equal(statement.vendor.id, vendor.id);
    assert.equal(statement.totalInvoiced, 600000); // 300000 + 300000

    // Verify chronological statement rows & step-by-step running balance:
    // Row 1 (Bill 1): initial due 200000 -> runningBalance = 200000
    // Row 2 (Payment 1): -100000 -> runningBalance = 100000
    // Row 3 (Bill 2): +300000 -> runningBalance = 400000
    // Row 4 (Debit Note): -50000 -> runningBalance = 350000
    assert.equal(statement.rows.length, 4);

    assert.equal(statement.rows[0].type, 'BILL');
    assert.equal(statement.rows[0].runningBalance, 200000);

    assert.equal(statement.rows[1].type, 'PAYMENT');
    assert.equal(statement.rows[1].runningBalance, 100000);

    assert.equal(statement.rows[2].type, 'BILL');
    assert.equal(statement.rows[2].runningBalance, 400000);

    assert.equal(statement.rows[3].type, 'RETURN');
    assert.equal(statement.rows[3].runningBalance, 350000);

    // Current total outstanding payable due must equal latest running balance (350000)
    assert.equal(getVendorTotalDue(vendor.id), 350000);
  });

  test('10. Real CRUD on Vendors: INSERT into db, FETCH all columns, UPDATE vendor, and DELETE from db', () => {
    // 1. CREATE / INSERT into db
    const vendor = createVendor({
      name: 'himalayan grains suppliers',
      phone: '9851088888',
      email: 'himalayan@grains.com',
      pan_vat: '608889999',
      address: 'Kalimati, Kathmandu',
      notes: 'Bulk grain importer',
    });

    // 2. READ / FETCH directly from SQLite vendors table
    const dbVendor = queryOne<{
      id: number;
      name: string;
      phone: string;
      email: string;
      pan_vat: string;
      address: string;
      notes: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM vendors WHERE id = ?', [vendor.id]);

    assert.ok(dbVendor);
    assert.equal(dbVendor.id, vendor.id);
    assert.equal(dbVendor.name, 'Himalayan Grains Suppliers');
    assert.equal(dbVendor.phone, '9851088888');
    assert.equal(dbVendor.email, 'himalayan@grains.com');
    assert.equal(dbVendor.pan_vat, '608889999');
    assert.equal(dbVendor.address, 'Kalimati, Kathmandu');
    assert.equal(dbVendor.notes, 'Bulk grain importer');
    assert.ok(dbVendor.created_at);
    assert.ok(dbVendor.updated_at);

    // 3. UPDATE in SQLite database
    updateVendor(vendor.id, {
      name: 'Himalayan Agro & Grains Pvt Ltd',
      phone: '9851088777',
      address: 'Balkhu, Kathmandu',
      notes: 'Net 30 days payment terms',
    });

    const updatedDbVendor = queryOne<{
      name: string;
      phone: string;
      address: string;
      notes: string;
    }>('SELECT name, phone, address, notes FROM vendors WHERE id = ?', [vendor.id]);
    assert.ok(updatedDbVendor);
    assert.equal(updatedDbVendor.name, 'Himalayan Agro & Grains Pvt Ltd');
    assert.equal(updatedDbVendor.phone, '9851088777');
    assert.equal(updatedDbVendor.address, 'Balkhu, Kathmandu');
    assert.equal(updatedDbVendor.notes, 'Net 30 days payment terms');

    // 4. DELETE from SQLite database
    deleteVendor(vendor.id);

    const deletedRow = queryOne('SELECT * FROM vendors WHERE id = ?', [vendor.id]);
    assert.equal(deletedRow, null, 'Vendor row must be deleted from database');
    assert.equal(getVendorById(vendor.id), null);
  });
});
