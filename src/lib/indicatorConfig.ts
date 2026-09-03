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
    lineWidth: 2,
    lineStyle: 'solid',
    period: 20,
  },
  ema50: {
    enabled: true,
    color: '#f97316', // Orange
    lineWidth: 2,
    lineStyle: 'solid',
    period: 50,
  },
  ema200: {
    enabled: true,
    color: '#a855f7', // Purple
    lineWidth: 2,
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
    lineWidth: 2,
    lineStyle: 'solid',
    period: 10,
    multiplier: 3,
  },
  rsi: {
    enabled: true,
    color: '#818cf8', // Indigo
    lineWidth: 2,
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

const STORAGE_KEY = 'bybit_trading_indicator_configs';

export function getStoredIndicatorConfigs(): AllIndicatorConfigs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_INDICATOR_CONFIGS,
        ...parsed,
      };
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
