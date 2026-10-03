/**
 * Settings Service
 */
import { AppSettings } from '../../types/index.ts';
import { query, run } from '../db/sqliteEngine.ts';

const DEFAULT_SETTINGS: AppSettings = {
  currency_symbol: 'Rs.',
  low_stock_threshold: 10,
  allow_negative_stock: false,
  store_name: 'StockForge Store',
  store_address: '',
  store_phone: '',
  receipt_footer: 'Thank you for shopping with us! Please come again.',
};

export function getSettings(): AppSettings {
  try {
    const rows = query<{ key: string; value: string }>('SELECT key, value FROM app_settings');
    const settings: AppSettings = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      if (row.key === 'currency_symbol') {
        settings.currency_symbol = row.value;
      } else if (row.key === 'low_stock_threshold') {
        const parsed = parseInt(row.value, 10);
        settings.low_stock_threshold = isNaN(parsed) ? 10 : parsed;
      } else if (row.key === 'allow_negative_stock') {
        settings.allow_negative_stock = row.value === 'true';
      } else if (row.key === 'store_name') {
        settings.store_name = row.value;
      } else if (row.key === 'store_address') {
        settings.store_address = row.value;
      } else if (row.key === 'store_phone') {
        settings.store_phone = row.value;
      } else if (row.key === 'receipt_footer') {
        settings.receipt_footer = row.value;
      }
    }

    return settings;
  } catch (err) {
    console.error('Failed to get settings from database:', err);
    return DEFAULT_SETTINGS;
  }
}

export function updateSettings(newSettings: Partial<AppSettings>): AppSettings {
  if (newSettings.currency_symbol !== undefined) {
    run(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['currency_symbol', newSettings.currency_symbol.trim() || 'Rs.']
    );
  }

  if (newSettings.low_stock_threshold !== undefined) {
    run(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['low_stock_threshold', Math.max(0, Math.floor(newSettings.low_stock_threshold)).toString()]
    );
  }

  if (newSettings.allow_negative_stock !== undefined) {
    run(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['allow_negative_stock', newSettings.allow_negative_stock ? 'true' : 'false']
    );
  }

  if (newSettings.store_name !== undefined) {
    run(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['store_name', newSettings.store_name.trim()]
    );
  }

  if (newSettings.store_address !== undefined) {
    run(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['store_address', newSettings.store_address.trim()]
    );
  }

  if (newSettings.store_phone !== undefined) {
    run(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['store_phone', newSettings.store_phone.trim()]
    );
  }

  if (newSettings.receipt_footer !== undefined) {
    run(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      ['receipt_footer', newSettings.receipt_footer.trim()]
    );
  }

  return getSettings();
}
