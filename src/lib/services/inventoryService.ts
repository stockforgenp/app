/**
 * Inventory & Stock Movements Service
 */
import { StockMovement } from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import { getProductById } from './productService.ts';
import { getSettings } from './settingsService.ts';

export function restockProduct(productId: number, quantityToAdd: number, note?: string): void {
  const qty = Math.floor(quantityToAdd);
  if (qty <= 0) {
    throw new Error('Restock quantity must be greater than zero');
  }

  const product = getProductById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const now = new Date().toISOString();

  transaction(() => {
    run(
      `UPDATE products 
       SET current_stock = current_stock + ?, updated_at = ?
       WHERE id = ?`,
      [qty, now, productId]
    );

    run(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, created_at)
       VALUES (?, 'RESTOCK', ?, NULL, ?, ?)`,
      [productId, qty, note?.trim() || 'Manual restock replenishment', now]
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

export function getStockMovements(productId?: number, limit: number = 100): StockMovement[] {
  if (productId) {
    return query<StockMovement>(
      `SELECT sm.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
       FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       WHERE sm.product_id = ?
       ORDER BY sm.created_at DESC, sm.id DESC
       LIMIT ?`,
      [productId, limit]
    );
  }

  return query<StockMovement>(
    `SELECT sm.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
     FROM stock_movements sm
     JOIN products p ON sm.product_id = p.id
     ORDER BY sm.created_at DESC, sm.id DESC
     LIMIT ?`,
    [limit]
  );
}
