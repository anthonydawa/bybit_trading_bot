import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
} from 'lightweight-charts';
import { Settings, X } from 'lucide-react';
import { Candle } from '../../lib/types';
import { calculateRSI } from '../../lib/indicators';

interface RsiSubChartProps {
  candles: Candle[];
  period?: number;
  color?: string;
  lineWidth?: number;
  onClose: () => void;
  onOpenSettings?: () => void;
  mainChart?: IChartApi | null;
}

export const RsiSubChart: React.FC<RsiSubChartProps> = ({
  candles,
  period = 14,
  color = '#a855f7',
  lineWidth = 1,
  onClose,
  onOpenSettings,
  mainChart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [currentValue, setCurrentValue] = useState<number | null>(null);

  // Initialize RSI Chart Instance
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#64748b',
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.3)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(30, 41, 59, 0.3)', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: 'rgba(148, 163, 184, 0.4)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(148, 163, 184, 0.4)', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        visible: false, // Time axis hidden (synced with main chart)
        borderColor: '#1e293b',
      },
      handleScroll: false, // Master chart controls scroll/zoom
      handleScale: false,
    });

    chartRef.current = chart;

    // RSI Line Series
    const rsiSeries = chart.addLineSeries({
      color,
      lineWidth: lineWidth as any,
      priceFormat: { type: 'custom', formatter: (val: number) => val.toFixed(1) },
    });
    rsiSeriesRef.current = rsiSeries;

    // Horizontal levels: 70 (Overbought), 30 (Oversold), 50 (Mid)
    rsiSeries.createPriceLine({
      price: 70,
      color: 'rgba(239, 68, 68, 0.6)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '70 OB',
    });
    rsiSeries.createPriceLine({
      price: 50,
      color: 'rgba(100, 116, 139, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: 'rgba(16, 185, 129, 0.6)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '30 OS',
    });

    // Crosshair listener for current value readout
    chart.subscribeCrosshairMove((param) => {
      if (param.seriesData && rsiSeries) {
        const val = param.seriesData.get(rsiSeries) as any;
        if (val && typeof val.value === 'number') {
          setCurrentValue(val.value);
        }
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !containerRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Synchronize Time Scale with Master Chart
  useEffect(() => {
    if (!mainChart || !chartRef.current) return;

    const mainTimeScale = mainChart.timeScale();
    const subTimeScale = chartRef.current.timeScale();

    const handleLogicalRangeChange = (range: any) => {
      if (range) {
        subTimeScale.setVisibleLogicalRange(range);
      }
    };

    mainTimeScale.subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);

    // Initial sync
    const initialRange = mainTimeScale.getVisibleLogicalRange();
    if (initialRange) {
      subTimeScale.setVisibleLogicalRange(initialRange);
    }

    return () => {
      mainTimeScale.unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
    };
  }, [mainChart]);

  // Update RSI Data
  useEffect(() => {
    if (!rsiSeriesRef.current || candles.length === 0) return;

    rsiSeriesRef.current.applyOptions({
      color,
      lineWidth: lineWidth as any,
    });

    const rsiData = calculateRSI(candles, period);
    const formatted = rsiData.map((p) => ({ time: p.time as any, value: p.value }));
    rsiSeriesRef.current.setData(formatted);

    if (formatted.length > 0) {
      setCurrentValue(formatted[formatted.length - 1].value);
    }
  }, [candles, period, color, lineWidth]);

  return (
    <div className="flex flex-col h-28 w-full border-t border-slate-800/90 bg-[#090d16] relative select-none shrink-0 group">
      {/* Sub-Pane Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#0d131f]/80 border-b border-slate-800/60 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-slate-300 font-semibold">RSI ({period})</span>
          <span className="text-purple-400 font-bold ml-1">
            {currentValue != null ? currentValue.toFixed(1) : '--'}
          </span>
          <span className="text-[10px] text-slate-500 font-sans">
            {currentValue != null && (currentValue >= 70 ? '⚠️ Overbought' : currentValue <= 30 ? '🔥 Oversold' : 'Neutral')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
              title="RSI Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            title="Close RSI Pane"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* RSI Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full" />
    </div>
  );
};
