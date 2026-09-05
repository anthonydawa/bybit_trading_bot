export type LineStyleType = 'solid' | 'dashed' | 'dotted';

export interface IndicatorStyle {
  enabled: boolean;
  color: string;
  lineWidth: 1 | 2 | 3 | 4;
  lineStyle: LineStyleType;
  period?: number;
  stdDev?: number;
  multiplier?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
}

export interface AllIndicatorConfigs {
  ema9: IndicatorStyle;
  ema20: IndicatorStyle;
  ema50: IndicatorStyle;
  ema200: IndicatorStyle;
  bollinger: IndicatorStyle;
  supertrend: IndicatorStyle;
  rsi: IndicatorStyle;
  macd: IndicatorStyle;
}

export const DEFAULT_INDICATOR_CONFIGS: AllIndicatorConfigs = {
  ema9: {
    enabled: true,
    color: '#06b6d4', // Cyan
    lineWidth: 1,
    lineStyle: 'solid',
    period: 9,
  },
  ema20: {
    enabled: true,
    color: '#eab308', // Yellow
    lineWidth: 1,
    lineStyle: 'solid',
    period: 20,
  },
  ema50: {
    enabled: true,
    color: '#f97316', // Orange
    lineWidth: 1,
    lineStyle: 'solid',
    period: 50,
  },
  ema200: {
    enabled: true,
    color: '#a855f7', // Purple
    lineWidth: 1,
    lineStyle: 'solid',
    period: 200,
  },
  bollinger: {
    enabled: false,
    color: '#3b82f6', // Blue
    lineWidth: 1,
    lineStyle: 'solid',
    period: 20,
    stdDev: 2,
  },
  supertrend: {
    enabled: false,
    color: '#10b981', // Emerald
    lineWidth: 1,
    lineStyle: 'solid',
    period: 10,
    multiplier: 3,
  },
  rsi: {
    enabled: true,
    color: '#818cf8', // Indigo
    lineWidth: 1,
    lineStyle: 'solid',
    period: 14,
  },
  macd: {
    enabled: false,
    color: '#3b82f6',
    lineWidth: 1,
    lineStyle: 'solid',
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
  },
};

const STORAGE_KEY = 'bybit_trading_indicator_configs_v3';
const LEGACY_STORAGE_KEY = 'bybit_trading_indicator_configs';

export function getStoredIndicatorConfigs(): AllIndicatorConfigs {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    let isLegacy = false;
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      isLegacy = true;
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: AllIndicatorConfigs = {
        ...DEFAULT_INDICATOR_CONFIGS,
        ...parsed,
      };
      // If migrating from legacy storage, reset any default 2px lines to 1px
      if (isLegacy) {
        (Object.keys(merged) as (keyof AllIndicatorConfigs)[]).forEach((k) => {
          if (merged[k]?.lineWidth === 2) {
            merged[k].lineWidth = 1;
          }
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (e) {
    console.warn('Failed to load stored indicator configs:', e);
  }
  return { ...DEFAULT_INDICATOR_CONFIGS };
}

export function saveStoredIndicatorConfigs(configs: AllIndicatorConfigs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (e) {
    console.warn('Failed to save indicator configs:', e);
  }
}
