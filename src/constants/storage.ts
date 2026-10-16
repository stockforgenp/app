/**
 * Local Storage & Cache Keys
 * Centralized key definitions for offline persistence.
 */

export const STORAGE_KEYS = {
  THEME: 'stockforge_theme',
  LANGUAGE: 'stockforge_language',
  ACTIVE_SHOP_ID: 'stockforge_active_shop_id',
  AUTH_TOKEN: 'stockforge_client_auth_token',
  SIDEBAR_COLLAPSED: 'stockforge_sidebar_collapsed',
  LAST_BACKUP_TIME: 'stockforge_last_backup_time',
  CALENDAR_SYSTEM: 'stockforge_calendar_system',
} as const;

export const DB_CONFIG = {
  NAME: 'StockForge_OfflineDB',
  VERSION: 1,
  STORE_NAME: 'sqlite_binary',
  KEY_NAME: 'current_database_file',
} as const;
