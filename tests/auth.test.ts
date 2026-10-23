/**
 * Feature 1 Test: Login & Authentication Suite
 * Tests:
 * 1. SHA-256 password hashing integrity
 * 2. Shop Registration & input validation (name, email, password length, duplicate email prevention)
 * 3. Default active 365-day subscription provisioning on registration
 * 4. Automatic app_settings synchronization with registered shop profile
 * 5. API Login Sync with Demo Account (john@demo.com / password):
 *    - Authenticates against remote backend API
 *    - Saves JWT auth token to localStorage
 *    - Inserts new shop in local SQLite with synced profile & subscription
 *    - Synchronizes app_settings with shop identity
 *    - Establishes active session in localStorage
 * 6. API Login Sync updates existing local shop (plan, duration, address, password hash)
 * 7. API Login rejection on invalid credentials with remote error message
 * 8. Offline fallback: authenticates via local password hash when network is unreachable
 * 9. Offline rejection when no matching local credentials exist
 * 10. Local phone number login in offline mode
 * 11. switchShop switches active session between registered shops
 * 12. logoutShop clears active shop session and removes remote auth token
 * 13. updateShopSubscription updates subscription plan, days and status
 * 14. isSubscriptionExpired and getSubscriptionDaysRemaining calculate accurately
 * 15. getAllShops and getShopsCount return complete multi-shop registry
 */

import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setupTestEnvironment } from "./setup.ts";

// Dynamically import after setup has registered the wasm loader and localStorage
const {
  hashPassword,
  registerShop,
  loginShop,
  getShopById,
  getAllShops,
  getShopsCount,
  getCurrentShop,
  logoutShop,
  switchShop,
  updateShopSubscription,
  isSubscriptionExpired,
  getSubscriptionDaysRemaining,
} = await import("../src/lib/services/authService.ts");

const { queryOne, query, run } = await import("../src/lib/db/sqliteEngine.ts");
const { STORAGE_KEYS } = await import("../src/constants/storage.ts");

// Helper to create test registration input with defaults
function makeRegisterInput(
  overrides: Partial<import("../src/types/index.ts").RegisterShopInput> = {},
): import("../src/types/index.ts").RegisterShopInput {
  return {
    name: "Sample Shop",
    email: `shop_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
    password: "securePassword123",
    shop_type: "General Retail",
    currency_symbol: "Rs.",
    ...overrides,
  };
}

// Demo client response payload modeled directly from https://backend-4uk0.onrender.com/api/v1/clients/login
const DEMO_API_LOGIN_RESPONSE = {
  success: true,
  message: "Client logged in successfully",
  data: {
    token: "demo-jwt-token-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    tokenType: "Bearer",
    client: {
      id: "0MRWCE9fYRhT3aW27WIyYaYUpBu1",
      email: "john@demo.com",
      name: "John Doe",
      phone: "+9779876543210",
      shopName: "Demo Store",
      shopType: "Grocery & Supermarket",
      address: "Birgunj, Nepal",
      currencySymbol: "Rs.",
      subscription: {
        plan: "trial",
        status: "trial",
        startDate: "2026-10-15T18:07:58.457Z",
        durationDays: 30,
        expiryDate: "2026-11-14T18:07:58.457Z",
        autoRenew: false,
      },
      createdAt: "2026-10-15T18:07:58.457Z",
      status: "active",
      updatedAt: "2026-10-15T18:31:40.931Z",
    },
    subscriptionStatus: {
      status: "trial",
      plan: "trial",
      expiryDate: "2026-11-14T18:07:58.457Z",
      daysRemaining: 23,
      isExpired: false,
    },
  },
};

describe("Feature 1: Login & Shop Authentication", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await setupTestEnvironment();

    // Default mock fetch interceptor for backend client login API
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/clients/login")) {
        let body: { email?: string; password?: string } = {};
        if (init?.body) {
          try {
            body = JSON.parse(init.body as string);
          } catch {}
        }

        // Demo user check
        if (body.email === "john@demo.com" && body.password === "password") {
          return new Response(JSON.stringify(DEMO_API_LOGIN_RESPONSE), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Invalid credentials response
        return new Response(
          JSON.stringify({
            success: false,
            message: "Invalid email, phone, or password",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.includes("/clients/logout")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Fallback for unmocked requests: treat as network unreachable
      throw new TypeError("Failed to fetch");
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("1. hashPassword produces valid 64-character SHA-256 hex string", async () => {
    const hash1 = await hashPassword("password123");
    const hash2 = await hashPassword("password123");
    const hash3 = await hashPassword("differentPassword");

    assert.equal(typeof hash1, "string");
    assert.equal(hash1.length, 64, "SHA-256 hex output must be 64 characters");
    assert.equal(
      hash1,
      hash2,
      "Identical passwords must produce identical hashes",
    );
    assert.notEqual(
      hash1,
      hash3,
      "Different passwords must produce distinct hashes",
    );
  });

  test("2. registerShop successfully creates a new shop with initial active session", async () => {
    const shop = await registerShop({
      name: "Birgunj Mart",
      email: "birgunj.mart@example.com",
      password: "securePassword2026",
      phone: "9801234567",
      shop_type: "Supermarket",
      address: "Adarshnagar, Birgunj",
      currency_symbol: "Rs.",
    });

    assert.ok(shop.id > 0, "Shop should be assigned an auto-increment ID");
    assert.equal(shop.name, "Birgunj Mart");
    assert.equal(shop.email, "birgunj.mart@example.com");
    assert.equal(shop.phone, "9801234567");
    assert.equal(shop.shop_type, "Supermarket");
    assert.equal(shop.address, "Adarshnagar, Birgunj");
    assert.equal(shop.currency_symbol, "Rs.");
    assert.equal(shop.subscription_status, "active");
    assert.equal(shop.subscription_plan, "Standard");
    assert.equal(shop.subscription_duration_days, 365);

    // Verify password hash in database is not stored in plaintext
    const dbRow = queryOne<{ password_hash: string }>(
      "SELECT password_hash FROM shops WHERE id = ?",
      [shop.id],
    );
    assert.ok(dbRow, "Shop record must exist in database");
    assert.notEqual(dbRow.password_hash, "securePassword2026");
    assert.equal(dbRow.password_hash.length, 64);

    // Verify app_settings was synchronized
    const storeNameSetting = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_name'",
    );
    assert.equal(storeNameSetting?.value, "Birgunj Mart");

    const storeEmailSetting = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_email'",
    );
    assert.equal(storeEmailSetting?.value, "birgunj.mart@example.com");
  });

  test("3. registerShop rejects invalid inputs", async () => {
    // Missing name
    await assert.rejects(
      async () => {
        await registerShop(
          makeRegisterInput({
            name: "   ",
            email: "valid@example.com",
            password: "pass",
          }),
        );
      },
      { message: "Shop name is required." },
    );

    // Invalid email
    await assert.rejects(
      async () => {
        await registerShop(
          makeRegisterInput({
            name: "Valid Name",
            email: "not-an-email",
            password: "pass",
          }),
        );
      },
      { message: "A valid email address is required." },
    );

    // Short password (< 4 characters)
    await assert.rejects(
      async () => {
        await registerShop(
          makeRegisterInput({
            name: "Valid Name",
            email: "test@example.com",
            password: "123",
          }),
        );
      },
      { message: "Password must be at least 4 characters long." },
    );
  });

  test("4. registerShop prevents duplicate email registrations", async () => {
    await registerShop(
      makeRegisterInput({
        name: "First Store",
        email: "owner@pokhariya.com",
        password: "password123",
      }),
    );

    await assert.rejects(async () => {
      await registerShop(
        makeRegisterInput({
          name: "Second Store Same Email",
          email: "OWNER@pokhariya.com", // Case-insensitive check
          password: "anotherPassword",
        }),
      );
    }, /already registered/);
  });

  test("5. loginShop authenticates via remote API with demo user (john@demo.com / password) and syncs to SQLite", async () => {
    // Fresh database has no shop records
    assert.equal(getShopsCount(), 0);
    assert.equal(getCurrentShop(), null);

    // Execute API login using demo credentials
    const shop = await loginShop({
      emailOrPhone: "john@demo.com",
      password: "password",
    });

    // 1. Verify returned shop data synced from remote API
    assert.ok(shop.id > 0, "Synced shop must have a local SQLite ID");
    assert.equal(shop.name, "Demo Store");
    assert.equal(shop.email, "john@demo.com");
    assert.equal(shop.phone, "+9779876543210");
    assert.equal(shop.shop_type, "Grocery & Supermarket");
    assert.equal(shop.address, "Birgunj, Nepal");
    assert.equal(shop.currency_symbol, "Rs.");
    assert.equal(shop.subscription_status, "trial");
    assert.equal(shop.subscription_plan, "trial");
    assert.equal(shop.subscription_duration_days, 30);
    assert.equal(shop.subscription_expiry_date, "2026-11-14");

    // 2. Verify local SQLite shops table row
    const localShop = getShopById(shop.id);
    assert.ok(localShop);
    assert.equal(localShop.name, "Demo Store");
    assert.equal(getShopsCount(), 1);

    // 3. Verify remote auth token stored in localStorage
    const savedToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    assert.equal(
      savedToken,
      "demo-jwt-token-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    );

    // 4. Verify app_settings synchronized with the active shop profile
    const nameSetting = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_name'",
    );
    assert.equal(nameSetting?.value, "Demo Store");

    const emailSetting = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_email'",
    );
    assert.equal(emailSetting?.value, "john@demo.com");

    const phoneSetting = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_phone'",
    );
    assert.equal(phoneSetting?.value, "+9779876543210");

    const addressSetting = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_address'",
    );
    assert.equal(addressSetting?.value, "Birgunj, Nepal");

    // 5. Verify active session retrieval
    const current = getCurrentShop();
    assert.ok(current);
    assert.equal(current.id, shop.id);
  });

  test("6. loginShop updates existing local shop when synced with remote API login", async () => {
    // Pre-seed an existing shop in SQLite with older local info
    const initialShop = await registerShop({
      name: "Old Local Store",
      email: "john@demo.com",
      password: "temporaryPassword",
      phone: "+9779876543210",
      shop_type: "Local Retail",
      address: "Old Address",
      currency_symbol: "Rs.",
    });

    assert.equal(getShopsCount(), 1);
    assert.equal(initialShop.name, "Old Local Store");

    // Now log in with API demo credentials
    const updatedShop = await loginShop({
      emailOrPhone: "john@demo.com",
      password: "password",
    });

    // Verify it updated the existing record without inserting a duplicate
    assert.equal(getShopsCount(), 1);
    assert.equal(updatedShop.id, initialShop.id);
    assert.equal(updatedShop.name, "Demo Store");
    assert.equal(updatedShop.shop_type, "Grocery & Supermarket");
    assert.equal(updatedShop.address, "Birgunj, Nepal");
    assert.equal(updatedShop.subscription_status, "trial");
    assert.equal(updatedShop.subscription_plan, "trial");
    assert.equal(updatedShop.subscription_duration_days, 30);

    // Verify app_settings updated
    const nameSetting = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_name'",
    );
    assert.equal(nameSetting?.value, "Demo Store");
  });

  test("7. loginShop rejects invalid credentials from remote API", async () => {
    // API returns 401 on wrong password
    await assert.rejects(
      async () => {
        await loginShop({
          emailOrPhone: "john@demo.com",
          password: "wrong_password",
        });
      },
      { message: "Invalid email, phone, or password" },
    );
  });

  test("8. loginShop falls back to local offline mode when server is unreachable", async () => {
    // Simulate network outage
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    // Pre-register shop in offline database
    await registerShop(
      makeRegisterInput({
        name: "Pokhariya Agro Traders",
        email: "agro@pokhariya.np",
        password: "agroPassword1",
        phone: "9845000000",
      }),
    );

    localStorage.clear();
    assert.equal(getCurrentShop(), null);

    // Offline login succeeds using local SQLite password hash
    const loggedIn = await loginShop({
      emailOrPhone: "agro@pokhariya.np",
      password: "agroPassword1",
    });

    assert.equal(loggedIn.name, "Pokhariya Agro Traders");
    assert.equal(loggedIn.email, "agro@pokhariya.np");
    assert.ok(getCurrentShop());
  });

  test("9. loginShop rejects offline login if no local matching credentials exist", async () => {
    // Simulate network outage
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    await assert.rejects(
      async () => {
        await loginShop({
          emailOrPhone: "unknown@example.com",
          password: "anyPassword",
        });
      },
      {
        message:
          "Unable to connect to the authentication server, and no matching local shop credentials were found.",
      },
    );
  });

  test("10. loginShop authenticates via phone number in local offline mode", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    await registerShop(
      makeRegisterInput({
        name: "Laxmi General Store",
        email: "laxmi@birgunj.np",
        password: "laxmiPass2026",
        phone: "9807654321",
      }),
    );

    localStorage.clear();

    const loggedIn = await loginShop({
      emailOrPhone: "9807654321",
      password: "laxmiPass2026",
    });

    assert.equal(loggedIn.name, "Laxmi General Store");
    assert.equal(loggedIn.phone, "9807654321");
  });

  test("11. switchShop switches active session between registered shops", async () => {
    const shopA = await registerShop(
      makeRegisterInput({
        name: "Shop Alpha",
        email: "alpha@mart.np",
        password: "passwordA",
      }),
    );

    const shopB = await registerShop(
      makeRegisterInput({
        name: "Shop Beta",
        email: "beta@mart.np",
        password: "passwordB",
      }),
    );

    assert.equal(getCurrentShop()?.id, shopB.id);

    // Switch back to Shop Alpha
    const switched = switchShop(shopA.id);
    assert.equal(switched?.id, shopA.id);
    assert.equal(getCurrentShop()?.id, shopA.id);

    // Verify settings updated to Shop Alpha
    const storeName = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'store_name'",
    );
    assert.equal(storeName?.value, "Shop Alpha");

    // Reject non-existent shop id by returning null
    const invalidSwitch = switchShop(999999);
    assert.equal(invalidSwitch, null);
  });

  test("12. logoutShop clears active shop session and removes remote auth token", async () => {
    // Log in via API demo account
    await loginShop({
      emailOrPhone: "john@demo.com",
      password: "password",
    });

    assert.ok(getCurrentShop() !== null);
    assert.ok(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) !== null);

    await logoutShop();

    assert.equal(getCurrentShop(), null);
    assert.equal(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN), null);
  });

  test("13. updateShopSubscription updates subscription plan, days and status", async () => {
    const initialShop = await registerShop(
      makeRegisterInput({
        name: "Subscription Plan Shop",
        email: "plan@store.np",
        password: "password123",
        phone: "9800000000",
      }),
    );

    const updated = updateShopSubscription(initialShop.id, {
      subscription_status: "active",
      subscription_plan: "Enterprise Pro",
      subscription_duration_days: 730,
      subscription_expiry_date: "2028-10-23",
    });

    assert.ok(updated);
    assert.equal(updated?.subscription_plan, "Enterprise Pro");
    assert.equal(updated?.subscription_duration_days, 730);
    assert.equal(updated?.subscription_expiry_date, "2028-10-23");

    // Retrieve via getShopById to verify database persistence
    const refreshed = getShopById(initialShop.id);
    assert.equal(refreshed?.subscription_plan, "Enterprise Pro");
  });

  test("14. isSubscriptionExpired and getSubscriptionDaysRemaining calculate accurately", async () => {
    const shop = await registerShop(
      makeRegisterInput({
        name: "Subscription Test Shop",
        email: "sub@test.np",
        password: "password123",
      }),
    );

    // Brand new shop has 365 days active
    assert.equal(isSubscriptionExpired(shop), false);
    const days = getSubscriptionDaysRemaining(shop);
    assert.ok(
      days >= 364 && days <= 366,
      `Expected ~365 remaining days, got: ${days}`,
    );

    // Create an expired shop fixture
    const expiredShop = {
      ...shop,
      subscription_status: "expired" as const,
      subscription_expiry_date: "2020-01-01",
    };
    assert.equal(isSubscriptionExpired(expiredShop), true);
    assert.equal(getSubscriptionDaysRemaining(expiredShop), 0);

    // Active shop with passed expiry date
    const dateExpiredShop = {
      ...shop,
      subscription_status: "active" as const,
      subscription_expiry_date: "2022-12-31",
    };
    assert.equal(isSubscriptionExpired(dateExpiredShop), true);
  });

  test("15. getAllShops and getShopsCount return complete multi-shop registry", async () => {
    assert.equal(getShopsCount(), 0);
    assert.equal(getAllShops().length, 0);

    await registerShop(
      makeRegisterInput({
        name: "Shop 1",
        email: "s1@test.com",
        password: "pass",
      }),
    );
    await registerShop(
      makeRegisterInput({
        name: "Shop 2",
        email: "s2@test.com",
        password: "pass",
      }),
    );
    await registerShop(
      makeRegisterInput({
        name: "Shop 3",
        email: "s3@test.com",
        password: "pass",
      }),
    );

    assert.equal(getShopsCount(), 3);
    const all = getAllShops();
    assert.equal(all.length, 3);
    assert.equal(
      all[0].name,
      "Shop 3",
      "Most recently created shop should be first (ORDER BY created_at DESC)",
    );
  });

  test("16. Real CRUD on Shops: INSERT into db, FETCH all columns, UPDATE shop record, and DELETE from db", async () => {
    // 1. CREATE / INSERT into db
    const registered = await registerShop({
      name: "Direct DB Mart",
      email: "directdb@mart.com",
      password: "password123",
      phone: "9811111111",
      shop_type: "Department Store",
      address: "Main Street, Pokhara",
      currency_symbol: "Rs.",
    });

    // 2. READ / FETCH directly from SQLite shops table
    const dbRow = queryOne<any>("SELECT * FROM shops WHERE id = ?", [registered.id]);
    assert.ok(dbRow, "Shop row must exist in SQLite database");
    assert.equal(dbRow.id, registered.id);
    assert.equal(dbRow.name, "Direct DB Mart");
    assert.equal(dbRow.email, "directdb@mart.com");
    assert.equal(dbRow.phone, "9811111111");
    assert.equal(dbRow.shop_type, "Department Store");
    assert.equal(dbRow.address, "Main Street, Pokhara");
    assert.equal(dbRow.currency_symbol, "Rs.");
    assert.equal(dbRow.is_active, 1);
    assert.equal(dbRow.subscription_status, "active");
    assert.equal(dbRow.subscription_plan, "Standard");
    assert.equal(dbRow.subscription_duration_days, 365);
    assert.ok(dbRow.created_at);
    assert.ok(dbRow.updated_at);

    // 3. UPDATE in SQLite database
    updateShopSubscription(registered.id, {
      subscription_plan: "Platinum VIP",
      subscription_status: "active",
      subscription_duration_days: 730,
      subscription_expiry_date: "2028-01-01",
    });
    run(
      "UPDATE shops SET name = ?, address = ?, phone = ? WHERE id = ?",
      ["Updated DB Mart", "Lakeside, Pokhara", "9822222222", registered.id]
    );

    // Fetch again from SQLite and verify update
    const updatedDbRow = queryOne<any>("SELECT * FROM shops WHERE id = ?", [registered.id]);
    assert.ok(updatedDbRow);
    assert.equal(updatedDbRow.name, "Updated DB Mart");
    assert.equal(updatedDbRow.address, "Lakeside, Pokhara");
    assert.equal(updatedDbRow.phone, "9822222222");
    assert.equal(updatedDbRow.subscription_plan, "Platinum VIP");
    assert.equal(updatedDbRow.subscription_duration_days, 730);
    assert.equal(updatedDbRow.subscription_expiry_date, "2028-01-01");

    // 4. DELETE from SQLite database
    run("DELETE FROM shops WHERE id = ?", [registered.id]);

    const deletedDbRow = queryOne("SELECT * FROM shops WHERE id = ?", [registered.id]);
    assert.equal(deletedDbRow, null, "Shop row must be deleted from database");
    assert.equal(getShopById(registered.id), null);
  });
});
