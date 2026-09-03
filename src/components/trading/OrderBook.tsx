import React, { useMemo } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { OrderBookData } from '../../lib/types';

interface OrderBookProps {
  orderBook: OrderBookData;
  currentPrice: number;
  onClose?: () => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({ orderBook, currentPrice, onClose }) => {
  // Take top 10 asks and top 10 bids
  const asks = useMemo(() => {
    // Top 10 lowest asks, displayed with highest ask on top down to best (lowest) ask at bottom
    return orderBook.asks.slice(0, 10).reverse();
  }, [orderBook.asks]);

  const bids = useMemo(() => {
    // Top 10 highest bids, starting from best (highest) bid down
    return orderBook.bids.slice(0, 10);
  }, [orderBook.bids]);

  // Calculate maximum cumulative depth for proportioning depth bars
  const maxDepth = useMemo(() => {
    const maxAsk = asks.length > 0 ? (asks[0]?.total || asks[asks.length - 1]?.total || 1) : 1;
    const maxBid = bids.length > 0 ? (bids[bids.length - 1]?.total || 1) : 1;
    return Math.max(maxAsk, maxBid, 1);
  }, [asks, bids]);

  // Calculate spread between best ask and best bid
  const bestAsk = orderBook.asks[0]?.price || 0;
  const bestBid = orderBook.bids[0]?.price || 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPercent = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  // Determine decimal precision based on price scale
  const formatPrice = (p: number) => {
    if (!p) return '--';
    if (p >= 1000) return p.toFixed(2);
    if (p >= 1) return p.toFixed(3);
    if (p >= 0.01) return p.toFixed(4);
    return p.toFixed(6);
  };

  const formatSize = (s: number) => {
    if (!s) return '0.00';
    if (s >= 1000) return (s / 1000).toFixed(1) + 'k';
    return s.toFixed(3);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0d131f] border-l border-slate-800 text-[11px] font-mono select-none overflow-hidden">
      {/* Header with Title and Minimize Button */}
      <div className="px-3 py-2 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-1.5">
          <span>Order Book</span>
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              onClick={onClose}
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="Minimize Order Book"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Subheader Column Labels */}
      <div className="px-3 py-1 text-[9px] text-slate-500 uppercase tracking-wider flex justify-between border-b border-slate-800/40">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      {/* Asks (Sell Orders - Red, sorted highest to lowest) */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden py-0.5">
        {asks.length === 0 ? (
          <div className="text-center py-4 text-slate-600 text-[10px]">Loading Asks...</div>
        ) : (
          asks.map((ask, i) => {
            const depthPercent = Math.min(100, ((ask.total || ask.size) / maxDepth) * 100);
            return (
              <div
                key={`ask-${ask.price}-${i}`}
                className="relative flex items-center justify-between px-3 py-[2px] hover:bg-rose-500/10 cursor-pointer"
              >
                {/* Visual Cumulative Depth Bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none transition-all duration-150"
                  style={{ width: `${depthPercent}%` }}
                />
                <span className="text-rose-400 font-medium relative z-10">
                  {formatPrice(ask.price)}
                </span>
                <span className="text-slate-300 relative z-10">
                  {formatSize(ask.size)}
                </span>
                <span className="text-slate-500 relative z-10 text-[10px]">
                  {formatSize(ask.total || ask.size)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Center: Live Spread & Mark Price Banner */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-y border-slate-800 flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-emerald-400 font-bold text-xs">
            ${currentPrice ? formatPrice(currentPrice) : '--'}
          </span>
          <span className="text-[9px] text-slate-500 uppercase">Mark</span>
        </div>
        {spread > 0 && (
          <span className="text-[9px] text-slate-400" title="Spread">
            Sprd: {spread.toFixed(2)} ({spreadPercent.toFixed(2)}%)
          </span>
        )}
      </div>

      {/* Bids (Buy Orders - Green, sorted highest to lowest) */}
      <div className="flex-1 overflow-hidden py-0.5">
        {bids.length === 0 ? (
          <div className="text-center py-4 text-slate-600 text-[10px]">Loading Bids...</div>
        ) : (
          bids.map((bid, i) => {
            const depthPercent = Math.min(100, ((bid.total || bid.size) / maxDepth) * 100);
            return (
              <div
                key={`bid-${bid.price}-${i}`}
                className="relative flex items-center justify-between px-3 py-[2px] hover:bg-emerald-500/10 cursor-pointer"
              >
                {/* Visual Cumulative Depth Bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none transition-all duration-150"
                  style={{ width: `${depthPercent}%` }}
                />
                <span className="text-emerald-400 font-medium relative z-10">
                  {formatPrice(bid.price)}
                </span>
                <span className="text-slate-300 relative z-10">
                  {formatSize(bid.size)}
                </span>
                <span className="text-slate-500 relative z-10 text-[10px]">
                  {formatSize(bid.total || bid.size)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
