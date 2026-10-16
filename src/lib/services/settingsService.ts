/**
 * Settings Service
 */
import { AppSettings, CalendarSystem } from "../../types/index.ts";
import { query, queryOne, run } from "../db/sqliteEngine.ts";
import { STORAGE_KEYS } from "../../constants/index.ts";

const DEFAULT_SETTINGS: AppSettings = {
  currency_symbol: "Rs.",
  low_stock_threshold: 10,
  allow_negative_stock: false,
  store_name: "StockForge Store",
  store_address: "",
  store_phone: "",
  store_pan_vat: "",
  enable_vat: true,
  receipt_footer: "Thank you for shopping with us! Please come again.",
  calendar_system: "BS",
};

export function getSettings(): AppSettings {
  try {
    const rows = query<{ key: string; value: string }>(
      "SELECT key, value FROM app_settings",
    );
    const settings: AppSettings = { ...DEFAULT_SETTINGS };

    // Initialize from cached localStorage if available
    try {
      const cachedCal = localStorage.getItem(STORAGE_KEYS.CALENDAR_SYSTEM);
      if (cachedCal === "BS" || cachedCal === "AD") {
        settings.calendar_system = cachedCal;
      }
    } catch {}

    for (const row of rows) {
      if (row.key === "currency_symbol") {
        settings.currency_symbol = row.value;
      } else if (row.key === "low_stock_threshold") {
        const parsed = parseInt(row.value, 10);
        settings.low_stock_threshold = isNaN(parsed) ? 10 : parsed;
      } else if (row.key === "allow_negative_stock") {
        settings.allow_negative_stock = row.value === "true";
      } else if (row.key === "store_name") {
        settings.store_name = row.value;
      } else if (row.key === "store_address") {
        settings.store_address = row.value;
      } else if (row.key === "store_phone") {
        settings.store_phone = row.value;
      } else if (row.key === "store_pan_vat") {
        settings.store_pan_vat = row.value;
      } else if (row.key === "enable_vat") {
        settings.enable_vat = row.value !== "false";
      } else if (row.key === "receipt_footer") {
        settings.receipt_footer = row.value;
      } else if (row.key === "calendar_system") {
        const cal = row.value === "AD" ? "AD" : "BS";
        settings.calendar_system = cal;
        try {
          localStorage.setItem(STORAGE_KEYS.CALENDAR_SYSTEM, cal);
        } catch {}
      }
    }

    return settings;
  } catch (err) {
    console.error("Failed to get settings from database:", err);
    return DEFAULT_SETTINGS;
  }
}

export function updateSettings(newSettings: Partial<AppSettings>): AppSettings {
  if (newSettings.currency_symbol !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["currency_symbol", newSettings.currency_symbol.trim() || "Rs."],
    );
  }

  if (newSettings.low_stock_threshold !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [
        "low_stock_threshold",
        Math.max(0, Math.floor(newSettings.low_stock_threshold)).toString(),
      ],
    );
  }

  if (newSettings.allow_negative_stock !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [
        "allow_negative_stock",
        newSettings.allow_negative_stock ? "true" : "false",
      ],
    );
  }

  if (newSettings.store_name !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["store_name", newSettings.store_name.trim()],
    );
  }

  if (newSettings.store_address !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["store_address", newSettings.store_address.trim()],
    );
  }

  if (newSettings.store_phone !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["store_phone", newSettings.store_phone.trim()],
    );
  }

  if (newSettings.store_pan_vat !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["store_pan_vat", newSettings.store_pan_vat.trim()],
    );
  }

  if (newSettings.enable_vat !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["enable_vat", newSettings.enable_vat ? "true" : "false"],
    );
  }

  if (newSettings.receipt_footer !== undefined) {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["receipt_footer", newSettings.receipt_footer.trim()],
    );
  }

  if (newSettings.calendar_system !== undefined) {
    const cal = newSettings.calendar_system === "AD" ? "AD" : "BS";
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ["calendar_system", cal],
    );
    try {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_SYSTEM, cal);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("stockforge:calendar-changed", { detail: cal }),
        );
      }
    } catch {}
  }

  return getSettings();
}

/**
 * Get active calendar system ('BS' | 'AD'). Defaults to 'BS'.
 */
export function getCalendarSystem(): CalendarSystem {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.CALENDAR_SYSTEM);
    if (cached === "BS" || cached === "AD") return cached;
    const dbVal = getAppSetting("calendar_system");
    if (dbVal === "BS" || dbVal === "AD") {
      try {
        localStorage.setItem(STORAGE_KEYS.CALENDAR_SYSTEM, dbVal);
      } catch {}
      return dbVal;
    }
  } catch {}
  return "BS";
}

/**
 * Set active calendar system ('BS' | 'AD').
 */
export function setCalendarSystem(system: CalendarSystem): void {
  const val = system === "AD" ? "AD" : "BS";
  try {
    localStorage.setItem(STORAGE_KEYS.CALENDAR_SYSTEM, val);
  } catch {}
  updateSettings({ calendar_system: val });
}

/**
 * Retrieve a specific setting string value directly from app_settings by key.
 */
export function getAppSetting(key: string): string | null {
  try {
    const row = queryOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = ?",
      [key],
    );
    return row?.value ?? null;
  } catch (err) {
    console.error(`Failed to get app setting ${key}:`, err);
    return null;
  }
}

/**
 * Set or update a specific setting string value in app_settings.
 */
export function setAppSetting(key: string, value: string): void {
  try {
    run(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
      [key, value, value],
    );
  } catch (err) {
    console.error(`Failed to set app setting ${key}:`, err);
  }
}

function isRsVariant(s?: string | null): boolean {
  if (!s) return true;
  const clean = s.trim().toLowerCase();
  return (
    clean === "rs." ||
    clean === "rs" ||
    clean === "nrs" ||
    clean === "nrs." ||
    clean === "rupees"
  );
}

function isNepaliRupeeVariant(s?: string | null): boolean {
  if (!s) return false;
  const clean = s.trim();
  return clean === "रु." || clean === "रु" || clean === "रू." || clean === "रू";
}

/**
 * Persist active language and synchronize the currency symbol between Rs. and रु.
 */
export function syncLanguageAndCurrency(newLang: "en" | "np"): void {
  try {
    setAppSetting("language", newLang);

    const cur = getAppSetting("currency_symbol");
    if (newLang === "np") {
      if (isRsVariant(cur)) {
        setAppSetting("currency_symbol", "रु.");
      }
    } else if (newLang === "en") {
      if (isNepaliRupeeVariant(cur) || !cur) {
        setAppSetting("currency_symbol", "Rs.");
      }
    }
  } catch (err) {
    console.error("Failed to sync language and currency settings:", err);
  }
}

/**
 * Get saved language ('en' | 'np') from app_settings.
 */
export function getSavedLanguage(): "en" | "np" | null {
  const val = getAppSetting("language");
  return val === "en" || val === "np" ? val : null;
}

/**
 * Get saved theme ('light' | 'dark') from app_settings.
 */
export function getSavedTheme(): "light" | "dark" | null {
  const val = getAppSetting("theme");
  return val === "light" || val === "dark" ? val : null;
}

/**
 * Save theme preference into app_settings.
 */
export function saveThemeSetting(theme: "light" | "dark"): void {
  setAppSetting("theme", theme);
}
