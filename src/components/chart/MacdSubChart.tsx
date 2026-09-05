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
import { calculateMACD } from '../../lib/indicators';

interface MacdSubChartProps {
  candles: Candle[];
  fastLength?: number;
  slowLength?: number;
  signalLength?: number;
  onClose: () => void;
  onOpenSettings?: () => void;
  mainChart?: IChartApi | null;
}

export const MacdSubChart: React.FC<MacdSubChartProps> = ({
  candles,
  fastLength = 12,
  slowLength = 26,
  signalLength = 9,
  onClose,
  onOpenSettings,
  mainChart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [currentReadout, setCurrentReadout] = useState<{ macd: number; signal: number; hist: number } | null>(null);

  // Initialize MACD Chart Instance
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
        autoScale: true,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        visible: false,
        borderColor: '#1e293b',
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    // Histogram Series
    const histSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'right',
    });
    histSeriesRef.current = histSeries;

    // MACD Line Series (Cyan)
    const macdSeries = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 1,
      priceFormat: { type: 'custom', formatter: (val: number) => val.toFixed(2) },
    });
    macdSeriesRef.current = macdSeries;

    // Signal Line Series (Orange)
    const signalSeries = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      priceFormat: { type: 'custom', formatter: (val: number) => val.toFixed(2) },
    });
    signalSeriesRef.current = signalSeries;

    // Zero Line
    macdSeries.createPriceLine({
      price: 0,
      color: 'rgba(100, 116, 139, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: false,
    });

    // Crosshair listener for current values
    chart.subscribeCrosshairMove((param) => {
      if (param.seriesData && macdSeries && signalSeries && histSeries) {
        const m = param.seriesData.get(macdSeries) as any;
        const s = param.seriesData.get(signalSeries) as any;
        const h = param.seriesData.get(histSeries) as any;
        if (m && s) {
          setCurrentReadout({
            macd: m.value || 0,
            signal: s.value || 0,
            hist: h?.value || 0,
          });
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

    const initialRange = mainTimeScale.getVisibleLogicalRange();
    if (initialRange) {
      subTimeScale.setVisibleLogicalRange(initialRange);
    }

    return () => {
      mainTimeScale.unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
    };
  }, [mainChart]);

  // Update MACD Data
  useEffect(() => {
    if (!macdSeriesRef.current || !signalSeriesRef.current || !histSeriesRef.current || candles.length === 0) return;

    const macdData = calculateMACD(candles, fastLength, slowLength, signalLength);

    const formattedMacd = macdData.map((p) => ({ time: p.time as any, value: p.macd }));
    const formattedSignal = macdData.map((p) => ({ time: p.time as any, value: p.signal }));
    const formattedHist = macdData.map((p) => ({
      time: p.time as any,
      value: p.histogram,
      color: p.histogram >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)',
    }));

    macdSeriesRef.current.setData(formattedMacd);
    signalSeriesRef.current.setData(formattedSignal);
    histSeriesRef.current.setData(formattedHist);

    if (macdData.length > 0) {
      const last = macdData[macdData.length - 1];
      setCurrentReadout({
        macd: last.macd,
        signal: last.signal,
        hist: last.histogram,
      });
    }
  }, [candles, fastLength, slowLength, signalLength]);

  return (
    <div className="flex flex-col h-28 w-full border-t border-slate-800/90 bg-[#090d16] relative select-none shrink-0 group">
      {/* Sub-Pane Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#0d131f]/80 border-b border-slate-800/60 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-300 font-semibold">MACD ({fastLength}, {slowLength}, {signalLength})</span>
          <span className="text-cyan-400 font-bold">
            MACD: {currentReadout ? currentReadout.macd.toFixed(2) : '--'}
          </span>
          <span className="text-orange-400 font-bold">
            Signal: {currentReadout ? currentReadout.signal.toFixed(2) : '--'}
          </span>
          <span className={`font-bold ${currentReadout && currentReadout.hist >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            Hist: {currentReadout ? currentReadout.hist.toFixed(2) : '--'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
              title="MACD Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            title="Close MACD Pane"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MACD Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full" />
    </div>
  );
};
