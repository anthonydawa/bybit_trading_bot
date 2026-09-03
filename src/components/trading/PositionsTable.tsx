import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  XCircle,
  History,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Position } from '../../lib/types';
import { PaperAccount } from '../../lib/paperTrading';

interface PositionsTableProps {
  positions: Position[];
  paperAccount: PaperAccount;
  isPaperMode: boolean;
  onClosePosition: (positionId: string, symbol: string) => void;
  onResetPaperAccount: () => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  paperAccount,
  isPaperMode,
  onClosePosition,
  onResetPaperAccount,
}) => {
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'HISTORY'>('POSITIONS');

  return (
    <div className="flex flex-col h-full bg-[#0d131f] border-t border-slate-800 font-mono text-xs select-none">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('POSITIONS')}
            className={`flex items-center gap-2 pb-1 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'POSITIONS'
                ? 'text-blue-400 border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <span>Open Positions</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {positions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-2 pb-1 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'HISTORY'
                ? 'text-blue-400 border-blue-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Trade History</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300">
              {paperAccount.tradeHistory.length}
            </span>
          </button>
        </div>

        {isPaperMode && (
          <button
            onClick={onResetPaperAccount}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-all"
            title="Reset simulated $10,000 equity"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            <span>Reset Virtual $10k</span>
          </button>
        )}
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {activeTab === 'POSITIONS' ? (
          positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-xs">
              <span>No active positions open.</span>
              <span className="text-[10px] text-slate-600 mt-1">
                Configure your order and execute via Paper or Bybit Live mode.
              </span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase">
                  <th className="py-2.5 px-4 font-semibold">Symbol / Side</th>
                  <th className="py-2.5 px-3 font-semibold">Size</th>
                  <th className="py-2.5 px-3 font-semibold">Entry Price</th>
                  <th className="py-2.5 px-3 font-semibold">Mark Price</th>
                  <th className="py-2.5 px-3 font-semibold">Liq. Price</th>
                  <th className="py-2.5 px-3 font-semibold">Margin</th>
                  <th className="py-2.5 px-3 font-semibold">Unrealized PnL (ROI)</th>
                  <th className="py-2.5 px-3 font-semibold">TP / SL</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {positions.map((pos) => {
                  const isLong = pos.side === 'Buy';
                  const isProfit = pos.unrealizedPnl >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Symbol & Side */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{pos.symbol}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isLong
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isLong ? 'LONG' : 'SHORT'} {pos.leverage}x
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-2.5 px-3 text-slate-300">
                        {pos.size.toFixed(4)}
                      </td>

                      {/* Entry Price */}
                      <td className="py-2.5 px-3 text-slate-300">
                        ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>

                      {/* Mark Price */}
                      <td className="py-2.5 px-3 text-slate-200 font-semibold">
                        ${pos.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>

                      {/* Liquidation Price */}
                      <td className="py-2.5 px-3 text-rose-400">
                        ${pos.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>

                      {/* Margin */}
                      <td className="py-2.5 px-3 text-slate-400">
                        ${pos.margin.toFixed(2)}
                      </td>

                      {/* PnL & ROI */}
                      <td className="py-2.5 px-3">
                        <div className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                          <span className="ml-1 text-[10px] font-normal">
                            ({isProfit ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </td>

                      {/* TP / SL */}
                      <td className="py-2.5 px-3 text-[11px] text-slate-400">
                        <div>TP: <span className="text-emerald-400">{pos.takeProfit ? `$${pos.takeProfit}` : '--'}</span></div>
                        <div>SL: <span className="text-rose-400">{pos.stopLoss ? `$${pos.stopLoss}` : '--'}</span></div>
                      </td>

                      {/* Close Action */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id, pos.symbol)}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-semibold text-[11px] transition-all"
                        >
                          Market Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          /* Trade History Tab */
          paperAccount.tradeHistory.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No closed trades in history yet.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[10px] text-slate-500 uppercase">
                  <th className="py-2 px-4">Time</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3">Entry / Exit</th>
                  <th className="py-2 px-3">Realized PnL</th>
                  <th className="py-2 px-4 text-right">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paperAccount.tradeHistory.map((t) => {
                  const isProfit = t.pnl >= 0;
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-4 text-slate-500 text-[10px]">
                        {new Date(t.closedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-bold text-white">{t.symbol}</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          t.side === 'Buy' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {t.side === 'Buy' ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">
                        ${t.entryPrice.toFixed(2)} → ${t.exitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}${t.pnl.toFixed(2)} ({isProfit ? '+' : ''}{t.pnlPercent.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          {t.reason}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
};
