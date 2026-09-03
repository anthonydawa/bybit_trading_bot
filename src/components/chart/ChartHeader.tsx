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
  Settings,
  Sliders
} from 'lucide-react';
import { IndicatorSettings, TickerInfo } from '../../lib/types';
import { AllIndicatorConfigs, DEFAULT_INDICATOR_CONFIGS } from '../../lib/indicatorConfig';

interface ChartHeaderProps {
  symbol: string;
  ticker: TickerInfo | null;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  indicators: IndicatorSettings;
  indicatorConfigs?: AllIndicatorConfigs;
  onToggleIndicator: (key: keyof AllIndicatorConfigs) => void;
  onOpenIndicatorSettings?: (key?: keyof AllIndicatorConfigs) => void;
  onOpenTickerSelector: () => void;
  onAnalyzeChart: () => void;
  isAiAnalyzing?: boolean;

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

export const ChartHeader: React.FC<ChartHeaderProps> = ({
  symbol,
  ticker,
  timeframe,
  onTimeframeChange,
  indicators,
  indicatorConfigs = DEFAULT_INDICATOR_CONFIGS,
  onToggleIndicator,
  onOpenIndicatorSettings,
  onOpenTickerSelector,
  onAnalyzeChart,
  isAiAnalyzing = false,
  isOrderBookOpen,
  onToggleOrderBook,
  isOrderFormOpen,
  onToggleOrderForm,
  isAiSidebarOpen,
  onToggleAiSidebar,
}) => {
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);

  const priceChange = ticker?.price24hPcnt || 0;
  const isPositive = priceChange >= 0;

  const indicatorList: { key: keyof AllIndicatorConfigs; label: string }[] = [
    { key: 'ema9', label: `EMA ${indicatorConfigs.ema9.period || 9}` },
    { key: 'ema20', label: `EMA ${indicatorConfigs.ema20.period || 20}` },
    { key: 'ema50', label: `EMA ${indicatorConfigs.ema50.period || 50}` },
    { key: 'ema200', label: `EMA ${indicatorConfigs.ema200.period || 200}` },
    { key: 'bollinger', label: `Bollinger Bands (${indicatorConfigs.bollinger.period || 20}, ${indicatorConfigs.bollinger.stdDev || 2})` },
    { key: 'supertrend', label: `Supertrend (${indicatorConfigs.supertrend.period || 10}, ${indicatorConfigs.supertrend.multiplier || 3})` },
    { key: 'rsi', label: `RSI (${indicatorConfigs.rsi.period || 14})` },
    { key: 'macd', label: 'MACD (12, 26, 9)' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#0d131f] border-b border-slate-800/80 gap-2 select-none">
      {/* Left: Symbol & Stats */}
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
                ${ticker.lastPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <span className={`flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.2 rounded ${
                isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-3 text-slate-400 border-l border-slate-800 pl-3 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9px]">24h High</span>
                <span className="text-slate-200">${ticker.highPrice24h?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">24h Low</span>
                <span className="text-slate-200">${ticker.lowPrice24h?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px]">24h Vol</span>
                <span className="text-slate-200">
                  {ticker.volume24h ? (ticker.volume24h > 1000000 ? `${(ticker.volume24h / 1000000).toFixed(2)}M` : `${(ticker.volume24h / 1000).toFixed(1)}K`) : '0'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Center/Right: Timeframes, Indicators & Panel Sliders */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Timeframe Selector */}
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

          {/* Quick Gear Icon to open full Indicator Settings */}
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
                  Indicators & Overlays
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
                      className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/80 rounded-xl transition-all group"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleIndicator(item.key)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: cfg.color }}
                        />
                        <span className="font-medium text-slate-200">{item.label}</span>
                        <span className="text-[10px] text-slate-500">
                          {cfg.lineWidth}px
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowIndicatorMenu(false);
                            onOpenIndicatorSettings?.(item.key);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors opacity-60 group-hover:opacity-100"
                          title="Edit color, width, and style"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={() => onToggleIndicator(item.key)}
                          className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* AI Vision Snapshot Button */}
        <button
          onClick={onAnalyzeChart}
          disabled={isAiAnalyzing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 text-yellow-300 ${isAiAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAiAnalyzing ? 'Scanning...' : 'AI Vision'}</span>
        </button>

        {/* Panel Sliders Toggle Group */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 ml-1">
          {/* Order Book Slider Button */}
          <button
            onClick={onToggleOrderBook}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              isOrderBookOpen
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title={isOrderBookOpen ? 'Hide Order Book (Slide out)' : 'Show Order Book (Slide in)'}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Book</span>
          </button>

          {/* Trade Order Form Slider Button */}
          <button
            onClick={onToggleOrderForm}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              isOrderFormOpen
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title={isOrderFormOpen ? 'Hide Trade Order Form (Slide out)' : 'Show Trade Order Form (Slide in)'}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Trade</span>
          </button>

          {/* AI Copilot Slider Button */}
          <button
            onClick={onToggleAiSidebar}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              isAiSidebarOpen
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title={isAiSidebarOpen ? 'Hide AI Sidebar (Slide out)' : 'Show AI Sidebar (Slide in)'}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Copilot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
