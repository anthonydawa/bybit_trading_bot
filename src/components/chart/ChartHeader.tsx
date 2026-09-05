import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronDown,
  Layers,
  Search,
  Check,
  BookOpen,
  Zap,
  Bot,
  Sliders,
  CandlestickChart,
  LineChart as LineChartIcon,
  AreaChart,
  BarChart3,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { IndicatorSettings, TickerInfo, ChartStyleType, OHLCData } from '../../lib/types';
import { AllIndicatorConfigs, DEFAULT_INDICATOR_CONFIGS } from '../../lib/indicatorConfig';
import { formatMarketPrice } from '../../lib/marketUtils';

interface ChartHeaderProps {
  symbol: string;
  ticker: TickerInfo | null;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  chartStyle: ChartStyleType;
  onChartStyleChange: (style: ChartStyleType) => void;
  hoverOhlc: OHLCData | null;
  indicators: IndicatorSettings;
  indicatorConfigs?: AllIndicatorConfigs;
  onToggleIndicator: (key: keyof AllIndicatorConfigs) => void;
  onOpenIndicatorSettings?: (key?: keyof AllIndicatorConfigs) => void;
  onOpenTickerSelector: () => void;
  onAnalyzeChart: () => void;
  isAiAnalyzing?: boolean;

  // Fullscreen
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;

  // Panel Slider Toggles
  isOrderBookOpen: boolean;
  onToggleOrderBook: () => void;
  isOrderFormOpen: boolean;
  onToggleOrderForm: () => void;
  isAiSidebarOpen: boolean;
  onToggleAiSidebar: () => void;
}

const TIMEFRAMES = [
  { label: '1m', value: '1' },
  { label: '3m', value: '3' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '30m', value: '30' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: '1D', value: 'D' },
];

const CHART_STYLES: { type: ChartStyleType; label: string; icon: React.FC<any> }[] = [
  { type: 'candles', label: 'Candlestick', icon: CandlestickChart },
  { type: 'line', label: 'Line', icon: LineChartIcon },
  { type: 'area', label: 'Area (Glow)', icon: AreaChart },
  { type: 'bars', label: 'OHLC Bars', icon: BarChart3 },
];

export const ChartHeader: React.FC<ChartHeaderProps> = ({
  symbol,
  ticker,
  timeframe,
  onTimeframeChange,
  chartStyle,
  onChartStyleChange,
  hoverOhlc,
  indicators,
  indicatorConfigs = DEFAULT_INDICATOR_CONFIGS,
  onToggleIndicator,
  onOpenIndicatorSettings,
  onOpenTickerSelector,
  onAnalyzeChart,
  isAiAnalyzing = false,
  isFullscreen = false,
  onToggleFullscreen,
  isOrderBookOpen,
  onToggleOrderBook,
  isOrderFormOpen,
  onToggleOrderForm,
  isAiSidebarOpen,
  onToggleAiSidebar,
}) => {
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const priceChange = ticker?.price24hPcnt || 0;
  const isPositive = priceChange >= 0;

  const indicatorList: { key: keyof AllIndicatorConfigs; label: string }[] = [
    { key: 'ema9', label: `EMA ${indicatorConfigs.ema9.period || 9}` },
    { key: 'ema20', label: `EMA ${indicatorConfigs.ema20.period || 20}` },
    { key: 'ema50', label: `EMA ${indicatorConfigs.ema50.period || 50}` },
    { key: 'ema200', label: `EMA ${indicatorConfigs.ema200.period || 200}` },
    { key: 'bollinger', label: `Bollinger Bands (${indicatorConfigs.bollinger.period || 20}, ${indicatorConfigs.bollinger.stdDev || 2})` },
    { key: 'supertrend', label: `Supertrend (${indicatorConfigs.supertrend.period || 10}, ${indicatorConfigs.supertrend.multiplier || 3})` },
    { key: 'rsi', label: `RSI (${indicatorConfigs.rsi.period || 14}) Sub-Pane` },
    { key: 'macd', label: 'MACD (12, 26, 9) Sub-Pane' },
  ];

  const CurrentStyleIcon = CHART_STYLES.find((s) => s.type === chartStyle)?.icon || CandlestickChart;

  return (
    <div className="flex flex-col bg-[#0d131f] border-b border-slate-800/80 select-none">
      {/* Top Main Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 gap-2">
        {/* Left: Ticker Search & 24h Summary */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Ticker Search Button */}
          <button
            onClick={onOpenTickerSelector}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-white font-bold tracking-wide transition-all group"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
            <span className="text-sm font-mono">{symbol}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Perp
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Current Price & 24h stats */}
          {ticker && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-base font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${formatMarketPrice(ticker.lastPrice, symbol)}
                </span>
                <span className={`flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.2 rounded ${
                  isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </div>

              <div className="hidden xl:flex items-center gap-3 text-slate-400 border-l border-slate-800 pl-3 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px]">24h High</span>
                  <span className="text-slate-200">${formatMarketPrice(ticker.highPrice24h, symbol)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">24h Low</span>
                  <span className="text-slate-200">${formatMarketPrice(ticker.lowPrice24h, symbol)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px]">24h Volume</span>
                  <span className="text-slate-200">
                    {ticker.volume24h ? (ticker.volume24h > 1000000 ? `${(ticker.volume24h / 1000000).toFixed(2)}M` : `${(ticker.volume24h / 1000).toFixed(1)}K`) : '0'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center/Right: Timeframes, Chart Styles, Indicators & Panel Sliders */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe Selector Bar */}
          <div className="flex items-center bg-slate-900/90 rounded-lg p-0.5 border border-slate-800">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                  timeframe === tf.value
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart Style Switcher (Candles, Line, Area, Bars) */}
          <div className="relative">
            <button
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800/70 hover:bg-slate-700/70 border border-slate-700/60 rounded-lg text-xs font-medium text-slate-200 transition-all"
              title="Chart Type (Candlestick, Line, Area, Bars)"
            >
              <CurrentStyleIcon className="w-3.5 h-3.5 text-blue-400" />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showStyleMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#0d131f] border border-slate-700/80 rounded-xl shadow-2xl p-1 z-50 animate-fade-in">
                {CHART_STYLES.map((style) => {
                  const Icon = style.icon;
                  return (
                    <button
                      key={style.type}
                      onClick={() => {
                        onChartStyleChange(style.type);
                        setShowStyleMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                        chartStyle === style.type
                          ? 'bg-blue-600/30 text-blue-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{style.label}</span>
                      </div>
                      {chartStyle === style.type && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Indicators Dropdown & Quick Settings */}
          <div className="relative flex items-center bg-slate-800/70 border border-slate-700/60 rounded-lg">
            <button
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-700/70 text-xs font-medium text-slate-200 rounded-l-lg transition-all"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Indicators</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <button
              onClick={() => onOpenIndicatorSettings?.()}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/70 rounded-r-lg border-l border-slate-700/60 transition-all"
              title="Open Indicator Customization (Colors, Thickness, Style)"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-300" />
            </button>

            {showIndicatorMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#0d131f] border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
                <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Indicators & Panes
                  </span>
                  <button
                    onClick={() => {
                      setShowIndicatorMenu(false);
                      onOpenIndicatorSettings?.();
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Customize</span>
                  </button>
                </div>

                <div className="space-y-0.5">
                  {indicatorList.map((item) => {
                    const cfg = indicatorConfigs[item.key];
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          cfg.enabled
                            ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                            : 'hover:bg-slate-800/80 text-slate-300'
                        }`}
                        onClick={() => onToggleIndicator(item.key)}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cfg.color }}
                          />
                          <span>{item.label}</span>
                        </div>
                        {cfg.enabled && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* AI One-Click Chart Analysis Trigger */}
          <button
            onClick={onAnalyzeChart}
            disabled={isAiAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAiAnalyzing ? 'Analyzing...' : 'AI Analyze'}</span>
          </button>

          {/* Side Panels Quick Sliders */}
          <div className="flex items-center bg-slate-900/80 rounded-lg p-0.5 border border-slate-800 gap-0.5">
            <button
              onClick={onToggleOrderBook}
              className={`p-1.5 rounded text-xs transition-all ${
                isOrderBookOpen ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Order Book"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggleOrderForm}
              className={`p-1.5 rounded text-xs transition-all ${
                isOrderFormOpen ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Order Form"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggleAiSidebar}
              className={`p-1.5 rounded text-xs transition-all ${
                isAiSidebarOpen ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle AI Copilot"
            >
              <Bot className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Mode Toggle (TradingView Style) */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`p-1.5 rounded-lg border text-xs transition-all ${
              isFullscreen
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700/60 text-slate-300 hover:text-white'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc / Shift+F)' : 'Full Screen Chart (Shift+F)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Floating Real-Time OHLCV Bar (TradingView Standard) */}
      {hoverOhlc && (
        <div className="flex items-center gap-4 px-4 py-1 bg-[#090d16]/90 border-t border-slate-800/50 text-[11px] font-mono text-slate-400 overflow-x-auto">
          <div className="flex items-center gap-3">
            <span>
              <span className="text-slate-500 mr-1 font-sans">O</span>
              <span className="text-slate-200">${formatMarketPrice(hoverOhlc.open, symbol)}</span>
            </span>
            <span>
              <span className="text-slate-500 mr-1 font-sans">H</span>
              <span className="text-slate-200">${formatMarketPrice(hoverOhlc.high, symbol)}</span>
            </span>
            <span>
              <span className="text-slate-500 mr-1 font-sans">L</span>
              <span className="text-slate-200">${formatMarketPrice(hoverOhlc.low, symbol)}</span>
            </span>
            <span>
              <span className="text-slate-500 mr-1 font-sans">C</span>
              <span className={hoverOhlc.close >= hoverOhlc.open ? 'text-emerald-400' : 'text-rose-400'}>
                ${formatMarketPrice(hoverOhlc.close, symbol)}
              </span>
            </span>
            <span className={`font-semibold ${hoverOhlc.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {hoverOhlc.change >= 0 ? '+' : ''}{formatMarketPrice(hoverOhlc.change, symbol)} ({hoverOhlc.changePercent?.toFixed(2)}%)
            </span>
            <span>
              <span className="text-slate-500 mr-1 font-sans">Vol</span>
              <span className="text-slate-300">
                {hoverOhlc.volume > 1000 ? `${(hoverOhlc.volume / 1000).toFixed(2)}K` : hoverOhlc.volume?.toFixed(1)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
