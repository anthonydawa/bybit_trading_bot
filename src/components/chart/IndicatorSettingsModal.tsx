import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  RotateCcw,
  Check,
  Eye,
  EyeOff,
  Palette,
  Hash
} from 'lucide-react';
import {
  AllIndicatorConfigs,
  IndicatorStyle,
  LineStyleType,
  DEFAULT_INDICATOR_CONFIGS
} from '../../lib/indicatorConfig';

interface IndicatorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  configs: AllIndicatorConfigs;
  onSaveConfigs: (newConfigs: AllIndicatorConfigs) => void;
  activeKey?: keyof AllIndicatorConfigs;
}

const COLOR_PALETTE = [
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#ffffff', // White
  '#94a3b8', // Slate
];

const INDICATOR_METADATA: Record<
  keyof AllIndicatorConfigs,
  { name: string; category: 'EMA' | 'Bands' | 'Oscillator'; description: string }
> = {
  ema9: { name: 'EMA 9 (Fast Trend)', category: 'EMA', description: 'Fast Exponential Moving Average for momentum scalp entries' },
  ema20: { name: 'EMA 20 (Short Trend)', category: 'EMA', description: 'Short-term dynamic support and resistance baseline' },
  ema50: { name: 'EMA 50 (Medium Trend)', category: 'EMA', description: 'Institutional pullback baseline and trend filter' },
  ema200: { name: 'EMA 200 (Macro Trend)', category: 'EMA', description: 'Major bull/bear macro trend demarcation line' },
  bollinger: { name: 'Bollinger Bands', category: 'Bands', description: 'Volatility envelope with standard deviation expansion/squeeze' },
  supertrend: { name: 'Supertrend', category: 'Bands', description: 'ATR-based trend-following stop and reversal baseline' },
  rsi: { name: 'Relative Strength Index', category: 'Oscillator', description: 'Momentum oscillator detecting overbought and oversold zones' },
  macd: { name: 'MACD', category: 'Oscillator', description: 'Moving Average Convergence Divergence trend momentum' },
};

export const IndicatorSettingsModal: React.FC<IndicatorSettingsModalProps> = ({
  isOpen,
  onClose,
  configs,
  onSaveConfigs,
  activeKey = 'ema9',
}) => {
  const [localConfigs, setLocalConfigs] = useState<AllIndicatorConfigs>(configs);
  const [selectedKey, setSelectedKey] = useState<keyof AllIndicatorConfigs>(activeKey);
  const [activeTab, setActiveTab] = useState<'style' | 'inputs'>('style');

  if (!isOpen) return null;

  const currentItem = localConfigs[selectedKey];
  const meta = INDICATOR_METADATA[selectedKey];

  const handleUpdateCurrent = (patch: Partial<IndicatorStyle>) => {
    setLocalConfigs((prev) => ({
      ...prev,
      [selectedKey]: {
        ...prev[selectedKey],
        ...patch,
      },
    }));
  };

  const handleSave = () => {
    onSaveConfigs(localConfigs);
    onClose();
  };

  const handleResetCurrent = () => {
    setLocalConfigs((prev) => ({
      ...prev,
      [selectedKey]: { ...DEFAULT_INDICATOR_CONFIGS[selectedKey] },
    }));
  };

  const handleResetAll = () => {
    if (window.confirm('Reset all indicators to default TradingView styling?')) {
      setLocalConfigs({ ...DEFAULT_INDICATOR_CONFIGS });
    }
  };

  // Keyboard Escape listener to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in font-sans select-none"
    >
      <div className="bg-[#0d131f] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Indicator Settings & Customization</h3>
              <p className="text-[11px] text-slate-400">Configure styles, line thickness (px), dash types, and inputs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Left Indicator Selector + Right Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Indicator Sidebar */}
          <div className="w-56 border-r border-slate-800 p-2 space-y-1 overflow-y-auto bg-slate-900/30">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
              Active Indicators
            </div>
            {(Object.keys(INDICATOR_METADATA) as (keyof AllIndicatorConfigs)[]).map((key) => {
              const item = localConfigs[key];
              const m = INDICATOR_METADATA[key];
              const isSelected = selectedKey === key;

              return (
                <div
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer text-xs transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-500/50 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{m.name}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocalConfigs((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], enabled: !prev[key].enabled },
                      }));
                    }}
                    className={`p-1 rounded text-[11px] transition-colors ${
                      item.enabled ? 'text-blue-400 hover:text-blue-300' : 'text-slate-600 hover:text-slate-400'
                    }`}
                    title={item.enabled ? 'Hide on chart' : 'Show on chart'}
                  >
                    {item.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right Editor Area */}
          <div className="flex-1 flex flex-col p-5 overflow-y-auto">
            {/* Indicator Title & Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shadow-md"
                    style={{ backgroundColor: currentItem.color }}
                  />
                  <span>{meta.name}</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{meta.description}</p>
              </div>

              {/* Tabs: Style vs Inputs */}
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('style')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'style'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Style
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('inputs')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'inputs'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Inputs
                </button>
              </div>
            </div>

            {/* STYLE TAB */}
            {activeTab === 'style' && (
              <div className="space-y-5">
                {/* 1. Visibility Checkbox */}
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentItem.enabled}
                    onChange={(e) => handleUpdateCurrent({ enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="font-semibold">Show on Chart (Visibility)</span>
                </label>

                {/* 2. Color Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    <span>Line Color</span>
                  </label>

                  {/* Preset Swatches */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {COLOR_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => handleUpdateCurrent({ color: hex })}
                        className={`w-7 h-7 rounded-xl border transition-all relative flex items-center justify-center ${
                          currentItem.color.toLowerCase() === hex.toLowerCase()
                            ? 'border-white scale-110 shadow-lg'
                            : 'border-slate-700 hover:scale-105'
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {currentItem.color.toLowerCase() === hex.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-black drop-shadow" />
                        )}
                      </button>
                    ))}

                    {/* Custom Color Input */}
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1">
                      <input
                        type="color"
                        value={currentItem.color.startsWith('#') ? currentItem.color : '#3b82f6'}
                        onChange={(e) => handleUpdateCurrent({ color: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={currentItem.color}
                        onChange={(e) => handleUpdateCurrent({ color: e.target.value })}
                        className="w-16 bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Line Width / Thickness Selector (1px, 2px, 3px, 4px) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Line Thickness (Width)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {([1, 2, 3, 4] as const).map((width) => (
                      <button
                        key={width}
                        type="button"
                        onClick={() => handleUpdateCurrent({ lineWidth: width })}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                          currentItem.lineWidth === width
                            ? 'bg-blue-600/20 border-blue-500 text-white font-bold shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs mb-1.5">{width} Pixel ({width}px)</span>
                        {/* Visual Thickness Line */}
                        <div
                          className="w-full rounded-full"
                          style={{
                            height: `${width}px`,
                            backgroundColor: currentItem.color,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Line Style Selector (Solid, Dashed, Dotted) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Line Style
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'solid' as LineStyleType, label: 'Solid', preview: 'border-solid' },
                      { type: 'dashed' as LineStyleType, label: 'Dashed', preview: 'border-dashed' },
                      { type: 'dotted' as LineStyleType, label: 'Dotted', preview: 'border-dotted' },
                    ].map((st) => (
                      <button
                        key={st.type}
                        type="button"
                        onClick={() => handleUpdateCurrent({ lineStyle: st.type })}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                          currentItem.lineStyle === st.type
                            ? 'bg-blue-600/20 border-blue-500 text-white font-bold shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span className="text-xs mb-1.5">{st.label}</span>
                        {/* Visual style preview */}
                        <div
                          className={`w-full ${st.preview}`}
                          style={{
                            borderTopWidth: `${currentItem.lineWidth}px`,
                            borderColor: currentItem.color,
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Live Preview Card */}
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Live Preview:</span>
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="text-xs font-mono font-bold text-white">
                      {meta.name} ({currentItem.lineWidth}px, {currentItem.lineStyle})
                    </span>
                    <div
                      className={`w-28 ${
                        currentItem.lineStyle === 'dashed'
                          ? 'border-dashed'
                          : currentItem.lineStyle === 'dotted'
                          ? 'border-dotted'
                          : 'border-solid'
                      }`}
                      style={{
                        borderTopWidth: `${currentItem.lineWidth}px`,
                        borderColor: currentItem.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* INPUTS TAB */}
            {activeTab === 'inputs' && (
              <div className="space-y-4">
                {/* Period / Length Input */}
                {currentItem.period !== undefined && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Length / Period (Candles)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={currentItem.period}
                      onChange={(e) => handleUpdateCurrent({ period: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Number of historical bars used for the calculation</p>
                  </div>
                )}

                {/* Bollinger Bands StdDev */}
                {selectedKey === 'bollinger' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Standard Deviation Multiplier
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0.5}
                      max={5}
                      value={currentItem.stdDev ?? 2}
                      onChange={(e) => handleUpdateCurrent({ stdDev: parseFloat(e.target.value) || 2 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Supertrend Multiplier */}
                {selectedKey === 'supertrend' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      ATR Multiplier (Factor)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min={0.5}
                      max={10}
                      value={currentItem.multiplier ?? 3}
                      onChange={(e) => handleUpdateCurrent({ multiplier: parseFloat(e.target.value) || 3 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* MACD Inputs */}
                {selectedKey === 'macd' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Fast Length</label>
                      <input
                        type="number"
                        min={1}
                        value={currentItem.fastPeriod ?? 12}
                        onChange={(e) => handleUpdateCurrent({ fastPeriod: parseInt(e.target.value) || 12 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Slow Length</label>
                      <input
                        type="number"
                        min={1}
                        value={currentItem.slowPeriod ?? 26}
                        onChange={(e) => handleUpdateCurrent({ slowPeriod: parseInt(e.target.value) || 26 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Signal Smoothing</label>
                      <input
                        type="number"
                        min={1}
                        value={currentItem.signalPeriod ?? 9}
                        onChange={(e) => handleUpdateCurrent({ signalPeriod: parseInt(e.target.value) || 9 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset {meta.name}</span>
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1.5 transition-colors"
            >
              Reset All
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
