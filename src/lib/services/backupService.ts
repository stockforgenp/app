/**
 * Database Backup, Restore, Telemetry & Maintenance Service
 * StockForge Offline Desktop & Web POS
 */
import {
  exportDatabaseToSql,
  exportDatabase,
  importDatabaseFromSql,
  importDatabase,
  resetDatabase,
} from '../db/sqliteEngine.ts';
import { getProductCount } from './productService.ts';
import { getSalesCount } from './salesService.ts';
import { getPurchasesCount } from './purchaseService.ts';
import { getExpensesCount } from './expenseService.ts';
import { getStaffCount } from './staffService.ts';

export interface DatabaseStats {
  products: number;
  sales: number;
  purchases: number;
  expenses: number;
  staff: number;
}

/**
 * Retrieve live database record counts across core entities for telemetry and health check.
 */
export function getDatabaseStats(): DatabaseStats {
  return {
    products: getProductCount(),
    sales: getSalesCount(),
    purchases: getPurchasesCount(),
    expenses: getExpensesCount(),
    staff: getStaffCount(),
  };
}

/**
 * Generate a complete, human-readable SQL dump containing schema DDL and row INSERT statements.
 */
export function exportSqlDump(): string {
  return exportDatabaseToSql();
}

/**
 * Export raw binary SQLite database bytes for complete low-level file snapshots.
 */
export function exportBinaryFile(): Uint8Array {
  return exportDatabase();
}

/**
 * Restore database state from a raw SQL dump script.
 */
export async function importSqlDump(sqlContent: string): Promise<void> {
  return importDatabaseFromSql(sqlContent);
}

/**
 * Restore database state from binary SQLite bytes.
 */
export async function importBinaryFile(data: Uint8Array): Promise<void> {
  return importDatabase(data);
}

/**
 * Wipe all business transactional data while preserving core shop credentials and schema structure.
 */
export async function resetDatabaseRecords(): Promise<void> {
  return resetDatabase();
}
