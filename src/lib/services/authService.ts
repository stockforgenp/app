/**
 * Authentication & Shop Management Service
 * Manages shop registration, password security, session persistence,
 * and test data seeding control for offline-first retail operations.
 */
import { Shop, RegisterShopInput, LoginInput } from '../../types/index.ts';
import { query, queryOne, run, getDatabase } from '../db/sqliteEngine.ts';
import { seedInitialData, clearAllTestData } from '../db/seed.ts';

const ACTIVE_SHOP_STORAGE_KEY = 'stockforge_active_shop_id';

/**
 * Computes SHA-256 cryptographic hash using browser Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getShopById(id: number): Shop | null {
  return queryOne<Shop>(
    `SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active, created_at, updated_at
     FROM shops WHERE id = ?`,
    [id]
  );
}

export function getAllShops(): Shop[] {
  return query<Shop>(
    `SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active, created_at, updated_at
     FROM shops ORDER BY created_at DESC`
  );
}

export function getShopsCount(): number {
  try {
    const res = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM shops');
    return res?.count || 0;
  } catch {
    return 0;
  }
}

/**
 * Register a new retail shop
 * Allows explicit control over whether to seed sample inventory & transactions
 */
export async function registerShop(input: RegisterShopInput): Promise<Shop> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const shopType = (input.shop_type || 'General Retail').trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const currencySymbol = input.currency_symbol?.trim() || 'Rs.';

  if (!name) {
    throw new Error('Shop name is required.');
  }
  if (!email || !email.includes('@')) {
    throw new Error('A valid email address is required.');
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  // Check for duplicate email
  const existing = queryOne<{ id: number }>('SELECT id FROM shops WHERE LOWER(email) = LOWER(?)', [
    email,
  ]);
  if (existing) {
    throw new Error('A shop with this email address is already registered. Please log in instead.');
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  // Create shop in SQLite
  run(
    `INSERT INTO shops (name, email, password_hash, phone, shop_type, address, currency_symbol, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [name, email, passwordHash, phone, shopType, address, currencySymbol, now, now]
  );

  const idRes = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  const shopId = idRes?.id ?? 0;
  const shop = getShopById(shopId);
  if (!shop) {
    throw new Error('Failed to retrieve registered shop.');
  }

  // Update app_settings with shop identity
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [name]
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [email]
  );
  if (phone) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_phone', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [phone]
    );
  }
  if (address) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_address', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [address]
    );
  }
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_type', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shopType]
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('currency_symbol', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [currencySymbol]
  );

  // Handle seed test data check
  const db = await getDatabase();
  if (input.seedTestData) {
    seedInitialData(db);
  } else {
    clearAllTestData(db);
  }

  // Store active session in localStorage
  try {
    localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, String(shop.id));
  } catch {
    // Ignore storage issues in private modes
  }

  return shop;
}

/**
 * Log in to an existing shop using email or phone + password
 */
export async function loginShop(input: LoginInput): Promise<Shop> {
  const term = input.emailOrPhone.trim();
  const password = input.password.trim();

  if (!term) {
    throw new Error('Please enter your shop email or phone number.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  const shopRow = queryOne<Shop & { password_hash: string }>(
    `SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active, password_hash, created_at, updated_at
     FROM shops
     WHERE LOWER(email) = LOWER(?) OR phone = ?`,
    [term, term]
  );

  if (!shopRow) {
    throw new Error('No registered shop found matching this email or phone number.');
  }

  const computedHash = await hashPassword(password);
  if (shopRow.password_hash !== computedHash) {
    throw new Error('Incorrect password. Please verify your credentials and try again.');
  }

  const shop: Shop = {
    id: shopRow.id,
    name: shopRow.name,
    email: shopRow.email,
    phone: shopRow.phone,
    shop_type: shopRow.shop_type,
    address: shopRow.address,
    currency_symbol: shopRow.currency_symbol,
    is_active: shopRow.is_active,
    created_at: shopRow.created_at,
    updated_at: shopRow.updated_at,
  };

  // Synchronize app settings with current shop
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.name]
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.email]
  );
  if (shop.phone) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_phone', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.phone]
    );
  }
  if (shop.address) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_address', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.address]
    );
  }
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_type', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.shop_type]
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('currency_symbol', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.currency_symbol || 'Rs.']
  );

  try {
    localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, String(shop.id));
  } catch {
    // Ignore storage issues
  }

  return shop;
}

/**
 * Returns currently logged-in shop if session is valid
 */
export function getCurrentShop(): Shop | null {
  try {
    const rawId = localStorage.getItem(ACTIVE_SHOP_STORAGE_KEY);
    if (!rawId) return null;
    const shopId = parseInt(rawId, 10);
    if (isNaN(shopId)) return null;
    return getShopById(shopId);
  } catch {
    return null;
  }
}

/**
 * Logs out the active shop
 */
export function logoutShop(): void {
  try {
    localStorage.removeItem(ACTIVE_SHOP_STORAGE_KEY);
  } catch {
    // Ignore storage issues
  }
}

/**
 * Switch active shop
 */
export function switchShop(shopId: number): Shop | null {
  const shop = getShopById(shopId);
  if (!shop) return null;

  try {
    localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, String(shop.id));
  } catch {
    // Ignore storage issues
  }

  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.name]
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.email]
  );
  if (shop.phone) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_phone', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.phone]
    );
  }
  if (shop.address) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_address', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.address]
    );
  }
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_type', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.shop_type]
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('currency_symbol', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.currency_symbol || 'Rs.']
  );

  return shop;
}

/**
 * Creates or retrieves a standard demo shop for instant 1-click test exploration
 */
export async function seedDemoShopIfEmpty(): Promise<Shop> {
  const existing = queryOne<Shop>(
    "SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active, created_at, updated_at FROM shops WHERE email = 'demo@stockforge.pos'"
  );
  if (existing) {
    try {
      localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, String(existing.id));
    } catch {
      // Ignore
    }
    return existing;
  }

  return registerShop({
    name: 'StockForge Demo Retail',
    email: 'demo@stockforge.pos',
    password: 'demo',
    phone: '+977 9801234567',
    shop_type: 'Grocery & Supermarket',
    address: 'Commercial Avenue, Kathmandu',
    currency_symbol: 'रु.',
    seedTestData: true,
  });
}
