/**
 * Inventory & Stock Movements Service
 */
import { StockMovement } from '../../types/index.ts';
import { query, run, transaction } from '../db/sqliteEngine.ts';
import { getProductById } from './productService.ts';
import { getSettings } from './settingsService.ts';

export function restockProduct(
  productId: number,
  quantityToAdd: number,
  note?: string,
  vendorId?: number | null,
  vendorName?: string | null
): void {
  const qty = Math.floor(quantityToAdd);
  if (qty <= 0) {
    throw new Error('Restock quantity must be greater than zero');
  }

  const product = getProductById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const now = new Date().toISOString();
  const vId = vendorId !== undefined ? vendorId : product.vendor_id ?? null;
  const vName = vendorName !== undefined ? (vendorName?.trim() || null) : product.vendor_name ?? null;

  transaction(() => {
    run(
      `UPDATE products 
       SET current_stock = current_stock + ?, 
           vendor_id = COALESCE(?, vendor_id),
           vendor_name = COALESCE(?, vendor_name),
           updated_at = ?
       WHERE id = ?`,
      [qty, vId, vName, now, productId]
    );

    run(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_id, vendor_id, vendor_name, note, created_at)
       VALUES (?, 'RESTOCK', ?, NULL, ?, ?, ?, ?)`,
      [productId, qty, vId, vName, note?.trim() || 'Manual restock replenishment', now]
    );
  });
}

export function adjustStock(productId: number, newStockQuantity: number, note?: string): void {
  const targetStock = Math.floor(newStockQuantity);
  const settings = getSettings();

  if (targetStock < 0 && !settings.allow_negative_stock) {
    throw new Error('Negative stock is not permitted by current settings');
  }

  const product = getProductById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const delta = targetStock - product.current_stock;
  if (delta === 0) {
    return; // No change needed
  }

  const now = new Date().toISOString();

  transaction(() => {
    run(
      `UPDATE products 
       SET current_stock = ?, updated_at = ?
       WHERE id = ?`,
      [targetStock, now, productId]
    );

    run(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, created_at)
       VALUES (?, 'ADJUSTMENT', ?, NULL, ?, ?)`,
      [
        productId,
        delta,
        note?.trim() || `Manual stock adjustment from ${product.current_stock} to ${targetStock}`,
        now,
      ]
    );
  });
}

export interface StockMovementFilterOptions {
  productId?: number;
  vendorId?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

export function getStockMovements(
  filterOrProductId?: StockMovementFilterOptions | number,
  legacyLimit: number = 200
): StockMovement[] {
  let options: StockMovementFilterOptions = {};

  if (typeof filterOrProductId === 'number') {
    options = { productId: filterOrProductId, limit: legacyLimit };
  } else if (filterOrProductId && typeof filterOrProductId === 'object') {
    options = filterOrProductId;
  } else {
    options = { limit: legacyLimit };
  }

  let sql = `
    SELECT sm.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
  `;

  const conditions: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  if (options.productId) {
    conditions.push('sm.product_id = ?');
    params.push(options.productId);
  }

  if (options.vendorId) {
    conditions.push('(sm.vendor_id = ? OR p.vendor_id = ?)');
    params.push(options.vendorId, options.vendorId);
  }

  if (options.type && options.type !== 'ALL') {
    conditions.push('sm.type = ?');
    params.push(options.type);
  }

  if (options.startDate) {
    conditions.push('sm.created_at >= ?');
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push('sm.created_at <= ?');
    params.push(options.endDate);
  }

  if (options.search && options.search.trim()) {
    const q = `%${options.search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.sku, "")) LIKE ? OR LOWER(COALESCE(sm.note, "")) LIKE ?)');
    params.push(q, q, q);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY sm.created_at DESC, sm.id DESC';

  const limit = options.limit && options.limit > 0 ? options.limit : 200;
  sql += ` LIMIT ${limit}`;

  return query<StockMovement>(sql, params);
}
