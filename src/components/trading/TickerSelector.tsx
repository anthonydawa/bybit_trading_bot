import React, { useState, useMemo } from 'react';
import { Search, Star, TrendingUp, TrendingDown, X, Flame } from 'lucide-react';
import { TickerInfo } from '../../lib/types';

interface TickerSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  tickers: TickerInfo[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  favorites: string[];
  onToggleFavorite: (symbol: string) => void;
}

type FilterTab = 'ALL' | 'FAVORITES' | 'GAINERS' | 'LOSERS' | 'VOLUME';

export const TickerSelector: React.FC<TickerSelectorProps> = ({
  isOpen,
  onClose,
  tickers,
  selectedSymbol,
  onSelectSymbol,
  favorites,
  onToggleFavorite,
}) => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('ALL');

  const filteredTickers = useMemo(() => {
    let list = [...tickers];

    if (search.trim()) {
      const q = search.toUpperCase();
      list = list.filter((t) => t.symbol.includes(q));
    }

    if (tab === 'FAVORITES') {
      list = list.filter((t) => favorites.includes(t.symbol));
    } else if (tab === 'GAINERS') {
      list.sort((a, b) => b.price24hPcnt - a.price24hPcnt);
    } else if (tab === 'LOSERS') {
      list.sort((a, b) => a.price24hPcnt - b.price24hPcnt);
    } else if (tab === 'VOLUME') {
      list.sort((a, b) => b.turnover24h - a.turnover24h);
    }

    return list;
  }, [tickers, search, tab, favorites]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-[#0d131f] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-yellow-400" />
            <h2 className="text-base font-bold text-white">Select Bybit Market</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {tickers.length} Pairs
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search coin (e.g. BTC, ETH, SOL, DOGE)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mt-3">
            {[
              { id: 'ALL' as const, label: 'All Pairs' },
              { id: 'FAVORITES' as const, label: `Favorites (${favorites.length})` },
              { id: 'VOLUME' as const, label: 'Top Volume' },
              { id: 'GAINERS' as const, label: 'Top Gainers' },
              { id: 'LOSERS' as const, label: 'Top Losers' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  tab === t.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Market Table List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
          {filteredTickers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No matching Bybit markets found.
            </div>
          ) : (
            filteredTickers.map((t) => {
              const isFav = favorites.includes(t.symbol);
              const isSelected = selectedSymbol === t.symbol;
              const isPos = t.price24hPcnt >= 0;

              return (
                <div
                  key={t.symbol}
                  onClick={() => {
                    onSelectSymbol(t.symbol);
                    onClose();
                  }}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-slate-800/60 cursor-pointer transition-all ${
                    isSelected ? 'bg-blue-600/10 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(t.symbol);
                      }}
                      className="text-slate-500 hover:text-yellow-400 p-1"
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-sm">{t.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          PERP
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Vol ${(t.turnover24h / 1000000).toFixed(2)}M
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-sm font-semibold text-slate-100">
                      ${t.lastPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </div>
                    <div className={`text-xs flex items-center justify-end gap-0.5 ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPos ? '+' : ''}{t.price24hPcnt?.toFixed(2)}%
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
