import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  X,
  Zap
} from 'lucide-react';
import { AiCritiqueResult, OrderFormData } from '../../lib/types';

interface TradeCritiqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderFormData | null;
  critique: AiCritiqueResult | null;
  isLoading: boolean;
  onExecuteTrade: (order: OrderFormData) => void;
  onApplyAdjustments: (adjustments: AiCritiqueResult['suggestedAdjustments']) => void;
}

export const TradeCritiqueModal: React.FC<TradeCritiqueModalProps> = ({
  isOpen,
  onClose,
  order,
  critique,
  isLoading,
  onExecuteTrade,
  onApplyAdjustments,
}) => {
  if (!isOpen || !order) return null;

  const isLong = order.side === 'Buy';

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/20';
      case 'B':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30 shadow-blue-500/20';
      case 'C':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 shadow-yellow-500/20';
      default:
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-rose-500/20';
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'EXECUTE':
        return { label: 'HIGH PROBABILITY SETUP', color: 'bg-emerald-600 text-white' };
      case 'CAUTION':
        return { label: 'PROCEED WITH CAUTION', color: 'bg-yellow-600 text-white' };
      default:
        return { label: 'UNFAVORABLE RISK / NO-GO', color: 'bg-rose-600 text-white' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-[#0d131f] border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>AI Trade Pre-Flight Critique</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                  isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {isLong ? 'LONG' : 'SHORT'} {order.symbol}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Quantitative checklist and strategy alignment scan
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

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-purple-200">
                Gemini is analyzing market structure, indicators & strategy...
              </span>
              <span className="text-xs text-slate-500">
                Evaluating chart vision snapshot and risk parameters
              </span>
            </div>
          ) : critique ? (
            <>
              {/* Score & Grade Header Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase ${
                      getVerdictBadge(critique.verdict).color
                    }`}>
                      {getVerdictBadge(critique.verdict).label}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Score: <strong className="text-white">{critique.score}/100</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                    {critique.summary}
                  </p>
                </div>

                {/* Grade Badge */}
                <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border-2 shadow-lg ${getGradeColor(critique.grade)}`}>
                  <span className="text-2xl font-black font-mono">{critique.grade}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wider">GRADE</span>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">Risk/Reward Ratio:</span>
                  <span className={`font-bold ${critique.riskRewardRatio >= 1.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    1 : {critique.riskRewardRatio}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">Liquidation Risk:</span>
                  <span className={`font-bold ${
                    critique.liquidationRisk === 'LOW' ? 'text-emerald-400' :
                    critique.liquidationRisk === 'MEDIUM' ? 'text-yellow-400' : 'text-rose-400'
                  }`}>
                    {critique.liquidationRisk}
                  </span>
                </div>
              </div>

              {/* Strategy Alignment Checklist */}
              {critique.checklist && critique.checklist.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Pre-Trade Checklist
                  </h3>
                  <div className="space-y-1.5">
                    {critique.checklist.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-start gap-2.5 text-xs"
                      >
                        {item.status === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : item.status === 'WARNING' ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-slate-200">{item.criterion}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.details}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Warning Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {critique.strengths && critique.strengths.length > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
                    <span className="font-semibold text-emerald-400 block mb-1">Key Strengths</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                      {critique.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {critique.risks && critique.risks.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs">
                    <span className="font-semibold text-rose-400 block mb-1">Risk Flags</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                      {critique.risks.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Suggested Adjustments */}
              {critique.suggestedAdjustments && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-purple-300 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-yellow-300" /> AI Suggested Optimization
                    </span>
                    {(critique.suggestedAdjustments.stopLoss || critique.suggestedAdjustments.takeProfit) && (
                      <button
                        onClick={() => onApplyAdjustments(critique.suggestedAdjustments)}
                        className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-semibold transition-all"
                      >
                        Apply to Order Form
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {critique.suggestedAdjustments.notes}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No critique available.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
          >
            Cancel & Adjust
          </button>

          <button
            onClick={() => {
              onExecuteTrade(order);
              onClose();
            }}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-white font-bold text-xs shadow-lg transition-all ${
              isLong
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
            }`}
          >
            <span>Proceed & Execute {isLong ? 'Long' : 'Short'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
