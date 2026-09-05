export interface ChartCustomizationSettings {
  autoScale: boolean;
  invertScale: boolean;
  scaleMode: 'normal' | 'logarithmic' | 'percentage' | 'indexed';
  scalePosition: 'right' | 'left';
  showLastPriceLabel: boolean;
  showHighLowLabels: boolean;
  showIndicatorLabels: boolean;
  showPriceLine: boolean;
  showCountdown: boolean;
  showGridVert: boolean;
  showGridHorz: boolean;
  gridStyle: 'dotted' | 'dashed' | 'solid' | 'none';
  candleUpColor: string;
  candleDownColor: string;
  wickColorUp: string;
  wickColorDown: string;
  backgroundColor: string;
  candleBorderUpColor: string;
  candleBorderDownColor: string;
  showIndicatorTitles: boolean;
  showIndicatorNameLabels: boolean;
  showIndicatorPriceLines: boolean;
  showExecutionLines: boolean;
  precision: 'default' | '2' | '4' | '8';
  showWatermark: boolean;
  showOhlcBar: boolean;
  showPositionsOnChart: boolean;
}

export const DEFAULT_CHART_SETTINGS: ChartCustomizationSettings = {
  autoScale: true,
  invertScale: false,
  scaleMode: 'normal',
  scalePosition: 'right',
  showLastPriceLabel: true,
  showHighLowLabels: true,
  showIndicatorLabels: true,
  showPriceLine: true,
  showIndicatorPriceLines: false,
  showCountdown: true,
  showGridVert: true,
  showGridHorz: true,
  gridStyle: 'dotted',
  candleUpColor: '#10b981',
  candleDownColor: '#ef4444',
  wickColorUp: '#10b981',
  wickColorDown: '#ef4444',
  candleBorderUpColor: '#10b981',
  candleBorderDownColor: '#ef4444',
  backgroundColor: '#090d16',
  showIndicatorTitles: true,
  showIndicatorNameLabels: false,
  showExecutionLines: true,
  precision: 'default',
  showWatermark: true,
  showOhlcBar: true,
  showPositionsOnChart: true,
};

const STORAGE_KEY = 'bybit_chart_custom_settings';

export function getStoredChartSettings(): ChartCustomizationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CHART_SETTINGS,
        ...parsed,
        showIndicatorNameLabels: parsed.showIndicatorNameLabels ?? false,
        showIndicatorPriceLines: parsed.showIndicatorPriceLines ?? false,
      };
    }
  } catch (e) {
    console.warn('Failed to parse stored chart settings:', e);
  }
  return { ...DEFAULT_CHART_SETTINGS };
}

export function saveStoredChartSettings(settings: ChartCustomizationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save chart settings:', e);
  }
}
