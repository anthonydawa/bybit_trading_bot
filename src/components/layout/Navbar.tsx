import React from 'react';
import {
  Sparkles,
  Compass,
  Settings,
  Shield,
  Activity,
  Zap,
  Flame,
  Key
} from 'lucide-react';
import { Strategy } from '../../lib/types';

interface NavbarProps {
  isPaperMode: boolean;
  onTogglePaperMode: () => void;
  balance: number;
  unrealizedPnl: number;
  activeStrategy: Strategy | null;
  onOpenStrategyManager: () => void;
  onOpenApiKeys: () => void;
  isAiSidebarOpen: boolean;
  onToggleAiSidebar: () => void;
  hasGeminiKey: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  isPaperMode,
  onTogglePaperMode,
  balance,
  unrealizedPnl,
  activeStrategy,
  onOpenStrategyManager,
  onOpenApiKeys,
  isAiSidebarOpen,
  onToggleAiSidebar,
  hasGeminiKey,
}) => {
  const isPnlPositive = unrealizedPnl >= 0;

  return (
    <header className="h-14 bg-[#0d131f] border-b border-slate-800 flex items-center justify-between px-4 z-30 select-none font-sans">
      {/* Brand & Exchange */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-white">BYBIT COPILOT</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 font-bold border border-purple-500/30">
                AI 3.7
              </span>
            </div>
          </div>
        </div>

        {/* Live / Paper Mode Switcher */}
        <div className="flex items-center ml-2">
          <button
            onClick={onTogglePaperMode}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
              isPaperMode
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 shadow-sm'
            }`}
            title="Click to toggle between Paper Simulation & Live Bybit Trading"
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${isPaperMode ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
            <span>{isPaperMode ? 'Paper Trading' : 'Live Bybit'}</span>
          </button>
        </div>
      </div>

      {/* Center: Active Strategy Pill */}
      <div className="hidden md:flex items-center">
        <button
          onClick={onOpenStrategyManager}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs transition-all group"
        >
          <Compass className="w-3.5 h-3.5 text-blue-400 group-hover:rotate-45 transition-transform" />
          <span className="text-slate-400">Strategy:</span>
          <span className="font-bold text-white max-w-[160px] truncate">
            {activeStrategy ? activeStrategy.name : 'Select Strategy'}
          </span>
        </button>
      </div>

      {/* Right: Balance, Settings & AI Toggle */}
      <div className="flex items-center gap-3">
        {/* Equity / Balance Card */}
        <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 font-mono text-xs">
          <span className="text-slate-400 text-[11px]">
            {isPaperMode ? 'Sim Equity:' : 'Bybit Bal:'}
          </span>
          <span className="font-bold text-slate-100">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {unrealizedPnl !== 0 && (
            <span className={`text-[10px] font-semibold ${isPnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({isPnlPositive ? '+' : ''}${unrealizedPnl.toFixed(2)})
            </span>
          )}
        </div>

        {/* API Keys Modal Button */}
        <button
          onClick={onOpenApiKeys}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs transition-all"
          title="API Keys & Settings"
        >
          <Key className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* AI Sidebar Toggle Button */}
        <button
          onClick={onToggleAiSidebar}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            isAiSidebarOpen
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 text-purple-200 border border-purple-500/40 hover:from-purple-600/30 hover:to-blue-600/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
          <span>Gemini AI</span>
        </button>
      </div>
    </header>
  );
};
