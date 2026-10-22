/**
 * Offline SQLite Database Engine
 * Powered by sql.js (WebAssembly SQLite) with IndexedDB persistence
 * Ensures 100% offline-first desktop functionality with ACID transaction safety.
 */

import initSqlJs, { Database, SqlValue } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SCHEMA_SQL } from "./schema.ts";
import { seedInitialData, cleanupMockData } from "./seed.ts";
import {
  saveDatabaseToStorage,
  loadDatabaseFromStorage,
  clearDatabaseStorage,
} from "./storage.ts";
import { capitalizeWords } from "../utils/format.ts";

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;
let listeners: Array<() => void> = [];
let transactionDepth = 0;

export function subscribeToDbChanges(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyDbChanged() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error("Error in DB subscriber:", e);
    }
  }
}

function migrateDatabaseIfNeeded(db: Database) {
  let changed = false;
  try {
    // Ensure shops table exists
    const shopsTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='shops';",
    );
    if (shopsTable.length === 0 || shopsTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS shops (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          phone TEXT,
          shop_type TEXT NOT NULL DEFAULT 'General Retail',
          address TEXT,
          currency_symbol TEXT DEFAULT 'Rs.',
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_email ON shops(email);
      `);
      changed = true;
    }

    // Ensure products min_stock_alert and unit columns exist
    const productTableInfo = db.exec("PRAGMA table_info(products);");
    if (productTableInfo.length > 0 && productTableInfo[0].values) {
      const colNames = productTableInfo[0].values.map(
        (col: unknown[]) => col[1] as string,
      );
      if (!colNames.includes("min_stock_alert")) {
        db.run(
          "ALTER TABLE products ADD COLUMN min_stock_alert INTEGER DEFAULT NULL;",
        );
        changed = true;
      }
      if (!colNames.includes("unit")) {
        db.run("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'pcs';");
        changed = true;
      }
      if (!colNames.includes("wholesale_price")) {
        db.run(
          "ALTER TABLE products ADD COLUMN wholesale_price INTEGER DEFAULT NULL;",
        );
        changed = true;
      }
      if (!colNames.includes("wholesale_min_qty")) {
        db.run(
          "ALTER TABLE products ADD COLUMN wholesale_min_qty INTEGER DEFAULT NULL;",
        );
        changed = true;
      }
      // Drop vendor columns if they existed in older schemas
      if (colNames.includes("vendor_id")) {
        try {
          db.run("ALTER TABLE products DROP COLUMN vendor_id;");
          changed = true;
        } catch {
          // Ignore if older SQLite doesn't support DROP COLUMN
        }
      }
      if (colNames.includes("vendor_name")) {
        try {
          db.run("ALTER TABLE products DROP COLUMN vendor_name;");
          changed = true;
        } catch {
          // Ignore if older SQLite doesn't support DROP COLUMN
        }
      }
    }

    // Ensure shops table subscription columns exist
    const shopsTableInfo = db.exec("PRAGMA table_info(shops);");
    if (shopsTableInfo.length > 0 && shopsTableInfo[0].values) {
      const colNames = shopsTableInfo[0].values.map(
        (col: unknown[]) => col[1] as string,
      );
      if (!colNames.includes("subscription_status")) {
        db.run(
          "ALTER TABLE shops ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active';",
        );
        changed = true;
      }
      if (!colNames.includes("subscription_plan")) {
        db.run(
          "ALTER TABLE shops ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'Standard';",
        );
        changed = true;
      }
      if (!colNames.includes("subscribed_date")) {
        db.run("ALTER TABLE shops ADD COLUMN subscribed_date TEXT;");
        changed = true;
      }
      if (!colNames.includes("subscription_duration_days")) {
        db.run(
          "ALTER TABLE shops ADD COLUMN subscription_duration_days INTEGER DEFAULT 365;",
        );
        changed = true;
        if (colNames.includes("subscription_duration_months")) {
          try {
            db.run(
              "UPDATE shops SET subscription_duration_days = COALESCE(subscription_duration_months * 30, 365) WHERE subscription_duration_days IS NULL;",
            );
          } catch {}
        }
      }
      if (!colNames.includes("subscription_expiry_date")) {
        db.run("ALTER TABLE shops ADD COLUMN subscription_expiry_date TEXT;");
        changed = true;
      }

      try {
        db.run(`
          UPDATE shops
          SET subscribed_date = COALESCE(subscribed_date, substr(created_at, 1, 10)),
              subscription_duration_days = COALESCE(subscription_duration_days, 365),
              subscription_expiry_date = COALESCE(subscription_expiry_date, date(substr(created_at, 1, 10), '+365 days'))
          WHERE subscription_expiry_date IS NULL;
        `);
      } catch {}
    }

    // Ensure vendors table exists
    const vendorsTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vendors';",
    );
    if (vendorsTable.length === 0 || vendorsTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS vendors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          pan_vat TEXT,
          address TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
        CREATE INDEX IF NOT EXISTS idx_vendors_pan_vat ON vendors(pan_vat);
        CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors(phone);
      `);
      changed = true;
    }

    // Ensure customers table exists
    const customersTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='customers';",
    );
    if (customersTable.length === 0 || customersTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
          pan_vat TEXT,
          address TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
        CREATE INDEX IF NOT EXISTS idx_customers_pan_vat ON customers(pan_vat);
      `);
      changed = true;
    } else {
      const custInfo = db.exec("PRAGMA table_info(customers);");
      if (custInfo.length > 0 && custInfo[0].values) {
        const colNames = custInfo[0].values.map(
          (col: unknown[]) => col[1] as string,
        );
        if (!colNames.includes("customer_type")) {
          db.run(
            "ALTER TABLE customers ADD COLUMN customer_type TEXT NOT NULL DEFAULT 'RETAIL';",
          );
          changed = true;
        }
      }
    }

    // Ensure stock_movements vendor_id and vendor_name columns exist
    const movementTableInfo = db.exec("PRAGMA table_info(stock_movements);");
    if (movementTableInfo.length > 0 && movementTableInfo[0].values) {
      const colNames = movementTableInfo[0].values.map(
        (col: unknown[]) => col[1] as string,
      );
      if (!colNames.includes("vendor_id")) {
        db.run(
          "ALTER TABLE stock_movements ADD COLUMN vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL;",
        );
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_stock_movements_vendor_id ON stock_movements(vendor_id);",
        );
        changed = true;
      }
      if (!colNames.includes("vendor_name")) {
        db.run("ALTER TABLE stock_movements ADD COLUMN vendor_name TEXT;");
        changed = true;
      }
    }

    const tableInfo = db.exec("PRAGMA table_info(sales);");
    if (tableInfo.length > 0 && tableInfo[0].values) {
      const colNames = tableInfo[0].values.map(
        (col: unknown[]) => col[1] as string,
      );
      if (!colNames.includes("customer_id")) {
        db.run(
          "ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;",
        );
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);",
        );
        changed = true;
      }
      if (!colNames.includes("customer_name")) {
        db.run("ALTER TABLE sales ADD COLUMN customer_name TEXT;");
        changed = true;
      }
      if (!colNames.includes("customer_phone")) {
        db.run("ALTER TABLE sales ADD COLUMN customer_phone TEXT;");
        changed = true;
      }
      if (!colNames.includes("customer_pan_vat")) {
        db.run("ALTER TABLE sales ADD COLUMN customer_pan_vat TEXT;");
        changed = true;
      }
      if (!colNames.includes("customer_address")) {
        db.run("ALTER TABLE sales ADD COLUMN customer_address TEXT;");
        changed = true;
      }
      if (!colNames.includes("bill_number")) {
        db.run("ALTER TABLE sales ADD COLUMN bill_number TEXT;");
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON sales(bill_number);",
        );
        changed = true;
      }
      if (!colNames.includes("taxable_amount")) {
        db.run("ALTER TABLE sales ADD COLUMN taxable_amount INTEGER;");
        changed = true;
      }
      if (!colNames.includes("vat_rate")) {
        db.run("ALTER TABLE sales ADD COLUMN vat_rate REAL DEFAULT 13.0;");
        changed = true;
      }
      if (!colNames.includes("vat_amount")) {
        db.run("ALTER TABLE sales ADD COLUMN vat_amount INTEGER DEFAULT 0;");
        changed = true;
      }
      if (!colNames.includes("grand_total")) {
        db.run("ALTER TABLE sales ADD COLUMN grand_total INTEGER;");
        changed = true;
      }
      if (!colNames.includes("paid_amount")) {
        db.run(
          "ALTER TABLE sales ADD COLUMN paid_amount INTEGER DEFAULT NULL;",
        );
        changed = true;
      }
      if (!colNames.includes("due_amount")) {
        db.run("ALTER TABLE sales ADD COLUMN due_amount INTEGER DEFAULT 0;");
        changed = true;
      }
      if (!colNames.includes("payment_method")) {
        db.run(
          "ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'Cash';",
        );
        changed = true;
      }
      if (!colNames.includes("status")) {
        db.run(
          "ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED';",
        );
        changed = true;
      }
      if (!colNames.includes("returned_at")) {
        db.run("ALTER TABLE sales ADD COLUMN returned_at TEXT;");
        changed = true;
      }

      // Backfill existing rows if bill_number or grand_total or paid_amount is missing
      try {
        db.run(`
          UPDATE sales 
          SET bill_number = 'BILL-' || substr('00000' || id, -5)
          WHERE bill_number IS NULL OR bill_number = '';
        `);
        db.run(`
          UPDATE sales 
          SET taxable_amount = COALESCE(taxable_amount, subtotal - discount),
              vat_rate = COALESCE(vat_rate, 13.0),
              vat_amount = COALESCE(vat_amount, round((subtotal - discount) * 0.13)),
              grand_total = COALESCE(grand_total, total)
          WHERE grand_total IS NULL;
        `);
        db.run(`
          UPDATE sales
          SET paid_amount = COALESCE(paid_amount, grand_total, total),
              due_amount = COALESCE(due_amount, 0)
          WHERE paid_amount IS NULL;
        `);
      } catch {
        // Ignore backfill errors if tables empty
      }
    }

    // Ensure expenses table exists
    const expensesTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses';",
    );
    if (expensesTable.length === 0 || expensesTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          amount INTEGER NOT NULL,
          date TEXT NOT NULL,
          payment_method TEXT,
          note TEXT,
          receipt_reference TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      `);
      changed = true;
    } else {
      const expCols = db.exec("PRAGMA table_info(expenses);");
      if (expCols.length > 0 && expCols[0].values) {
        const expColNames = expCols[0].values.map((v) => v[1] as string);
        if (!expColNames.includes("payment_method")) {
          db.run(
            "ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'Cash';",
          );
          changed = true;
        }
      }
    }

    // Ensure staff table exists
    const staffTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='staff';",
    );
    if (staffTable.length === 0 || staffTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS staff (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          base_salary INTEGER NOT NULL DEFAULT 0,
          salary_type TEXT NOT NULL DEFAULT 'monthly',
          status TEXT NOT NULL DEFAULT 'active',
          join_date TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
      `);
      changed = true;
    }

    // Ensure salary_payments table exists
    const salaryTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='salary_payments';",
    );
    if (salaryTable.length === 0 || salaryTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS salary_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL,
          bonus INTEGER NOT NULL DEFAULT 0,
          deductions INTEGER NOT NULL DEFAULT 0,
          net_paid INTEGER NOT NULL,
          payment_date TEXT NOT NULL,
          payment_period TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          reference TEXT,
          note TEXT,
          expense_id INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_salary_payments_staff_id ON salary_payments(staff_id);
        CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON salary_payments(payment_date);
        CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON salary_payments(payment_period);
      `);
      changed = true;
    }

    // Ensure purchases table exists
    const purchasesTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='purchases';",
    );
    if (purchasesTable.length === 0 || purchasesTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bill_number TEXT,
          invoice_number TEXT,
          vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
          vendor_name TEXT,
          vendor_phone TEXT,
          vendor_email TEXT,
          vendor_pan_vat TEXT,
          vendor_address TEXT,
          subtotal INTEGER NOT NULL,
          discount INTEGER NOT NULL DEFAULT 0,
          taxable_amount INTEGER,
          vat_rate REAL DEFAULT 13.0,
          vat_amount INTEGER NOT NULL DEFAULT 0,
          grand_total INTEGER,
          total INTEGER NOT NULL,
          paid_amount INTEGER DEFAULT NULL,
          due_amount INTEGER DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_purchases_vendor_id ON purchases(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_purchases_bill_number ON purchases(bill_number);
        CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);
      `);
      changed = true;
    } else {
      const pCols = db.exec("PRAGMA table_info(purchases);");
      const pColNames = pCols[0]?.values.map((v) => v[1] as string) || [];
      if (!pColNames.includes("bill_number")) {
        db.run("ALTER TABLE purchases ADD COLUMN bill_number TEXT;");
        changed = true;
      }
      if (!pColNames.includes("invoice_number")) {
        db.run("ALTER TABLE purchases ADD COLUMN invoice_number TEXT;");
        changed = true;
      }
      if (!pColNames.includes("vendor_id")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL;",
        );
        changed = true;
      }
      if (!pColNames.includes("vendor_name")) {
        db.run("ALTER TABLE purchases ADD COLUMN vendor_name TEXT;");
        changed = true;
      }
      if (!pColNames.includes("vendor_phone")) {
        db.run("ALTER TABLE purchases ADD COLUMN vendor_phone TEXT;");
        changed = true;
      }
      if (!pColNames.includes("vendor_email")) {
        db.run("ALTER TABLE purchases ADD COLUMN vendor_email TEXT;");
        changed = true;
      }
      if (!pColNames.includes("vendor_pan_vat")) {
        db.run("ALTER TABLE purchases ADD COLUMN vendor_pan_vat TEXT;");
        changed = true;
      }
      if (!pColNames.includes("vendor_address")) {
        db.run("ALTER TABLE purchases ADD COLUMN vendor_address TEXT;");
        changed = true;
      }
      if (!pColNames.includes("subtotal")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN subtotal INTEGER NOT NULL DEFAULT 0;",
        );
        changed = true;
      }
      if (!pColNames.includes("discount")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN discount INTEGER NOT NULL DEFAULT 0;",
        );
        changed = true;
      }
      if (!pColNames.includes("taxable_amount")) {
        db.run("ALTER TABLE purchases ADD COLUMN taxable_amount INTEGER;");
        changed = true;
      }
      if (!pColNames.includes("vat_rate")) {
        db.run("ALTER TABLE purchases ADD COLUMN vat_rate REAL DEFAULT 13.0;");
        changed = true;
      }
      if (!pColNames.includes("vat_amount")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN vat_amount INTEGER NOT NULL DEFAULT 0;",
        );
        changed = true;
      }
      if (!pColNames.includes("grand_total")) {
        db.run("ALTER TABLE purchases ADD COLUMN grand_total INTEGER;");
        changed = true;
      }
      if (!pColNames.includes("total")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN total INTEGER NOT NULL DEFAULT 0;",
        );
        changed = true;
      }
      if (!pColNames.includes("paid_amount")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN paid_amount INTEGER DEFAULT NULL;",
        );
        changed = true;
      }
      if (!pColNames.includes("due_amount")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN due_amount INTEGER DEFAULT 0;",
        );
        changed = true;
      }
      if (!pColNames.includes("payment_method")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN payment_method TEXT DEFAULT 'Cash';",
        );
        changed = true;
      }
      if (!pColNames.includes("notes")) {
        db.run("ALTER TABLE purchases ADD COLUMN notes TEXT;");
        changed = true;
      }
      if (!pColNames.includes("status")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED';",
        );
        changed = true;
      }
      if (!pColNames.includes("returned_at")) {
        db.run("ALTER TABLE purchases ADD COLUMN returned_at TEXT;");
        changed = true;
      }
      if (!pColNames.includes("created_at")) {
        db.run(
          "ALTER TABLE purchases ADD COLUMN created_at TEXT NOT NULL DEFAULT '';",
        );
        changed = true;
      }

      try {
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_purchases_vendor_id ON purchases(vendor_id);",
        );
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_purchases_bill_number ON purchases(bill_number);",
        );
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);",
        );
      } catch {}

      try {
        db.run(`
          UPDATE purchases
          SET bill_number = 'PUR-' || substr('00000' || id, -5)
          WHERE bill_number IS NULL OR bill_number = '';
        `);
        db.run(`
          UPDATE purchases
          SET taxable_amount = COALESCE(taxable_amount, subtotal - discount),
              vat_rate = COALESCE(vat_rate, 13.0),
              vat_amount = COALESCE(vat_amount, round((subtotal - discount) * 0.13)),
              grand_total = COALESCE(grand_total, total)
          WHERE grand_total IS NULL;
        `);
        db.run(`
          UPDATE purchases
          SET paid_amount = COALESCE(paid_amount, grand_total, total),
              due_amount = COALESCE(due_amount, 0)
          WHERE paid_amount IS NULL;
        `);
      } catch {
        // Ignore backfill errors
      }
    }

    // Ensure purchase_items table exists
    const purchaseItemsTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='purchase_items';",
    );
    if (
      purchaseItemsTable.length === 0 ||
      purchaseItemsTable[0].values.length === 0
    ) {
      db.run(`
        CREATE TABLE IF NOT EXISTS purchase_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          product_name TEXT,
          product_sku TEXT,
          quantity INTEGER NOT NULL,
          cost_price INTEGER NOT NULL,
          selling_price INTEGER,
          discount INTEGER NOT NULL DEFAULT 0,
          total INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);
        CREATE VIEW IF NOT EXISTS purchase_products AS SELECT * FROM purchase_items;
      `);
      changed = true;
    } else {
      const piCols = db.exec("PRAGMA table_info(purchase_items);");
      const piColNames = piCols[0]?.values.map((v) => v[1] as string) || [];
      if (!piColNames.includes("product_name")) {
        db.run("ALTER TABLE purchase_items ADD COLUMN product_name TEXT;");
        changed = true;
      }
      if (!piColNames.includes("product_sku")) {
        db.run("ALTER TABLE purchase_items ADD COLUMN product_sku TEXT;");
        changed = true;
      }
      if (!piColNames.includes("selling_price")) {
        db.run("ALTER TABLE purchase_items ADD COLUMN selling_price INTEGER;");
        changed = true;
      }
      if (!piColNames.includes("discount")) {
        db.run(
          "ALTER TABLE purchase_items ADD COLUMN discount INTEGER NOT NULL DEFAULT 0;",
        );
        changed = true;
      }
      if (!piColNames.includes("batch_id")) {
        db.run(
          "ALTER TABLE purchase_items ADD COLUMN batch_id INTEGER REFERENCES product_batches(id) ON DELETE SET NULL;",
        );
        changed = true;
      }
      if (!piColNames.includes("batch_number")) {
        db.run("ALTER TABLE purchase_items ADD COLUMN batch_number TEXT;");
        changed = true;
      }
      if (!piColNames.includes("expiry_date")) {
        db.run("ALTER TABLE purchase_items ADD COLUMN expiry_date TEXT;");
        changed = true;
      }
      if (!piColNames.includes("mfg_date")) {
        db.run("ALTER TABLE purchase_items ADD COLUMN mfg_date TEXT;");
        changed = true;
      }
      if (!piColNames.includes("packaging_id")) {
        db.run(
          "ALTER TABLE purchase_items ADD COLUMN packaging_id INTEGER REFERENCES product_packagings(id) ON DELETE SET NULL;",
        );
        changed = true;
      }
      if (!piColNames.includes("package_multiplier")) {
        db.run(
          "ALTER TABLE purchase_items ADD COLUMN package_multiplier REAL DEFAULT 1;",
        );
        changed = true;
      }
      if (!piColNames.includes("packaging_name")) {
        db.run("ALTER TABLE purchase_items ADD COLUMN packaging_name TEXT;");
        changed = true;
      }
      try {
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);",
        );
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_purchase_items_product_id ON purchase_items(product_id);",
        );
        db.run(
          "CREATE VIEW IF NOT EXISTS purchase_products AS SELECT * FROM purchase_items;",
        );
      } catch {}
    }

    // Ensure product_batches table exists
    const batchesTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='product_batches';",
    );
    if (batchesTable.length === 0 || batchesTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS product_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          batch_number TEXT NOT NULL,
          mfg_date TEXT,
          expiry_date TEXT NOT NULL,
          cost_price INTEGER NOT NULL,
          selling_price INTEGER,
          quantity INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_batches_product_id ON product_batches(product_id);
        CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);
      `);
      changed = true;
    }

    // Ensure sale_items batch columns exist
    const saleItemsTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items';",
    );
    if (saleItemsTable.length > 0 && saleItemsTable[0].values.length > 0) {
      const siCols = db.exec("PRAGMA table_info(sale_items);");
      const siColNames = siCols[0]?.values.map((v) => v[1] as string) || [];
      if (!siColNames.includes("batch_id")) {
        db.run(
          "ALTER TABLE sale_items ADD COLUMN batch_id INTEGER REFERENCES product_batches(id) ON DELETE SET NULL;",
        );
        changed = true;
      }
      if (!siColNames.includes("batch_number")) {
        db.run("ALTER TABLE sale_items ADD COLUMN batch_number TEXT;");
        changed = true;
      }
      if (!siColNames.includes("expiry_date")) {
        db.run("ALTER TABLE sale_items ADD COLUMN expiry_date TEXT;");
        changed = true;
      }
      if (!siColNames.includes("pricing_tier")) {
        db.run(
          "ALTER TABLE sale_items ADD COLUMN pricing_tier TEXT NOT NULL DEFAULT 'RETAIL';",
        );
        changed = true;
      }
      if (!siColNames.includes("packaging_id")) {
        db.run(
          "ALTER TABLE sale_items ADD COLUMN packaging_id INTEGER REFERENCES product_packagings(id) ON DELETE SET NULL;",
        );
        changed = true;
      }
      if (!siColNames.includes("package_multiplier")) {
        db.run(
          "ALTER TABLE sale_items ADD COLUMN package_multiplier REAL DEFAULT 1;",
        );
        changed = true;
      }
      if (!siColNames.includes("packaging_name")) {
        db.run("ALTER TABLE sale_items ADD COLUMN packaging_name TEXT;");
        changed = true;
      }
      try {
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id ON sale_items(batch_id);",
        );
        db.run(
          "CREATE INDEX IF NOT EXISTS idx_sale_items_packaging_id ON sale_items(packaging_id);",
        );
      } catch {}
    }

    // Ensure product_packagings table exists
    const packagingsTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='product_packagings';",
    );
    if (
      packagingsTable.length === 0 ||
      packagingsTable[0].values.length === 0
    ) {
      db.run(`
        CREATE TABLE IF NOT EXISTS product_packagings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          package_name TEXT NOT NULL,
          package_unit TEXT NOT NULL,
          multiplier REAL NOT NULL,
          selling_price INTEGER,
          barcode TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_packagings_product_id ON product_packagings(product_id);
      `);
      changed = true;
    }

    // Ensure sale_returns & purchase_returns tables exist
    const saleReturnsTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sale_returns';",
    );
    if (
      saleReturnsTable.length === 0 ||
      saleReturnsTable[0].values.length === 0
    ) {
      db.run(`
        CREATE TABLE IF NOT EXISTS sale_returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_number TEXT NOT NULL UNIQUE,
          sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
          bill_number TEXT,
          customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
          customer_name TEXT,
          total_refund INTEGER NOT NULL,
          refund_method TEXT NOT NULL DEFAULT 'CASH',
          reason TEXT NOT NULL DEFAULT 'CUSTOMER_CANCELLED',
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sale_return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_id INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price INTEGER NOT NULL,
          total INTEGER NOT NULL,
          batch_id INTEGER REFERENCES product_batches(id),
          batch_number TEXT,
          action TEXT NOT NULL DEFAULT 'RESTOCK',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS purchase_returns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_number TEXT NOT NULL UNIQUE,
          purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
          bill_number TEXT,
          vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
          vendor_name TEXT,
          total_refund INTEGER NOT NULL,
          refund_method TEXT NOT NULL DEFAULT 'VENDOR_CREDIT',
          reason TEXT NOT NULL DEFAULT 'DEFECTIVE',
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS purchase_return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          cost_price INTEGER NOT NULL,
          total INTEGER NOT NULL,
          batch_id INTEGER REFERENCES product_batches(id),
          batch_number TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON sale_returns(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_return_items_return_id ON sale_return_items(return_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase_id ON purchase_returns(purchase_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return_id ON purchase_return_items(return_id);
      `);
      changed = true;
    }

    // Ensure shift_sessions table exists
    const shiftTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='shift_sessions';",
    );
    if (shiftTable.length === 0 || shiftTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS shift_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cashier_name TEXT NOT NULL,
          staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
          opening_float INTEGER NOT NULL DEFAULT 0,
          closing_cash INTEGER,
          system_cash INTEGER,
          cash_sales INTEGER NOT NULL DEFAULT 0,
          online_sales INTEGER NOT NULL DEFAULT 0,
          credit_sales INTEGER NOT NULL DEFAULT 0,
          cash_refunds INTEGER NOT NULL DEFAULT 0,
          cash_expenses INTEGER NOT NULL DEFAULT 0,
          variance INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'OPEN',
          notes TEXT,
          opened_at TEXT NOT NULL,
          closed_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_shift_sessions_status ON shift_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_shift_sessions_opened_at ON shift_sessions(opened_at);
      `);
      changed = true;
    }

    // Ensure stock_write_offs table exists
    const writeOffTable = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='stock_write_offs';",
    );
    if (writeOffTable.length === 0 || writeOffTable[0].values.length === 0) {
      db.run(`
        CREATE TABLE IF NOT EXISTS stock_write_offs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voucher_number TEXT NOT NULL UNIQUE,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          product_name TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_cost INTEGER NOT NULL,
          total_loss INTEGER NOT NULL,
          batch_id INTEGER REFERENCES product_batches(id) ON DELETE SET NULL,
          batch_number TEXT,
          reason TEXT NOT NULL,
          action TEXT NOT NULL DEFAULT 'DISPOSAL',
          approved_by TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_stock_write_offs_product_id ON stock_write_offs(product_id);
        CREATE INDEX IF NOT EXISTS idx_stock_write_offs_reason ON stock_write_offs(reason);
        CREATE INDEX IF NOT EXISTS idx_stock_write_offs_created_at ON stock_write_offs(created_at);
      `);
      changed = true;
    }

    // Capitalize existing records across products, vendors, customers, staff, sales, and purchases
    try {
      const prods = db.exec(
        "SELECT id, name FROM products WHERE name IS NOT NULL;",
      );
      if (prods.length > 0 && prods[0].values) {
        for (const [id, name] of prods[0].values as [number, string][]) {
          const cap = capitalizeWords(name);
          if (cap && cap !== name) {
            db.run("UPDATE products SET name = ? WHERE id = ?;", [cap, id]);
            changed = true;
          }
        }
      }
      const vends = db.exec(
        "SELECT id, name FROM vendors WHERE name IS NOT NULL;",
      );
      if (vends.length > 0 && vends[0].values) {
        for (const [id, name] of vends[0].values as [number, string][]) {
          const cap = capitalizeWords(name);
          if (cap && cap !== name) {
            db.run("UPDATE vendors SET name = ? WHERE id = ?;", [cap, id]);
            changed = true;
          }
        }
      }
      const custs = db.exec(
        "SELECT id, name FROM customers WHERE name IS NOT NULL;",
      );
      if (custs.length > 0 && custs[0].values) {
        for (const [id, name] of custs[0].values as [number, string][]) {
          const cap = capitalizeWords(name);
          if (cap && cap !== name) {
            db.run("UPDATE customers SET name = ? WHERE id = ?;", [cap, id]);
            changed = true;
          }
        }
      }
      const stfs = db.exec(
        "SELECT id, name FROM staff WHERE name IS NOT NULL;",
      );
      if (stfs.length > 0 && stfs[0].values) {
        for (const [id, name] of stfs[0].values as [number, string][]) {
          const cap = capitalizeWords(name);
          if (cap && cap !== name) {
            db.run("UPDATE staff SET name = ? WHERE id = ?;", [cap, id]);
            changed = true;
          }
        }
      }
      const sls = db.exec(
        "SELECT id, customer_name FROM sales WHERE customer_name IS NOT NULL;",
      );
      if (sls.length > 0 && sls[0].values) {
        for (const [id, name] of sls[0].values as [number, string][]) {
          const cap = capitalizeWords(name);
          if (cap && cap !== name) {
            db.run("UPDATE sales SET customer_name = ? WHERE id = ?;", [
              cap,
              id,
            ]);
            changed = true;
          }
        }
      }
      const prchs = db.exec(
        "SELECT id, vendor_name FROM purchases WHERE vendor_name IS NOT NULL;",
      );
      if (prchs.length > 0 && prchs[0].values) {
        for (const [id, name] of prchs[0].values as [number, string][]) {
          const cap = capitalizeWords(name);
          if (cap && cap !== name) {
            db.run("UPDATE purchases SET vendor_name = ? WHERE id = ?;", [
              cap,
              id,
            ]);
            changed = true;
          }
        }
      }
      const mvts = db.exec(
        "SELECT id, vendor_name FROM stock_movements WHERE vendor_name IS NOT NULL;",
      );
      if (mvts.length > 0 && mvts[0].values) {
        for (const [id, name] of mvts[0].values as [number, string][]) {
          const cap = capitalizeWords(name);
          if (cap && cap !== name) {
            db.run("UPDATE stock_movements SET vendor_name = ? WHERE id = ?;", [
              cap,
              id,
            ]);
            changed = true;
          }
        }
      }
    } catch (e) {
      console.warn("Name capitalization migration warning:", e);
    }
  } catch (e) {
    console.error("Database migration error:", e);
  }
  return changed;
}

export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const SQL = await initSqlJs({
        locateFile: () => sqlWasmUrl,
      });

      const savedBinary = await loadDatabaseFromStorage();
      if (savedBinary && savedBinary.byteLength > 0) {
        dbInstance = new SQL.Database(savedBinary);
        dbInstance.run("PRAGMA foreign_keys = ON;");
        const migrated = migrateDatabaseIfNeeded(dbInstance);
        cleanupMockData(dbInstance);
        if (migrated) {
          await persistCurrentDatabase();
        }
      } else {
        dbInstance = new SQL.Database();
        dbInstance.run("PRAGMA foreign_keys = ON;");
        dbInstance.run(SCHEMA_SQL);
        seedInitialData(dbInstance);
        await persistCurrentDatabase();
      }

      return dbInstance;
    } catch (err) {
      console.error("Failed to initialize SQLite engine:", err);
      throw err;
    }
  })();

  return initPromise;
}

export async function persistCurrentDatabase(): Promise<void> {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    await saveDatabaseToStorage(data);
  } catch (err) {
    console.error("Error persisting database:", err);
  }
}

/**
 * Execute a query with parameters and return array of objects
 */
export function query<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): T[] {
  if (!dbInstance) {
    throw new Error(
      "Database not initialized. Await getDatabase() before querying.",
    );
  }

  const stmt = dbInstance.prepare(sql);
  try {
    if (params.length > 0) {
      stmt.bind(params as SqlValue[]);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

/**
 * Execute a query expecting a single object result or null
 */
export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a single mutating statement
 */
export function run(
  sql: string,
  params: (string | number | boolean | null)[] = [],
): void {
  if (!dbInstance) {
    throw new Error("Database not initialized");
  }

  if (params.length > 0) {
    dbInstance.run(sql, params as SqlValue[]);
  } else {
    dbInstance.run(sql);
  }

  // Only persist and notify subscribers if not in the middle of a transaction.
  // Defer to microtask so callers can safely read last_insert_rowid() synchronously
  // before db.export() executes.
  if (transactionDepth === 0) {
    queueMicrotask(() => {
      if (transactionDepth === 0) {
        persistCurrentDatabase();
        notifyDbChanged();
      }
    });
  }
}

/**
 * Run operations within a transaction.
 * Supports nesting via SQLite SAVEPOINTs.
 * If any error is thrown, the transaction/savepoint is automatically rolled back.
 */
export function transaction<T>(fn: () => T): T {
  if (!dbInstance) {
    throw new Error("Database not initialized");
  }

  transactionDepth++;
  const savepoint = `sp_${transactionDepth}`;
  dbInstance.run(`SAVEPOINT ${savepoint};`);

  try {
    const result = fn();
    dbInstance.run(`RELEASE SAVEPOINT ${savepoint};`);
    transactionDepth--;

    // Persist and notify once the outermost transaction is fully committed
    if (transactionDepth === 0) {
      persistCurrentDatabase();
      notifyDbChanged();
    }
    return result;
  } catch (err) {
    try {
      dbInstance.run(`ROLLBACK TO SAVEPOINT ${savepoint};`);
      dbInstance.run(`RELEASE SAVEPOINT ${savepoint};`);
    } catch (rbErr: unknown) {
      const msg = rbErr instanceof Error ? rbErr.message : String(rbErr);
      if (
        !msg.includes("no transaction is active") &&
        !msg.includes("no such savepoint") &&
        !msg.includes("cannot rollback")
      ) {
        console.error("Failed to rollback transaction:", msg);
      }
    }
    transactionDepth--;
    throw err;
  }
}

/**
 * Export the current SQLite database binary
 */
export function exportDatabase(): Uint8Array {
  if (!dbInstance) {
    throw new Error("Database not initialized");
  }
  return dbInstance.export();
}

/**
 * Export the current SQLite database as a clean SQL script dump
 */
export function exportDatabaseToSql(): string {
  if (!dbInstance) {
    throw new Error("Database not initialized");
  }

  const lines: string[] = [
    "--",
    "-- StockForge SQLite Database Dump",
    `-- Exported At: ${new Date().toISOString()}`,
    "--",
    "PRAGMA foreign_keys = OFF;",
    "BEGIN TRANSACTION;",
    "",
  ];

  // 1. Get all views first to drop them before tables
  const viewsRes = dbInstance.exec(
    "SELECT name, sql FROM sqlite_master WHERE type = 'view' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  );
  if (viewsRes.length > 0 && viewsRes[0].values) {
    for (const [name] of viewsRes[0].values) {
      const viewName = String(name);
      lines.push(`DROP VIEW IF EXISTS "${viewName.replace(/"/g, '""')}";`);
    }
    lines.push("");
  }

  // 2. Get all tables (excluding sqlite internal tables)
  const tablesRes = dbInstance.exec(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
  );

  if (tablesRes.length > 0 && tablesRes[0].values) {
    for (const [name, sql] of tablesRes[0].values) {
      const tableName = String(name);
      const tableSql = String(sql);

      lines.push(`-- Table: ${tableName}`);
      lines.push(`DROP TABLE IF EXISTS "${tableName.replace(/"/g, '""')}";`);
      lines.push(`${tableSql};`);

      // Dump rows
      const rowsRes = dbInstance.exec(
        `SELECT * FROM "${tableName.replace(/"/g, '""')}";`,
      );
      if (rowsRes.length > 0 && rowsRes[0].values.length > 0) {
        const columns = rowsRes[0].columns;
        const colList = columns
          .map((c) => `"${c.replace(/"/g, '""')}"`)
          .join(", ");

        for (const row of rowsRes[0].values) {
          const valList = row
            .map((val) => {
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "number")
                return Number.isFinite(val) ? String(val) : "NULL";
              if (typeof val === "boolean") return val ? "1" : "0";
              if (val instanceof Uint8Array) {
                const hex = Array.from(val)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("");
                return `X'${hex}'`;
              }
              return `'${String(val).replace(/'/g, "''")}'`;
            })
            .join(", ");

          lines.push(
            `INSERT INTO "${tableName.replace(/"/g, '""')}" (${colList}) VALUES (${valList});`,
          );
        }
      }
      lines.push("");
    }
  }

  // 3. Recreate views
  if (viewsRes.length > 0 && viewsRes[0].values) {
    for (const [name, sql] of viewsRes[0].values) {
      const viewName = String(name);
      const viewSql = String(sql);
      lines.push(`-- View: ${viewName}`);
      lines.push(`${viewSql};`);
      lines.push("");
    }
  }

  // 4. Recreate indices (excluding auto-generated primary key indices)
  const indicesRes = dbInstance.exec(
    "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name;",
  );
  if (indicesRes.length > 0 && indicesRes[0].values) {
    for (const [, sql] of indicesRes[0].values) {
      if (sql) {
        lines.push(`${String(sql)};`);
      }
    }
    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("PRAGMA foreign_keys = ON;");
  lines.push("");

  return lines.join("\n");
}

/**
 * Import a binary SQLite database and replace the current state
 */
export async function importDatabase(binaryData: Uint8Array): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  const newDb = new SQL.Database(binaryData);
  newDb.run("PRAGMA foreign_keys = ON;");

  // Quick sanity check to ensure it has our tables
  const test = newDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='products'",
  );
  if (test.length === 0 || test[0].values.length === 0) {
    throw new Error("Invalid database: products table missing.");
  }

  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = newDb;
  await persistCurrentDatabase();
  notifyDbChanged();
}

/**
 * Import a SQL script and replace the current database state
 */
export async function importDatabaseFromSql(sqlContent: string): Promise<void> {
  const trimmed = sqlContent.trim();
  if (!trimmed) {
    throw new Error("The SQL backup file is empty.");
  }

  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  const newDb = new SQL.Database();
  newDb.run("PRAGMA foreign_keys = OFF;");

  // If the SQL script does not define tables (only inserts/data), initialize core schema first
  const hasCreateTable = /create\s+table/i.test(trimmed);
  if (!hasCreateTable) {
    newDb.run(SCHEMA_SQL);
  }

  // Execute the user SQL script
  newDb.run(trimmed);
  newDb.run("PRAGMA foreign_keys = ON;");

  // Apply migrations if needed to ensure any new columns exist
  migrateDatabaseIfNeeded(newDb);

  // Quick sanity check to ensure core tables like products exist
  const test = newDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='products'",
  );
  if (test.length === 0 || test[0].values.length === 0) {
    throw new Error("Invalid SQL database backup: products table is missing.");
  }

  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = newDb;
  await persistCurrentDatabase();
  notifyDbChanged();
}

/**
 * Reset database to fresh default sample state
 */
export async function resetDatabase(): Promise<void> {
  await clearDatabaseStorage();
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  initPromise = null;
  await getDatabase();
  notifyDbChanged();
}
