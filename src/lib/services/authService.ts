/**
 * Authentication & Shop Management Service
 * Manages shop registration, password security, session persistence,
 * and test data seeding control for offline-first retail operations.
 */
import { Shop, RegisterShopInput, LoginInput } from "../../types/index.ts";
import { query, queryOne, run } from "../db/sqliteEngine.ts";
import { STORAGE_KEYS } from "../../constants/index.ts";

const ACTIVE_SHOP_STORAGE_KEY = STORAGE_KEYS.ACTIVE_SHOP_ID;

/**
 * Computes SHA-256 cryptographic hash using browser Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getShopById(id: number): Shop | null {
  return queryOne<Shop>(
    `SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active,
            subscription_status, subscription_plan, subscribed_date,
            COALESCE(subscription_duration_days, 365) as subscription_duration_days,
            subscription_expiry_date,
            created_at, updated_at
     FROM shops WHERE id = ?`,
    [id],
  );
}

export function getAllShops(): Shop[] {
  return query<Shop>(
    `SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active,
            subscription_status, subscription_plan, subscribed_date,
            COALESCE(subscription_duration_days, 365) as subscription_duration_days,
            subscription_expiry_date,
            created_at, updated_at
     FROM shops ORDER BY created_at DESC`,
  );
}

export function getShopsCount(): number {
  try {
    const res = queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM shops",
    );
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
  const shopType = (input.shop_type || "General Retail").trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const currencySymbol = input.currency_symbol?.trim() || "Rs.";

  if (!name) {
    throw new Error("Shop name is required.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("A valid email address is required.");
  }
  if (!password || password.length < 4) {
    throw new Error("Password must be at least 4 characters long.");
  }

  // Check for duplicate email
  const existing = queryOne<{ id: number }>(
    "SELECT id FROM shops WHERE LOWER(email) = LOWER(?)",
    [email],
  );
  if (existing) {
    throw new Error(
      "A shop with this email address is already registered. Please log in instead.",
    );
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const nowIso = now.toISOString();
  const subscribedDate = nowIso.split("T")[0];
  const durationDays = 365;
  const expDateObj = new Date(
    now.getTime() + durationDays * 24 * 60 * 60 * 1000,
  );
  const expiryDate = expDateObj.toISOString().split("T")[0];

  // Create shop in SQLite with 365-day active subscription
  run(
    `INSERT INTO shops (name, email, password_hash, phone, shop_type, address, currency_symbol, is_active,
                        subscription_status, subscription_plan, subscribed_date, subscription_duration_days, subscription_expiry_date,
                        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', 'Standard', ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      passwordHash,
      phone,
      shopType,
      address,
      currencySymbol,
      subscribedDate,
      durationDays,
      expiryDate,
      nowIso,
      nowIso,
    ],
  );

  const idRes = queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
  const shopId = idRes?.id ?? 0;
  const shop = getShopById(shopId);
  if (!shop) {
    throw new Error("Failed to retrieve registered shop.");
  }

  // Update app_settings with shop identity
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [name],
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [email],
  );
  if (phone) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_phone', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [phone],
    );
  }
  if (address) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_address', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [address],
    );
  }
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_type', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shopType],
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('currency_symbol', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [currencySymbol],
  );
  if (input.enable_vat !== undefined) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('enable_vat', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [input.enable_vat ? "true" : "false"],
    );
  }
  if (input.store_pan_vat) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_pan_vat', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [input.store_pan_vat.trim()],
    );
  }

  // Store active session in localStorage
  try {
    localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, String(shop.id));
  } catch {
    // Ignore storage issues in private modes
  }

  return shop;
}

// const API_URL =
//   ((import.meta as any).env?.VITE_API_URL as string) ||
//   "http://localhost:4000/api/v1";

const API_URL = "https://backend-4uk0.onrender.com/api/v1";

interface ApiLoginResponse {
  success: boolean;
  message?: string;
  data: {
    token: string;
    tokenType: string;
    client: {
      id: string;
      email: string;
      name: string;
      phone?: string;
      shopName?: string;
      shopType?: string;
      address?: string;
      currencySymbol?: string;
      status: string;
      subscription: {
        plan: string;
        status: string;
        startDate: string;
        durationDays: number;
        expiryDate: string;
      };
      createdAt: string;
      updatedAt: string;
    };
  };
}

/**
 * Synchronize local SQLite app settings with the active shop's profile
 */
function syncAppSettings(shop: Shop) {
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.name],
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.email],
  );
  if (shop.phone) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_phone', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.phone],
    );
  }
  if (shop.address) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_address', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.address],
    );
  }
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_type', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.shop_type],
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('currency_symbol', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.currency_symbol || "Rs."],
  );
}

/**
 * Attempt to authenticate client with remote backend API
 * Sends request to POST /api/v1/clients/login (Firebase Auth + Firestore clients collection)
 */
async function authenticateWithApi(
  emailOrPhone: string,
  password: string,
): Promise<ApiLoginResponse["data"] | null> {
  try {
    const res = await fetch(`${API_URL}/clients/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailOrPhone, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg =
        data?.message || data?.error || "Invalid email, phone, or password";
      throw new Error(msg);
    }
    return data.data;
  } catch (err: any) {
    // If it's a network error (server offline/no internet), return null to permit offline local login fallback
    if (
      err.name === "TypeError" &&
      (err.message.includes("fetch") ||
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Load failed") ||
        err.message.includes("network"))
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Log in to an existing shop using email or phone + password.
 * Flow:
 * 1. Validates credentials against backend client login API (checks Firebase user & clients collection in Firestore).
 * 2. On successful API response:
 *    - If the shop record exists in local SQLite, updates it with the latest data and password hash.
 *    - If the shop record does NOT exist in local SQLite, inserts it.
 * 3. Falls back to local credentials only if server is unreachable (offline mode).
 */
export async function loginShop(input: LoginInput): Promise<Shop> {
  const term = input.emailOrPhone.trim();
  const password = input.password.trim();

  if (!term) {
    throw new Error("Please enter your shop email or phone number.");
  }
  if (!password) {
    throw new Error("Please enter your password.");
  }

  const computedHash = await hashPassword(password);

  // 1. Authenticate with backend client login API first
  const apiData = await authenticateWithApi(term, password);

  // When API authentication succeeded:
  if (apiData && apiData.client) {
    const client = apiData.client;

    // Save remote auth token
    if (apiData.token) {
      try {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, apiData.token);
      } catch {}
    }

    const clientEmail = (client.email || (term.includes("@") ? term : ""))
      .toLowerCase()
      .trim();
    const clientPhone =
      client.phone?.trim() || (!term.includes("@") ? term : null);

    // Check if client already exists in local SQLite database
    const existingShop = queryOne<Shop>(
      `SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active,
              subscription_status, subscription_plan, subscribed_date,
              COALESCE(subscription_duration_days, 365) as subscription_duration_days,
              subscription_expiry_date, created_at, updated_at
       FROM shops
       WHERE (LOWER(email) = LOWER(?) AND email != '') OR (phone IS NOT NULL AND phone != '' AND phone = ?)`,
      [clientEmail, clientPhone || ""],
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const shopName = client.shopName || client.name || "My Retail Shop";
    const shopType = client.shopType || "General Retail";
    const address = client.address || null;
    const currencySymbol = client.currencySymbol || "Rs.";
    const subStatus = client.subscription?.status || "active";
    const subPlan = client.subscription?.plan || "Standard";
    const durationDays = client.subscription?.durationDays || 365;
    const subscribedDate =
      client.subscription?.startDate?.split("T")[0] || nowIso.split("T")[0];
    const expiryDate =
      client.subscription?.expiryDate?.split("T")[0] ||
      new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

    let shop: Shop | null = null;

    if (existingShop) {
      // 2a. Record exists locally -> UPDATE with response from API
      run(
        `UPDATE shops
         SET name = ?,
             email = ?,
             password_hash = ?,
             phone = ?,
             shop_type = ?,
             address = ?,
             currency_symbol = ?,
             subscription_status = ?,
             subscription_plan = ?,
             subscribed_date = ?,
             subscription_duration_days = ?,
             subscription_expiry_date = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          shopName,
          clientEmail || existingShop.email,
          computedHash,
          clientPhone || existingShop.phone,
          shopType,
          address || existingShop.address,
          currencySymbol,
          subStatus,
          subPlan,
          subscribedDate,
          durationDays,
          expiryDate,
          nowIso,
          existingShop.id,
        ],
      );

      shop = getShopById(existingShop.id);
    } else {
      // 2b. Record does NOT exist locally -> INSERT new shop record
      run(
        `INSERT INTO shops (name, email, password_hash, phone, shop_type, address, currency_symbol, is_active,
                            subscription_status, subscription_plan, subscribed_date, subscription_duration_days, subscription_expiry_date,
                            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          shopName,
          clientEmail,
          computedHash,
          clientPhone,
          shopType,
          address,
          currencySymbol,
          subStatus,
          subPlan,
          subscribedDate,
          durationDays,
          expiryDate,
          client.createdAt || nowIso,
          client.updatedAt || nowIso,
        ],
      );

      const idRes = queryOne<{ id: number }>(
        "SELECT last_insert_rowid() as id",
      );
      const newShopId = idRes?.id ?? 0;
      shop = getShopById(newShopId);
    }

    if (!shop) {
      throw new Error(
        "Failed to initialize or update shop record in local database.",
      );
    }

    // Synchronize app settings with active shop
    syncAppSettings(shop);

    try {
      localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, String(shop.id));
    } catch {}

    return shop;
  }

  // 3. Fallback for Offline Mode (Network unreachable)
  // If authenticateWithApi returned null due to network error, check local DB
  const localShop = queryOne<
    Shop & {
      password_hash: string;
    }
  >(
    `SELECT id, name, email, phone, shop_type, address, currency_symbol, is_active,
            subscription_status, subscription_plan, subscribed_date,
            COALESCE(subscription_duration_days, 365) as subscription_duration_days,
            subscription_expiry_date, password_hash, created_at, updated_at
     FROM shops
     WHERE LOWER(email) = LOWER(?) OR phone = ?`,
    [term, term],
  );

  if (localShop && localShop.password_hash === computedHash) {
    const shop = getShopById(localShop.id) || localShop;
    syncAppSettings(shop);
    try {
      localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, String(shop.id));
    } catch {}
    return shop;
  }

  throw new Error(
    "Unable to connect to the authentication server, and no matching local shop credentials were found.",
  );
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
export async function logoutShop(): Promise<void> {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  if (token) {
    try {
      await fetch(`${API_URL}/clients/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore network errors on logout
    }
  }

  try {
    localStorage.removeItem(ACTIVE_SHOP_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
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
    [shop.name],
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.email],
  );
  if (shop.phone) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_phone', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.phone],
    );
  }
  if (shop.address) {
    run(
      `INSERT INTO app_settings (key, value) VALUES ('store_address', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [shop.address],
    );
  }
  run(
    `INSERT INTO app_settings (key, value) VALUES ('store_type', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.shop_type],
  );
  run(
    `INSERT INTO app_settings (key, value) VALUES ('currency_symbol', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [shop.currency_symbol || "Rs."],
  );

  return shop;
}

/**
 * Checks if a shop's subscription has expired
 */
export function isSubscriptionExpired(shop: Shop | null | undefined): boolean {
  if (!shop) return false;
  if (shop.subscription_status === "expired") return true;
  if (shop.subscription_expiry_date) {
    const expTime = new Date(shop.subscription_expiry_date).getTime();
    if (!isNaN(expTime) && expTime < Date.now()) {
      return true;
    }
  }
  return false;
}

/**
 * Calculates remaining days in active subscription (0 if expired)
 */
export function getSubscriptionDaysRemaining(
  shop: Shop | null | undefined,
): number {
  if (!shop || !shop.subscription_expiry_date) return 0;
  const expTime = new Date(
    shop.subscription_expiry_date + "T23:59:59",
  ).getTime();
  const validExp = isNaN(expTime)
    ? new Date(shop.subscription_expiry_date).getTime()
    : expTime;
  if (isNaN(validExp)) return 0;
  const diffMs = validExp - Date.now();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

/**
 * Updates subscription details for a shop
 */
export function updateShopSubscription(
  shopId: number,
  details: {
    subscription_status?: Shop["subscription_status"];
    subscription_plan?: string;
    subscribed_date?: string;
    subscription_duration_days?: number;
    subscription_duration_months?: number;
    subscription_expiry_date?: string;
  },
): Shop | null {
  const current = getShopById(shopId);
  if (!current) return null;

  const status =
    details.subscription_status ?? current.subscription_status ?? "active";
  const plan =
    details.subscription_plan ?? current.subscription_plan ?? "Standard";
  const subDate =
    details.subscribed_date ??
    current.subscribed_date ??
    new Date().toISOString().split("T")[0];
  const duration =
    details.subscription_duration_days ??
    (details.subscription_duration_months
      ? details.subscription_duration_months * 30
      : (current.subscription_duration_days ?? 365));
  const expiryDate =
    details.subscription_expiry_date ?? current.subscription_expiry_date ?? "";
  const nowIso = new Date().toISOString();

  run(
    `UPDATE shops
     SET subscription_status = ?,
         subscription_plan = ?,
         subscribed_date = ?,
         subscription_duration_days = ?,
         subscription_expiry_date = ?,
         updated_at = ?
     WHERE id = ?`,
    [status, plan, subDate, duration, expiryDate, nowIso, shopId],
  );

  return getShopById(shopId);
}
