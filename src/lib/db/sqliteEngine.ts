/**
 * Offline SQLite Database Engine
 * Powered by sql.js (WebAssembly SQLite) with IndexedDB persistence
 * Ensures 100% offline-first desktop functionality with ACID transaction safety.
 */

import initSqlJs, { Database, SqlValue } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { SCHEMA_SQL } from './schema.ts';
import { seedInitialData } from './seed.ts';
import { saveDatabaseToStorage, loadDatabaseFromStorage, clearDatabaseStorage } from './storage.ts';

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;
let listeners: Array<() => void> = [];
let transactionDepth = 0;

export function subscribeToDbChanges(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notifyDbChanged() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error('Error in DB subscriber:', e);
    }
  }
}

function migrateDatabaseIfNeeded(db: Database) {
  let changed = false;
  try {
    // Ensure shops table exists
    const shopsTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='shops';");
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
      const colNames = productTableInfo[0].values.map((col: unknown[]) => col[1] as string);
      if (!colNames.includes('min_stock_alert')) {
        db.run('ALTER TABLE products ADD COLUMN min_stock_alert INTEGER DEFAULT NULL;');
        changed = true;
      }
      if (!colNames.includes('unit')) {
        db.run("ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'pcs';");
        changed = true;
      }
    }

    const tableInfo = db.exec("PRAGMA table_info(sales);");
    if (tableInfo.length > 0 && tableInfo[0].values) {
      const colNames = tableInfo[0].values.map((col: unknown[]) => col[1] as string);
      if (!colNames.includes('customer_name')) {
        db.run('ALTER TABLE sales ADD COLUMN customer_name TEXT;');
        changed = true;
      }
      if (!colNames.includes('customer_phone')) {
        db.run('ALTER TABLE sales ADD COLUMN customer_phone TEXT;');
        changed = true;
      }
    }

    // Ensure expenses table exists
    const expensesTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='expenses';");
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
    }

    // Ensure staff table exists
    const staffTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='staff';");
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
    const salaryTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='salary_payments';");
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
  } catch (e) {
    console.error('Database migration error:', e);
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
        dbInstance.run('PRAGMA foreign_keys = ON;');
        const migrated = migrateDatabaseIfNeeded(dbInstance);
        if (migrated) {
          await persistCurrentDatabase();
        }
      } else {
        dbInstance = new SQL.Database();
        dbInstance.run('PRAGMA foreign_keys = ON;');
        dbInstance.run(SCHEMA_SQL);
        seedInitialData(dbInstance);
        await persistCurrentDatabase();
      }

      return dbInstance;
    } catch (err) {
      console.error('Failed to initialize SQLite engine:', err);
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
    console.error('Error persisting database:', err);
  }
}

/**
 * Execute a query with parameters and return array of objects
 */
export function query<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): T[] {
  if (!dbInstance) {
    throw new Error('Database not initialized. Await getDatabase() before querying.');
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
  params: (string | number | boolean | null)[] = []
): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a single mutating statement
 */
export function run(
  sql: string,
  params: (string | number | boolean | null)[] = []
): void {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }

  if (params.length > 0) {
    dbInstance.run(sql, params as SqlValue[]);
  } else {
    dbInstance.run(sql);
  }

  // Only persist and notify subscribers if not in the middle of a transaction
  if (transactionDepth === 0) {
    persistCurrentDatabase();
    notifyDbChanged();
  }
}

/**
 * Run operations within a transaction.
 * Supports nesting via SQLite SAVEPOINTs.
 * If any error is thrown, the transaction/savepoint is automatically rolled back.
 */
export function transaction<T>(fn: () => T): T {
  if (!dbInstance) {
    throw new Error('Database not initialized');
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
        !msg.includes('no transaction is active') &&
        !msg.includes('no such savepoint') &&
        !msg.includes('cannot rollback')
      ) {
        console.error('Failed to rollback transaction:', msg);
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
    throw new Error('Database not initialized');
  }
  return dbInstance.export();
}

/**
 * Import a binary SQLite database and replace the current state
 */
export async function importDatabase(binaryData: Uint8Array): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  const newDb = new SQL.Database(binaryData);
  newDb.run('PRAGMA foreign_keys = ON;');
  
  // Quick sanity check to ensure it has our tables
  const test = newDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
  if (test.length === 0 || test[0].values.length === 0) {
    throw new Error('Invalid database: products table missing.');
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
