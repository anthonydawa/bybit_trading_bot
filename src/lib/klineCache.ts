import { Candle } from './types';

const DB_NAME = 'BybitTradingBotDB';
const STORE_NAME = 'kline_cache';
const DB_VERSION = 1;

// Memory cache for synchronous instant rendering
const memoryCache = new Map<string, Candle[]>();

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export const klineCache = {
  /**
   * Get cached candles for a symbol & interval (Memory first, then IndexedDB)
   */
  async get(symbol: string, interval: string): Promise<Candle[] | null> {
    const key = `${symbol}_${interval}`;

    // 1. Check memory cache first (0ms latency)
    if (memoryCache.has(key)) {
      return memoryCache.get(key) || null;
    }

    // 2. Check IndexedDB
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result.candles)) {
            memoryCache.set(key, req.result.candles);
            resolve(req.result.candles);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => {
          resolve(null);
        };
      });
    } catch (e) {
      return null;
    }
  },

  /**
   * Save candles to cache (both in-memory and IndexedDB)
   */
  async set(symbol: string, interval: string, candles: Candle[]): Promise<void> {
    const key = `${symbol}_${interval}`;
    if (!candles || candles.length === 0) return;

    // Save to memory
    memoryCache.set(key, candles);

    // Save to IndexedDB
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: key,
        symbol,
        interval,
        updatedAt: Date.now(),
        candles,
      });
    } catch (e) {
      // IndexedDB write error fallback (memory cache still active)
    }
  },

  /**
   * Merge newly fetched candles with existing cached candles to ensure no gaps
   */
  merge(existing: Candle[], incoming: Candle[]): Candle[] {
    if (!existing || existing.length === 0) return incoming || [];
    if (!incoming || incoming.length === 0) return existing || [];

    const map = new Map<number, Candle>();
    for (const c of existing) {
      map.set(c.time, c);
    }
    for (const c of incoming) {
      map.set(c.time, c); // incoming overwrites / updates latest
    }

    // Sort chronologically ascending
    const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);
    // Keep max 1500 candles to prevent memory bloat while giving huge historical depth
    return sorted.slice(-1500);
  }
};
