/**
 * Purchase Management & Historical Inflow Query Service
 * Handles multi-product purchases, stock increases, vendor associations,
 * sequential bill numbering (PUR-00001), 13% VAT, and stock movement auditing.
 */
import {
  Purchase,
  PurchaseItem,
  ProcessPurchaseItemInput,
  ProcessPurchaseVendorInfo,
  Product,
  CreateVendorInput,
} from '../../types/index.ts';

export type { ProcessPurchaseItemInput, ProcessPurchaseVendorInfo };
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import {
  findOrCreateVendor,
  getVendorById,
  updateVendor,
  getVendorPreviousDueForPurchase,
} from './vendorService.ts';
import { capitalizeWords } from '../utils/format.ts';
import { getSettings } from './settingsService.ts';
import { getProductById } from './productService.ts';

export function processPurchase(
  items: ProcessPurchaseItemInput[],
  vendorInfo?: ProcessPurchaseVendorInfo
): Purchase {
  if (!items || items.length === 0) {
    throw new Error('Purchase must contain at least one item');
  }

  const settings = getSettings();
  const now = new Date().toISOString();
  const transactionCreatedAt = vendorInfo?.createdAt
    ? new Date(vendorInfo.createdAt).toISOString()
    : now;

  return transaction(() => {
    // 1. Resolve or auto-create vendor if details were supplied
    let resolvedVendorId: number | null = vendorInfo?.vendorId || null;
    let resolvedVendorName: string | null = vendorInfo?.vendorName ? capitalizeWords(vendorInfo.vendorName) : null;
    let resolvedVendorPhone: string | null = vendorInfo?.vendorPhone?.trim() || null;
    let resolvedVendorEmail: string | null = vendorInfo?.vendorEmail?.trim() || null;
    let resolvedVendorPanVat: string | null = vendorInfo?.vendorPanVat?.trim() || null;
    let resolvedVendorAddress: string | null = vendorInfo?.vendorAddress?.trim() || null;

    if (resolvedVendorId) {
      // If an existing vendor is selected, update any new or changed details provided during purchase
      const existingVendor = getVendorById(resolvedVendorId);
      if (existingVendor) {
        const updates: Partial<CreateVendorInput> = {};
        if (resolvedVendorPanVat && resolvedVendorPanVat !== (existingVendor.pan_vat || '')) {
          updates.pan_vat = resolvedVendorPanVat;
        }
        if (resolvedVendorPhone && resolvedVendorPhone !== (existingVendor.phone || '')) {
          updates.phone = resolvedVendorPhone;
        }
        if (resolvedVendorEmail && resolvedVendorEmail !== (existingVendor.email || '')) {
          updates.email = resolvedVendorEmail;
        }
        if (resolvedVendorAddress && resolvedVendorAddress !== (existingVendor.address || '')) {
          updates.address = resolvedVendorAddress;
        }
        if (resolvedVendorName && resolvedVendorName !== existingVendor.name && resolvedVendorName !== 'Supplier') {
          updates.name = resolvedVendorName;
        }
        if (Object.keys(updates).length > 0) {
          updateVendor(resolvedVendorId, updates);
          const updated = getVendorById(resolvedVendorId);
          if (updated) {
            resolvedVendorName = updated.name;
            resolvedVendorPhone = updated.phone ?? resolvedVendorPhone;
            resolvedVendorEmail = updated.email ?? resolvedVendorEmail;
            resolvedVendorPanVat = updated.pan_vat ?? resolvedVendorPanVat;
            resolvedVendorAddress = updated.address ?? resolvedVendorAddress;
          }
        } else {
          resolvedVendorName = resolvedVendorName || existingVendor.name;
          resolvedVendorPhone = resolvedVendorPhone || (existingVendor.phone ?? null);
          resolvedVendorEmail = resolvedVendorEmail || (existingVendor.email ?? null);
          resolvedVendorPanVat = resolvedVendorPanVat || (existingVendor.pan_vat ?? null);
          resolvedVendorAddress = resolvedVendorAddress || (existingVendor.address ?? null);
        }
      }
    } else if (resolvedVendorName || resolvedVendorPhone || resolvedVendorPanVat) {
      const v = findOrCreateVendor({
        name: resolvedVendorName || 'Supplier',
        phone: resolvedVendorPhone || undefined,
        email: resolvedVendorEmail || undefined,
        pan_vat: resolvedVendorPanVat || undefined,
        address: resolvedVendorAddress || undefined,
      });
      if (v) {
        resolvedVendorId = v.id;
        resolvedVendorName = v.name;
        resolvedVendorPhone = v.phone || resolvedVendorPhone;
        resolvedVendorEmail = v.email || resolvedVendorEmail;
        resolvedVendorPanVat = v.pan_vat || resolvedVendorPanVat;
        resolvedVendorAddress = v.address || resolvedVendorAddress;
      }
    }

    let purchaseSubtotal = 0;
    let purchaseDiscount = 0;

    // 2. Verify all line items
    const verifiedItems: Array<{
      product: Product;
      quantity: number;
      costPrice: number;
      sellingPrice?: number;
      discount: number;
      lineGross: number;
      lineNet: number;
    }> = [];

    for (const it of items) {
      const qty = Math.floor(it.quantity);
      if (qty <= 0) {
        throw new Error(`Quantity for product #${it.productId} must be greater than 0`);
      }

      const product = getProductById(it.productId);
      if (!product) {
        throw new Error(`Product with ID ${it.productId} was not found`);
      }

      const costPrice = Math.max(0, Math.floor(it.costPrice));
      const sellingPrice =
        it.sellingPrice !== undefined ? Math.max(0, Math.floor(it.sellingPrice)) : undefined;
      const discount = Math.max(0, Math.floor(it.discount || 0));

      const lineGross = qty * costPrice;
      const lineNet = Math.max(0, lineGross - discount);

      purchaseSubtotal += lineGross;
      purchaseDiscount += discount;

      verifiedItems.push({
        product,
        quantity: qty,
        costPrice,
        sellingPrice,
        discount,
        lineGross,
        lineNet,
      });
    }

    const taxableAmount = Math.max(0, purchaseSubtotal - purchaseDiscount);
    const vatEnabled = vendorInfo?.applyVat !== undefined
      ? vendorInfo.applyVat
      : (settings.enable_vat !== false);
    const vatRate = vatEnabled ? 13.0 : 0.0;
    const vatAmount = vatEnabled ? Math.round(taxableAmount * 0.13) : 0;
    const grandTotal = taxableAmount + vatAmount;

    // 3. Generate sequential Bill Number: PUR-00001
    const countRes = queryOne<{ next_id: number }>(
       'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM purchases'
     );
    const nextId = countRes?.next_id ?? 1;
    const billNumber = `PUR-${String(nextId).padStart(5, '0')}`;

    // 4. Calculate paid amount and due amount
    const paidAmount = vendorInfo?.paidAmount !== undefined
      ? Math.max(0, Math.floor(vendorInfo.paidAmount))
      : grandTotal;
    const dueAmount = Math.max(0, grandTotal - paidAmount);

    // 5. Insert into purchases table
    run(
      `INSERT INTO purchases (
        bill_number, invoice_number, vendor_id, vendor_name, vendor_phone,
        vendor_email, vendor_pan_vat, vendor_address, subtotal, discount,
        taxable_amount, vat_rate, vat_amount, grand_total, total, paid_amount, due_amount, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        billNumber,
        vendorInfo?.invoiceNumber?.trim() || null,
        resolvedVendorId,
        resolvedVendorName,
        resolvedVendorPhone,
        resolvedVendorEmail,
        resolvedVendorPanVat,
        resolvedVendorAddress,
        purchaseSubtotal,
        purchaseDiscount,
        taxableAmount,
        vatRate,
        vatAmount,
        grandTotal,
        grandTotal,
        paidAmount,
        dueAmount,
        vendorInfo?.notes?.trim() || null,
        transactionCreatedAt,
      ]
    );

    const purchaseIdRes = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const purchaseId = purchaseIdRes?.id ?? nextId;

    // 5. Insert line items, update stock & log stock movements
    for (const it of verifiedItems) {
      run(
        `INSERT INTO purchase_items (
          purchase_id, product_id, product_name, product_sku,
          quantity, cost_price, selling_price, discount, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          it.product.id,
          it.product.name,
          it.product.sku,
          it.quantity,
          it.costPrice,
          it.sellingPrice !== undefined ? it.sellingPrice : null,
          it.discount,
          it.lineNet,
        ]
      );

      // Inflow Stock into inventory: increase current_stock, update cost_price and selling_price if provided
      const newStock = it.product.current_stock + it.quantity;
      if (it.sellingPrice !== undefined && it.sellingPrice > 0) {
        run(
          `UPDATE products 
           SET current_stock = ?,
               cost_price = ?,
               selling_price = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            newStock,
            it.costPrice,
            it.sellingPrice,
            now,
            it.product.id,
          ]
        );
      } else {
        run(
          `UPDATE products 
           SET current_stock = ?,
               cost_price = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            newStock,
            it.costPrice,
            now,
            it.product.id,
          ]
        );
      }

      // Record Stock Inflow Movement
      run(
        `INSERT INTO stock_movements (
          product_id, type, quantity, reference_id,
          vendor_id, vendor_name, note, created_at
        ) VALUES (?, 'RESTOCK', ?, ?, ?, ?, ?, ?)`,
        [
          it.product.id,
          it.quantity,
          purchaseId,
          resolvedVendorId,
          resolvedVendorName,
          `Purchase Order #${billNumber}${
            vendorInfo?.invoiceNumber ? ` (Inv: ${vendorInfo.invoiceNumber})` : ''
          }`,
          transactionCreatedAt,
        ]
      );
    }

    const created = getPurchaseWithItems(purchaseId);
    if (!created) {
      throw new Error('Failed to retrieve newly created purchase');
    }

    return created.purchase;
  });
}

export function getPurchases(options?: {
  startDate?: string;
  endDate?: string;
  vendorId?: number;
  search?: string;
  limit?: number;
}): Purchase[] {
  let sql = `
    SELECT 
      p.id,
      p.bill_number,
      p.invoice_number,
      p.vendor_id,
      p.vendor_name,
      p.vendor_phone,
      p.vendor_email,
      p.vendor_pan_vat,
      p.vendor_address,
      p.subtotal,
      p.discount,
      p.taxable_amount,
      p.vat_rate,
      p.vat_amount,
      p.grand_total,
      p.total,
      COALESCE(p.paid_amount, p.grand_total, p.total) as paid_amount,
      COALESCE(p.due_amount, 0) as due_amount,
      COALESCE(p.status, 'COMPLETED') as status,
      p.returned_at,
      p.notes,
      p.created_at,
      COUNT(pi.id) as item_count,
      SUM(pi.quantity) as total_units
    FROM purchases p
    LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
  `;

  const conditions: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  if (options?.startDate) {
    conditions.push('p.created_at >= ?');
    params.push(options.startDate);
  }

  if (options?.endDate) {
    conditions.push('p.created_at <= ?');
    params.push(options.endDate);
  }

  if (options?.vendorId) {
    conditions.push('p.vendor_id = ?');
    params.push(options.vendorId);
  }

  if (options?.search && options.search.trim()) {
    const q = `%${options.search.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(COALESCE(p.bill_number, '')) LIKE ? OR
      LOWER(COALESCE(p.invoice_number, '')) LIKE ? OR
      LOWER(COALESCE(p.vendor_name, '')) LIKE ? OR
      LOWER(COALESCE(p.vendor_phone, '')) LIKE ? OR
      LOWER(COALESCE(p.vendor_pan_vat, '')) LIKE ? OR
      CAST(p.id AS TEXT) = ?
    )`);
    params.push(q, q, q, q, q, options.search.trim());
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY p.id ORDER BY p.id DESC';

  if (options?.limit && options.limit > 0) {
    sql += ` LIMIT ${options.limit}`;
  }

  return query<Purchase>(sql, params);
}

export function getPurchaseWithItems(
  purchaseId: number
): { purchase: Purchase; items: PurchaseItem[] } | null {
  const purchase = queryOne<Purchase>(
    `SELECT 
       p.id,
       p.bill_number,
       p.invoice_number,
       p.vendor_id,
       p.vendor_name,
       p.vendor_phone,
       p.vendor_email,
       p.vendor_pan_vat,
       p.vendor_address,
       p.subtotal,
       p.discount,
       p.taxable_amount,
       p.vat_rate,
       p.vat_amount,
       p.grand_total,
       p.total,
       COALESCE(p.paid_amount, p.grand_total, p.total) as paid_amount,
       COALESCE(p.due_amount, 0) as due_amount,
       COALESCE(p.status, 'COMPLETED') as status,
       p.returned_at,
       p.notes,
       p.created_at
     FROM purchases p
     WHERE p.id = ?`,
    [purchaseId]
  );

  if (!purchase) return null;

  const previousDue = getVendorPreviousDueForPurchase(purchase.id, purchase.vendor_id);
  const totalDue = previousDue + (purchase.due_amount || 0);

  const enrichedPurchase: Purchase = {
    ...purchase,
    previous_due: previousDue,
    total_due: totalDue,
  };

  const items = query<PurchaseItem>(
    `SELECT 
       pi.id,
       pi.purchase_id,
       pi.product_id,
       pi.product_name,
       pi.product_sku,
       pr.unit as product_unit,
       pi.quantity,
       pi.cost_price,
       pi.selling_price,
       pi.discount,
       pi.total
     FROM purchase_items pi
     LEFT JOIN products pr ON pi.product_id = pr.id
     WHERE pi.purchase_id = ?
     ORDER BY pi.id ASC`,
    [purchaseId]
  );

  return { purchase: enrichedPurchase, items };
}

/**
 * Total count of purchase records in the database.
 */
export function getPurchasesCount(): number {
  const row = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM purchases`);
  return row?.count ?? 0;
}

/**
 * Updates an existing purchase, safely adjusting inventory levels and purchase details atomically.
 */
export function updatePurchase(
  purchaseId: number,
  items: ProcessPurchaseItemInput[],
  vendorInfo?: ProcessPurchaseVendorInfo
): Purchase {
  if (!items || items.length === 0) {
    throw new Error('Purchase must contain at least one item');
  }

  const existing = getPurchaseWithItems(purchaseId);
  if (!existing) {
    throw new Error(`Purchase with ID ${purchaseId} was not found`);
  }

  const settings = getSettings();
  const now = new Date().toISOString();
  const transactionCreatedAt = vendorInfo?.createdAt
    ? new Date(vendorInfo.createdAt).toISOString()
    : existing.purchase.created_at;

  return transaction(() => {
    // 1. Revert previous inventory inflows
    for (const oldItem of existing.items) {
      run(
        `UPDATE products SET current_stock = current_stock - ? WHERE id = ?`,
        [oldItem.quantity, oldItem.product_id]
      );
    }

    // 2. Vendor resolution
    let resolvedVendorId: number | null = vendorInfo?.vendorId ?? existing.purchase.vendor_id ?? null;
    let resolvedVendorName: string | null = (vendorInfo?.vendorName ? capitalizeWords(vendorInfo.vendorName) : null) || existing.purchase.vendor_name || null;
    let resolvedVendorPhone: string | null = (vendorInfo?.vendorPhone?.trim()) || existing.purchase.vendor_phone || null;
    let resolvedVendorEmail: string | null = (vendorInfo?.vendorEmail?.trim()) || existing.purchase.vendor_email || null;
    let resolvedVendorPanVat: string | null = (vendorInfo?.vendorPanVat?.trim()) || existing.purchase.vendor_pan_vat || null;
    let resolvedVendorAddress: string | null = (vendorInfo?.vendorAddress?.trim()) || existing.purchase.vendor_address || null;

    if (resolvedVendorId) {
      const existingVendor = getVendorById(resolvedVendorId);
      if (existingVendor) {
        const updates: Partial<CreateVendorInput> = {};
        if (resolvedVendorPanVat && resolvedVendorPanVat !== (existingVendor.pan_vat || '')) updates.pan_vat = resolvedVendorPanVat;
        if (resolvedVendorPhone && resolvedVendorPhone !== (existingVendor.phone || '')) updates.phone = resolvedVendorPhone;
        if (resolvedVendorEmail && resolvedVendorEmail !== (existingVendor.email || '')) updates.email = resolvedVendorEmail;
        if (resolvedVendorAddress && resolvedVendorAddress !== (existingVendor.address || '')) updates.address = resolvedVendorAddress;
        if (resolvedVendorName && resolvedVendorName !== existingVendor.name && resolvedVendorName !== 'Supplier') updates.name = resolvedVendorName;
        if (Object.keys(updates).length > 0) updateVendor(resolvedVendorId, updates);
      }
    } else if (resolvedVendorName || resolvedVendorPhone || resolvedVendorPanVat) {
      const v = findOrCreateVendor({
        name: resolvedVendorName || 'Supplier',
        phone: resolvedVendorPhone || undefined,
        email: resolvedVendorEmail || undefined,
        pan_vat: resolvedVendorPanVat || undefined,
        address: resolvedVendorAddress || undefined,
      });
      if (v) {
        resolvedVendorId = v.id;
        resolvedVendorName = v.name;
        resolvedVendorPhone = v.phone || resolvedVendorPhone;
        resolvedVendorEmail = v.email || resolvedVendorEmail;
        resolvedVendorPanVat = v.pan_vat || resolvedVendorPanVat;
        resolvedVendorAddress = v.address || resolvedVendorAddress;
      }
    }

    let purchaseSubtotal = 0;
    let purchaseDiscount = 0;

    const verifiedItems: Array<{
      product: Product;
      quantity: number;
      costPrice: number;
      sellingPrice?: number;
      discount: number;
      lineGross: number;
      lineNet: number;
    }> = [];

    for (const it of items) {
      const qty = Math.floor(it.quantity);
      if (qty <= 0) {
        throw new Error(`Quantity for product #${it.productId} must be greater than 0`);
      }

      const product = getProductById(it.productId);
      if (!product) {
        throw new Error(`Product with ID ${it.productId} was not found`);
      }

      const costPrice = Math.max(0, Math.floor(it.costPrice));
      const sellingPrice =
        it.sellingPrice !== undefined ? Math.max(0, Math.floor(it.sellingPrice)) : undefined;
      const discount = Math.max(0, Math.floor(it.discount || 0));

      const lineGross = qty * costPrice;
      const lineNet = Math.max(0, lineGross - discount);

      purchaseSubtotal += lineGross;
      purchaseDiscount += discount;

      verifiedItems.push({
        product,
        quantity: qty,
        costPrice,
        sellingPrice,
        discount,
        lineGross,
        lineNet,
      });
    }

    const taxableAmount = Math.max(0, purchaseSubtotal - purchaseDiscount);
    const vatEnabled = vendorInfo?.applyVat !== undefined
      ? vendorInfo.applyVat
      : (existing.purchase.vat_rate ? existing.purchase.vat_rate > 0 : (settings.enable_vat !== false));
    const vatRate = vatEnabled ? 13.0 : 0.0;
    const vatAmount = vatEnabled ? Math.round(taxableAmount * 0.13) : 0;
    const grandTotal = taxableAmount + vatAmount;

    // 3. Calculate paid amount and due amount
    const paidAmount = vendorInfo?.paidAmount !== undefined
      ? Math.max(0, Math.floor(vendorInfo.paidAmount))
      : (existing.purchase.paid_amount !== undefined && existing.purchase.paid_amount !== null
          ? existing.purchase.paid_amount
          : grandTotal);
    const dueAmount = Math.max(0, grandTotal - paidAmount);

    // 4. Update purchases record
    run(
      `UPDATE purchases SET
        invoice_number = ?,
        vendor_id = ?,
        vendor_name = ?,
        vendor_phone = ?,
        vendor_email = ?,
        vendor_pan_vat = ?,
        vendor_address = ?,
        subtotal = ?,
        discount = ?,
        taxable_amount = ?,
        vat_rate = ?,
        vat_amount = ?,
        grand_total = ?,
        total = ?,
        paid_amount = ?,
        due_amount = ?,
        notes = ?,
        created_at = ?
      WHERE id = ?`,
      [
        (vendorInfo?.invoiceNumber?.trim()) || existing.purchase.invoice_number || null,
        resolvedVendorId,
        resolvedVendorName,
        resolvedVendorPhone,
        resolvedVendorEmail,
        resolvedVendorPanVat,
        resolvedVendorAddress,
        purchaseSubtotal,
        purchaseDiscount,
        taxableAmount,
        vatRate,
        vatAmount,
        grandTotal,
        grandTotal,
        paidAmount,
        dueAmount,
        (vendorInfo?.notes?.trim()) || existing.purchase.notes || null,
        transactionCreatedAt,
        purchaseId,
      ]
    );

    // 4. Replace purchase_items and increase stock
    run(`DELETE FROM purchase_items WHERE purchase_id = ?`, [purchaseId]);
    for (const it of verifiedItems) {
      run(
        `INSERT INTO purchase_items (
          purchase_id, product_id, product_name, product_sku,
          quantity, cost_price, selling_price, discount, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          it.product.id,
          it.product.name,
          it.product.sku,
          it.quantity,
          it.costPrice,
          it.sellingPrice !== undefined ? it.sellingPrice : null,
          it.discount,
          it.lineNet,
        ]
      );

      // Inflow Stock into inventory
      if (it.sellingPrice !== undefined && it.sellingPrice > 0) {
        run(
          `UPDATE products 
           SET current_stock = current_stock + ?,
               cost_price = ?,
               selling_price = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            it.quantity,
            it.costPrice,
            it.sellingPrice,
            now,
            it.product.id,
          ]
        );
      } else {
        run(
          `UPDATE products 
           SET current_stock = current_stock + ?,
               cost_price = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            it.quantity,
            it.costPrice,
            now,
            it.product.id,
          ]
        );
      }
    }

    // 5. Replace stock movements
    run(`DELETE FROM stock_movements WHERE reference_id = ? AND type = 'RESTOCK'`, [purchaseId]);
    for (const it of verifiedItems) {
      run(
        `INSERT INTO stock_movements (
          product_id, type, quantity, reference_id,
          vendor_id, vendor_name, note, created_at
        ) VALUES (?, 'RESTOCK', ?, ?, ?, ?, ?, ?)`,
        [
          it.product.id,
          it.quantity,
          purchaseId,
          resolvedVendorId,
          resolvedVendorName,
          `Updated Purchase Order #${existing.purchase.bill_number}${
            vendorInfo?.invoiceNumber ? ` (Inv: ${vendorInfo.invoiceNumber})` : ''
          }`,
          transactionCreatedAt,
        ]
      );
    }

    const updated = getPurchaseWithItems(purchaseId);
    if (!updated) {
      throw new Error('Failed to retrieve updated purchase record');
    }
    return updated.purchase;
  });
}

/**
 * Processes a return for a purchase:
 * - Validates negative stock constraints if disallowed
 * - Deducts inflowed quantities from product inventory
 * - Records stock return movements into the movement log for audit trail
 * - Marks the purchase record status as 'RETURNED' with returned_at timestamp
 * - Retains the purchase record and line items in history for full auditing
 */
export function returnPurchase(purchaseId: number): {
  id: number;
  billNumber: string | null;
  deductedItemCount: number;
} {
  const existing = getPurchaseWithItems(purchaseId);
  if (!existing) {
    throw new Error(`Purchase record #${purchaseId} not found`);
  }

  if (existing.purchase.status === 'RETURNED') {
    throw new Error(`Purchase #${existing.purchase.bill_number || purchaseId} has already been returned.`);
  }

  const settings = getSettings();
  const now = new Date().toISOString();

  // Validate negative stock constraints if disallowed
  if (!settings.allow_negative_stock) {
    for (const item of existing.items) {
      const prod = getProductById(item.product_id);
      if (prod && prod.current_stock < item.quantity) {
        throw new Error(
          `Cannot return purchase #${existing.purchase.bill_number || purchaseId}: Deducting ${item.quantity} unit(s) of "${prod.name}" would result in negative stock (Available: ${prod.current_stock}, Required: ${item.quantity}). Adjust stock or enable "Allow Negative Stock" in settings.`
        );
      }
    }
  }

  const billLabel = existing.purchase.bill_number ? `Bill #${existing.purchase.bill_number}` : `Purchase #${purchaseId}`;
  const vendorLabel = existing.purchase.vendor_name ? ` (${capitalizeWords(existing.purchase.vendor_name)})` : '';

  return transaction(() => {
    // 1. Revert inventory inflows (deduct stock from products) and record return movements
    for (const item of existing.items) {
      run(
        `UPDATE products SET current_stock = current_stock - ?, updated_at = ? WHERE id = ?`,
        [item.quantity, now, item.product_id]
      );

      // Record stock deduction in movement log
      run(
        `INSERT INTO stock_movements (
          product_id, type, quantity, reference_id,
          vendor_id, vendor_name, note, created_at
        ) VALUES (?, 'RETURN', ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          -item.quantity, // Negative number (deducted from stock)
          purchaseId,
          existing.purchase.vendor_id || null,
          existing.purchase.vendor_name ? capitalizeWords(existing.purchase.vendor_name) : null,
          `Deducted from purchase return: ${billLabel}${vendorLabel}`,
          now,
        ]
      );
    }

    // 2. Mark the purchase record as RETURNED (record is KEPT in history!)
    run(`UPDATE purchases SET status = 'RETURNED', returned_at = ? WHERE id = ?`, [now, purchaseId]);

    return {
      id: purchaseId,
      billNumber: existing.purchase.bill_number ?? null,
      deductedItemCount: existing.items.length,
    };
  });
}

/**
 * Backward compatibility alias for returnPurchase
 */
export const deletePurchase = returnPurchase;


