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
} from "../../types/index.ts";
import { query, queryOne, run, transaction } from "../db/sqliteEngine.ts";

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
        COALESCE((SELECT SUM(COALESCE(p_rec.grand_total, p_rec.total)) FROM purchases p_rec WHERE p_rec.vendor_id = v.id), 0)
        +
        COALESCE((
          SELECT SUM(sm.quantity * COALESCE(p.cost_price, 0))
          FROM stock_movements sm
          LEFT JOIN products p ON sm.product_id = p.id
          WHERE sm.vendor_id = v.id AND sm.type = 'RESTOCK' AND sm.reference_id IS NULL AND (sm.note IS NULL OR sm.note NOT LIKE 'Purchase%')
        ), 0)
      ) as total_purchased,
      (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id) as total_due
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
         COALESCE((SELECT SUM(COALESCE(p_rec.grand_total, p_rec.total)) FROM purchases p_rec WHERE p_rec.vendor_id = v.id), 0)
         +
         COALESCE((
           SELECT SUM(sm.quantity * COALESCE(p.cost_price, 0))
           FROM stock_movements sm
           LEFT JOIN products p ON sm.product_id = p.id
          WHERE sm.vendor_id = v.id AND sm.type = 'RESTOCK' AND sm.reference_id IS NULL AND (sm.note IS NULL OR sm.note NOT LIKE 'Purchase%')
        ), 0)
       ) as total_purchased,
       (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id) as total_due
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
         (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id) as total_due
       FROM vendors v 
       ORDER BY v.name ASC 
       LIMIT ?`,
      [limit],
    );
  }

  const s = `%${term}%`;
  return query<Vendor>(
    `SELECT v.*, ${productCountSubquery},
       (SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) FROM purchases WHERE vendor_id = v.id) as total_due
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
    `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as total_due FROM purchases WHERE vendor_id = ?`,
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
    `SELECT COALESCE(SUM(COALESCE(due_amount, 0)), 0) as prev_due FROM purchases WHERE vendor_id = ? AND id < ?`,
    [vendorId, purchaseId]
  );
  return row?.prev_due ?? 0;
}

export function createVendor(data: CreateVendorInput): Vendor {
  const trimmedName = data.name.trim();
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
  const name = data.name !== undefined ? data.name.trim() : existing.name;
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
  const trimmedName = data.name ? data.name.trim() : "";
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
