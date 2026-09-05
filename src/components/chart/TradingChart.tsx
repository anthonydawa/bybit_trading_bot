import React, { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  BarData,
  ColorType,
  CrosshairMode,
  LineStyle,
  PriceScaleMode,
} from 'lightweight-charts';
import { Settings, Eye, RotateCcw } from 'lucide-react';
import { Candle, IndicatorSettings, ChartStyleType, OHLCData } from '../../lib/types';
import {
  AllIndicatorConfigs,
  DEFAULT_INDICATOR_CONFIGS,
  LineStyleType,
} from '../../lib/indicatorConfig';
import {
  calculateEMA,
  calculateBollingerBands,
  calculateSupertrend,
} from '../../lib/indicators';
import {
  Drawing,
  DrawingToolType,
} from '../../lib/drawingTypes';
import {
  getStoredDrawings,
  saveStoredDrawings,
  clearStoredDrawings,
} from '../../lib/drawingStorage';
import { DrawingToolbar } from './DrawingToolbar';
import { DrawingOverlay } from './DrawingOverlay';
import { RsiSubChart } from './RsiSubChart';
import { MacdSubChart } from './MacdSubChart';

export interface TradingChartRef {
  captureSnapshot: () => Promise<string | null>;
  resetChart: () => void;
}

interface TradingChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  chartStyle?: ChartStyleType;
  indicators: IndicatorSettings;
  indicatorConfigs?: AllIndicatorConfigs;
  onOpenIndicatorSettings?: (key: keyof AllIndicatorConfigs) => void;
  onToggleIndicator?: (key: keyof AllIndicatorConfigs) => void;
  onPriceHover?: (price: number | null) => void;
  onHoverOhlc?: (data: OHLCData | null) => void;
}

function getLineStyle(style?: LineStyleType): LineStyle {
  if (style === 'dashed') return LineStyle.Dashed;
  if (style === 'dotted') return LineStyle.Dotted;
  return LineStyle.Solid;
}

const RANGE_SHORTCUTS = [
  { label: '1D', durationDays: 1 },
  { label: '5D', durationDays: 5 },
  { label: '1M', durationDays: 30 },
  { label: '3M', durationDays: 90 },
  { label: '6M', durationDays: 180 },
  { label: 'YTD', isYtd: true },
  { label: 'ALL', isAll: true },
];

export const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(({
  candles,
  symbol,
  timeframe,
  chartStyle = 'candles',
  indicators,
  indicatorConfigs = DEFAULT_INDICATOR_CONFIGS,
  onOpenIndicatorSettings,
  onToggleIndicator,
  onPriceHover,
  onHoverOhlc,
}, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Indicator Series Refs
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const supertrendSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // TradingView Scale Options State
  const [isAutoScale, setIsAutoScale] = useState<boolean>(true);
  const [isLogScale, setIsLogScale] = useState<boolean>(false);
  const [activeRange, setActiveRange] = useState<string>('ALL');

  // Drawing Tools State (Persisted per symbol in browser LocalStorage)
  const [drawings, setDrawings] = useState<Drawing[]>(() => getStoredDrawings(symbol));
  const [activeTool, setActiveTool] = useState<DrawingToolType>('cursor');
  const [isMagnetEnabled, setIsMagnetEnabled] = useState<boolean>(false);
  const [areDrawingsHidden, setAreDrawingsHidden] = useState<boolean>(false);
  const [areDrawingsLocked, setAreDrawingsLocked] = useState<boolean>(false);

  // Re-center / Auto-Scale / Normalize Chart View Function
  const handleResetChart = useCallback(() => {
    if (chartRef.current && mainSeriesRef.current) {
      mainSeriesRef.current.priceScale().applyOptions({
        autoScale: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.15,
        },
      });
      setIsAutoScale(true);
      chartRef.current.timeScale().resetTimeScale();
      chartRef.current.timeScale().fitContent();
    }
  }, []);

  // Toggle Auto-Scale Mode
  const handleToggleAutoScale = () => {
    if (mainSeriesRef.current) {
      const next = !isAutoScale;
      mainSeriesRef.current.priceScale().applyOptions({
        autoScale: next,
      });
      setIsAutoScale(next);
      if (next) {
        chartRef.current?.timeScale().fitContent();
      }
    }
  };

  // Toggle Logarithmic Scale Mode
  const handleToggleLogScale = () => {
    if (mainSeriesRef.current) {
      const next = !isLogScale;
      mainSeriesRef.current.priceScale().applyOptions({
        mode: next ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      });
      setIsLogScale(next);
    }
  };

  // Range Shortcuts (1D, 5D, 1M, 3M, 6M, YTD, ALL)
  const handleSelectRange = (shortcut: typeof RANGE_SHORTCUTS[number]) => {
    if (!chartRef.current || candles.length === 0) return;
    setActiveRange(shortcut.label);

    const timeScale = chartRef.current.timeScale();
    const lastCandleTime = candles[candles.length - 1].time;

    if (shortcut.isAll) {
      timeScale.resetTimeScale();
      timeScale.fitContent();
      return;
    }

    let fromTime: number;
    if (shortcut.isYtd) {
      const currentYear = new Date().getFullYear();
      fromTime = Math.floor(new Date(currentYear, 0, 1).getTime() / 1000);
    } else if (shortcut.durationDays) {
      fromTime = lastCandleTime - shortcut.durationDays * 86400;
    } else {
      fromTime = candles[0].time;
    }

    try {
      timeScale.setVisibleRange({
        from: fromTime as any,
        to: (lastCandleTime + 3600) as any,
      });
    } catch (e) {
      timeScale.fitContent();
    }
  };

  // Load symbol-specific drawings when symbol changes
  useEffect(() => {
    setDrawings(getStoredDrawings(symbol));
  }, [symbol]);

  // Drawing Mutation Handlers
  const handleAddDrawing = (newDrawing: Drawing) => {
    setDrawings((prev) => {
      const updated = [...prev, newDrawing];
      saveStoredDrawings(symbol, updated);
      return updated;
    });
  };

  const handleUpdateDrawing = (id: string, patch: Partial<Drawing>) => {
    setDrawings((prev) => {
      const updated = prev.map((d) => (d.id === id ? ({ ...d, ...patch } as Drawing) : d));
      saveStoredDrawings(symbol, updated);
      return updated;
    });
  };

  const handleDeleteDrawing = (id: string) => {
    setDrawings((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      saveStoredDrawings(symbol, updated);
      return updated;
    });
  };

  const handleClearAllDrawings = () => {
    setDrawings([]);
    clearStoredDrawings(symbol);
  };

  // Keyboard Shortcuts for Drawing Tools & Reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        setActiveTool('cursor');
      } else if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setActiveTool('trendline');
      } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setActiveTool('horizontalLine');
      } else if (e.altKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setActiveTool('horizontalRay');
      } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setActiveTool('rectangle');
      } else if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setActiveTool('fibonacci');
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        setActiveTool('riskReward');
      } else if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleResetChart();
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('cursor');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetChart]);

  // Expose snapshot capture and reset functions to parent
  useImperativeHandle(ref, () => ({
    captureSnapshot: async () => {
      if (!chartContainerRef.current) return null;
      try {
        const canvas = chartContainerRef.current.querySelector('canvas');
        if (canvas) {
          return canvas.toDataURL('image/png');
        }
        return null;
      } catch (err) {
        console.warn('Screenshot capture failed:', err);
        return null;
      }
    },
    resetChart: handleResetChart,
  }));

  // 1. Initialize Main Trading Chart & Series
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.45)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(30, 41, 59, 0.45)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(148, 163, 184, 0.6)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: 'rgba(148, 163, 184, 0.6)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: {
          top: 0.08,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Create Main Price Series based on Chart Style
    let mainSeries: ISeriesApi<any>;
    if (chartStyle === 'line') {
      mainSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
      });
    } else if (chartStyle === 'area') {
      mainSeries = chart.addAreaSeries({
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3b82f6',
        lineWidth: 2,
      });
    } else if (chartStyle === 'bars') {
      mainSeries = chart.addBarSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
      });
    } else {
      // Default: Candlesticks (or hollow)
      mainSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
    }
    mainSeriesRef.current = mainSeries;

    // Volume Series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Indicator Line Series with Initial Configs
    ema9SeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.ema9.color,
      lineWidth: indicatorConfigs.ema9.lineWidth as any,
      lineStyle: getLineStyle(indicatorConfigs.ema9.lineStyle),
      title: 'EMA 9',
    });

    ema20SeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.ema20.color,
      lineWidth: indicatorConfigs.ema20.lineWidth as any,
      lineStyle: getLineStyle(indicatorConfigs.ema20.lineStyle),
      title: 'EMA 20',
    });

    ema50SeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.ema50.color,
      lineWidth: indicatorConfigs.ema50.lineWidth as any,
      lineStyle: getLineStyle(indicatorConfigs.ema50.lineStyle),
      title: 'EMA 50',
    });

    ema200SeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.ema200.color,
      lineWidth: indicatorConfigs.ema200.lineWidth as any,
      lineStyle: getLineStyle(indicatorConfigs.ema200.lineStyle),
      title: 'EMA 200',
    });

    bbUpperSeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.bollinger.color,
      lineWidth: indicatorConfigs.bollinger.lineWidth as any,
      lineStyle: getLineStyle(indicatorConfigs.bollinger.lineStyle),
      title: 'BB Upper',
    });

    bbMiddleSeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.bollinger.color,
      lineWidth: Math.max(1, indicatorConfigs.bollinger.lineWidth - 1) as any,
      lineStyle: LineStyle.Dashed,
      title: 'BB Mid',
    });

    bbLowerSeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.bollinger.color,
      lineWidth: indicatorConfigs.bollinger.lineWidth as any,
      lineStyle: getLineStyle(indicatorConfigs.bollinger.lineStyle),
      title: 'BB Lower',
    });

    supertrendSeriesRef.current = chart.addLineSeries({
      color: indicatorConfigs.supertrend.color,
      lineWidth: indicatorConfigs.supertrend.lineWidth as any,
      lineStyle: getLineStyle(indicatorConfigs.supertrend.lineStyle),
      title: 'Supertrend',
    });

    // Crosshair hover listener for Real-Time Floating OHLCV
    chart.subscribeCrosshairMove((param) => {
      if (param.point && param.seriesData && mainSeries) {
        const data = param.seriesData.get(mainSeries) as any;
        if (data) {
          const price = data.close ?? data.value ?? null;
          onPriceHover?.(price);

          if (data.open != null && data.close != null) {
            const change = data.close - data.open;
            const changePercent = data.open !== 0 ? (change / data.open) * 100 : 0;
            const volData = volumeSeries ? (param.seriesData.get(volumeSeries) as any) : null;
            onHoverOhlc?.({
              open: data.open,
              high: data.high,
              low: data.low,
              close: data.close,
              volume: volData?.value || 0,
              change,
              changePercent,
              time: Number(data.time),
            });
          }
        }
      } else {
        onPriceHover?.(null);
      }
    });

    // Double-click listener on chart container to re-center & auto-scale
    const container = chartContainerRef.current;
    if (container) {
      container.addEventListener('dblclick', handleResetChart);
    }

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartContainerRef.current || !chart) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });

    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      if (container) {
        container.removeEventListener('dblclick', handleResetChart);
      }
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartStyle, handleResetChart]);

  // 2. Update Data, Indicators, Colors, Thickness, and Line Styles
  useEffect(() => {
    if (!mainSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    // Format Data for Main Series
    if (chartStyle === 'line' || chartStyle === 'area') {
      const lineData: LineData[] = candles.map((c) => ({
        time: c.time as any,
        value: c.close,
      }));
      mainSeriesRef.current.setData(lineData);
    } else {
      const candleData: CandlestickData[] = candles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      mainSeriesRef.current.setData(candleData);
    }

    // Default latest candle for floating OHLC bar when not hovering
    const latest = candles[candles.length - 1];
    if (latest) {
      onHoverOhlc?.({
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close,
        volume: latest.volume,
        change: latest.close - latest.open,
        changePercent: latest.open > 0 ? ((latest.close - latest.open) / latest.open) * 100 : 0,
        time: latest.time,
      });
    }

    // Format Volume Data
    const formattedVolume: HistogramData[] = candles.map((c) => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
    }));
    volumeSeriesRef.current.setData(formattedVolume);

    // Apply Dynamic Styling & Data for EMA 9
    if (ema9SeriesRef.current) {
      const cfg = indicatorConfigs.ema9;
      ema9SeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: cfg.lineWidth as any,
        lineStyle: getLineStyle(cfg.lineStyle),
      });
      if (cfg.enabled) {
        const ema9 = calculateEMA(candles, cfg.period || 9);
        ema9SeriesRef.current.setData(ema9.map((p) => ({ time: p.time as any, value: p.value })));
      } else {
        ema9SeriesRef.current.setData([]);
      }
    }

    // Apply Dynamic Styling & Data for EMA 20
    if (ema20SeriesRef.current) {
      const cfg = indicatorConfigs.ema20;
      ema20SeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: cfg.lineWidth as any,
        lineStyle: getLineStyle(cfg.lineStyle),
      });
      if (cfg.enabled) {
        const ema20 = calculateEMA(candles, cfg.period || 20);
        ema20SeriesRef.current.setData(ema20.map((p) => ({ time: p.time as any, value: p.value })));
      } else {
        ema20SeriesRef.current.setData([]);
      }
    }

    // Apply Dynamic Styling & Data for EMA 50
    if (ema50SeriesRef.current) {
      const cfg = indicatorConfigs.ema50;
      ema50SeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: cfg.lineWidth as any,
        lineStyle: getLineStyle(cfg.lineStyle),
      });
      if (cfg.enabled) {
        const ema50 = calculateEMA(candles, cfg.period || 50);
        ema50SeriesRef.current.setData(ema50.map((p) => ({ time: p.time as any, value: p.value })));
      } else {
        ema50SeriesRef.current.setData([]);
      }
    }

    // Apply Dynamic Styling & Data for EMA 200
    if (ema200SeriesRef.current) {
      const cfg = indicatorConfigs.ema200;
      ema200SeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: cfg.lineWidth as any,
        lineStyle: getLineStyle(cfg.lineStyle),
      });
      if (cfg.enabled) {
        const ema200 = calculateEMA(candles, cfg.period || 200);
        ema200SeriesRef.current.setData(ema200.map((p) => ({ time: p.time as any, value: p.value })));
      } else {
        ema200SeriesRef.current.setData([]);
      }
    }

    // Apply Dynamic Styling & Data for Bollinger Bands
    if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
      const cfg = indicatorConfigs.bollinger;
      bbUpperSeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: cfg.lineWidth as any,
        lineStyle: getLineStyle(cfg.lineStyle),
      });
      bbMiddleSeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: Math.max(1, cfg.lineWidth - 1) as any,
        lineStyle: LineStyle.Dashed,
      });
      bbLowerSeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: cfg.lineWidth as any,
        lineStyle: getLineStyle(cfg.lineStyle),
      });

      if (cfg.enabled) {
        const bb = calculateBollingerBands(candles, cfg.period || 20, cfg.stdDev || 2);
        bbUpperSeriesRef.current.setData(bb.map((p) => ({ time: p.time as any, value: p.upper })));
        bbMiddleSeriesRef.current.setData(bb.map((p) => ({ time: p.time as any, value: p.middle })));
        bbLowerSeriesRef.current.setData(bb.map((p) => ({ time: p.time as any, value: p.lower })));
      } else {
        bbUpperSeriesRef.current.setData([]);
        bbMiddleSeriesRef.current.setData([]);
        bbLowerSeriesRef.current.setData([]);
      }
    }

    // Apply Dynamic Styling & Data for Supertrend
    if (supertrendSeriesRef.current) {
      const cfg = indicatorConfigs.supertrend;
      supertrendSeriesRef.current.applyOptions({
        color: cfg.color,
        lineWidth: cfg.lineWidth as any,
        lineStyle: getLineStyle(cfg.lineStyle),
      });
      if (cfg.enabled) {
        const st = calculateSupertrend(candles, cfg.period || 10, cfg.multiplier || 3);
        supertrendSeriesRef.current.setData(st.map((p) => ({ time: p.time as any, value: p.value })));
      } else {
        supertrendSeriesRef.current.setData([]);
      }
    }
  }, [candles, indicatorConfigs, chartStyle]);

  // Active indicator list for the on-chart legend
  const activeLegendList = [
    { key: 'ema9' as const, label: `EMA ${indicatorConfigs.ema9.period || 9}`, config: indicatorConfigs.ema9 },
    { key: 'ema20' as const, label: `EMA ${indicatorConfigs.ema20.period || 20}`, config: indicatorConfigs.ema20 },
    { key: 'ema50' as const, label: `EMA ${indicatorConfigs.ema50.period || 50}`, config: indicatorConfigs.ema50 },
    { key: 'ema200' as const, label: `EMA ${indicatorConfigs.ema200.period || 200}`, config: indicatorConfigs.ema200 },
    { key: 'bollinger' as const, label: `BB (${indicatorConfigs.bollinger.period || 20}, ${indicatorConfigs.bollinger.stdDev || 2})`, config: indicatorConfigs.bollinger },
    { key: 'supertrend' as const, label: `Supertrend (${indicatorConfigs.supertrend.period || 10}, ${indicatorConfigs.supertrend.multiplier || 3})`, config: indicatorConfigs.supertrend },
  ].filter((item) => item.config.enabled);

  return (
    <div className="flex flex-col h-full w-full bg-[#090d16] relative overflow-hidden select-none">
      {/* 1. TradingView / Bybit Style Left Drawing Toolbar */}
      <DrawingToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        isMagnetEnabled={isMagnetEnabled}
        onToggleMagnet={() => setIsMagnetEnabled(!isMagnetEnabled)}
        onClearAllDrawings={handleClearAllDrawings}
        drawingsCount={drawings.length}
        areDrawingsHidden={areDrawingsHidden}
        onToggleHideDrawings={() => setAreDrawingsHidden(!areDrawingsHidden)}
        areDrawingsLocked={areDrawingsLocked}
        onToggleLockDrawings={() => setAreDrawingsLocked(!areDrawingsLocked)}
      />

      {/* 2. TradingView Style On-Chart Active Legend */}
      {activeLegendList.length > 0 && (
        <div className="absolute top-2 left-14 z-10 flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {activeLegendList.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 backdrop-blur-sm border border-slate-800 text-[11px] font-mono text-slate-300 shadow-md group transition-all"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow"
                style={{ backgroundColor: item.config.color }}
              />
              <span className="font-semibold text-slate-200">{item.label}</span>
              <span className="text-[10px] text-slate-500 font-sans">
                {item.config.lineWidth}px
              </span>

              {/* Hover Controls: Toggle 👁️ / Settings ⚙️ */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                <button
                  type="button"
                  onClick={() => onToggleIndicator?.(item.key)}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Hide indicator"
                >
                  <Eye className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenIndicatorSettings?.(item.key)}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
                  title="Configure indicator (color, width, style)"
                >
                  <Settings className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Main Chart Canvas Viewport */}
      <div className="flex-1 w-full relative min-h-[260px] overflow-hidden">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* 4. Interactive Drawing SVG Overlay Layer */}
        <DrawingOverlay
          chart={chartRef.current}
          series={mainSeriesRef.current}
          candles={candles}
          drawings={drawings}
          onAddDrawing={handleAddDrawing}
          onUpdateDrawing={handleUpdateDrawing}
          onDeleteDrawing={handleDeleteDrawing}
          activeTool={activeTool}
          onResetTool={() => setActiveTool('cursor')}
          isMagnetEnabled={isMagnetEnabled}
          areDrawingsHidden={areDrawingsHidden}
          areDrawingsLocked={areDrawingsLocked}
        />

        {/* 5. TradingView Standard Bottom-Right Scale Controls */}
        <div className="absolute bottom-3 right-16 z-20 flex items-center gap-1 pointer-events-auto select-none">
          {/* Auto-Scale Toggle */}
          <button
            type="button"
            onClick={handleToggleAutoScale}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
              isAutoScale
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Toggle Auto-Scale"
          >
            auto
          </button>

          {/* Logarithmic Scale Toggle */}
          <button
            type="button"
            onClick={handleToggleLogScale}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
              isLogScale
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Toggle Logarithmic Price Scale"
          >
            log
          </button>

          {/* Re-Center / Normalize Button */}
          <button
            type="button"
            onClick={handleResetChart}
            className="p-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all active:scale-95"
            title="Re-Center & Normalize Chart (or Double-Click Chart)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 6. Synchronized Sub-Pane: RSI (14) */}
      {indicatorConfigs.rsi.enabled && (
        <RsiSubChart
          candles={candles}
          period={indicatorConfigs.rsi.period || 14}
          color={indicatorConfigs.rsi.color || '#a855f7'}
          lineWidth={indicatorConfigs.rsi.lineWidth || 2}
          onClose={() => onToggleIndicator?.('rsi')}
          onOpenSettings={() => onOpenIndicatorSettings?.('rsi')}
          mainChart={chartRef.current}
        />
      )}

      {/* 7. Synchronized Sub-Pane: MACD (12, 26, 9) */}
      {indicatorConfigs.macd.enabled && (
        <MacdSubChart
          candles={candles}
          fastLength={12}
          slowLength={26}
          signalLength={9}
          onClose={() => onToggleIndicator?.('macd')}
          onOpenSettings={() => onOpenIndicatorSettings?.('macd')}
          mainChart={chartRef.current}
        />
      )}

      {/* 8. Bottom TradingView Range Selector Bar (1D, 5D, 1M, 3M, 6M, YTD, ALL) */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#0d131f] border-t border-slate-800/80 text-[11px] font-mono text-slate-400 shrink-0 select-none">
        <div className="flex items-center gap-1">
          {RANGE_SHORTCUTS.map((sc) => (
            <button
              key={sc.label}
              onClick={() => handleSelectRange(sc)}
              className={`px-2 py-0.5 rounded transition-all ${
                activeRange === sc.label
                  ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40'
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-sans">
          <span>UTC (Bybit V5)</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
});
