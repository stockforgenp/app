/**
 * Customer Management Service
 * Supports customer directory, search autocomplete, auto-fill, and auto-creation during sales.
 */
import {
  Customer,
  CreateCustomerInput,
  Sale,
  CustomerPayment,
  RecordCustomerPaymentInput,
  StatementRow,
  SaleReturn,
} from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import { capitalizeWords } from '../utils/format.ts';

export function getAllCustomers(search?: string): Customer[] {
  const baseSql = `
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as sales_count,
      (SELECT COALESCE(SUM(COALESCE(grand_total, total)), 0) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as total_spent,
      (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as total_due
    FROM customers c
  `;

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    return query<Customer>(
      `${baseSql} WHERE c.name LIKE ? OR c.phone LIKE ? OR c.pan_vat LIKE ? ORDER BY c.name ASC`,
      [s, s, s]
    );
  }

  return query<Customer>(`${baseSql} ORDER BY c.name ASC`);
}

export function getCustomerById(id: number): Customer | null {
  return queryOne<Customer>(
    `SELECT 
       c.*,
       (SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as sales_count,
       (SELECT COALESCE(SUM(COALESCE(grand_total, total)), 0) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as total_spent,
       (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as total_due
     FROM customers c 
     WHERE c.id = ?`,
    [id]
  );
}

/**
 * Fast search for autocomplete in POS Sales view.
 */
export function searchCustomers(searchTerm: string, limit: number = 20): Customer[] {
  const term = searchTerm.trim();
  if (!term) {
    return query<Customer>(
      `SELECT c.*, 
         (SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as sales_count,
         (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as total_due
       FROM customers c 
       ORDER BY c.name ASC 
       LIMIT ?`,
      [limit]
    );
  }

  const s = `%${term}%`;
  return query<Customer>(
    `SELECT c.*, 
       (SELECT COUNT(*) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as sales_count,
       (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM sales WHERE customer_id = c.id AND (status IS NULL OR status != 'RETURNED')) as total_due
     FROM customers c 
     WHERE c.name LIKE ? OR c.phone LIKE ? OR c.pan_vat LIKE ?
     ORDER BY 
       CASE 
         WHEN LOWER(c.phone) = LOWER(?) THEN 1
         WHEN LOWER(c.name) = LOWER(?) THEN 2
         WHEN LOWER(c.pan_vat) = LOWER(?) THEN 3
         WHEN LOWER(c.phone) LIKE LOWER(? || '%') THEN 4
         WHEN LOWER(c.name) LIKE LOWER(? || '%') THEN 5
         ELSE 6
       END,
       c.name ASC
     LIMIT ?`,
    [s, s, s, term, term, term, term, term, limit]
  );
}

/**
 * Returns total outstanding due for a customer across all sales.
 */
export function getCustomerTotalDue(customerId?: number | null, phone?: string | null): number {
  if (customerId) {
    const row = queryOne<{ total_due: number }>(
      `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as total_due FROM sales WHERE customer_id = ? AND (status IS NULL OR status != 'RETURNED')`,
      [customerId]
    );
    const unallocatedCredit = queryOne<{ total_credit: number }>(
      `SELECT COALESCE(SUM(total_refund), 0) as total_credit FROM sale_returns WHERE customer_id = ? AND refund_method = 'CREDIT_NOTE' AND sale_id IS NULL`,
      [customerId]
    );
    const totalDue = (row?.total_due ?? 0) - (unallocatedCredit?.total_credit ?? 0);
    return Math.max(0, totalDue);
  }
  if (phone && phone.trim()) {
    const row = queryOne<{ total_due: number }>(
      `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as total_due FROM sales WHERE customer_phone = ? AND (status IS NULL OR status != 'RETURNED')`,
      [phone.trim()]
    );
    return row?.total_due ?? 0;
  }
  return 0;
}

/**
 * Returns customer due balance strictly PRIOR to a given sale ID.
 */
export function getCustomerPreviousDueForSale(
  saleId: number,
  customerId?: number | null,
  phone?: string | null
): number {
  if (customerId) {
    const row = queryOne<{ prev_due: number }>(
      `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as prev_due FROM sales WHERE customer_id = ? AND id < ? AND (status IS NULL OR status != 'RETURNED')`,
      [customerId, saleId]
    );
    return row?.prev_due ?? 0;
  }
  if (phone && phone.trim()) {
    const row = queryOne<{ prev_due: number }>(
      `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as prev_due FROM sales WHERE customer_phone = ? AND id < ? AND (status IS NULL OR status != 'RETURNED')`,
      [phone.trim(), saleId]
    );
    return row?.prev_due ?? 0;
  }
  return 0;
}

export function createCustomer(data: CreateCustomerInput): Customer {
  const trimmedName = capitalizeWords(data.name);
  if (!trimmedName) {
    throw new Error('Customer name is required');
  }

  const now = new Date().toISOString();
  const phone = data.phone && data.phone.trim() ? data.phone.trim() : null;
  const panVat = data.pan_vat && data.pan_vat.trim() ? data.pan_vat.trim() : null;
  const address = data.address && data.address.trim() ? data.address.trim() : null;
  const notes = data.notes && data.notes.trim() ? data.notes.trim() : null;
  const customerType = data.customer_type === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';

  return transaction(() => {
    run(
      `INSERT INTO customers (name, phone, pan_vat, address, notes, customer_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [trimmedName, phone, panVat, address, notes, customerType, now, now]
    );

    const idRes = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const newId = idRes?.id ?? 0;

    const created = getCustomerById(newId);
    if (!created) {
      throw new Error('Failed to retrieve created customer');
    }
    return created;
  });
}

export function updateCustomer(id: number, data: Partial<CreateCustomerInput>): void {
  const existing = getCustomerById(id);
  if (!existing) {
    throw new Error('Customer not found');
  }

  const now = new Date().toISOString();
  const name = data.name !== undefined ? capitalizeWords(data.name) : existing.name;
  if (!name) {
    throw new Error('Customer name cannot be empty');
  }

  const phone = (data.phone !== undefined ? data.phone?.trim() : existing.phone) ?? null;
  const panVat = (data.pan_vat !== undefined ? data.pan_vat?.trim() : existing.pan_vat) ?? null;
  const address = (data.address !== undefined ? data.address?.trim() : existing.address) ?? null;
  const notes = (data.notes !== undefined ? data.notes?.trim() : existing.notes) ?? null;
  const customerType = data.customer_type !== undefined ? data.customer_type : (existing.customer_type ?? 'RETAIL');

  transaction(() => {
    run(
      `UPDATE customers 
       SET name = ?, phone = ?, pan_vat = ?, address = ?, notes = ?, customer_type = ?, updated_at = ?
       WHERE id = ?`,
      [name, phone, panVat, address, notes, customerType, now, id]
    );

    // Keep denormalized customer_name in sales up-to-date
    if (name !== existing.name || phone !== existing.phone) {
      run(`UPDATE sales SET customer_name = ?, customer_phone = ? WHERE customer_id = ?`, [name, phone, id]);
    }
  });
}

export function deleteCustomer(id: number): void {
  const existing = getCustomerById(id);
  if (!existing) {
    throw new Error('Customer not found');
  }

  transaction(() => {
    // Unlink sales before deleting customer
    run(`UPDATE sales SET customer_id = NULL WHERE customer_id = ?`, [id]);
    run(`DELETE FROM customers WHERE id = ?`, [id]);
  });
}

/**
 * Searches for an existing customer by Phone, PAN/VAT, or Name.
 * If found, updates any missing details and returns the customer.
 * If not found, automatically creates and returns a new Customer.
 */
export function findOrCreateCustomer(data: {
  name?: string | null;
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
}): Customer | null {
  const trimmedName = data.name ? data.name.trim() : '';
  const trimmedPhone = data.phone ? data.phone.trim() : '';
  const trimmedPan = data.pan_vat ? data.pan_vat.trim() : '';
  const trimmedAddress = data.address ? data.address.trim() : '';

  if (!trimmedName && !trimmedPhone && !trimmedPan) {
    return null;
  }

  // 1. Try matching by Phone if provided (primary retail lookup)
  if (trimmedPhone) {
    const matchByPhone = queryOne<Customer>(
      `SELECT * FROM customers WHERE phone = ? LIMIT 1`,
      [trimmedPhone]
    );
    if (matchByPhone) {
      const updates: Partial<CreateCustomerInput> = {};
      if (
        trimmedName &&
        trimmedName !== matchByPhone.name &&
        (matchByPhone.name.startsWith('Customer (') || matchByPhone.name === 'Walk-in Customer' || trimmedName.length > 0)
      ) {
        updates.name = trimmedName;
      }
      if (trimmedPan && trimmedPan !== (matchByPhone.pan_vat || '')) {
        updates.pan_vat = trimmedPan;
      }
      if (trimmedAddress && trimmedAddress !== (matchByPhone.address || '')) {
        updates.address = trimmedAddress;
      }
      if (Object.keys(updates).length > 0) {
        updateCustomer(matchByPhone.id, updates);
        return getCustomerById(matchByPhone.id) || matchByPhone;
      }
      return matchByPhone;
    }
  }

  // 2. Try matching by PAN/VAT if provided
  if (trimmedPan) {
    const matchByPan = queryOne<Customer>(
      `SELECT * FROM customers WHERE LOWER(pan_vat) = LOWER(?) LIMIT 1`,
      [trimmedPan]
    );
    if (matchByPan) {
      const updates: Partial<CreateCustomerInput> = {};
      if (trimmedPhone && trimmedPhone !== (matchByPan.phone || '')) {
        updates.phone = trimmedPhone;
      }
      if (
        trimmedName &&
        trimmedName !== matchByPan.name &&
        (matchByPan.name.startsWith('Customer (') || matchByPan.name === 'Walk-in Customer' || trimmedName.length > 0)
      ) {
        updates.name = trimmedName;
      }
      if (trimmedAddress && trimmedAddress !== (matchByPan.address || '')) {
        updates.address = trimmedAddress;
      }
      if (Object.keys(updates).length > 0) {
        updateCustomer(matchByPan.id, updates);
        return getCustomerById(matchByPan.id) || matchByPan;
      }
      return matchByPan;
    }
  }

  // 3. Try matching by Name (case-insensitive) if provided
  if (trimmedName && trimmedName !== 'Walk-in Customer') {
    const matchByName = queryOne<Customer>(
      `SELECT * FROM customers WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [trimmedName]
    );
    if (matchByName) {
      const updates: Partial<CreateCustomerInput> = {};
      if (trimmedPhone && trimmedPhone !== (matchByName.phone || '')) {
        updates.phone = trimmedPhone;
      }
      if (trimmedPan && trimmedPan !== (matchByName.pan_vat || '')) {
        updates.pan_vat = trimmedPan;
      }
      if (trimmedAddress && trimmedAddress !== (matchByName.address || '')) {
        updates.address = trimmedAddress;
      }
      if (Object.keys(updates).length > 0) {
        updateCustomer(matchByName.id, updates);
        return getCustomerById(matchByName.id) || matchByName;
      }
      return matchByName;
    }
  }

  // 4. Not found: create new customer
  const effectiveName = trimmedName || (trimmedPhone ? `Customer (${trimmedPhone})` : 'Walk-in Customer');
  return createCustomer({
    name: effectiveName,
    phone: trimmedPhone || null,
    pan_vat: trimmedPan || null,
    address: trimmedAddress || null,
    notes: data.notes?.trim() || null,
  });
}

export function getCustomerSales(customerId: number): Sale[] {
  return query<Sale>(
    `SELECT s.*, 
            COALESCE(s.paid_amount, s.grand_total, s.total) as paid_amount,
            COALESCE(s.due_amount, 0) as due_amount,
            COALESCE(s.status, 'COMPLETED') as status,
            (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
     FROM sales s
     WHERE s.customer_id = ?
     ORDER BY s.created_at DESC, s.id DESC`,
    [customerId]
  );
}

/**
 * Total count of registered customers in the database.
 */
export function getCustomerCount(): number {
  const row = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM customers`);
  return row?.count ?? 0;
}

/**
 * Records a customer payment / debt settlement receipt.
 * Automatically allocates the paid amount to unsettled sales (FIFO or specific sale).
 */
export function recordCustomerPayment(input: RecordCustomerPaymentInput): CustomerPayment {
  const { customerId, amount, paymentMethod = 'Cash', paymentDate, note, saleId } = input;

  if (!customerId) {
    throw new Error('Customer ID is required to record payment');
  }
  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const customer = getCustomerById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const now = new Date().toISOString();
  const dateToRecord = paymentDate ? new Date(paymentDate).toISOString() : now;

  return transaction(() => {
    // Generate sequential receipt number
    const lastPay = queryOne<{ id: number }>('SELECT id FROM customer_payments ORDER BY id DESC LIMIT 1');
    const nextPayId = (lastPay?.id ?? 0) + 1;
    const receiptNumber = `RCP-C-${nextPayId.toString().padStart(5, '0')}`;

    // 1. Insert customer payment record
    run(
      `INSERT INTO customer_payments (
        customer_id, sale_id, amount, payment_method, payment_date, receipt_number, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, saleId ?? null, amount, paymentMethod, dateToRecord, receiptNumber, note?.trim() || null, now]
    );

    let remainingToAllocate = amount;

    // 2. If a specific sale was targeted, apply to it first
    if (saleId) {
      const targetSale = queryOne<Sale>(
        `SELECT * FROM sales WHERE id = ? AND customer_id = ? AND (status IS NULL OR status != 'RETURNED')`,
        [saleId, customerId]
      );
      if (targetSale && (targetSale.due_amount ?? 0) > 0) {
        const currentDue = targetSale.due_amount ?? 0;
        const currentPaid = targetSale.paid_amount ?? (targetSale.grand_total ?? targetSale.total) - currentDue;
        const apply = Math.min(remainingToAllocate, currentDue);
        
        run(
          `UPDATE sales SET paid_amount = ?, due_amount = ? WHERE id = ?`,
          [currentPaid + apply, currentDue - apply, saleId]
        );
        remainingToAllocate -= apply;
      }
    }

    // 3. Allocate remaining amount FIFO across other unpaid sales
    if (remainingToAllocate > 0) {
      const unpaidSales = query<Sale>(
        `SELECT * FROM sales 
         WHERE customer_id = ? AND due_amount > 0 AND (status IS NULL OR status != 'RETURNED')
         ORDER BY created_at ASC, id ASC`,
        [customerId]
      );

      for (const s of unpaidSales) {
        if (remainingToAllocate <= 0) break;
        if (saleId && s.id === saleId) continue; // already handled

        const currentDue = s.due_amount ?? 0;
        const currentPaid = s.paid_amount ?? (s.grand_total ?? s.total) - currentDue;
        const apply = Math.min(remainingToAllocate, currentDue);

        run(
          `UPDATE sales SET paid_amount = ?, due_amount = ? WHERE id = ?`,
          [currentPaid + apply, currentDue - apply, s.id]
        );
        remainingToAllocate -= apply;
      }
    }

    const created = queryOne<CustomerPayment>(
      `SELECT cp.*, c.name as customer_name, s.bill_number as sale_bill_number
       FROM customer_payments cp
       LEFT JOIN customers c ON cp.customer_id = c.id
       LEFT JOIN sales s ON cp.sale_id = s.id
       WHERE cp.id = ?`,
      [nextPayId]
    );

    if (!created) {
      throw new Error('Failed to retrieve recorded payment');
    }

    return created;
  });
}

/**
 * Returns all payment records for a customer.
 */
export function getCustomerPayments(customerId: number): CustomerPayment[] {
  return query<CustomerPayment>(
    `SELECT cp.*, c.name as customer_name, s.bill_number as sale_bill_number
     FROM customer_payments cp
     LEFT JOIN customers c ON cp.customer_id = c.id
     LEFT JOIN sales s ON cp.sale_id = s.id
     WHERE cp.customer_id = ?
     ORDER BY cp.payment_date DESC, cp.id DESC`,
    [customerId]
  );
}

/**
 * Builds chronological Statement of Account (Ledger) for a customer.
 */
export function getCustomerStatement(customerId: number): {
  customer: Customer;
  sales: Sale[];
  payments: CustomerPayment[];
  returns: SaleReturn[];
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
  rows: StatementRow[];
} {
  const customer = getCustomerById(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  const sales = getCustomerSales(customerId);
  const payments = getCustomerPayments(customerId);
  const returns = query<SaleReturn>(
    `SELECT * FROM sale_returns WHERE customer_id = ? ORDER BY created_at DESC, id DESC`,
    [customerId]
  );

  const activeSales = sales.filter((s) => s.status !== 'RETURNED');
  const totalInvoiced = activeSales.reduce((acc, s) => acc + (s.grand_total ?? s.total), 0);
  const totalPaid = activeSales.reduce((acc, s) => acc + (s.paid_amount ?? s.grand_total ?? s.total), 0);
  const totalDue = activeSales.reduce((acc, s) => acc + (s.due_amount ?? 0), 0);

  // Build unified chronological statement rows (oldest first for running balance)
  const unsortedRows: Omit<StatementRow, 'runningBalance'>[] = [];

  for (const s of sales) {
    const isReturned = s.status === 'RETURNED';
    const isPartialReturn = s.status === 'PARTIAL_RETURN';
    const billTotal = s.grand_total ?? s.total;

    // Check subsequent payments applied to this specific sale
    const subsequentPayments = queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM customer_payments WHERE sale_id = ?`,
      [s.id]
    )?.total ?? 0;

    // Check credit notes applied to this sale
    const creditNotesApplied = queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(total_refund), 0) as total FROM sale_returns WHERE sale_id = ? AND refund_method = 'CREDIT_NOTE'`,
      [s.id]
    )?.total ?? 0;

    // The initial due at invoice time
    const initialDue = isReturned ? 0 : ((s.due_amount ?? 0) + subsequentPayments + creditNotesApplied);
    const paidAtSale = Math.max(0, billTotal - initialDue);

    unsortedRows.push({
      id: `sale-${s.id}`,
      date: s.created_at,
      type: isReturned ? 'RETURN' : 'BILL',
      refNumber: s.bill_number || `INV-${s.id.toString().padStart(5, '0')}`,
      description: isReturned
        ? 'Sales Invoice (Fully Returned / Voided)'
        : isPartialReturn
          ? `Sales Invoice (${s.item_count || 1} items - Partially Returned)`
          : `Sales Invoice (${s.item_count || 1} items)`,
      amount: billTotal,
      paidAmount: paidAtSale,
      dueAmount: initialDue,
      status: s.status || 'COMPLETED',
    });
  }

  for (const p of payments) {
    unsortedRows.push({
      id: `payment-${p.id}`,
      date: p.payment_date || p.created_at,
      type: 'PAYMENT',
      refNumber: p.receipt_number || `REC-${p.id.toString().padStart(5, '0')}`,
      description: p.note ? `Payment Settlement: ${p.note}` : 'Payment Received (Balance Settlement)',
      amount: p.amount,
      paidAmount: p.amount,
      dueAmount: 0,
      paymentMethod: p.payment_method,
      status: 'PAID',
    });
  }

  for (const r of returns) {
    const isCreditNote = r.refund_method === 'CREDIT_NOTE';
    unsortedRows.push({
      id: `return-${r.id}`,
      date: r.created_at,
      type: 'RETURN',
      refNumber: r.return_number,
      description: isCreditNote
        ? `Credit Note (${r.reason || 'Goods Return'})`
        : `Sales Return (${r.refund_method} Refund - ${r.reason || 'Goods Return'})`,
      amount: r.total_refund,
      paidAmount: r.total_refund,
      dueAmount: 0,
      paymentMethod: r.refund_method,
      status: isCreditNote ? 'CREDIT_NOTE' : 'REFUNDED',
    });
  }

  // Sort chronological ascending (oldest to newest) to calculate running balance
  unsortedRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const rows: StatementRow[] = unsortedRows.map((r) => {
    if (r.type === 'BILL') {
      // Bill increases outstanding due by bill's initial due amount
      runningBalance += r.dueAmount;
    } else if (r.type === 'PAYMENT') {
      // Direct payment reduces outstanding balance
      runningBalance = Math.max(0, runningBalance - r.amount);
    } else if (r.type === 'RETURN') {
      // Credit note reduces running balance
      if (r.paymentMethod === 'CREDIT_NOTE') {
        runningBalance = Math.max(0, runningBalance - r.amount);
      }
    }
    return {
      ...r,
      runningBalance,
    };
  });

  return {
    customer,
    sales,
    payments,
    returns,
    totalInvoiced,
    totalPaid,
    totalDue,
    rows,
  };
}
