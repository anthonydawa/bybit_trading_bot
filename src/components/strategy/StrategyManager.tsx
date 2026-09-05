import React, { useState, useEffect } from 'react';
import {
  Compass,
  Plus,
  CheckCircle,
  Trash2,
  X,
  Sliders,
  ShieldCheck,
  Zap,
  Target
} from 'lucide-react';
import { Strategy } from '../../lib/types';

interface StrategyManagerProps {
  isOpen: boolean;
  onClose: () => void;
  strategies: Strategy[];
  activeStrategy: Strategy | null;
  onSelectStrategy: (strategy: Strategy) => void;
  onSaveCustomStrategy: (strategy: Partial<Strategy>) => void;
  onDeleteCustomStrategy: (id: string) => void;
}

export const StrategyManager: React.FC<StrategyManagerProps> = ({
  isOpen,
  onClose,
  strategies,
  activeStrategy,
  onSelectStrategy,
  onSaveCustomStrategy,
  onDeleteCustomStrategy,
}) => {
  const [showBuilder, setShowBuilder] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Trend Following');
  const [longCondition, setLongCondition] = useState('');
  const [shortCondition, setShortCondition] = useState('');
  const [stopLossRule, setStopLossRule] = useState('');
  const [takeProfitRule, setTakeProfitRule] = useState('');
  const [minRiskReward, setMinRiskReward] = useState('2.0');

  if (!isOpen) return null;

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveCustomStrategy({
      name: name.trim(),
      category,
      timeframes: ['15m', '1h'],
      description: `Custom quantitative strategy: ${name}`,
      rules: {
        longCondition,
        shortCondition,
        stopLoss: stopLossRule,
        takeProfit: takeProfitRule,
        minRiskReward: parseFloat(minRiskReward) || 2.0,
      },
      checklist: [
        'Is the trade aligned with main trend structure?',
        'Does the setup satisfy entry conditions?',
        'Is Stop Loss positioned safely with >= 1:2 R:R?',
      ],
    });

    setName('');
    setLongCondition('');
    setShortCondition('');
    setStopLossRule('');
    setTakeProfitRule('');
    setShowBuilder(false);
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
    >
      <div className="bg-[#0d131f] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Trading Strategies & Rules</h2>
              <p className="text-xs text-slate-400">
                Select an institutional template or build custom strategy rules for the AI to enforce
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {showBuilder ? 'Build New Strategy' : 'Available Strategies'}
          </span>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md"
          >
            {showBuilder ? (
              <span>Back to Library</span>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Create Custom Strategy</span>
              </>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {showBuilder ? (
            /* Custom Strategy Form */
            <form onSubmit={handleCreateCustom} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Strategy Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5m Breakout + VWAP Retest"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Trend Following">Trend Following</option>
                    <option value="Breakout">Breakout</option>
                    <option value="Mean Reversion">Mean Reversion</option>
                    <option value="Scalping">Scalping</option>
                    <option value="Smart Money Concepts">Smart Money Concepts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-emerald-400 font-semibold block mb-1">Long / Buy Entry Conditions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Price bounces off 20 EMA with RSI > 50 and Bullish Engulfing candle"
                  value={longCondition}
                  onChange={(e) => setLongCondition(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-rose-400 font-semibold block mb-1">Short / Sell Entry Conditions</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Price rejects 20 EMA with RSI < 50 and Bearish Engulfing candle"
                  value={shortCondition}
                  onChange={(e) => setShortCondition(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Stop Loss Placement Rule</label>
                  <input
                    type="text"
                    placeholder="e.g. 1.0 ATR below swing low or 50 EMA"
                    value={stopLossRule}
                    onChange={(e) => setStopLossRule(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Take Profit Target Rule</label>
                  <input
                    type="text"
                    placeholder="e.g. Prior liquidity high or 1:2.5 RR"
                    value={takeProfitRule}
                    onChange={(e) => setTakeProfitRule(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all"
              >
                Save & Activate Strategy
              </button>
            </form>
          ) : (
            /* Strategy Library List */
            strategies.map((strat) => {
              const isActive = activeStrategy?.id === strat.id;
              const isCustom = strat.id.startsWith('custom-');

              return (
                <div
                  key={strat.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-blue-600/10 border-blue-500/80 shadow-lg shadow-blue-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm">{strat.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-blue-400 border border-slate-700">
                        {strat.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCustom && (
                        <button
                          onClick={() => onDeleteCustomStrategy(strat.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Delete custom strategy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onSelectStrategy(strat)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isActive ? 'Active Active' : 'Select'}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">{strat.description}</p>

                  {/* Rules preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-emerald-400 font-bold block mb-0.5">LONG RULE:</span>
                      <span className="text-slate-300">{strat.rules.longCondition}</span>
                    </div>
                    <div>
                      <span className="text-rose-400 font-bold block mb-0.5">SHORT RULE:</span>
                      <span className="text-slate-300">{strat.rules.shortCondition}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
