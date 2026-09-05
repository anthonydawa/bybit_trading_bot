import React, { useState } from 'react';
import {
  X,
  CandlestickChart,
  Sliders,
  Hash,
  Palette,
  Zap,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  ChartCustomizationSettings,
  DEFAULT_CHART_SETTINGS,
} from '../../lib/chartSettingsStorage';

interface ChartSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChartCustomizationSettings;
  onSaveSettings: (settings: ChartCustomizationSettings) => void;
  symbol: string;
}

type SettingsTab = 'symbol' | 'statusLine' | 'scales' | 'canvas' | 'trading';

const PRESET_COLORS = [
  '#10b981', // Emerald Up
  '#ef4444', // Red Down
  '#22c55e', // Bright Green
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ffffff', // White
  '#94a3b8', // Slate
  '#090d16', // Dark Slate
  '#131722', // TradingView Dark
];

const BG_PRESETS = [
  { label: 'Deep Blue', value: '#090d16' },
  { label: 'TradingView Dark', value: '#131722' },
  { label: 'Pitch Black', value: '#000000' },
  { label: 'Midnight Grey', value: '#1e222d' },
];

export const ChartSettingsModal: React.FC<ChartSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  symbol,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('symbol');
  const [draft, setDraft] = useState<ChartCustomizationSettings>(settings);

  // Sync draft when opened or settings change
  React.useEffect(() => {
    if (isOpen) {
      setDraft(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleApply = () => {
    onSaveSettings(draft);
    onClose();
  };

  const handleResetDefaults = () => {
    setDraft({ ...DEFAULT_CHART_SETTINGS });
  };

  const updateDraft = (patch: Partial<ChartCustomizationSettings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const tabs: { id: SettingsTab; label: string; icon: React.FC<any> }[] = [
    { id: 'symbol', label: 'Symbol', icon: CandlestickChart },
    { id: 'statusLine', label: 'Status line', icon: Sliders },
    { id: 'scales', label: 'Scales and lines', icon: Hash },
    { id: 'canvas', label: 'Appearance', icon: Palette },
    { id: 'trading', label: 'Trading', icon: Zap },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans select-none">
      <div className="flex flex-col w-full max-w-2xl bg-[#1e222d] border border-[#2a2e39] rounded-2xl shadow-2xl overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2e39] bg-[#181b24]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-white tracking-wide">
              Chart settings
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
              {symbol}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Left sidebar tabs + Right panel settings) */}
        <div className="flex flex-1 overflow-hidden min-h-[380px]">
          {/* Left Tabs Sidebar */}
          <div className="w-48 bg-[#181b24] border-r border-[#2a2e39] p-2 space-y-1 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#2a2e39]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Settings Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-[#1e222d] text-xs text-slate-200">
            {/* 1. SYMBOL TAB */}
            {activeTab === 'symbol' && (
              <div className="space-y-4">
                <div className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">
                  Candlestick Colors
                </div>

                {/* Candle Body */}
                <div className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60">
                  <div>
                    <span className="font-medium text-slate-200 block">Body</span>
                    <span className="text-[11px] text-slate-400">Bullish & Bearish candle fill</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={draft.candleUpColor}
                        onChange={(e) => updateDraft({ candleUpColor: e.target.value })}
                        className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-emerald-400">Up</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={draft.candleDownColor}
                        onChange={(e) => updateDraft({ candleDownColor: e.target.value })}
                        className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-rose-400">Down</span>
                    </div>
                  </div>
                </div>

                {/* Borders */}
                <div className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60">
                  <div>
                    <span className="font-medium text-slate-200 block">Borders</span>
                    <span className="text-[11px] text-slate-400">Outer edge contours</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={draft.candleBorderUpColor}
                        onChange={(e) => updateDraft({ candleBorderUpColor: e.target.value })}
                        className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-emerald-400">Up</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={draft.candleBorderDownColor}
                        onChange={(e) => updateDraft({ candleBorderDownColor: e.target.value })}
                        className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-rose-400">Down</span>
                    </div>
                  </div>
                </div>

                {/* Wick */}
                <div className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60">
                  <div>
                    <span className="font-medium text-slate-200 block">Wick</span>
                    <span className="text-[11px] text-slate-400">High and low shadows</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={draft.wickColorUp}
                        onChange={(e) => updateDraft({ wickColorUp: e.target.value })}
                        className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-emerald-400">Up</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={draft.wickColorDown}
                        onChange={(e) => updateDraft({ wickColorDown: e.target.value })}
                        className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-rose-400">Down</span>
                    </div>
                  </div>
                </div>

                {/* Precision */}
                <div className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60">
                  <div>
                    <span className="font-medium text-slate-200 block">Precision</span>
                    <span className="text-[11px] text-slate-400">Decimal places formatted on price scale</span>
                  </div>
                  <select
                    value={draft.precision}
                    onChange={(e) => updateDraft({ precision: e.target.value as any })}
                    className="bg-[#181b24] border border-[#2a2e39] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="default">Default (Smart)</option>
                    <option value="2">2 decimals (1/100)</option>
                    <option value="4">4 decimals (1/10000)</option>
                    <option value="8">8 decimals (Crypto precision)</option>
                  </select>
                </div>

                {/* Timezone */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="font-medium text-slate-200 block">Time Zone</span>
                    <span className="text-[11px] text-slate-400">Exchange timestamp format</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 px-2.5 py-1 rounded bg-[#181b24] border border-[#2a2e39]">
                    UTC (Exchange standard)
                  </div>
                </div>
              </div>
            )}

            {/* 2. STATUS LINE TAB */}
            {activeTab === 'statusLine' && (
              <div className="space-y-4">
                <div className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">
                  Status Line Elements
                </div>

                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">OHLC Values</span>
                    <span className="text-[11px] text-slate-400">Show Open, High, Low, Close & Volume readout</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showOhlcBar}
                    onChange={(e) => updateDraft({ showOhlcBar: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Indicator Titles</span>
                    <span className="text-[11px] text-slate-400">Show name and inputs of active indicators</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showIndicatorTitles}
                    onChange={(e) => updateDraft({ showIndicatorTitles: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Indicator Values</span>
                    <span className="text-[11px] text-slate-400">Show real-time computed indicator coordinates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showIndicatorLabels}
                    onChange={(e) => updateDraft({ showIndicatorLabels: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            )}

            {/* 3. SCALES & LINES TAB */}
            {activeTab === 'scales' && (
              <div className="space-y-4">
                <div className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">
                  Price Scale & Placement
                </div>

                {/* Scale Placement */}
                <div className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60">
                  <div>
                    <span className="font-medium text-slate-200 block">Scale Placement</span>
                    <span className="text-[11px] text-slate-400">Pin price axis to right or left side</span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#181b24] p-0.5 rounded-lg border border-[#2a2e39]">
                    <button
                      type="button"
                      onClick={() => updateDraft({ scalePosition: 'left' })}
                      className={`px-2.5 py-1 rounded text-xs transition-all ${
                        draft.scalePosition === 'left'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraft({ scalePosition: 'right' })}
                      className={`px-2.5 py-1 rounded text-xs transition-all ${
                        draft.scalePosition === 'right'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Right
                    </button>
                  </div>
                </div>

                {/* Scale Mode */}
                <div className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60">
                  <div>
                    <span className="font-medium text-slate-200 block">Price Scale Mode</span>
                    <span className="text-[11px] text-slate-400">Linear, Percentage, Logarithmic, or Indexed</span>
                  </div>
                  <select
                    value={draft.scaleMode}
                    onChange={(e) => updateDraft({ scaleMode: e.target.value as any })}
                    className="bg-[#181b24] border border-[#2a2e39] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="normal">Regular (Linear)</option>
                    <option value="logarithmic">Logarithmic (Alt+L)</option>
                    <option value="percentage">Percentage (Alt+P)</option>
                    <option value="indexed">Indexed to 100</option>
                  </select>
                </div>

                {/* Invert Scale */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Invert Scale</span>
                    <span className="text-[11px] text-slate-400">Flip price vertical axis (Alt+I)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.invertScale}
                    onChange={(e) => updateDraft({ invertScale: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                {/* Symbol Last Price Label */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Symbol Last Price Label</span>
                    <span className="text-[11px] text-slate-400">Current market price badge on axis</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showLastPriceLabel}
                    onChange={(e) => updateDraft({ showLastPriceLabel: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                {/* High and Low Price Labels */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">High and Low Price Labels</span>
                    <span className="text-[11px] text-slate-400">Visible range peak and trough badges</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showHighLowLabels}
                    onChange={(e) => updateDraft({ showHighLowLabels: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                {/* Countdown to Bar Close */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Countdown To Bar Close</span>
                    <span className="text-[11px] text-slate-400">Timer showing seconds remaining on active candle</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showCountdown}
                    onChange={(e) => updateDraft({ showCountdown: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                {/* Symbol Last Price Line */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Symbol Last Price Line</span>
                    <span className="text-[11px] text-slate-400">Horizontal dashed line at last traded price</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showPriceLine}
                    onChange={(e) => updateDraft({ showPriceLine: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                {/* Indicator Name Labels */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Indicator Name Labels</span>
                    <span className="text-[11px] text-slate-400">Indicator name badges (EMA 50, EMA 200, etc.) on price scale</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showIndicatorNameLabels}
                    onChange={(e) => updateDraft({ showIndicatorNameLabels: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                {/* Indicator Value Labels */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Indicator Value Labels</span>
                    <span className="text-[11px] text-slate-400">Indicator real-time numerical value badges on price scale</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showIndicatorLabels}
                    onChange={(e) => updateDraft({ showIndicatorLabels: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                {/* Grid Lines */}
                <div className="py-2 space-y-2.5">
                  <div className="font-medium text-slate-200">Grid Lines</div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showGridVert}
                        onChange={(e) => updateDraft({ showGridVert: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0"
                      />
                      <span>Vertical grid</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showGridHorz}
                        onChange={(e) => updateDraft({ showGridHorz: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0"
                      />
                      <span>Horizontal grid</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">Grid Line Style</span>
                    <select
                      value={draft.gridStyle}
                      onChange={(e) => updateDraft({ gridStyle: e.target.value as any })}
                      className="bg-[#181b24] border border-[#2a2e39] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="dotted">Dotted</option>
                      <option value="dashed">Dashed</option>
                      <option value="solid">Solid</option>
                      <option value="none">None (Hidden)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 4. CANVAS / APPEARANCE TAB */}
            {activeTab === 'canvas' && (
              <div className="space-y-4">
                <div className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">
                  Canvas Appearance
                </div>

                {/* Background Color */}
                <div className="space-y-2 py-2 border-b border-[#2a2e39]/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-200 block">Background Color</span>
                      <span className="text-[11px] text-slate-400">Chart backdrop canvas theme</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draft.backgroundColor}
                        onChange={(e) => updateDraft({ backgroundColor: e.target.value })}
                        className="w-7 h-7 rounded border border-[#2a2e39] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-xs text-slate-300">{draft.backgroundColor}</span>
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="flex items-center gap-2 pt-1">
                    {BG_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => updateDraft({ backgroundColor: preset.value })}
                        className={`px-2.5 py-1 rounded text-[11px] border transition-all ${
                          draft.backgroundColor === preset.value
                            ? 'border-blue-500 bg-blue-500/20 text-white font-semibold'
                            : 'border-[#2a2e39] bg-[#181b24] text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Watermark */}
                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Watermark</span>
                    <span className="text-[11px] text-slate-400">Large background symbol emblem ({symbol})</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showWatermark}
                    onChange={(e) => updateDraft({ showWatermark: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            )}

            {/* 5. TRADING TAB */}
            {activeTab === 'trading' && (
              <div className="space-y-4">
                <div className="font-semibold text-white text-xs uppercase tracking-wider text-slate-400">
                  Trading & Execution Overlays
                </div>

                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Show Positions</span>
                    <span className="text-[11px] text-slate-400">Display open Bybit positions and entry badges on chart</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showPositionsOnChart}
                    onChange={(e) => updateDraft({ showPositionsOnChart: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between py-2 border-b border-[#2a2e39]/60 cursor-pointer">
                  <div>
                    <span className="font-medium text-slate-200 block">Execution Lines & TP/SL</span>
                    <span className="text-[11px] text-slate-400">Show Take-Profit, Stop-Loss, and Order limit lines</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.showExecutionLines}
                    onChange={(e) => updateDraft({ showExecutionLines: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-[#181b24] border-[#2a2e39] focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#2a2e39] bg-[#181b24]">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2e39] text-xs text-slate-400 hover:text-white hover:bg-[#2a2e39] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Apply Defaults</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-[#2a2e39] text-xs font-medium text-slate-300 hover:text-white hover:bg-[#2a2e39] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
