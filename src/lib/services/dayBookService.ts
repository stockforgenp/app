/**
 * Day Book (Daily Cash & Transaction Ledger) Service
 * Synthesizes all daily financial movements into an authoritative double-entry journal:
 * 1. Cash Inflow & Outflow (Sales, Purchases, Expenses, Customer Dues, Vendor Dues, Payroll, Returns)
 * 2. Payment Mode Distribution (Cash, Online/QR, Cheque, Bank Transfer)
 * 3. Opening Cash Balance, Net Day Cash Flow, and Closing Balance
 * 4. Credit & Dues Created vs Collected / Settled
 */
import {
  DayBookSummary,
  DayBookEntry,
  DayBookPaymentModeSummary,
  Sale,
  Purchase,
  Expense,
  CustomerPayment,
  VendorPayment,
  SalaryPayment,
  SaleReturn,
  PurchaseReturn,
} from '../../types/index.ts';
import { query, queryOne } from '../db/sqliteEngine.ts';
import { getTodayISODate } from '../utils/format.ts';

export interface DayBookFilterOptions {
  date?: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

/**
 * Normalizes payment mode names for clean grouping.
 */
function normalizePaymentMode(mode?: string | null): string {
  if (!mode || !mode.trim()) return 'Cash';
  const m = mode.trim();
  const lower = m.toLowerCase();
  if (lower === 'cash') return 'Cash';
  if (lower.includes('fonepay') || lower.includes('qr') || lower.includes('esewa') || lower.includes('khalti') || lower.includes('online')) {
    return 'Online / QR';
  }
  if (lower.includes('bank') || lower.includes('transfer') || lower.includes('card')) {
    return 'Bank Transfer';
  }
  if (lower.includes('cheque') || lower.includes('check')) {
    return 'Cheque';
  }
  if (lower.includes('credit') || lower.includes('due') || lower.includes('note')) {
    return 'Credit / Store Credit';
  }
  return m;
}

/**
 * Computes opening cash balance strictly prior to startDate.
 */
export function getOpeningCashBalance(startDate: string): number {
  // 1. Prior Cash Sales
  const priorSales = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(COALESCE(paid_amount, grand_total, total)), 0) as total FROM sales 
     WHERE substr(created_at, 1, 10) < ? AND (status IS NULL OR status != 'RETURNED') 
     AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')`,
    [startDate]
  )?.total ?? 0;

  // 2. Prior Customer Cash Payments
  const priorCustPayments = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments 
     WHERE substr(COALESCE(payment_date, created_at), 1, 10) < ? 
     AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')`,
    [startDate]
  )?.total ?? 0;

  // 3. Prior Purchase Return Cash Refunds Received
  const priorPurchaseReturns = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(total_refund), 0) as total FROM purchase_returns 
     WHERE substr(created_at, 1, 10) < ? AND refund_method = 'CASH'`,
    [startDate]
  )?.total ?? 0;

  // 4. Prior Cash Purchases
  const priorPurchases = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(COALESCE(paid_amount, grand_total, total)), 0) as total FROM purchases 
     WHERE substr(created_at, 1, 10) < ? AND (status IS NULL OR status != 'RETURNED') 
     AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')`,
    [startDate]
  )?.total ?? 0;

  // 5. Prior Vendor Cash Payments
  const priorVendorPayments = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM vendor_payments 
     WHERE substr(COALESCE(payment_date, created_at), 1, 10) < ? 
     AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')`,
    [startDate]
  )?.total ?? 0;

  // 6. Prior Cash Expenses
  const priorExpenses = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses 
     WHERE substr(COALESCE(date, created_at), 1, 10) < ? 
     AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')`,
    [startDate]
  )?.total ?? 0;

  // 7. Prior Cash Salaries
  const priorSalaries = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(net_paid), 0) as total FROM salary_payments 
     WHERE substr(COALESCE(payment_date, created_at), 1, 10) < ? 
     AND (payment_method IS NULL OR LOWER(payment_method) = 'cash')`,
    [startDate]
  )?.total ?? 0;

  // 8. Prior Cash Sales Returns
  const priorSaleReturns = queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(total_refund), 0) as total FROM sale_returns 
     WHERE substr(created_at, 1, 10) < ? AND refund_method = 'CASH'`,
    [startDate]
  )?.total ?? 0;

  // 9. Initial shift opening float
  const shiftFloat = queryOne<{ opening_float: number }>(
    `SELECT opening_float FROM shift_sessions 
     WHERE substr(opened_at, 1, 10) <= ? ORDER BY opened_at ASC LIMIT 1`,
    [startDate]
  )?.opening_float ?? 0;

  const totalInflow = priorSales + priorCustPayments + priorPurchaseReturns;
  const totalOutflow = priorPurchases + priorVendorPayments + priorExpenses + priorSalaries + priorSaleReturns;

  return Math.max(0, shiftFloat + totalInflow - totalOutflow);
}

/**
 * Retrieves the comprehensive Day Book summary and entries for a single date or date range.
 */
export function getDayBook(options?: DayBookFilterOptions): DayBookSummary {
  const today = getTodayISODate();
  const startDate = options?.startDate || options?.date || today;
  const endDate = options?.endDate || options?.date || today;

  const openingBalance = getOpeningCashBalance(startDate);
  const entries: DayBookEntry[] = [];

  // Metrics trackers
  let salesInvoiced = 0;
  let salesPaid = 0;
  let newCustomerDue = 0;
  let customerDueCollected = 0;

  let purchasesInvoiced = 0;
  let purchasesPaid = 0;
  let newVendorDue = 0;
  let vendorDuePaid = 0;

  let expensesPaid = 0;
  let salariesPaid = 0;
  let refundsGiven = 0;
  let refundsReceived = 0;

  // 1. Fetch Sales
  const sales = query<Sale>(
    `SELECT * FROM sales 
     WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
     ORDER BY created_at ASC, id ASC`,
    [startDate, endDate]
  );

  for (const s of sales) {
    const isReturned = s.status === 'RETURNED';
    const total = s.grand_total ?? s.total;
    const paid = isReturned ? 0 : (s.paid_amount ?? total);
    const due = isReturned ? 0 : (s.due_amount ?? 0);
    const mode = s.payment_method || 'Cash';

    if (!isReturned) {
      salesInvoiced += total;
      salesPaid += paid;
      newCustomerDue += due;
    }

    entries.push({
      id: `sale-${s.id}`,
      time: s.created_at,
      type: 'SALE',
      refNumber: s.bill_number || `BILL-${s.id.toString().padStart(5, '0')}`,
      partyName: s.customer_name || 'Walk-in Customer',
      paymentMethod: mode,
      billAmount: total,
      inflow: paid,
      outflow: 0,
      dueAmount: due,
      status: s.status || 'COMPLETED',
      notes: isReturned ? 'Bill Fully Returned' : s.customer_phone ? `Phone: ${s.customer_phone}` : null,
    });
  }

  // 2. Fetch Customer Due Collections
  const customerPayments = query<CustomerPayment & { customer_name?: string; sale_bill_number?: string }>(
    `SELECT cp.*, c.name as customer_name, s.bill_number as sale_bill_number 
     FROM customer_payments cp
     LEFT JOIN customers c ON cp.customer_id = c.id
     LEFT JOIN sales s ON cp.sale_id = s.id
     WHERE (substr(cp.payment_date, 1, 10) >= ? AND substr(cp.payment_date, 1, 10) <= ?)
        OR (substr(cp.created_at, 1, 10) >= ? AND substr(cp.created_at, 1, 10) <= ?)
     ORDER BY COALESCE(cp.payment_date, cp.created_at) ASC, cp.id ASC`,
    [startDate, endDate, startDate, endDate]
  );

  for (const cp of customerPayments) {
    customerDueCollected += cp.amount;
    entries.push({
      id: `custpay-${cp.id}`,
      time: cp.payment_date || cp.created_at,
      type: 'CUSTOMER_PAYMENT',
      refNumber: cp.receipt_number || `RCP-C-${cp.id.toString().padStart(5, '0')}`,
      partyName: cp.customer_name || `Customer #${cp.customer_id}`,
      paymentMethod: cp.payment_method || 'Cash',
      billAmount: cp.amount,
      inflow: cp.amount,
      outflow: 0,
      dueAmount: 0,
      notes: cp.note ? cp.note : cp.sale_bill_number ? `For Bill ${cp.sale_bill_number}` : 'Customer Due Settlement',
    });
  }

  // 3. Fetch Purchases
  const purchases = query<Purchase>(
    `SELECT * FROM purchases 
     WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
     ORDER BY created_at ASC, id ASC`,
    [startDate, endDate]
  );

  for (const p of purchases) {
    const isReturned = p.status === 'RETURNED';
    const total = p.grand_total ?? p.total;
    const paid = isReturned ? 0 : (p.paid_amount ?? total);
    const due = isReturned ? 0 : (p.due_amount ?? 0);
    const mode = p.payment_method || 'Cash';

    if (!isReturned) {
      purchasesInvoiced += total;
      purchasesPaid += paid;
      newVendorDue += due;
    }

    entries.push({
      id: `purchase-${p.id}`,
      time: p.created_at,
      type: 'PURCHASE',
      refNumber: p.bill_number || `PUR-${p.id.toString().padStart(5, '0')}`,
      partyName: p.vendor_name || 'General Supplier',
      paymentMethod: mode,
      billAmount: total,
      inflow: 0,
      outflow: paid,
      dueAmount: due,
      status: p.status || 'COMPLETED',
      notes: isReturned ? 'Purchase Fully Returned' : p.invoice_number ? `Supplier Inv: ${p.invoice_number}` : null,
    });
  }

  // 4. Fetch Vendor Due Payments
  const vendorPayments = query<VendorPayment & { vendor_name?: string; purchase_bill_number?: string }>(
    `SELECT vp.*, v.name as vendor_name, p.bill_number as purchase_bill_number 
     FROM vendor_payments vp
     LEFT JOIN vendors v ON vp.vendor_id = v.id
     LEFT JOIN purchases p ON vp.purchase_id = p.id
     WHERE (substr(vp.payment_date, 1, 10) >= ? AND substr(vp.payment_date, 1, 10) <= ?)
        OR (substr(vp.created_at, 1, 10) >= ? AND substr(vp.created_at, 1, 10) <= ?)
     ORDER BY COALESCE(vp.payment_date, vp.created_at) ASC, vp.id ASC`,
    [startDate, endDate, startDate, endDate]
  );

  for (const vp of vendorPayments) {
    vendorDuePaid += vp.amount;
    entries.push({
      id: `vendpay-${vp.id}`,
      time: vp.payment_date || vp.created_at,
      type: 'VENDOR_PAYMENT',
      refNumber: vp.receipt_number || `VCH-V-${vp.id.toString().padStart(5, '0')}`,
      partyName: vp.vendor_name || `Vendor #${vp.vendor_id}`,
      paymentMethod: vp.payment_method || 'Cash',
      billAmount: vp.amount,
      inflow: 0,
      outflow: vp.amount,
      dueAmount: 0,
      notes: vp.note ? vp.note : vp.purchase_bill_number ? `For Purchase ${vp.purchase_bill_number}` : 'Vendor Due Settlement',
    });
  }

  // 5. Fetch Expenses
  const expenses = query<Expense>(
    `SELECT * FROM expenses 
     WHERE (substr(date, 1, 10) >= ? AND substr(date, 1, 10) <= ?)
        OR (substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?)
     ORDER BY COALESCE(date, created_at) ASC, id ASC`,
    [startDate, endDate, startDate, endDate]
  );

  for (const e of expenses) {
    expensesPaid += e.amount;
    const timeIso = e.date && e.date.includes('T') ? e.date : (e.created_at || `${e.date}T12:00:00Z`);
    entries.push({
      id: `exp-${e.id}`,
      time: timeIso,
      type: 'EXPENSE',
      refNumber: e.receipt_reference || `EXP-${e.id.toString().padStart(5, '0')}`,
      partyName: e.category,
      paymentMethod: e.payment_method || 'Cash',
      billAmount: e.amount,
      inflow: 0,
      outflow: e.amount,
      dueAmount: 0,
      notes: e.note || null,
    });
  }

  // 6. Fetch Staff Salaries
  const salaries = query<SalaryPayment & { staff_name?: string }>(
    `SELECT sp.*, st.name as staff_name 
     FROM salary_payments sp
     LEFT JOIN staff st ON sp.staff_id = st.id
     WHERE (substr(sp.payment_date, 1, 10) >= ? AND substr(sp.payment_date, 1, 10) <= ?)
        OR (substr(sp.created_at, 1, 10) >= ? AND substr(sp.created_at, 1, 10) <= ?)
     ORDER BY COALESCE(sp.payment_date, sp.created_at) ASC, sp.id ASC`,
    [startDate, endDate, startDate, endDate]
  );

  for (const sp of salaries) {
    salariesPaid += sp.net_paid;
    entries.push({
      id: `sal-${sp.id}`,
      time: sp.payment_date || sp.created_at,
      type: 'SALARY',
      refNumber: sp.reference || `PAY-${sp.id.toString().padStart(5, '0')}`,
      partyName: sp.staff_name || `Staff #${sp.staff_id}`,
      paymentMethod: sp.payment_method || 'Cash',
      billAmount: sp.net_paid,
      inflow: 0,
      outflow: sp.net_paid,
      dueAmount: 0,
      notes: sp.note ? `${sp.payment_period}: ${sp.note}` : `Salary for ${sp.payment_period}`,
    });
  }

  // 7. Fetch Sale Returns (Customer refunds)
  const saleReturns = query<SaleReturn>(
    `SELECT * FROM sale_returns 
     WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
     ORDER BY created_at ASC, id ASC`,
    [startDate, endDate]
  );

  for (const sr of saleReturns) {
    const isCashRefund = sr.refund_method === 'CASH';
    if (isCashRefund) {
      refundsGiven += sr.total_refund;
    }
    entries.push({
      id: `saleret-${sr.id}`,
      time: sr.created_at,
      type: 'SALE_RETURN',
      refNumber: sr.return_number,
      partyName: sr.customer_name || 'Customer Return',
      paymentMethod: sr.refund_method,
      billAmount: sr.total_refund,
      inflow: 0,
      outflow: isCashRefund ? sr.total_refund : 0,
      dueAmount: 0,
      notes: sr.bill_number ? `Return on ${sr.bill_number} (${sr.reason})` : sr.reason,
    });
  }

  // 8. Fetch Purchase Returns (Vendor refunds)
  const purchaseReturns = query<PurchaseReturn>(
    `SELECT * FROM purchase_returns 
     WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
     ORDER BY created_at ASC, id ASC`,
    [startDate, endDate]
  );

  for (const pr of purchaseReturns) {
    const isCashRefund = pr.refund_method === 'CASH';
    if (isCashRefund) {
      refundsReceived += pr.total_refund;
    }
    entries.push({
      id: `purret-${pr.id}`,
      time: pr.created_at,
      type: 'PURCHASE_RETURN',
      refNumber: pr.return_number,
      partyName: pr.vendor_name || 'Vendor Return',
      paymentMethod: pr.refund_method,
      billAmount: pr.total_refund,
      inflow: isCashRefund ? pr.total_refund : 0,
      outflow: 0,
      dueAmount: 0,
      notes: pr.bill_number ? `Debit Note on ${pr.bill_number} (${pr.reason})` : pr.reason,
    });
  }

  // Sort entries chronologically ascending
  entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Aggregate Payment Mode Summaries & Global Totals
  const modeMap = new Map<string, { inflow: number; outflow: number }>();
  let totalInflow = 0;
  let totalOutflow = 0;
  let cashInflow = 0;
  let cashOutflow = 0;

  for (const entry of entries) {
    totalInflow += entry.inflow;
    totalOutflow += entry.outflow;

    const normMode = normalizePaymentMode(entry.paymentMethod);
    const existing = modeMap.get(normMode) || { inflow: 0, outflow: 0 };
    existing.inflow += entry.inflow;
    existing.outflow += entry.outflow;
    modeMap.set(normMode, existing);

    if (normMode === 'Cash') {
      cashInflow += entry.inflow;
      cashOutflow += entry.outflow;
    }
  }

  // Ensure 'Cash' is always represented in mode summaries
  if (!modeMap.has('Cash')) {
    modeMap.set('Cash', { inflow: 0, outflow: 0 });
  }

  const modeSummaries: DayBookPaymentModeSummary[] = Array.from(modeMap.entries()).map(
    ([mode, { inflow, outflow }]) => ({
      mode,
      inflow,
      outflow,
      net: inflow - outflow,
    })
  );

  // Sort mode summaries so Cash is first
  modeSummaries.sort((a, b) => {
    if (a.mode === 'Cash') return -1;
    if (b.mode === 'Cash') return 1;
    return a.mode.localeCompare(b.mode);
  });

  const netCashFlow = totalInflow - totalOutflow;
  const netCash = cashInflow - cashOutflow;
  const closingBalance = openingBalance + netCash;

  return {
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    totalInflow,
    totalOutflow,
    netCashFlow,
    cashInflow,
    cashOutflow,
    netCash,
    salesInvoiced,
    salesPaid,
    newCustomerDue,
    customerDueCollected,
    purchasesInvoiced,
    purchasesPaid,
    newVendorDue,
    vendorDuePaid,
    expensesPaid,
    salariesPaid,
    refundsGiven,
    refundsReceived,
    entries,
    modeSummaries,
  };
}
