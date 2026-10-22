/**
 * Product Batch & Expiry Management Service
 * Supports batch-wise inventory tracking, FEFO (First Expiring, First Out),
 * expiry alerts, and batch allocation during purchase and sales.
 */

import { ProductBatch } from "../../types/index.ts";
import { query, queryOne, run, transaction } from "../db/sqliteEngine.ts";

export interface CreateBatchInput {
  productId: number;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  mfgDate?: string | null; // YYYY-MM-DD
  costPrice: number;
  sellingPrice?: number | null;
  quantity: number;
}

/**
 * Creates a new product batch or adds quantity if identical product + batch_number already exists.
 */
export function createOrAddBatch(input: CreateBatchInput): ProductBatch {
  const now = new Date().toISOString();
  const cleanBatchNum = input.batchNumber.trim().toUpperCase();

  return transaction(() => {
    // Check if a batch with same product_id and batch_number exists
    const existing = queryOne<ProductBatch>(
      "SELECT * FROM product_batches WHERE product_id = ? AND UPPER(batch_number) = ?",
      [input.productId, cleanBatchNum],
    );

    if (existing) {
      const newQty = existing.quantity + input.quantity;
      run(
        `UPDATE product_batches 
         SET quantity = ?, 
             expiry_date = COALESCE(?, expiry_date),
             mfg_date = COALESCE(?, mfg_date),
             cost_price = ?,
             selling_price = COALESCE(?, selling_price),
             updated_at = ?
         WHERE id = ?`,
        [
          newQty,
          input.expiryDate || existing.expiry_date,
          input.mfgDate || existing.mfg_date || null,
          input.costPrice,
          input.sellingPrice !== undefined
            ? input.sellingPrice
            : (existing.selling_price ?? null),
          now,
          existing.id,
        ],
      );
      const updated = queryOne<ProductBatch>(
        "SELECT * FROM product_batches WHERE id = ?",
        [existing.id],
      );
      if (!updated) throw new Error("Failed to retrieve updated batch");
      return updated;
    }

    run(
      `INSERT INTO product_batches (
        product_id, batch_number, mfg_date, expiry_date, cost_price, selling_price, quantity, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.productId,
        cleanBatchNum,
        input.mfgDate || null,
        input.expiryDate,
        input.costPrice,
        input.sellingPrice !== undefined ? input.sellingPrice : null,
        input.quantity,
        now,
        now,
      ],
    );

    const insertedId = queryOne<{ id: number }>(
      "SELECT last_insert_rowid() as id",
    );
    const newBatch = queryOne<ProductBatch>(
      "SELECT * FROM product_batches WHERE id = ?",
      [insertedId?.id ?? 0],
    );
    if (!newBatch) throw new Error("Failed to retrieve newly created batch");
    return newBatch;
  });
}

/**
 * Returns all active batches for a given product sorted by earliest expiry (FEFO).
 */
export function getBatchesForFEFO(productId: number): ProductBatch[] {
  return query<ProductBatch>(
    `SELECT b.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
     FROM product_batches b
     JOIN products p ON b.product_id = p.id
     WHERE b.product_id = ? AND b.quantity > 0
     ORDER BY b.expiry_date ASC, b.id ASC`,
    [productId],
  );
}

/**
 * Returns all batches for a specific product.
 */
export function getProductBatches(
  productId: number,
  includeEmpty = true,
): ProductBatch[] {
  const sql = `
    SELECT b.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
    FROM product_batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.product_id = ? ${includeEmpty ? "" : "AND b.quantity > 0"}
    ORDER BY b.expiry_date ASC
  `;
  return query<ProductBatch>(sql, [productId]);
}

/**
 * Returns a batch by its ID.
 */
export function getBatchById(batchId: number): ProductBatch | null {
  return queryOne<ProductBatch>(
    `SELECT b.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
     FROM product_batches b
     JOIN products p ON b.product_id = p.id
     WHERE b.id = ?`,
    [batchId],
  );
}

/**
 * Depletes a specific batch's stock quantity.
 */
export function depleteBatchStock(batchId: number, qtyToDeduct: number): void {
  const batch = getBatchById(batchId);
  if (!batch) {
    throw new Error(`Batch #${batchId} not found`);
  }
  const remaining = Math.max(0, batch.quantity - qtyToDeduct);
  run("UPDATE product_batches SET quantity = ?, updated_at = ? WHERE id = ?", [
    remaining,
    new Date().toISOString(),
    batchId,
  ]);
}

/**
 * Adds stock quantity to a specific batch.
 */
export function addBatchStock(batchId: number, qtyToAdd: number): void {
  const batch = getBatchById(batchId);
  if (!batch) {
    throw new Error(`Batch #${batchId} not found`);
  }
  const updatedQty = batch.quantity + qtyToAdd;
  run("UPDATE product_batches SET quantity = ?, updated_at = ? WHERE id = ?", [
    updatedQty,
    new Date().toISOString(),
    batchId,
  ]);
}

export interface GetAllBatchesFilter {
  productId?: number;
  search?: string;
  includeEmpty?: boolean;
  status?: "ALL" | "HEALTHY" | "EXPIRING_SOON" | "EXPIRED";
  daysThreshold?: number;
}

/**
 * Returns all batches across the system with product join and status filtering.
 */
export function getAllBatches(filter?: GetAllBatchesFilter): ProductBatch[] {
  const days = filter?.daysThreshold ?? 30;
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let sql = `
    SELECT b.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit
    FROM product_batches b
    JOIN products p ON b.product_id = p.id
    WHERE 1=1
  `;
  const params: (string | number | boolean | null)[] = [];

  if (filter?.productId) {
    sql += " AND b.product_id = ?";
    params.push(filter.productId);
  }

  if (!filter?.includeEmpty) {
    sql += " AND b.quantity > 0";
  }

  if (filter?.search) {
    const s = `%${filter.search.trim()}%`;
    sql += " AND (b.batch_number LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)";
    params.push(s, s, s);
  }

  if (filter?.status === "EXPIRED") {
    sql += " AND b.expiry_date < ?";
    params.push(today);
  } else if (filter?.status === "EXPIRING_SOON") {
    sql += " AND b.expiry_date >= ? AND b.expiry_date <= ?";
    params.push(today, targetDate);
  } else if (filter?.status === "HEALTHY") {
    sql += " AND b.expiry_date > ?";
    params.push(targetDate);
  }

  sql += " ORDER BY b.expiry_date ASC, p.name ASC";
  return query<ProductBatch>(sql, params);
}

/**
 * Returns batches that are expired or expiring within N days.
 */
export function getNearExpiryBatches(daysThreshold = 30): ProductBatch[] {
  return getAllBatches({
    status: "EXPIRING_SOON",
    daysThreshold,
    includeEmpty: false,
  });
}

/**
 * Returns batches that are already expired.
 */
export function getExpiredBatches(): ProductBatch[] {
  return getAllBatches({ status: "EXPIRED", includeEmpty: false });
}
