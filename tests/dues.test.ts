/**
 * Feature 8 Test: Dues, Settlements & Day Book Suite
 * Tests:
 * 1. Historical opening cash balance calculation (prior sales, purchases, expenses, collections, returns)
 * 2. Customer credit dues generation, outstanding balance tracking, and customer settlement collections
 * 3. Vendor credit dues (accounts payable) generation and supplier settlement payments
 * 4. Multi-mode payment distribution in Day Book (Cash, Online / QR, Bank Transfer, Cheque)
 * 5. Day Book double-entry journal reconciliation (total inflow, outflow, net cash flow, and closing balance)
 * 6. Cash drawer shift management via shiftService (open shift, live metrics, close shift, cash variance over/short)
 * 7. Shift opening float linkage to Day Book opening balance
 * 8. Comprehensive full-day transaction reconciliation combining sales, purchases, expenses, dues, and returns
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnvironment } from './setup.ts';
import type { ProcessPurchaseItemInput } from '../src/types/index.ts';

// Dynamically import after setup has registered the wasm loader
const {
  getDayBook,
  getOpeningCashBalance,
} = await import('../src/lib/services/dayBookService.ts');

const {
  openShift,
  closeShift,
  getCurrentOpenShift,
  getShiftLiveMetrics,
} = await import('../src/lib/services/shiftService.ts');

const {
  createCustomer,
  getCustomerTotalDue,
  recordCustomerPayment,
} = await import('../src/lib/services/customerService.ts');

const {
  createVendor,
  getVendorTotalDue,
  recordVendorPayment,
} = await import('../src/lib/services/vendorService.ts');

const {
  createProduct,
} = await import('../src/lib/services/productService.ts');

const {
  processSale,
} = await import('../src/lib/services/salesService.ts');

const {
  processPurchase,
} = await import('../src/lib/services/purchaseService.ts');

const {
  createExpense,
} = await import('../src/lib/services/expenseService.ts');

const {
  processSaleReturn,
  processPurchaseReturn,
} = await import('../src/lib/services/returnsService.ts');

const { queryOne, query, run } = await import('../src/lib/db/sqliteEngine.ts');

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

describe('Feature 8: Dues, Settlements & Day Book', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  test('1. Historical opening cash balance calculation from prior transactions', () => {
    const product = createProduct({ name: 'Cooking Ghee 1L', cost_price: 80000, selling_price: 100000, current_stock: 50 });

    // Prior Date: 2026-10-10
    // 1. Cash Sale of Rs. 2,000 (200000 paisa)
    processSale(
      [{ productId: product.id, quantity: 2, actualSellingPrice: 100000, discount: 0 }],
      { paymentMethod: 'Cash', applyVat: false, createdAt: '2026-10-10T10:00:00Z' }
    );

    // 2. Cash Purchase of Rs. 800 (80000 paisa)
    processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 1, costPrice: 80000 })],
      { paymentMethod: 'Cash', applyVat: false, createdAt: '2026-10-10T12:00:00Z' }
    );

    // 3. Cash Expense of Rs. 200 (20000 paisa)
    createExpense({
      category: 'Utilities',
      amount: 20000,
      payment_method: 'Cash',
      date: '2026-10-10',
    });

    // Net cash before 2026-10-15: 200000 - 80000 - 20000 = 100000 paisa
    const openingBal = getOpeningCashBalance('2026-10-15');
    assert.equal(openingBal, 100000, 'Opening balance on 2026-10-15 must reflect 100000 paisa');
  });

  test('2. Customer credit dues generation, outstanding balance tracking, and customer settlement collections', () => {
    const today = new Date().toISOString().slice(0, 10);
    const customer = createCustomer({ name: 'Ramesh Karki', phone: '9845112244' });
    const product = createProduct({ name: 'Chowmein 1kg', cost_price: 10000, selling_price: 15000, current_stock: 50 });

    // Customer buys 10 packs = Rs. 1500 (150000 paisa) on partial credit: pays Rs. 500 (50000 paisa), due = Rs. 1000 (100000 paisa)
    const sale = processSale(
      [{ productId: product.id, quantity: 10, actualSellingPrice: 15000, discount: 0 }],
      { customerId: customer.id, paidAmount: 50000, paymentMethod: 'Cash', applyVat: false }
    );

    assert.equal(sale.due_amount, 100000);
    assert.equal(getCustomerTotalDue(customer.id), 100000);

    // Customer pays Rs. 600 (60000 paisa) towards the debt
    recordCustomerPayment({
      customerId: customer.id,
      amount: 60000,
      paymentMethod: 'Cash',
      paymentDate: today,
      note: 'Partial khata settlement',
    });

    // Outstanding due should now be 40000 paisa
    assert.equal(getCustomerTotalDue(customer.id), 40000);

    // Day Book check
    const dayBook = getDayBook({ date: today });
    assert.equal(dayBook.salesInvoiced, 150000);
    assert.equal(dayBook.salesPaid, 110000); // 50000 at sale + 60000 settled
    assert.equal(dayBook.newCustomerDue, 40000); // Remaining due
    assert.equal(dayBook.customerDueCollected, 60000);
  });

  test('3. Vendor credit dues (accounts payable) generation and supplier settlement payments', () => {
    const today = new Date().toISOString().slice(0, 10);
    const vendor = createVendor({ name: 'National Flour Mill', phone: '9855011999' });
    const product = createProduct({ name: 'Wheat Atta 50kg', cost_price: 300000, selling_price: 400000, current_stock: 10 });

    // Purchase 2 sacks = Rs. 6,000 (600000 paisa) on credit: paid Rs. 2,000 (200000 paisa), due = Rs. 4,000 (400000 paisa)
    const purchase = processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 2, costPrice: 300000 })],
      { vendorId: vendor.id, paidAmount: 200000, paymentMethod: 'Bank Transfer', applyVat: false }
    );

    assert.equal(purchase.due_amount, 400000);
    assert.equal(getVendorTotalDue(vendor.id), 400000);

    // Shopkeeper pays Rs. 2,500 (250000 paisa) to vendor
    recordVendorPayment({
      vendorId: vendor.id,
      amount: 250000,
      paymentMethod: 'Bank Transfer',
      paymentDate: today,
      note: 'Vendor bill settlement',
    });

    // Remaining vendor payable due should be 150000 paisa
    assert.equal(getVendorTotalDue(vendor.id), 150000);

    // Day Book check
    const dayBook = getDayBook({ date: today });
    assert.equal(dayBook.purchasesInvoiced, 600000);
    assert.equal(dayBook.purchasesPaid, 450000); // 200000 initial + 250000 settled
    assert.equal(dayBook.newVendorDue, 150000); // Remaining due
    assert.equal(dayBook.vendorDuePaid, 250000);
  });

  test('4. Multi-mode payment distribution in Day Book (Cash, Online / QR, Bank Transfer)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const prod = createProduct({ name: 'Item Multi', cost_price: 1000, selling_price: 2000, current_stock: 100 });

    // Transaction 1: Cash sale of 10 units = 20000
    processSale([{ productId: prod.id, quantity: 10, actualSellingPrice: 2000, discount: 0 }], { paymentMethod: 'Cash', applyVat: false });

    // Transaction 2: Online / QR sale of 15 units = 30000
    processSale([{ productId: prod.id, quantity: 15, actualSellingPrice: 2000, discount: 0 }], { paymentMethod: 'Online / QR', applyVat: false });

    // Transaction 3: Cash expense = 5000
    createExpense({ category: 'Tea', amount: 5000, payment_method: 'Cash', date: today });

    // Transaction 4: Bank Transfer purchase = 15000
    processPurchase([makePurchaseItem({ productId: prod.id, quantity: 15, costPrice: 1000 })], { paymentMethod: 'Bank Transfer', applyVat: false });

    const dayBook = getDayBook({ date: today });

    // Cash mode: Inflow 20000, Outflow 5000 -> Net 15000
    const cashMode = dayBook.modeSummaries.find((m) => m.mode === 'Cash');
    assert.ok(cashMode);
    assert.equal(cashMode.inflow, 20000);
    assert.equal(cashMode.outflow, 5000);
    assert.equal(cashMode.net, 15000);

    // Online / QR mode: Inflow 30000, Outflow 0 -> Net 30000
    const qrMode = dayBook.modeSummaries.find((m) => m.mode === 'Online / QR');
    assert.ok(qrMode);
    assert.equal(qrMode.inflow, 30000);
    assert.equal(qrMode.outflow, 0);
    assert.equal(qrMode.net, 30000);

    // Bank Transfer mode: Inflow 0, Outflow 15000 -> Net -15000
    const bankMode = dayBook.modeSummaries.find((m) => m.mode === 'Bank Transfer');
    assert.ok(bankMode);
    assert.equal(bankMode.inflow, 0);
    assert.equal(bankMode.outflow, 15000);
    assert.equal(bankMode.net, -15000);
  });

  test('5. Day Book double-entry journal reconciliation (total inflow, outflow, net cash flow, and closing balance)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const prod = createProduct({ name: 'Juice Bottle', cost_price: 3000, selling_price: 5000, current_stock: 40 });

    // Cash Sale: +25000
    processSale([{ productId: prod.id, quantity: 5, actualSellingPrice: 5000, discount: 0 }], { paymentMethod: 'Cash', applyVat: false });

    // Cash Purchase: -12000
    processPurchase([makePurchaseItem({ productId: prod.id, quantity: 4, costPrice: 3000 })], { paymentMethod: 'Cash', applyVat: false });

    // Cash Expense: -3000
    createExpense({ category: 'Printing', amount: 3000, payment_method: 'Cash', date: today });

    const dayBook = getDayBook({ date: today });
    assert.equal(dayBook.totalInflow, 25000);
    assert.equal(dayBook.totalOutflow, 15000); // 12000 + 3000
    assert.equal(dayBook.netCashFlow, 10000); // 25000 - 15000
    assert.equal(dayBook.closingBalance, dayBook.openingBalance + 10000);
  });

  test('6. Cash drawer shift management via shiftService (open shift, live metrics, close shift, variance over/short)', () => {
    assert.equal(getCurrentOpenShift(), null);

    // Open shift with Rs. 5,000 opening float (500000 paisa)
    const shift = openShift({
      cashierName: 'Aayush Shrestha',
      openingFloat: 500000,
      notes: 'Morning shift started',
    });

    assert.ok(shift.id > 0);
    assert.equal(shift.status, 'OPEN');
    assert.equal(shift.opening_float, 500000);
    assert.equal(getCurrentOpenShift()?.id, shift.id);

    // Attempting to open a second shift without closing must be rejected
    assert.throws(
      () => openShift({ cashierName: 'Other Cashier', openingFloat: 100000 }),
      /already open/i,
      'Should block opening a second shift simultaneously'
    );

    const product = createProduct({ name: 'Soap Cake', cost_price: 2000, selling_price: 3000, current_stock: 50 });

    // Cash Sale of 10 cakes = 30000 paisa
    processSale(
      [{ productId: product.id, quantity: 10, actualSellingPrice: 3000, discount: 0 }],
      { paymentMethod: 'Cash', applyVat: false }
    );

    // Cash Expense of 5000 paisa
    createExpense({ category: 'Lunch', amount: 5000, payment_method: 'Cash' });

    // Check live metrics
    // Expected drawer cash = opening float (500000) + cash sales (30000) - cash expenses (5000) = 525000
    const liveMetrics = getShiftLiveMetrics(shift.id);
    assert.equal(liveMetrics.openingFloat, 500000);
    assert.equal(liveMetrics.cashSales, 30000);
    assert.equal(liveMetrics.cashExpenses, 5000);
    assert.equal(liveMetrics.expectedDrawerCash, 525000);

    // Cashier physically counts 524500 paisa (Rs. 5 shortage)
    const closed = closeShift({
      shiftId: shift.id,
      closingCash: 524500,
      notes: 'Closing counter; minor Rs. 5 coin shortage',
    });

    assert.equal(closed.status, 'CLOSED');
    assert.equal(closed.closing_cash, 524500);
    assert.equal(closed.system_cash, 525000);
    assert.equal(closed.variance, -500, 'Variance must reflect -500 paisa shortage');
    assert.equal(getCurrentOpenShift(), null, 'No shift should be active after close');
  });

  test('7. Shift opening float linkage to Day Book opening balance', () => {
    const today = new Date().toISOString().slice(0, 10);

    // Open shift with float of Rs. 3,000 (300000 paisa)
    openShift({
      cashierName: 'Counter 1',
      openingFloat: 300000,
      openedAt: `${today}T08:00:00.000Z`,
    });

    // Opening cash balance in Day Book for today must take the shift opening float into account
    const openingCash = getOpeningCashBalance(today);
    assert.equal(openingCash, 300000, 'Opening cash balance should match shift opening float');
  });

  test('8. Full-day comprehensive reconciliation: sales, purchases, expenses, settlements, and returns', () => {
    const today = new Date().toISOString().slice(0, 10);

    const product = createProduct({ name: 'Rice Bag 25kg', cost_price: 150000, selling_price: 200000, current_stock: 50 });
    const customer = createCustomer({ name: 'Deepak Sharma', phone: '9845001122' });
    const vendor = createVendor({ name: 'Nepal Agro Suppliers', phone: '9855009988' });

    // 1. Cash Sale of 2 bags = 400000 paisa
    const sale1 = processSale(
      [{ productId: product.id, quantity: 2, actualSellingPrice: 200000, discount: 0 }],
      { customerId: customer.id, paymentMethod: 'Cash', applyVat: false }
    );

    // 2. Partial credit sale: 1 bag = 200000 paisa (paid 50000, due 150000)
    processSale(
      [{ productId: product.id, quantity: 1, actualSellingPrice: 200000, discount: 0 }],
      { customerId: customer.id, paidAmount: 50000, paymentMethod: 'Cash', applyVat: false }
    );

    // 3. Customer debt payment receipt of 50000 paisa
    recordCustomerPayment({
      customerId: customer.id,
      amount: 50000,
      paymentMethod: 'Cash',
      paymentDate: today,
      note: 'Due settlement',
    });

    // 4. Cash Purchase of 2 bags = 300000 paisa
    processPurchase(
      [makePurchaseItem({ productId: product.id, quantity: 2, costPrice: 150000 })],
      { vendorId: vendor.id, paymentMethod: 'Cash', applyVat: false }
    );

    // 5. Operating expense of 20000 paisa
    createExpense({ category: 'Tea', amount: 20000, payment_method: 'Cash', date: today });

    // 6. Cash sale return refund of 1 bag = 200000 paisa
    processSaleReturn({
      saleId: sale1.id,
      billNumber: sale1.bill_number,
      customerId: customer.id,
      refundMethod: 'CASH',
      reason: 'DEFECTIVE',
      items: [{ productId: product.id, quantity: 1, unitPrice: 200000, action: 'RESTOCK' }],
    });

    const dayBook = getDayBook({ date: today });

    // Verify all transaction entries are accounted for
    assert.ok(dayBook.entries.length >= 6);

    // Inflows:
    // Sale 1: 400000
    // Sale 2: 100000 (50000 paid at sale + 50000 customer payment allocated to it)
    // Customer Payment: 50000
    // Outflows:
    // Purchase: 300000
    // Expense: 20000
    // Return Cash Refund: 200000
    assert.equal(dayBook.salesInvoiced, 600000);
    assert.equal(dayBook.purchasesInvoiced, 300000);
    assert.equal(dayBook.expensesPaid, 20000);
    assert.equal(dayBook.refundsGiven, 200000);
    assert.equal(dayBook.customerDueCollected, 50000);

    // Overall cash reconciliation integrity
    assert.equal(dayBook.closingBalance, dayBook.openingBalance + dayBook.netCash);
  });

  test('9. Real CRUD on Cash Drawer Shifts: INSERT shift into db, FETCH shift, UPDATE on close, and verify db record', () => {
    // 1. CREATE / INSERT into shift_sessions table
    const shift = openShift({
      cashierName: 'Rita Karki',
      openingFloat: 50000, // Rs. 500
      notes: 'Morning shift opening float',
    });

    // 2. READ / FETCH directly from SQLite shift_sessions table
    const dbShift = queryOne<{
      id: number;
      cashier_name: string;
      opening_float: number;
      status: string;
      notes: string;
      opened_at: string;
      closed_at: string | null;
      closing_cash_actual: number | null;
      closing_cash_expected: number | null;
      cash_difference: number | null;
    }>('SELECT * FROM shift_sessions WHERE id = ?', [shift.id]);

    assert.ok(dbShift);
    assert.equal(dbShift.id, shift.id);
    assert.equal(dbShift.cashier_name, 'Rita Karki');
    assert.equal(dbShift.opening_float, 50000);
    assert.equal(dbShift.status, 'OPEN');
    assert.equal(dbShift.notes, 'Morning shift opening float');
    assert.ok(dbShift.opened_at);
    assert.equal(dbShift.closed_at, null);

    // 3. UPDATE in SQLite database (Close shift)
    const closed = closeShift({
      shiftId: shift.id,
      closingCash: 52000,
      notes: 'Shift ended smoothly with Rs. 20 overage',
    });

    assert.equal(closed.status, 'CLOSED');
    assert.equal(closed.closing_cash, 52000);

    const updatedDbShift = queryOne<{
      status: string;
      closing_cash: number;
      closed_at: string;
      notes: string;
    }>('SELECT status, closing_cash, closed_at, notes FROM shift_sessions WHERE id = ?', [shift.id]);

    assert.ok(updatedDbShift);
    assert.equal(updatedDbShift.status, 'CLOSED');
    assert.equal(updatedDbShift.closing_cash, 52000);
    assert.ok(updatedDbShift.closed_at);
    assert.ok(updatedDbShift.notes.includes('Shift ended smoothly'));
  });
});

