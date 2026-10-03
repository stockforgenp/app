/**
 * Sales Processing & Historical Query Service
 * Strictly enforces transaction atomicity, snapshot pricing, item discounts,
 * and stock validation.
 */
import { Sale, SaleItem, LowStockAlertItem, Product } from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';
import { getProductById } from './productService.ts';
import { getSettings } from './settingsService.ts';

export interface ProcessSaleItemInput {
  productId: number;
  quantity: number;
  actualSellingPrice: number; // in minor units
  discount: number; // in minor units
}

export interface ProcessSaleCustomerInfo {
  customerName?: string | null;
  customerPhone?: string | null;
}

export function processSale(
  items: ProcessSaleItemInput[],
  customerInfo?: ProcessSaleCustomerInfo
): Sale {
  if (!items || items.length === 0) {
    throw new Error('Sale must contain at least one item');
  }

  const settings = getSettings();
  const now = new Date().toISOString();

  // Everything executes inside an atomic ACID transaction
  return transaction(() => {
    let saleSubtotal = 0;
    let saleDiscount = 0;
    let saleTotal = 0;

    // First pass: Verify all products and check stock availability
    const verifiedItems: Array<{
      product: Product;
      productId: number;
      productName: string;
      quantity: number;
      costPrice: number;
      actualSellingPrice: number;
      discount: number;
      itemGross: number;
      itemTotal: number;
      currentStock: number;
    }> = [];

    for (const item of items) {
      const qty = Math.floor(item.quantity);
      if (qty <= 0) {
        throw new Error(`Quantity for product #${item.productId} must be greater than 0`);
      }

      const product = getProductById(item.productId);
      if (!product) {
        throw new Error(`Product with ID ${item.productId} was not found`);
      }

      // Check stock limit if negative stock is disallowed
      if (!settings.allow_negative_stock && product.current_stock < qty) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.current_stock}, Requested: ${qty}`
        );
      }

      const sellingPrice = Math.max(0, Math.floor(item.actualSellingPrice));
      const discount = Math.max(0, Math.floor(item.discount));
      const gross = qty * sellingPrice;
      
      // Net item total cannot be negative
      const netTotal = Math.max(0, gross - discount);

      saleSubtotal += gross;
      saleDiscount += discount;
      saleTotal += netTotal;

      verifiedItems.push({
        product,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        costPrice: product.cost_price, // SNAPSHOT current cost price at this instant
        actualSellingPrice: sellingPrice,
        discount,
        itemGross: gross,
        itemTotal: netTotal,
        currentStock: product.current_stock,
      });
    }

    // 1. Insert Sales Record (including optional customer name and phone)
    run(
      `INSERT INTO sales (customer_name, customer_phone, subtotal, discount, total, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        customerInfo?.customerName?.trim() || null,
        customerInfo?.customerPhone?.trim() || null,
        saleSubtotal,
        saleDiscount,
        saleTotal,
        now,
      ]
    );

    const saleIdRes = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const saleId = saleIdRes?.id ?? 0;

    const lowStockAlerts: LowStockAlertItem[] = [];

    // 2. Insert Sale Items, Reduce Stock & Record Movements
    for (const item of verifiedItems) {
      run(
        `INSERT INTO sale_items (sale_id, product_id, quantity, cost_price, selling_price, discount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          item.productId,
          item.quantity,
          item.costPrice,
          item.actualSellingPrice,
          item.discount,
          item.itemTotal,
        ]
      );

      // Reduce product stock
      const remainingStock = item.currentStock - item.quantity;
      run(
        `UPDATE products 
         SET current_stock = ?, updated_at = ?
         WHERE id = ?`,
        [remainingStock, now, item.productId]
      );

      // Record stock movement
      run(
        `INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, created_at)
         VALUES (?, 'SALE', ?, ?, ?, ?)`,
        [item.productId, -item.quantity, saleId, `Completed Sale #${saleId}`, now]
      );

      // Check if product's stock levels fall to or below its specific 'minimum alert threshold'
      const specificThreshold =
        item.product.min_stock_alert !== null && item.product.min_stock_alert !== undefined
          ? item.product.min_stock_alert
          : settings.low_stock_threshold;

      if (remainingStock <= specificThreshold) {
        lowStockAlerts.push({
          productId: item.productId,
          productName: item.productName,
          productSku: item.product.sku,
          previousStock: item.currentStock,
          remainingStock,
          threshold: specificThreshold,
          quantitySold: item.quantity,
        });
      }
    }

    const completedSale = getSaleWithItems(saleId);
    if (!completedSale) {
      throw new Error('Failed to retrieve newly created sale record');
    }

    return {
      ...completedSale.sale,
      lowStockAlerts,
    };
  });
}

export function getSales(options?: {
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}): Sale[] {
  let sql = `
    SELECT 
      s.id,
      s.customer_name,
      s.customer_phone,
      s.subtotal,
      s.discount,
      s.total,
      s.created_at,
      COUNT(si.id) as item_count,
      SUM(si.quantity * si.cost_price) as cost_total,
      (s.total - SUM(si.quantity * si.cost_price)) as gross_profit
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
  `;

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (options?.startDate) {
    whereClauses.push(`s.created_at >= ?`);
    params.push(options.startDate);
  }

  if (options?.endDate) {
    whereClauses.push(`s.created_at <= ?`);
    params.push(options.endDate);
  }

  if (options?.search && options.search.trim()) {
    whereClauses.push(`(
      CAST(s.id AS TEXT) LIKE ? OR
      s.customer_name LIKE ? OR
      s.customer_phone LIKE ? OR
      s.id IN (
        SELECT sale_id FROM sale_items JOIN products ON sale_items.product_id = products.id
        WHERE products.name LIKE ?
      )
    )`);
    const term = `%${options.search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ` + whereClauses.join(' AND ');
  }

  sql += ` GROUP BY s.id ORDER BY s.created_at DESC, s.id DESC`;

  if (options?.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
  }

  return query<Sale>(sql, params);
}

export function getSaleWithItems(saleId: number): { sale: Sale; items: SaleItem[] } | null {
  const sale = queryOne<Sale>(
    `SELECT 
       s.id,
       s.customer_name,
       s.customer_phone,
       s.subtotal,
       s.discount,
       s.total,
       s.created_at,
       COUNT(si.id) as item_count,
       SUM(si.quantity * si.cost_price) as cost_total,
       (s.total - SUM(si.quantity * si.cost_price)) as gross_profit
     FROM sales s
     LEFT JOIN sale_items si ON s.id = si.sale_id
     WHERE s.id = ?
     GROUP BY s.id`,
    [saleId]
  );

  if (!sale) return null;

  const items = query<SaleItem>(
    `SELECT 
       si.*,
       p.name as product_name,
       p.sku as product_sku,
       p.unit as product_unit,
       (si.quantity * si.cost_price) as cost_amount,
       (si.total - (si.quantity * si.cost_price)) as gross_profit
     FROM sale_items si
     LEFT JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = ?
     ORDER BY si.id ASC`,
    [saleId]
  );

  return { sale, items };
}
