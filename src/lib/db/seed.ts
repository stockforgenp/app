/**
 * Database Initialization & Reset Utilities
 * Ensures clean, production-ready offline state without dummy mock/seed data.
 */
import { Database } from 'sql.js';

/**
 * Initializes essential default settings if not already present.
 * Does NOT insert any mock products, sales, expenses, staff, or vendors.
 */
export function seedInitialData(db: Database) {
  try {
    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('currency_symbol', 'Rs.')`);
    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('low_stock_threshold', '10')`);
    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('allow_negative_stock', 'false')`);
  } catch (err) {
    console.error('Error initializing default settings:', err);
  }
}

/**
 * Remove legacy sample demo records from previous test sessions if present.
 */
export function cleanupMockData(db: Database) {
  try {
    const demoSkus = [
      'BEV-CC-500',
      'BEV-PEP-500',
      'SNK-CHP-050',
      'BEV-WAT-1000',
      'SNK-NOD-075',
      'SNK-CHO-040',
      'BEV-TEA-025',
      'GRN-RIC-001',
    ];

    // Find and remove demo products and their movements/sale items
    const placeholders = demoSkus.map(() => '?').join(',');
    const demoProducts = db.exec(`SELECT id FROM products WHERE sku IN (${placeholders})`, demoSkus);
    if (demoProducts.length > 0 && demoProducts[0].values) {
      const pids = demoProducts[0].values.map((v) => v[0] as number);
      for (const pid of pids) {
        db.run('DELETE FROM sale_items WHERE product_id = ?', [pid]);
        db.run('DELETE FROM purchase_items WHERE product_id = ?', [pid]);
        db.run('DELETE FROM stock_movements WHERE product_id = ?', [pid]);
        db.run('DELETE FROM products WHERE id = ?', [pid]);
      }
    }

    // Remove demo shop if it was auto-seeded
    db.run("DELETE FROM shops WHERE email = 'demo@stockforge.pos'");

    // Remove demo staff if seeded
    db.run("DELETE FROM staff WHERE email IN ('asif.khan@example.com', 'bilal.ahmed@example.com', 'hamza.t@example.com')");
  } catch (err) {
    console.error('Error during cleanupMockData:', err);
  }
}

/**
 * Clear all transaction, product, and staff data for a completely clean slate.
 */
export function clearAllTestData(db: Database) {
  try {
    db.run('DELETE FROM purchase_items;');
    db.run('DELETE FROM purchases;');
    db.run('DELETE FROM sale_items;');
    db.run('DELETE FROM sales;');
    db.run('DELETE FROM stock_movements;');
    db.run('DELETE FROM products;');
    db.run('DELETE FROM vendors;');
    db.run('DELETE FROM customers;');
    db.run('DELETE FROM salary_payments;');
    db.run('DELETE FROM expenses;');
    db.run('DELETE FROM staff;');
    // Reset sqlite autoincrement sequences
    db.run(
      "DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales', 'sale_items', 'purchases', 'purchase_items', 'stock_movements', 'vendors', 'customers', 'expenses', 'staff', 'salary_payments');"
    );
  } catch (err) {
    console.error('Error clearing data:', err);
  }
}
