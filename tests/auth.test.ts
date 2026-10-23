/**
 * Feature 1 Test: Login & Authentication Suite
 * Tests:
 * 1. SHA-256 password hashing integrity
 * 2. Shop Registration & input validation (name, email, password length, duplicate email prevention)
 * 3. Default active 365-day subscription provisioning on registration
 * 4. Automatic app_settings synchronization with registered shop profile
 * 5. Local Login with valid email & password
 * 6. Local Login with valid phone number & password
 * 7. Invalid credentials rejection (wrong password, non-existent user, empty fields)
 * 8. Session retrieval via getCurrentShop() and localStorage
 * 9. Switching active shop across multiple registered shops
 * 10. Logout & session cleanup
 * 11. Shop profile update and settings sync
 * 12. Subscription status verification & remaining days calculation
 */

import test, { describe, beforeEach } from "node:test";
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

const { queryOne } = await import("../src/lib/db/sqliteEngine.ts");

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

describe("Feature 1: Login & Shop Authentication", () => {
  beforeEach(async () => {
    await setupTestEnvironment();
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

  test("5. loginShop authenticates via email & password in local offline mode", async () => {
    await registerShop(
      makeRegisterInput({
        name: "Pokhariya Agro Traders",
        email: "agro@pokhariya.np",
        password: "agroPassword1",
        phone: "9845000000",
      }),
    );

    // Clear session to simulate fresh login
    localStorage.clear();
    assert.equal(getCurrentShop(), null);

    // Attempt login
    const loggedIn = await loginShop({
      emailOrPhone: "agro@pokhariya.np",
      password: "agroPassword1",
    });

    assert.equal(loggedIn.name, "Pokhariya Agro Traders");
    assert.equal(loggedIn.email, "agro@pokhariya.np");

    // Verify session persisted
    const current = getCurrentShop();
    assert.ok(current);
    assert.equal(current?.id, loggedIn.id);
  });

  test("6. loginShop authenticates via phone number in local offline mode", async () => {
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

  test("7. loginShop rejects invalid credentials", async () => {
    await registerShop(
      makeRegisterInput({
        name: "Test Mart",
        email: "testmart@example.com",
        password: "correctPassword",
      }),
    );

    // Wrong password
    await assert.rejects(async () => {
      await loginShop({
        emailOrPhone: "testmart@example.com",
        password: "wrongPassword",
      });
    }, /Unable to connect to the authentication server, and no matching local shop credentials were found/);

    // Non-existent email
    await assert.rejects(async () => {
      await loginShop({
        emailOrPhone: "nonexistent@example.com",
        password: "correctPassword",
      });
    }, /Unable to connect to the authentication server, and no matching local shop credentials were found/);

    // Missing fields
    await assert.rejects(
      async () => {
        await loginShop({
          emailOrPhone: "",
          password: "pass",
        });
      },
      { message: "Please enter your shop email or phone number." },
    );

    await assert.rejects(
      async () => {
        await loginShop({
          emailOrPhone: "test@example.com",
          password: "",
        });
      },
      { message: "Please enter your password." },
    );
  });

  test("8. switchShop switches active session between registered shops", async () => {
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

  test("9. logoutShop clears active shop session", async () => {
    await registerShop(
      makeRegisterInput({
        name: "Session Store",
        email: "session@store.com",
        password: "password123",
      }),
    );

    assert.ok(getCurrentShop() !== null);

    await logoutShop();

    assert.equal(getCurrentShop(), null);
  });

  test("10. updateShopSubscription updates subscription plan, days and status", async () => {
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

  test("11. isSubscriptionExpired and getSubscriptionDaysRemaining calculate accurately", async () => {
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

  test("12. getAllShops and getShopsCount return complete multi-shop registry", async () => {
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
});
