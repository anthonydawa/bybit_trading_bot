import { Candle } from './types';

export interface InstrumentInfo {
  symbol: string;
  tickSize: number;
  priceScale: number; // Decimal places for price
  qtyStep: number;
  minOrderQty: number;
  maxOrderQty?: number;
  minNotionalValue?: number;
}

// In-memory cache for all linear perpetual instrument specifications
const instrumentsCache = new Map<string, InstrumentInfo>();
let isFetchingInstruments = false;

const STORAGE_KEY = 'bybit_instruments_cache_v1';

// Initialize from localStorage if available
try {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    const parsed: InstrumentInfo[] = JSON.parse(stored);
    for (const item of parsed) {
      instrumentsCache.set(item.symbol, item);
    }
  }
} catch (e) {
  // LocalStorage not available or parse error
}

/**
 * Fetch and cache all Linear instruments specs from Bybit / local backend
 */
export async function fetchInstruments(): Promise<Map<string, InstrumentInfo>> {
  if (instrumentsCache.size > 0 && !isFetchingInstruments) {
    return instrumentsCache;
  }
  if (isFetchingInstruments) {
    return instrumentsCache;
  }

  isFetchingInstruments = true;
  try {
    let list: any[] = [];
    // 1. Try local server endpoint first
    try {
      const res = await fetch('/api/bybit/instruments?category=linear');
      if (res.ok) {
        const data = await res.json();
        list = data.data?.list || [];
      }
    } catch (e) {
      // Ignore and fallback
    }

    // 2. Fallback to Bybit CORS public API directly
    if (!list || list.length === 0) {
      const res = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000');
      if (res.ok) {
        const data = await res.json();
        list = data.result?.list || [];
      }
    }

    if (list && list.length > 0) {
      const itemsToStore: InstrumentInfo[] = [];
      for (const item of list) {
        const tickSizeNum = parseFloat(item.priceFilter?.tickSize) || 0.01;
        const priceScaleNum = parseInt(item.priceScale, 10) || getPrecisionFromTickSize(tickSizeNum);
        const qtyStepNum = parseFloat(item.lotSizeFilter?.qtyStep) || 0.001;
        const minOrderQtyNum = parseFloat(item.lotSizeFilter?.minOrderQty) || qtyStepNum;

        const info: InstrumentInfo = {
          symbol: item.symbol,
          tickSize: tickSizeNum,
          priceScale: priceScaleNum,
          qtyStep: qtyStepNum,
          minOrderQty: minOrderQtyNum,
          maxOrderQty: parseFloat(item.lotSizeFilter?.maxOrderQty) || undefined,
          minNotionalValue: parseFloat(item.lotSizeFilter?.minNotionalValue) || undefined,
        };

        instrumentsCache.set(item.symbol, info);
        itemsToStore.push(info);
      }

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsToStore));
        }
      } catch (e) {
        // Storage quota or disabled
      }
    }
  } catch (err) {
    console.warn('Failed to load instrument specifications:', err);
  } finally {
    isFetchingInstruments = false;
  }

  return instrumentsCache;
}

/**
 * Get instrument info for a symbol if already loaded
 */
export function getInstrumentInfo(symbol: string): InstrumentInfo | null {
  return instrumentsCache.get(symbol) || null;
}

/**
 * Calculate decimal places from a tickSize number (e.g. 0.0001 -> 4, 0.1 -> 1)
 */
export function getPrecisionFromTickSize(tickSize: number): number {
  if (!tickSize || isNaN(tickSize) || tickSize >= 1) return 2;
  const str = tickSize.toString();
  if (str.includes('e-')) {
    const parts = str.split('e-');
    return parseInt(parts[1], 10) || 2;
  }
  if (str.includes('.')) {
    return str.split('.')[1].length;
  }
  return 2;
}

/**
 * Dynamically deduce market precision and tickSize step size.
 * Uses Bybit InstrumentInfo if available, otherwise intelligently computes
 * from current price magnitude and raw candle data.
 */
export function getMarketPrecision(
  symbol: string,
  currentPrice?: number,
  candles?: Candle[]
): {
  precision: number;
  tickSize: number;
  minMove: number;
  qtyStep: number;
  minOrderQty: number;
} {
  const cached = instrumentsCache.get(symbol);
  if (cached) {
    return {
      precision: cached.priceScale,
      tickSize: cached.tickSize,
      minMove: cached.tickSize,
      qtyStep: cached.qtyStep,
      minOrderQty: cached.minOrderQty,
    };
  }

  // Fallback: Smart calculation from current price & candle resolution
  const p = currentPrice || (candles && candles.length > 0 ? candles[candles.length - 1].close : 0);
  let prec = 2;
  let minMove = 0.01;

  if (p > 0) {
    if (p >= 1000) {
      prec = 2;
      minMove = 0.1;
    } else if (p >= 100) {
      prec = 2;
      minMove = 0.01;
    } else if (p >= 1) {
      prec = 4;
      minMove = 0.0001;
    } else if (p >= 0.1) {
      prec = 5;
      minMove = 0.00001;
    } else if (p >= 0.01) {
      prec = 6;
      minMove = 0.000001;
    } else if (p >= 0.001) {
      prec = 7;
      minMove = 0.0000001;
    } else {
      prec = 8;
      minMove = 0.00000001;
    }
  }

  // Scan recent candle data for higher precision
  if (candles && candles.length > 0) {
    const sample = candles.slice(-20);
    for (const c of sample) {
      for (const val of [c.open, c.high, c.low, c.close]) {
        if (!val) continue;
        const str = val.toString();
        if (str.includes('.')) {
          const dec = str.split('.')[1].length;
          if (dec > prec) {
            prec = Math.min(8, dec);
            minMove = Math.pow(10, -prec);
          }
        }
      }
    }
  }

  let qtyStep = 1;
  if (p >= 1000) qtyStep = 0.001;
  else if (p >= 10) qtyStep = 0.01;
  else if (p >= 1) qtyStep = 0.1;
  else qtyStep = 1;

  return {
    precision: prec,
    tickSize: minMove,
    minMove,
    qtyStep,
    minOrderQty: qtyStep,
  };
}

/**
 * Format price according to symbol step size or explicit precision
 */
export function formatMarketPrice(
  price: number | undefined | null,
  symbol?: string,
  forcedPrecision?: number | string
): string {
  if (price === undefined || price === null || isNaN(price)) return '--';

  let precision = 2;
  if (forcedPrecision !== undefined && forcedPrecision !== 'default') {
    precision = Number(forcedPrecision);
  } else if (symbol) {
    precision = getMarketPrecision(symbol, price).precision;
  } else {
    precision = getMarketPrecision('', price).precision;
  }

  return price.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/**
 * Format quantity based on lot step size
 */
export function formatMarketQty(
  qty: number | undefined | null,
  symbol?: string
): string {
  if (qty === undefined || qty === null || isNaN(qty)) return '0';
  const { qtyStep } = symbol ? getMarketPrecision(symbol) : { qtyStep: 0.001 };
  const decimals = getPrecisionFromTickSize(qtyStep);
  return qty.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
