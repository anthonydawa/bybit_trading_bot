import { Candle } from './types';

const DB_NAME = 'BybitTradingBotDB';
const STORE_NAME = 'kline_cache';
// Increment version to 2 to automatically drop any corrupt/mixed-timeframe cache from v1
const DB_VERSION = 2;

// In-memory cache for ultra-fast instant switching
const memoryCache = new Map<string, Candle[]>();

// Map interval string to expected period in seconds
const INTERVAL_SECONDS_MAP: Record<string, number> = {
  '1': 60,
  '3': 180,
  '5': 300,
  '15': 900,
  '30': 1800,
  '60': 3600,
  '120': 7200,
  '240': 14400,
  '360': 21600,
  '720': 43200,
  'D': 86400,
  'd': 86400,
  '1D': 86400,
};

/**
 * Validates, repairs, aligns, and sorts a candle sequence.
 * Ensures:
 * 1. Valid numbers for open, high, low, close > 0
 * 2. High >= Math.max(open, close) and Low <= Math.min(open, close)
 * 3. Timestamp alignment to interval (prevents mixing 15m and 1h candles)
 * 4. Deduplication by timestamp
 * 5. Strictly chronological ascending order (required by Lightweight Charts)
 */
export function sanitizeCandles(raw: Candle[], interval?: string): Candle[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const expectedSec = interval ? INTERVAL_SECONDS_MAP[interval] : undefined;
  const candleMap = new Map<number, Candle>();

  for (const c of raw) {
    if (!c) continue;
    const time = typeof c.time === 'number' ? c.time : Number(c.time);
    if (!Number.isFinite(time) || time <= 0) continue;

    const open = typeof c.open === 'number' ? c.open : parseFloat(c.open as any);
    const high = typeof c.high === 'number' ? c.high : parseFloat(c.high as any);
    const low = typeof c.low === 'number' ? c.low : parseFloat(c.low as any);
    const close = typeof c.close === 'number' ? c.close : parseFloat(c.close as any);
    const volume = typeof c.volume === 'number' ? c.volume : parseFloat((c.volume as any) || 0);

    if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0 || close <= 0) continue;
    const validHigh = Number.isFinite(high) ? Math.max(open, close, high) : Math.max(open, close);
    const validLow = Number.isFinite(low) ? Math.min(open, close, low) : Math.min(open, close);
    const validVolume = Number.isFinite(volume) && volume >= 0 ? volume : 0;

    // Filter out candles from different timeframes by checking timestamp alignment
    if (expectedSec && expectedSec < 86400) {
      if (time % expectedSec !== 0) {
        // Unaligned timestamp from another timeframe - discard to prevent interleaved candles
        continue;
      }
    }

    candleMap.set(time, {
      time,
      open,
      high: validHigh,
      low: validLow,
      close,
      volume: validVolume,
    });
  }

  // Sort chronologically ascending
  return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
}

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      // Drop previous store on version upgrade to purge any corrupted/interleaved cache
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

    // 1. Check memory cache first
    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key);
      if (cached && cached.length > 0) {
        const sanitized = sanitizeCandles(cached, interval);
        if (sanitized.length > 0) return sanitized;
      }
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
            const sanitized = sanitizeCandles(req.result.candles, interval);
            if (sanitized.length > 0) {
              memoryCache.set(key, sanitized);
              resolve(sanitized);
              return;
            }
          }
          resolve(null);
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

    const sanitized = sanitizeCandles(candles, interval);
    if (sanitized.length === 0) return;

    // Save to memory
    memoryCache.set(key, sanitized);

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
        candles: sanitized,
      });
    } catch (e) {
      // IndexedDB fallback
    }
  },

  /**
   * Merge helper: newly fetched candles from exchange are always authoritative
   */
  merge(existing: Candle[], incoming: Candle[], interval?: string): Candle[] {
    if (!incoming || incoming.length === 0) return sanitizeCandles(existing || [], interval);
    // If incoming has a substantial batch (e.g. 500-1000 candles from REST), use it directly
    if (incoming.length >= 200) {
      return sanitizeCandles(incoming, interval);
    }
    return sanitizeCandles([...(existing || []), ...incoming], interval);
  },

  /**
   * Clear all memory and IndexedDB caches
   */
  async clear(): Promise<void> {
    memoryCache.clear();
    try {
      const db = await getDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    } catch (e) {
      // Ignore
    }
  }
};
