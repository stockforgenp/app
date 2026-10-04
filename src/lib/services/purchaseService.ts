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
} from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import { getProductById } from './productService.ts';
import { findOrCreateVendor } from './vendorService.ts';
import { getSettings } from './settingsService.ts';

export function processPurchase(
  items: ProcessPurchaseItemInput[],
  vendorInfo?: ProcessPurchaseVendorInfo
): Purchase {
  if (!items || items.length === 0) {
    throw new Error('Purchase must contain at least one item');
  }

  const settings = getSettings();
  const now = new Date().toISOString();

  return transaction(() => {
    // 1. Resolve or auto-create vendor if details were supplied
    let resolvedVendorId: number | null = vendorInfo?.vendorId || null;
    let resolvedVendorName: string | null = vendorInfo?.vendorName?.trim() || null;
    let resolvedVendorPhone: string | null = vendorInfo?.vendorPhone?.trim() || null;
    let resolvedVendorEmail: string | null = vendorInfo?.vendorEmail?.trim() || null;
    let resolvedVendorPanVat: string | null = vendorInfo?.vendorPanVat?.trim() || null;
    let resolvedVendorAddress: string | null = vendorInfo?.vendorAddress?.trim() || null;

    if (
      !resolvedVendorId &&
      (resolvedVendorName || resolvedVendorPhone || resolvedVendorPanVat)
    ) {
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
    const vatRate = settings.enable_vat !== false ? 13.0 : 0.0;
    const vatAmount = settings.enable_vat !== false ? Math.round(taxableAmount * 0.13) : 0;
    const grandTotal = taxableAmount + vatAmount;

    // 3. Generate sequential Bill Number: PUR-00001
    const countRes = queryOne<{ next_id: number }>(
      'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM purchases'
    );
    const nextId = countRes?.next_id ?? 1;
    const billNumber = `PUR-${String(nextId).padStart(5, '0')}`;

    // 4. Insert into purchases table
    run(
      `INSERT INTO purchases (
        bill_number, invoice_number, vendor_id, vendor_name, vendor_phone,
        vendor_email, vendor_pan_vat, vendor_address, subtotal, discount,
        taxable_amount, vat_rate, vat_amount, grand_total, total, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        taxableAmount,
        vendorInfo?.notes?.trim() || null,
        now,
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

      // Inflow Stock into inventory: increase current_stock, update cost_price and vendor
      const newStock = it.product.current_stock + it.quantity;
      if (it.sellingPrice !== undefined && it.sellingPrice > 0) {
        run(
          `UPDATE products 
           SET current_stock = ?,
               cost_price = ?,
               selling_price = ?,
               vendor_id = COALESCE(?, vendor_id),
               vendor_name = COALESCE(?, vendor_name),
               updated_at = ?
           WHERE id = ?`,
          [
            newStock,
            it.costPrice,
            it.sellingPrice,
            resolvedVendorId,
            resolvedVendorName,
            now,
            it.product.id,
          ]
        );
      } else {
        run(
          `UPDATE products 
           SET current_stock = ?,
               cost_price = ?,
               vendor_id = COALESCE(?, vendor_id),
               vendor_name = COALESCE(?, vendor_name),
               updated_at = ?
           WHERE id = ?`,
          [
            newStock,
            it.costPrice,
            resolvedVendorId,
            resolvedVendorName,
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
          now,
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
       p.notes,
       p.created_at
     FROM purchases p
     WHERE p.id = ?`,
    [purchaseId]
  );

  if (!purchase) return null;

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

  return { purchase, items };
}
