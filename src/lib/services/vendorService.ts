/**
 * Vendor Management Service
 * Supports vendor catalog, search autocomplete, auto-fill, and auto-creation during purchases.
 */
import {
  Vendor,
  CreateVendorInput,
  Product,
  StockMovement,
  Purchase,
  VendorPayment,
  RecordVendorPaymentInput,
  StatementRow,
} from "../../types/index.ts";
import { query, queryOne, run, transaction } from "../db/sqliteEngine.ts";
import { capitalizeWords } from "../utils/format.ts";

export function getAllVendors(search?: string): Vendor[] {
  const baseSql = `
    SELECT 
      v.*,
      (
        SELECT COUNT(DISTINCT product_id) FROM (
          SELECT pi.product_id FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pu.vendor_id = v.id
          UNION
          SELECT sm.product_id FROM stock_movements sm WHERE sm.vendor_id = v.id
        )
      ) as product_count,
      (
        COALESCE((SELECT SUM(COALESCE(p_rec.grand_total, p_rec.total)) FROM purchases p_rec WHERE p_rec.vendor_id = v.id AND (p_rec.status IS NULL OR p_rec.status != 'RETURNED')), 0)
        +
        COALESCE((
          SELECT SUM(sm.quantity * COALESCE(p.cost_price, 0))
          FROM stock_movements sm
          LEFT JOIN products p ON sm.product_id = p.id
          WHERE sm.vendor_id = v.id AND sm.type = 'RESTOCK' AND sm.reference_id IS NULL AND (sm.note IS NULL OR sm.note NOT LIKE 'Purchase%')
        ), 0)
      ) as total_purchased,
      (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id AND (status IS NULL OR status != 'RETURNED')) as total_due
    FROM vendors v
  `;

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    return query<Vendor>(
      `${baseSql} WHERE v.name LIKE ? OR v.pan_vat LIKE ? OR v.phone LIKE ? OR v.email LIKE ? ORDER BY v.name ASC`,
      [s, s, s, s],
    );
  }

  return query<Vendor>(`${baseSql} ORDER BY v.name ASC`);
}

export function getVendorById(id: number): Vendor | null {
  return queryOne<Vendor>(
    `SELECT 
       v.*,
       (
         SELECT COUNT(DISTINCT product_id) FROM (
           SELECT pi.product_id FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pu.vendor_id = v.id
           UNION
           SELECT sm.product_id FROM stock_movements sm WHERE sm.vendor_id = v.id
         )
       ) as product_count,
       (
         COALESCE((SELECT SUM(COALESCE(p_rec.grand_total, p_rec.total)) FROM purchases p_rec WHERE p_rec.vendor_id = v.id AND (p_rec.status IS NULL OR p_rec.status != 'RETURNED')), 0)
         +
         COALESCE((
           SELECT SUM(sm.quantity * COALESCE(p.cost_price, 0))
           FROM stock_movements sm
           LEFT JOIN products p ON sm.product_id = p.id
          WHERE sm.vendor_id = v.id AND sm.type = 'RESTOCK' AND sm.reference_id IS NULL AND (sm.note IS NULL OR sm.note NOT LIKE 'Purchase%')
        ), 0)
       ) as total_purchased,
       (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id AND (status IS NULL OR status != 'RETURNED')) as total_due
     FROM vendors v 
     WHERE v.id = ?`,
    [id],
  );
}

/**
 * Fast search for autocomplete in Add/Restock product views.
 */
export function searchVendors(
  searchTerm: string,
  limit: number = 20,
): Vendor[] {
  const term = searchTerm.trim();
  const productCountSubquery = `
    (
      SELECT COUNT(DISTINCT product_id) FROM (
        SELECT pi.product_id FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pu.vendor_id = v.id
        UNION
        SELECT sm.product_id FROM stock_movements sm WHERE sm.vendor_id = v.id
      )
    ) as product_count
  `;

  if (!term) {
    return query<Vendor>(
      `SELECT v.*, ${productCountSubquery},
         (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id AND (status IS NULL OR status != 'RETURNED')) as total_due
       FROM vendors v 
       ORDER BY v.name ASC 
       LIMIT ?`,
      [limit],
    );
  }

  const s = `%${term}%`;
  return query<Vendor>(
    `SELECT v.*, ${productCountSubquery},
       (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id AND (status IS NULL OR status != 'RETURNED')) as total_due
     FROM vendors v 
     WHERE v.name LIKE ? OR v.pan_vat LIKE ? OR v.phone LIKE ? OR v.email LIKE ?
     ORDER BY 
       CASE 
         WHEN LOWER(v.name) = LOWER(?) THEN 1
         WHEN LOWER(v.pan_vat) = LOWER(?) THEN 2
         WHEN LOWER(v.name) LIKE LOWER(? || '%') THEN 3
         ELSE 4
       END,
       v.name ASC
     LIMIT ?`,
    [s, s, s, s, term, term, term, limit],
  );
}

/**
 * Returns total outstanding due for a vendor across all purchases.
 */
export function getVendorTotalDue(vendorId?: number | null): number {
  if (!vendorId) return 0;
  const row = queryOne<{ total_due: number }>(
    `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as total_due FROM purchases WHERE vendor_id = ? AND (status IS NULL OR status != 'RETURNED')`,
    [vendorId]
  );
  return row?.total_due ?? 0;
}

/**
 * Returns vendor due balance strictly PRIOR to a given purchase ID.
 */
export function getVendorPreviousDueForPurchase(
  purchaseId: number,
  vendorId?: number | null
): number {
  if (!vendorId) return 0;
  const row = queryOne<{ prev_due: number }>(
    `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as prev_due FROM purchases WHERE vendor_id = ? AND id < ? AND (status IS NULL OR status != 'RETURNED')`,
    [vendorId, purchaseId]
  );
  return row?.prev_due ?? 0;
}

export function createVendor(data: CreateVendorInput): Vendor {
  const trimmedName = capitalizeWords(data.name);
  if (!trimmedName) {
    throw new Error("Vendor name is required");
  }

  const now = new Date().toISOString();
  const email = data.email && data.email.trim() ? data.email.trim() : null;
  const phone = data.phone && data.phone.trim() ? data.phone.trim() : null;
  const panVat =
    data.pan_vat && data.pan_vat.trim() ? data.pan_vat.trim() : null;
  const address =
    data.address && data.address.trim() ? data.address.trim() : null;
  const notes = data.notes && data.notes.trim() ? data.notes.trim() : null;

  return transaction(() => {
    run(
      `INSERT INTO vendors (name, email, phone, pan_vat, address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [trimmedName, email, phone, panVat, address, notes, now, now],
    );

    const idRes = queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
    const newId = idRes?.id ?? 0;

    const created = getVendorById(newId);
    if (!created) {
      throw new Error("Failed to retrieve created vendor");
    }
    return created;
  });
}

export function updateVendor(
  id: number,
  data: Partial<CreateVendorInput>,
): void {
  const existing = getVendorById(id);
  if (!existing) {
    throw new Error("Vendor not found");
  }

  const now = new Date().toISOString();
  const name = data.name !== undefined ? capitalizeWords(data.name) : existing.name;
  if (!name) {
    throw new Error("Vendor name cannot be empty");
  }

  const email =
    (data.email !== undefined ? data.email?.trim() : existing.email) ?? null;
  const phone =
    (data.phone !== undefined ? data.phone?.trim() : existing.phone) ?? null;
  const panVat =
    (data.pan_vat !== undefined ? data.pan_vat?.trim() : existing.pan_vat) ??
    null;
  const address =
    (data.address !== undefined ? data.address?.trim() : existing.address) ??
    null;
  const notes =
    (data.notes !== undefined ? data.notes?.trim() : existing.notes) ?? null;

  transaction(() => {
    run(
      `UPDATE vendors 
       SET name = ?, email = ?, phone = ?, pan_vat = ?, address = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [name, email, phone, panVat, address, notes, now, id],
    );

    // Keep denormalized vendor_name in stock_movements and purchases up-to-date
    if (name !== existing.name) {
      run(`UPDATE stock_movements SET vendor_name = ? WHERE vendor_id = ?`, [
        name,
        id,
      ]);
      run(`UPDATE purchases SET vendor_name = ? WHERE vendor_id = ?`, [
        name,
        id,
      ]);
    }
  });
}

export function deleteVendor(id: number): void {
  const existing = getVendorById(id);
  if (!existing) {
    throw new Error("Vendor not found");
  }

  transaction(() => {
    // Unlink stock movements before deleting vendor
    run(
      `UPDATE stock_movements SET vendor_id = NULL, vendor_name = NULL WHERE vendor_id = ?`,
      [id],
    );
    run(`DELETE FROM vendors WHERE id = ?`, [id]);
  });
}

/**
 * Searches for a vendor by name or PAN/VAT. If matched, returns the existing vendor;
 * otherwise automatically creates a new vendor and returns it.
 */
export function findOrCreateVendor(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  pan_vat?: string | null;
  address?: string | null;
  notes?: string | null;
}): Vendor | null {
  const trimmedName = data.name ? capitalizeWords(data.name) : "";
  if (!trimmedName) {
    return null;
  }

  const trimmedPan = data.pan_vat ? data.pan_vat.trim() : "";

  // 1. Try matching by PAN/VAT if supplied
  if (trimmedPan) {
    const matchByPan = queryOne<Vendor>(
      `SELECT * FROM vendors WHERE LOWER(pan_vat) = LOWER(?) LIMIT 1`,
      [trimmedPan],
    );
    if (matchByPan) {
      // Update missing phone, email, or address if newly provided
      const updates: Partial<CreateVendorInput> = {};
      if (!matchByPan.phone && data.phone?.trim())
        updates.phone = data.phone.trim();
      if (!matchByPan.email && data.email?.trim())
        updates.email = data.email.trim();
      if (!matchByPan.address && data.address?.trim())
        updates.address = data.address.trim();
      if (Object.keys(updates).length > 0) {
        updateVendor(matchByPan.id, updates);
        return getVendorById(matchByPan.id) || matchByPan;
      }
      return matchByPan;
    }
  }

  // 2. Try matching by Name (case-insensitive)
  const matchByName = queryOne<Vendor>(
    `SELECT * FROM vendors WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    [trimmedName],
  );
  if (matchByName) {
    // Update missing details if newly provided
    const updates: Partial<CreateVendorInput> = {};
    if (!matchByName.pan_vat && trimmedPan) updates.pan_vat = trimmedPan;
    if (!matchByName.phone && data.phone?.trim())
      updates.phone = data.phone.trim();
    if (!matchByName.email && data.email?.trim())
      updates.email = data.email.trim();
    if (!matchByName.address && data.address?.trim())
      updates.address = data.address.trim();
    if (Object.keys(updates).length > 0) {
      updateVendor(matchByName.id, updates);
      return getVendorById(matchByName.id) || matchByName;
    }
    return matchByName;
  }

  // 3. Not found: create new vendor record
  return createVendor({
    name: trimmedName,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    pan_vat: trimmedPan || null,
    address: data.address?.trim() || null,
    notes: data.notes?.trim() || null,
  });
}

export function getVendorProducts(vendorId: number): Product[] {
  return query<Product>(
    `SELECT DISTINCT p.* FROM products p 
     WHERE p.id IN (
       SELECT pi.product_id FROM purchase_items pi JOIN purchases pu ON pi.purchase_id = pu.id WHERE pu.vendor_id = ?
       UNION
       SELECT sm.product_id FROM stock_movements sm WHERE sm.vendor_id = ?
     )
     ORDER BY p.name ASC`,
    [vendorId, vendorId],
  );
}

export function getVendorMovements(
  vendorId: number,
  limit: number = 50,
): StockMovement[] {
  return query<StockMovement>(
    `SELECT sm.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
     FROM stock_movements sm
     JOIN products p ON sm.product_id = p.id
     WHERE sm.vendor_id = ?
     ORDER BY sm.created_at DESC, sm.id DESC
     LIMIT ?`,
    [vendorId, limit],
  );
}

export function getVendorPurchases(vendorId: number): Purchase[] {
  return query<Purchase>(
    `SELECT p.*,
       COALESCE(p.paid_amount, p.grand_total, p.total) as paid_amount,
       COALESCE(p.due_amount, 0) as due_amount,
       COALESCE(p.status, 'COMPLETED') as status,
       p.returned_at,
       (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as item_count,
       (SELECT COALESCE(SUM(quantity), 0) FROM purchase_items WHERE purchase_id = p.id) as total_units
     FROM purchases p
     WHERE p.vendor_id = ?
     ORDER BY p.created_at DESC, p.id DESC`,
    [vendorId],
  );
}

/**
 * Total count of registered vendors in the database.
 */
export function getVendorCount(): number {
  const row = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM vendors`);
  return row?.count ?? 0;
}

/**
 * Records a payment made to a vendor to settle outstanding bills (FIFO or specific purchase).
 */
export function recordVendorPayment(input: RecordVendorPaymentInput): VendorPayment {
  const { vendorId, amount, paymentMethod = 'Cash', paymentDate, note, purchaseId } = input;

  if (!vendorId) {
    throw new Error('Vendor ID is required to record payment');
  }
  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const vendor = getVendorById(vendorId);
  if (!vendor) {
    throw new Error('Vendor not found');
  }

  const now = new Date().toISOString();
  const dateToRecord = paymentDate ? new Date(paymentDate).toISOString() : now;

  return transaction(() => {
    // Generate sequential receipt/voucher number
    const lastPay = queryOne<{ id: number }>('SELECT id FROM vendor_payments ORDER BY id DESC LIMIT 1');
    const nextPayId = (lastPay?.id ?? 0) + 1;
    const receiptNumber = `VCH-V-${nextPayId.toString().padStart(5, '0')}`;

    // 1. Insert vendor payment record
    run(
      `INSERT INTO vendor_payments (
        vendor_id, purchase_id, amount, payment_method, payment_date, receipt_number, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendorId, purchaseId ?? null, amount, paymentMethod, dateToRecord, receiptNumber, note?.trim() || null, now]
    );

    let remainingToAllocate = amount;

    // 2. If a specific purchase was targeted, apply to it first
    if (purchaseId) {
      const targetPurchase = queryOne<Purchase>(
        `SELECT * FROM purchases WHERE id = ? AND vendor_id = ? AND (status IS NULL OR status != 'RETURNED')`,
        [purchaseId, vendorId]
      );
      if (targetPurchase && (targetPurchase.due_amount ?? 0) > 0) {
        const currentDue = targetPurchase.due_amount ?? 0;
        const currentPaid = targetPurchase.paid_amount ?? (targetPurchase.grand_total ?? targetPurchase.total) - currentDue;
        const apply = Math.min(remainingToAllocate, currentDue);
        
        run(
          `UPDATE purchases SET paid_amount = ?, due_amount = ? WHERE id = ?`,
          [currentPaid + apply, currentDue - apply, purchaseId]
        );
        remainingToAllocate -= apply;
      }
    }

    // 3. Allocate remaining amount FIFO across other unpaid purchases
    if (remainingToAllocate > 0) {
      const unpaidPurchases = query<Purchase>(
        `SELECT * FROM purchases 
         WHERE vendor_id = ? AND due_amount > 0 AND (status IS NULL OR status != 'RETURNED')
         ORDER BY created_at ASC, id ASC`,
        [vendorId]
      );

      for (const p of unpaidPurchases) {
        if (remainingToAllocate <= 0) break;
        if (purchaseId && p.id === purchaseId) continue;

        const currentDue = p.due_amount ?? 0;
        const currentPaid = p.paid_amount ?? (p.grand_total ?? p.total) - currentDue;
        const apply = Math.min(remainingToAllocate, currentDue);

        run(
          `UPDATE purchases SET paid_amount = ?, due_amount = ? WHERE id = ?`,
          [currentPaid + apply, currentDue - apply, p.id]
        );
        remainingToAllocate -= apply;
      }
    }

    const created = queryOne<VendorPayment>(
      `SELECT vp.*, v.name as vendor_name, p.bill_number as purchase_bill_number
       FROM vendor_payments vp
       LEFT JOIN vendors v ON vp.vendor_id = v.id
       LEFT JOIN purchases p ON vp.purchase_id = p.id
       WHERE vp.id = ?`,
      [nextPayId]
    );

    if (!created) {
      throw new Error('Failed to retrieve recorded vendor payment');
    }

    return created;
  });
}

/**
 * Returns all payment records made to a vendor.
 */
export function getVendorPayments(vendorId: number): VendorPayment[] {
  return query<VendorPayment>(
    `SELECT vp.*, v.name as vendor_name, p.bill_number as purchase_bill_number
     FROM vendor_payments vp
     LEFT JOIN vendors v ON vp.vendor_id = v.id
     LEFT JOIN purchases p ON vp.purchase_id = p.id
     WHERE vp.vendor_id = ?
     ORDER BY vp.payment_date DESC, vp.id DESC`,
    [vendorId]
  );
}

/**
 * Builds chronological Statement of Account (Ledger) for a vendor.
 */
export function getVendorStatement(vendorId: number): {
  vendor: Vendor;
  purchases: Purchase[];
  payments: VendorPayment[];
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
  rows: StatementRow[];
} {
  const vendor = getVendorById(vendorId);
  if (!vendor) {
    throw new Error('Vendor not found');
  }

  const purchases = getVendorPurchases(vendorId);
  const payments = getVendorPayments(vendorId);

  const activePurchases = purchases.filter((p) => p.status !== 'RETURNED');
  const totalInvoiced = activePurchases.reduce((acc, p) => acc + (p.grand_total ?? p.total), 0);
  const totalPaid = activePurchases.reduce((acc, p) => acc + (p.paid_amount ?? p.grand_total ?? p.total), 0);
  const totalDue = activePurchases.reduce((acc, p) => acc + (p.due_amount ?? 0), 0);

  // Build unified chronological statement rows (oldest first for running balance)
  const unsortedRows: Omit<StatementRow, 'runningBalance'>[] = [];

  for (const p of purchases) {
    const isReturned = p.status === 'RETURNED';
    const billTotal = p.grand_total ?? p.total;
    const paid = p.paid_amount ?? billTotal;
    const due = p.due_amount ?? 0;

    unsortedRows.push({
      id: `purchase-${p.id}`,
      date: p.created_at,
      type: isReturned ? 'RETURN' : 'BILL',
      refNumber: p.bill_number || `PUR-${p.id.toString().padStart(5, '0')}`,
      description: isReturned ? 'Purchase Return (Voided Bill)' : `Purchase Invoice (${p.item_count || 1} items)`,
      amount: billTotal,
      paidAmount: paid,
      dueAmount: isReturned ? 0 : due,
      status: p.status || 'COMPLETED',
    });
  }

  for (const v of payments) {
    unsortedRows.push({
      id: `payment-${v.id}`,
      date: v.payment_date || v.created_at,
      type: 'PAYMENT',
      refNumber: v.receipt_number || `VCH-${v.id.toString().padStart(5, '0')}`,
      description: v.note ? `Payment to Vendor: ${v.note}` : 'Payment Paid (Balance Settlement)',
      amount: v.amount,
      paidAmount: v.amount,
      dueAmount: 0,
      paymentMethod: v.payment_method,
      status: 'PAID',
    });
  }

  // Sort chronological ascending (oldest to newest) to calculate running balance
  unsortedRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const rows: StatementRow[] = unsortedRows.map((r) => {
    if (r.type === 'BILL') {
      // Bill increases outstanding due to vendor
      runningBalance += r.dueAmount;
    } else if (r.type === 'PAYMENT') {
      // Payment reduces outstanding balance
      runningBalance = Math.max(0, runningBalance - r.amount);
    }
    return {
      ...r,
      runningBalance,
    };
  });

  return {
    vendor,
    purchases,
    payments,
    totalInvoiced,
    totalPaid,
    totalDue,
    rows,
  };
}

