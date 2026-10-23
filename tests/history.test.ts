/**
 * Feature 5 Test: History, Day Book & Audit Logs Suite
 * Tests:
 * 1. Expense creation, validation, update, and deletion in expense ledger
 * 2. Expense querying with category and date filtering, and expense summary aggregation
 * 3. Expired & damaged goods write-off vouchers (WO-XXXXX) with inventory deduction and financial loss posting
 * 4. Write-off summary breakdown by reason and expired batch candidates detection
 * 5. Sales Returns & Credit Note (CN-XXXXX) audit trail with partial return and full return tracking
 * 6. Purchase Returns & Debit Note (DN-XXXXX) audit trail with vendor debit tracking
 * 7. Unified Stock Movement ledger history across sales, purchases, adjustments, returns, and write-offs
 * 8. Day Book Daily Journal: Multi-entry reconciliation (opening balance, inflows, outflows, closing balance, payment modes)
 * 9. Day Book Credit & Due tracking: newly generated dues vs collected customer/vendor settlements
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';

// Dynamically import after setup has registered the wasm loader
const {
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
  getExpenseSummary,
} = await import('../src/lib/services/expenseService.ts');

const {
  createStockWriteOff,
  getAllStockWriteOffs,
  getWriteOffSummary,
  getExpiredBatchCandidates,
} = await import('../src/lib/services/writeOffService.ts');

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
  getStockMovements,
} = await import('../src/lib/services/inventoryService.ts');

const {
  createOrAddBatch,
} = await import('../src/lib/services/batchService.ts');

const {
  findOrCreateCustomer,
  recordCustomerPayment,
} = await import('../src/lib/services/customerService.ts');

const {
  findOrCreateVendor,
  recordVendorPayment,
} = await import('../src/lib/services/vendorService.ts');

const {
  getDayBook,
  getOpeningCashBalance,
} = await import('../src/lib/services/dayBookService.ts');

describe('Feature 5: History, Day Book & Audit Logs', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. Expense creation, validation, update, and deletion in expense ledger', () => {
    // Validation
    assert.throws(() => createExpense({ category: '', amount: 1000 }), /category is required/i);
    assert.throws(() => createExpense({ category: 'Rent', amount: 0 }), /greater than zero/i);
    assert.throws(() => createExpense({ category: 'Rent', amount: -500 }), /greater than zero/i);

    // Create valid expense
    const exp = createExpense({
      category: 'Shop Rent',
      amount: 1500000, // Rs. 15,000
      date: '2026-10-01',
      payment_method: 'Bank Transfer',
      receipt_reference: 'RENT-OCT-2026',
      note: 'Monthly shop space rent paid to landlord',
    });

    assert.ok(exp.id > 0);
    assert.equal(exp.category, 'Shop Rent');
    assert.equal(exp.amount, 1500000);
    assert.equal(exp.payment_method, 'Bank Transfer');
    assert.equal(exp.receipt_reference, 'RENT-OCT-2026');

    // Update expense
    const updated = updateExpense(exp.id, {
      amount: 1600000,
      note: 'Adjusted rent with maintenance fee',
    });
    assert.equal(updated.amount, 1600000);
    assert.equal(updated.note, 'Adjusted rent with maintenance fee');

    // Delete expense
    const deleted = deleteExpense(exp.id);
    assert.equal(deleted, true);
    assert.equal(getExpenses({ search: 'RENT-OCT-2026' }).length, 0);
  });

  test('2. Expense querying with category and date filtering, and expense summary aggregation', () => {
    createExpense({ category: 'Electricity', amount: 350000, date: '2026-10-05', note: 'NEA electricity bill' });
    createExpense({ category: 'Internet', amount: 150000, date: '2026-10-08', note: 'WorldLink fiber' });
    createExpense({ category: 'Tea & Snacks', amount: 50000, date: '2026-10-15', note: 'Staff refreshments' });
    createExpense({ category: 'Electricity', amount: 400000, date: '2026-11-05', note: 'November NEA electricity bill' });

    // Filter by date range (October 2026)
    const octExpenses = getExpenses({ startDate: '2026-10-01', endDate: '2026-10-31' });
    assert.equal(octExpenses.length, 3);

    // Filter by category
    const elecExpenses = getExpenses({ category: 'Electricity' });
    assert.equal(elecExpenses.length, 2);

    // Summary aggregation for October 2026
    const summary = getExpenseSummary('2026-10-01', '2026-10-31');
    assert.equal(summary.total_expenses, 550000); // 350000 + 150000 + 50000
    assert.equal(summary.expense_count, 3);
    const elecSummary = summary.categoryBreakdown.find((b) => b.category === 'Electricity');
    assert.equal(elecSummary?.amount, 350000);
  });

  test('3. Expired & damaged goods write-off vouchers (WO-XXXXX) with inventory deduction & financial loss posting', () => {
    const product = createProduct({
      name: 'Fresh Cow Milk 1L',
      cost_price: 9000,
      selling_price: 11000,
      current_stock: 30,
    });

    const writeOff = createStockWriteOff({
      productId: product.id,
      quantity: 10,
      reason: 'SPOILED_LEAKED',
      action: 'DISPOSAL',
      approvedBy: 'Store Manager',
      notes: 'Refrigerator power outage spoiled milk cartons',
      recordAsExpense: true,
    });

    assert.ok(writeOff.id > 0);
    assert.match(writeOff.voucher_number, /^WO-\d{5}$/, 'Voucher format WO-XXXXX');
    assert.equal(writeOff.product_name, 'Fresh Cow Milk 1L');
    assert.equal(writeOff.quantity, 10);
    assert.equal(writeOff.unit_cost, 9000);
    assert.equal(writeOff.total_loss, 90000); // 10 * 9000
    assert.equal(writeOff.reason, 'SPOILED_LEAKED');

    // Physical stock deducted
    const updated = getProductById(product.id);
    assert.equal(updated?.current_stock, 20, 'Stock should decrease from 30 to 20');

    // Movement ledger record
    const movements = getStockMovements({ productId: product.id });
    const woMovement = movements.find((m) => m.note?.includes(writeOff.voucher_number));
    assert.ok(woMovement, 'Must log write-off adjustment movement');
    assert.equal(woMovement.quantity, -10);

    // Posted as financial loss in operating expenses
    const lossExpenses = getExpenses({ category: 'Inventory Loss / Spoilage' });
    assert.equal(lossExpenses.length, 1);
    assert.equal(lossExpenses[0].amount, 90000);
  });

  test('4. Write-off summary breakdown by reason and expired batch candidates detection', () => {
    const p1 = createProduct({ name: 'Packet Curd 500g', cost_price: 6000, selling_price: 7500, current_stock: 50 });
    const p2 = createProduct({ name: 'Glass Tumbler', cost_price: 4000, selling_price: 6000, current_stock: 40 });

    // Write-off 5 curd packs as EXPIRED
    createStockWriteOff({ productId: p1.id, quantity: 5, reason: 'EXPIRED' });
    // Write-off 3 glasses as DAMAGED
    createStockWriteOff({ productId: p2.id, quantity: 3, reason: 'DAMAGED' });

    const summary = getWriteOffSummary();
    assert.equal(summary.totalVouchersCount, 2);
    assert.equal(summary.totalUnitsWrittenOff, 8); // 5 + 3
    assert.equal(summary.totalLossAmount, 42000); // (5 * 6000) + (3 * 4000) = 30000 + 12000

    const expiredBreakdown = summary.breakdownByReason.find((b) => b.reason === 'EXPIRED');
    assert.equal(expiredBreakdown?.amount, 30000);
    assert.equal(expiredBreakdown?.count, 1);

    const damagedBreakdown = summary.breakdownByReason.find((b) => b.reason === 'DAMAGED');
    assert.equal(damagedBreakdown?.amount, 12000);
    assert.equal(damagedBreakdown?.count, 1);

    // Create an expired lot in product_batches
    createOrAddBatch({
      productId: p1.id,
      batchNumber: 'LOT-EXP-OLD',
      expiryDate: '2026-01-01', // Already expired
      costPrice: 6000,
      quantity: 12,
    });

    const candidates = getExpiredBatchCandidates();
    assert.ok(candidates.length >= 1);
    const candidate = candidates.find((c) => c.batchNumber === 'LOT-EXP-OLD');
    assert.ok(candidate);
    assert.equal(candidate.quantity, 12);
    assert.equal(candidate.totalLossValue, 72000); // 12 * 6000
  });

  test('5. Sales Returns & Credit Note (CN-XXXXX) audit trail with partial return and full return tracking', () => {
    const product = createProduct({ name: 'Jacket Size L', cost_price: 150000, selling_price: 250000, current_stock: 10 });
    const sale = processSale(
      [{ productId: product.id, quantity: 2, actualSellingPrice: 250000, discount: 0 }],
      { customerName: 'Roshan Shrestha', applyVat: false }
    );
    assert.equal(getProductById(product.id)?.current_stock, 8);

    // Process partial sale return (return 1 jacket)
    const { returnRecord, items } = processSaleReturn({
      saleId: sale.id,
      billNumber: sale.bill_number,
      customerId: sale.customer_id,
      customerName: sale.customer_name,
      refundMethod: 'CREDIT_NOTE',
      reason: 'WRONG_ITEM',
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 250000,
          action: 'RESTOCK',
        },
      ],
    });

    assert.match(returnRecord.return_number, /^CN-\d{5}$/, 'Credit Note format CN-XXXXX');
    assert.equal(returnRecord.total_refund, 250000);
    assert.equal(returnRecord.refund_method, 'CREDIT_NOTE');
    assert.equal(items.length, 1);

    // Stock should increase from 8 to 9
    assert.equal(getProductById(product.id)?.current_stock, 9);

    // Check historical query of sale returns
    const allReturns = getAllSaleReturns();
    assert.equal(allReturns.length, 1);
    assert.equal(allReturns[0].return_number, returnRecord.return_number);

    const returnItems = getSaleReturnItems(returnRecord.id);
    assert.equal(returnItems.length, 1);
    assert.equal(returnItems[0].product_name, 'Jacket Size L');
    assert.equal(returnItems[0].quantity, 1);
  });

  test('6. Purchase Returns & Debit Note (DN-XXXXX) audit trail with vendor debit tracking', () => {
    const product = createProduct({ name: 'Paint Bucket 20L', cost_price: 350000, selling_price: 450000, current_stock: 10 });
    const purchase = processPurchase(
      [{ productId: product.id, quantity: 10, costPrice: 350000, discount: 0 }],
      { vendorName: 'Asian Paints Nepal', applyVat: false }
    );
    assert.equal(getProductById(product.id)?.current_stock, 20);

    // Return 2 defective paint buckets to vendor
    const { returnRecord, items } = processPurchaseReturn({
      purchaseId: purchase.id,
      billNumber: purchase.bill_number,
      vendorId: purchase.vendor_id,
      vendorName: purchase.vendor_name,
      refundMethod: 'VENDOR_CREDIT',
      reason: 'DEFECTIVE',
      items: [
        {
          productId: product.id,
          quantity: 2,
          costPrice: 350000,
        },
      ],
    });

    assert.match(returnRecord.return_number, /^DN-\d{5}$/, 'Debit note format DN-XXXXX');
    assert.equal(returnRecord.total_refund, 700000); // 2 * 350000
    assert.equal(items.length, 1);

    // Stock should be deducted from 20 to 18
    assert.equal(getProductById(product.id)?.current_stock, 18);

    // Audit logs for purchase returns
    const allPurchReturns = getAllPurchaseReturns();
    assert.equal(allPurchReturns.length, 1);
    assert.equal(allPurchReturns[0].return_number, returnRecord.return_number);

    const purchReturnItems = getPurchaseReturnItems(returnRecord.id);
    assert.equal(purchReturnItems.length, 1);
    assert.equal(purchReturnItems[0].product_name, 'Paint Bucket 20L');
    assert.equal(purchReturnItems[0].quantity, 2);
  });

  test('7. Unified Stock Movement ledger history across sales, purchases, adjustments, and returns', () => {
    const product = createProduct({
      name: 'Instant Noodles Pack',
      cost_price: 2000,
      selling_price: 2500,
      current_stock: 100, // Initial RESTOCK = 100
    });

    // 1. Purchase replenishment: +50 units
    processPurchase(
      [{ productId: product.id, quantity: 50, costPrice: 2000, discount: 0 }],
      { applyVat: false }
    );

    // 2. Sale outflow: -30 units
    processSale(
      [{ productId: product.id, quantity: 30, actualSellingPrice: 2500, discount: 0 }],
      { applyVat: false }
    );

    // 3. Write-off damaged stock: -5 units
    createStockWriteOff({ productId: product.id, quantity: 5, reason: 'DAMAGED' });

    // Verify stock movements sequence in the ledger
    const movements = getStockMovements({ productId: product.id });
    assert.equal(movements.length, 4);

    // Current stock should be: 100 + 50 - 30 - 5 = 115
    const p = getProductById(product.id);
    assert.equal(p?.current_stock, 115);

    // Check filtering by movement type
    const restocks = getStockMovements({ productId: product.id, type: 'RESTOCK' });
    assert.equal(restocks.length, 2); // Initial stock (100) + purchase (50)

    const sales = getStockMovements({ productId: product.id, type: 'SALE' });
    assert.equal(sales.length, 1);
    assert.equal(sales[0].quantity, -30);

    const adjustments = getStockMovements({ productId: product.id, type: 'ADJUSTMENT' });
    assert.equal(adjustments.length, 1);
    assert.equal(adjustments[0].quantity, -5);
  });

  test('8. Day Book Daily Journal: Multi-entry reconciliation (opening balance, inflows, outflows, closing balance)', () => {
    const today = new Date().toISOString().slice(0, 10);

    const prod = createProduct({ name: 'Ghee 1L', cost_price: 80000, selling_price: 100000, current_stock: 50 });

    // 1. Cash Sale of 2 units = Rs. 2000 (200000 paisa)
    processSale(
      [{ productId: prod.id, quantity: 2, actualSellingPrice: 100000, discount: 0 }],
      { paymentMethod: 'Cash', applyVat: false }
    );

    // 2. Online/QR Sale of 1 unit = Rs. 1000 (100000 paisa)
    processSale(
      [{ productId: prod.id, quantity: 1, actualSellingPrice: 100000, discount: 0 }],
      { paymentMethod: 'Online / QR', applyVat: false }
    );

    // 3. Operating Cash Expense of Rs. 300 (30000 paisa)
    createExpense({ category: 'Tea', amount: 30000, date: today, payment_method: 'Cash' });

    // Generate Day Book for today
    const dayBook = getDayBook({ date: today });
    assert.ok(dayBook);
    assert.equal(dayBook.entries.length, 3);

    // Inflows: Cash (200000) + Online/QR (100000) = 300000
    assert.equal(dayBook.totalInflow, 300000);
    // Outflows: Expense (30000) = 30000
    assert.equal(dayBook.totalOutflow, 30000);
    // Net cash flow: 300000 - 30000 = 270000
    assert.equal(dayBook.netCashFlow, 270000);

    // Pure Cash flow: Inflow 200000 - Outflow 30000 = 170000
    assert.equal(dayBook.cashInflow, 200000);
    assert.equal(dayBook.cashOutflow, 30000);
    assert.equal(dayBook.netCash, 170000);

    // Closing balance = opening (0) + netCash (170000) = 170000
    assert.equal(dayBook.closingBalance, 170000);

    // Payment mode breakdowns
    const cashMode = dayBook.modeSummaries.find((m) => m.mode === 'Cash');
    assert.equal(cashMode?.inflow, 200000);
    assert.equal(cashMode?.outflow, 30000);
    assert.equal(cashMode?.net, 170000);

    const qrMode = dayBook.modeSummaries.find((m) => m.mode === 'Online / QR');
    assert.equal(qrMode?.inflow, 100000);
    assert.equal(qrMode?.outflow, 0);
  });

  test('9. Day Book Credit & Due tracking: newly generated dues vs collected customer/vendor settlements', () => {
    const today = new Date().toISOString().slice(0, 10);
    const prod = createProduct({ name: 'Sugar 50kg', cost_price: 350000, selling_price: 450000, current_stock: 20 });

    const customer = findOrCreateCustomer({ name: 'Hari Prasad', phone: '9845000111' });
    assert.ok(customer);

    // Credit Sale: Total 450000, Paid 150000, Due 300000
    processSale(
      [{ productId: prod.id, quantity: 1, actualSellingPrice: 450000, discount: 0 }],
      { customerId: customer.id, paidAmount: 150000, paymentMethod: 'Cash', applyVat: false }
    );

    // Subsequent due collection: Customer settles Rs. 1000 (100000 paisa)
    recordCustomerPayment({
      customerId: customer.id,
      amount: 100000,
      paymentMethod: 'Cash',
      paymentDate: today,
      note: 'Part settlement for Sugar bill',
    });

    const dayBook = getDayBook({ date: today });
    assert.equal(dayBook.salesInvoiced, 450000);
    assert.equal(dayBook.salesPaid, 250000); // Updated to 250000 upon receiving payment
    assert.equal(dayBook.newCustomerDue, 200000); // Remaining due reduced to 200000
    assert.equal(dayBook.customerDueCollected, 100000);
  });
});
