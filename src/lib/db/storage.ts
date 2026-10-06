/**
 * IndexedDB storage adapter for persisting SQLite database binary state offline.
 * Works seamlessly across browser viewports and desktop webviews (Tauri/WebView2).
 */

import { DB_CONFIG } from '../../constants/index.ts';

const DB_NAME = DB_CONFIG.NAME;
const DB_VERSION = DB_CONFIG.VERSION;
const STORE_NAME = DB_CONFIG.STORE_NAME;
const KEY_NAME = DB_CONFIG.KEY_NAME;

function openStorageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDatabaseToStorage(data: Uint8Array): Promise<void> {
  try {
    const db = await openStorageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Store as ArrayBuffer or Uint8Array
      const req = store.put(data, KEY_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to persist SQLite database to IndexedDB:', err);
  }
}

export async function loadDatabaseFromStorage(): Promise<Uint8Array | null> {
  try {
    const db = await openStorageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_NAME);
      req.onsuccess = () => {
        if (req.result) {
          if (req.result instanceof Uint8Array) {
            resolve(req.result);
          } else if (req.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(req.result));
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load SQLite database from IndexedDB:', err);
    return null;
  }
}

export async function clearDatabaseStorage(): Promise<void> {
  try {
    const db = await openStorageDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(KEY_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to clear SQLite storage:', err);
  }
}
