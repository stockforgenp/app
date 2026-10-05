/**
 * Product Management Service
 */
import { Product } from "../../types/index.ts";
import { query, queryOne, run, transaction } from "../db/sqliteEngine.ts";

export function getAllProducts(search?: string): Product[] {
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    return query<Product>(
      `SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY name ASC`,
      [s, s],
    );
  }
  return query<Product>(`SELECT * FROM products ORDER BY name ASC`);
}

export function getProductById(id: number): Product | null {
  return queryOne<Product>(`SELECT * FROM products WHERE id = ?`, [id]);
}

/**
 * Auto-generate a unique, retail-standard SKU code for a product if one is not provided.
 * Standard format: <PREFIX>-<0000> (e.g. 'CC-0009', 'BIS-0010', 'SKU-0011')
 */
export function generateProductSku(productName?: string): string {
  let prefix = "SKU";
  if (productName && productName.trim()) {
    const alphaWords = productName
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter((w) => w.length > 0);

    if (alphaWords.length >= 2) {
      prefix = alphaWords
        .slice(0, 3)
        .map((w) => w[0].toUpperCase())
        .join("");
    } else if (alphaWords.length === 1 && alphaWords[0].length >= 3) {
      prefix = alphaWords[0].slice(0, 3).toUpperCase();
    } else if (alphaWords.length === 1 && alphaWords[0].length > 0) {
      prefix = alphaWords[0].toUpperCase();
    }
  }

  // Ensure prefix has only alphanumeric characters and min length 2
  if (!prefix || prefix.length < 2 || !/^[A-Z0-9]+$/.test(prefix)) {
    prefix = "SKU";
  }

  let nextNum = 1;
  try {
    const maxRow = queryOne<{ maxId: number }>(
      "SELECT MAX(id) as maxId FROM products",
    );
    nextNum = (maxRow?.maxId || 0) + 1;
  } catch {
    nextNum = 1;
  }

  let counter = nextNum;
  let candidate = `${prefix}-${String(counter).padStart(4, "0")}`;

  try {
    while (true) {
      const existing = queryOne<{ id: number }>(
        "SELECT id FROM products WHERE sku = ?",
        [candidate],
      );
      if (!existing) {
        break;
      }
      counter++;
      candidate = `${prefix}-${String(counter).padStart(4, "0")}`;
    }
  } catch {
    candidate = `${prefix}-${Date.now().toString().slice(-4)}`;
  }

  return candidate;
}

export function createProduct(data: {
  name: string;
  sku?: string | null;
  unit?: string | null;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  min_stock_alert?: number | null;
}): Product {
  const now = new Date().toISOString();
  const name = data.name.trim();
  let sku = data.sku && data.sku.trim() ? data.sku.trim() : null;
  const unit =
    data.unit && data.unit.trim() ? data.unit.trim().toLowerCase() : "pcs";

  // Auto-generate SKU code if not provided by user
  if (!sku) {
    sku = generateProductSku(name);
  }

  const initialStock = Math.max(0, Math.floor(data.current_stock));
  const minStockAlert =
    data.min_stock_alert !== undefined ? data.min_stock_alert : null;

  return transaction(() => {
    run(
      `INSERT INTO products (name, sku, unit, cost_price, selling_price, current_stock, min_stock_alert, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        sku,
        unit,
        data.cost_price,
        data.selling_price,
        initialStock,
        minStockAlert,
        now,
        now,
      ],
    );

    const idRes = queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
    const newId = idRes?.id ?? 0;

    if (initialStock > 0) {
      run(
        `INSERT INTO stock_movements (product_id, type, quantity, reference_id, vendor_id, vendor_name, note, created_at)
         VALUES (?, 'RESTOCK', ?, NULL, NULL, NULL, 'Initial stock for new product', ?)`,
        [newId, initialStock, now],
      );
    }

    const created = getProductById(newId);
    if (!created) {
      throw new Error("Failed to retrieve created product");
    }
    return created;
  });
}

export function createProductsBatch(
  products: Array<{
    name: string;
    sku?: string | null;
    unit?: string | null;
    cost_price: number;
    selling_price: number;
    current_stock: number;
    min_stock_alert?: number | null;
  }>,
): Product[] {
  if (products.length === 0) return [];
  return transaction(() => {
    return products.map((p) => createProduct(p));
  });
}

export function updateProduct(
  id: number,
  data: {
    name: string;
    sku?: string | null;
    unit?: string | null;
    cost_price: number;
    selling_price: number;
    min_stock_alert?: number | null;
  },
): void {
  const now = new Date().toISOString();
  const name = data.name.trim();
  let sku = data.sku && data.sku.trim() ? data.sku.trim() : null;
  const unit =
    data.unit && data.unit.trim() ? data.unit.trim().toLowerCase() : "pcs";

  // Auto-generate SKU code if not provided or left blank
  if (!sku) {
    sku = generateProductSku(name);
  }

  const minStockAlert =
    data.min_stock_alert !== undefined ? data.min_stock_alert : null;

  run(
    `UPDATE products 
     SET name = ?, sku = ?, unit = ?, cost_price = ?, selling_price = ?, min_stock_alert = ?, updated_at = ?
     WHERE id = ?`,
    [
      name,
      sku,
      unit,
      data.cost_price,
      data.selling_price,
      minStockAlert,
      now,
      id,
    ],
  );
}

export function deleteProduct(id: number): void {
  // Check if product has sales
  const salesCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?`,
    [id],
  );

  if (salesCount && salesCount.count > 0) {
    throw new Error(
      `Cannot delete product: it is referenced in ${salesCount.count} historical sales records. Historical integrity must be preserved.`,
    );
  }

  // Check if product has purchase records
  const purchasesCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?`,
    [id],
  );

  if (purchasesCount && purchasesCount.count > 0) {
    throw new Error(
      `Cannot delete product: it is referenced in ${purchasesCount.count} historical purchase records. Historical integrity must be preserved.`,
    );
  }

  transaction(() => {
    // Delete stock movements first
    run(`DELETE FROM stock_movements WHERE product_id = ?`, [id]);
    run(`DELETE FROM products WHERE id = ?`, [id]);
  });
}
