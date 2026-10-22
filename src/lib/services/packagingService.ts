/**
 * Product Packaging Hierarchy & Unit Conversion Service (Multi-UOM)
 * Supports nested packaging configurations (e.g., 1 Carton = 24 pcs, 1 Sack = 25 kg)
 * and seamless inventory conversion between bulk packaging and base stocking units.
 */

import { ProductPackaging } from '../../types/index.ts';
import { query, queryOne, run, transaction } from '../db/sqliteEngine.ts';

export interface CreatePackagingInput {
  productId: number;
  packageName: string; // e.g. 'Carton', 'Sack', 'Box', 'Strip'
  packageUnit: string; // e.g. 'ctn', 'sack', 'box', 'strip'
  multiplier: number; // e.g. 24, 25, 10, 12
  sellingPrice?: number | null; // in minor units
  barcode?: string | null;
}

/**
 * Creates a packaging conversion rule for a product.
 */
export function createPackaging(input: CreatePackagingInput): ProductPackaging {
  const mult = Math.max(1, input.multiplier);
  const now = new Date().toISOString();
  const name = input.packageName.trim();
  const unit = input.packageUnit.trim().toLowerCase();
  const barcode = input.barcode?.trim() || null;
  const sellingPrice =
    input.sellingPrice !== undefined && input.sellingPrice !== null && input.sellingPrice > 0
      ? Math.floor(input.sellingPrice)
      : null;

  return transaction(() => {
    run(
      `INSERT INTO product_packagings (
        product_id, package_name, package_unit, multiplier, selling_price, barcode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.productId, name, unit, mult, sellingPrice, barcode, now, now]
    );

    const insertedId = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    const created = queryOne<ProductPackaging>('SELECT * FROM product_packagings WHERE id = ?', [
      insertedId?.id ?? 0,
    ]);
    if (!created) {
      throw new Error('Failed to retrieve newly created packaging');
    }
    return created;
  });
}

/**
 * Returns all packaging options configured for a product.
 */
export function getProductPackagings(productId: number): ProductPackaging[] {
  return query<ProductPackaging>(
    'SELECT * FROM product_packagings WHERE product_id = ? ORDER BY multiplier ASC',
    [productId]
  );
}

/**
 * Returns all packagings across the system.
 */
export function getAllPackagings(): ProductPackaging[] {
  return query<ProductPackaging>('SELECT * FROM product_packagings ORDER BY product_id ASC, multiplier ASC');
}

/**
 * Returns a specific packaging record by ID.
 */
export function getPackagingById(id: number): ProductPackaging | null {
  return queryOne<ProductPackaging>('SELECT * FROM product_packagings WHERE id = ?', [id]);
}

/**
 * Deletes a packaging configuration.
 */
export function deletePackaging(id: number): void {
  run('DELETE FROM product_packagings WHERE id = ?', [id]);
}

