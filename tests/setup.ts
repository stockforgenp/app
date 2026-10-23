/**
 * Test Environment Setup for StockForge
 * - Configures Node.js ESM loader for sql.js wasm
 * - Mocks browser localStorage & Web Crypto API if needed
 * - Provides helpers to create clean in-memory database instances for tests
 */

import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Register wasm resolution hook so sql.js loads without browser bundling errors
const wasmPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/sql.js/dist/sql-wasm.wasm",
);

const loaderCode = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes('?url') || specifier.endsWith('.wasm')) {
    return {
      url: 'data:text/javascript,export default "${wasmPath.replace(/\\/g, "/")}";',
      format: 'module',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;

try {
  register("data:text/javascript," + encodeURIComponent(loaderCode));
} catch {
  // Loader might already be registered in multi-test execution
}

// In-memory mock for localStorage
class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }
}

if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = new LocalStorageMock();
}

/**
 * Resets the in-memory test database and clears localStorage session
 */
export async function setupTestEnvironment() {
  localStorage.clear();
  const { resetDatabase, getDatabase } =
    await import("../src/lib/db/sqliteEngine.ts");
  await resetDatabase();
  const db = await getDatabase();
  return db;
}
