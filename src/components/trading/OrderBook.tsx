import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, TrendingUp, TrendingDown, Layers } from 'lucide-react';
import { OrderBookData, OrderBookEntry } from '../../lib/types';
import { getMarketPrecision, formatMarketPrice, formatMarketQty } from '../../lib/marketUtils';

interface OrderBookProps {
  orderBook: OrderBookData;
  currentPrice: number;
  symbol?: string;
  onClose?: () => void;
  onSelectPrice?: (price: number) => void;
}

type OrderBookViewMode = 'both' | 'bids' | 'asks';

export const OrderBook: React.FC<OrderBookProps> = ({
  orderBook,
  currentPrice,
  symbol,
  onClose,
  onSelectPrice,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<OrderBookViewMode>('both');
  const [rowCapacity, setRowCapacity] = useState<number>(16);

  // Price direction tracker for flashing tick color
  const prevPriceRef = useRef<number>(currentPrice);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');

  useEffect(() => {
    if (currentPrice && prevPriceRef.current) {
      if (currentPrice > prevPriceRef.current) {
        setPriceDirection('up');
      } else if (currentPrice < prevPriceRef.current) {
        setPriceDirection('down');
      }
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  // Dynamically calculate how many rows fit the container height without any empty void
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateCapacity = () => {
      const h = el.clientHeight;
      // Fixed overhead: Header (~38px) + Controls (~28px) + Columns (~24px) + Spread (~36px) = ~126px
      const availableH = Math.max(160, h - 126);
      const rowHeight = 20; // 20px per row
      if (viewMode === 'both') {
        // Half for asks, half for bids
        const perSide = Math.max(8, Math.min(50, Math.floor(availableH / (rowHeight * 2))));
        setRowCapacity(perSide);
      } else {
        const full = Math.max(16, Math.min(50, Math.floor(availableH / rowHeight)));
        setRowCapacity(full);
      }
    };

    updateCapacity();
    const observer = new ResizeObserver(updateCapacity);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode]);

  // Market-specific precision and tick size specs
  const marketInfo = useMemo(() => {
    return getMarketPrecision(symbol || '', currentPrice);
  }, [symbol, currentPrice]);

  // Determine dynamic tick grouping options based on market tick size
  const tickOptions = useMemo(() => {
    const base = marketInfo.tickSize || 0.01;
    const multipliers = [1, 2, 5, 10, 50];
    const dec = marketInfo.precision;
    return multipliers.map((m) => {
      const val = base * m;
      return parseFloat(val.toFixed(dec)).toString();
    });
  }, [marketInfo]);

  const [tickSize, setTickSize] = useState<string>(tickOptions[0]);

  // Ensure tick size updates if market changes
  useEffect(() => {
    if (tickOptions.length > 0 && !tickOptions.includes(tickSize)) {
      setTickSize(tickOptions[0]);
    }
  }, [tickOptions, tickSize]);

  // Aggregate orderbook according to selected tick size
  const aggregateOrders = (orders: OrderBookEntry[], isAsk: boolean): OrderBookEntry[] => {
    const step = parseFloat(tickSize) || marketInfo.tickSize || 0.01;
    if (step <= 0) return orders;

    const grouped = new Map<number, number>();
    for (const item of orders) {
      const bucket = isAsk
        ? Math.ceil(item.price / step) * step
        : Math.floor(item.price / step) * step;
      const roundedBucket = parseFloat(bucket.toFixed(marketInfo.precision + 2));
      grouped.set(roundedBucket, (grouped.get(roundedBucket) || 0) + item.size);
    }

    const sortedPrices = Array.from(grouped.keys()).sort((a, b) =>
      isAsk ? a - b : b - a
    );

    let cumTotal = 0;
    return sortedPrices.map((p) => {
      const s = grouped.get(p) || 0;
      cumTotal += s;
      return { price: p, size: s, total: cumTotal };
    });
  };

  // Visible Asks: sorted highest on top down to best (lowest) ask at bottom
  const visibleAsks = useMemo(() => {
    const raw = orderBook.asks || [];
    const aggregated = aggregateOrders(raw, true);
    const count = viewMode === 'asks' ? rowCapacity * 2 : rowCapacity;
    // Take lowest `count` asks and reverse them so highest is at the top
    return aggregated.slice(0, count).reverse();
  }, [orderBook.asks, tickSize, rowCapacity, viewMode]);

  // Visible Bids: sorted highest (best) on top down
  const visibleBids = useMemo(() => {
    const raw = orderBook.bids || [];
    const aggregated = aggregateOrders(raw, false);
    const count = viewMode === 'bids' ? rowCapacity * 2 : rowCapacity;
    return aggregated.slice(0, count);
  }, [orderBook.bids, tickSize, rowCapacity, viewMode]);

  // Independent side max cumulative depth calculation for balanced depth gradients
  const maxAskDepth = useMemo(() => {
    if (visibleAsks.length === 0) return 1;
    return visibleAsks.reduce((max, a) => Math.max(max, a.total), 0) || 1;
  }, [visibleAsks]);

  const maxBidDepth = useMemo(() => {
    if (visibleBids.length === 0) return 1;
    return visibleBids.reduce((max, b) => Math.max(max, b.total), 0) || 1;
  }, [visibleBids]);

  // Calculate live spread between best ask and best bid
  const bestAsk = orderBook.asks[0]?.price || 0;
  const bestBid = orderBook.bids[0]?.price || 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPercent = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

  // Formatting helpers
  const formatPrice = (p: number) => {
    if (!p) return '--';
    return formatMarketPrice(p, symbol);
  };

  const formatSize = (s: number) => {
    if (!s) return '0.000';
    if (s >= 1000) return (s / 1000).toFixed(1) + 'k';
    return s.toFixed(3);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full bg-[#090d16] border-l border-slate-800 text-[11px] font-mono select-none overflow-hidden"
    >
      {/* 1. Header Toolbar */}
      <div className="px-3 py-2 border-b border-slate-800/80 text-[10px] font-semibold text-slate-300 flex items-center justify-between bg-slate-900/70 shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="tracking-wide uppercase font-sans">Order Book</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher (Both / Bids Only / Asks Only) */}
          <div className="flex items-center bg-slate-800/80 rounded p-0.5 border border-slate-700/60">
            {/* Both Mode */}
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'both' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Both Bids and Asks"
            >
              <div className="w-3 h-3 flex flex-col justify-between py-0.5">
                <div className="h-1 bg-rose-400 rounded-xs w-full" />
                <div className="h-1 bg-emerald-400 rounded-xs w-full" />
              </div>
            </button>

            {/* Bids Only */}
            <button
              type="button"
              onClick={() => setViewMode('bids')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'bids' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Bids Only"
            >
              <div className="w-3 h-3 flex flex-col justify-center gap-0.5 py-0.5">
                <div className="h-1 bg-emerald-400 rounded-xs w-full" />
                <div className="h-1 bg-emerald-400 rounded-xs w-full" />
              </div>
            </button>

            {/* Asks Only */}
            <button
              type="button"
              onClick={() => setViewMode('asks')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'asks' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Asks Only"
            >
              <div className="w-3 h-3 flex flex-col justify-center gap-0.5 py-0.5">
                <div className="h-1 bg-rose-400 rounded-xs w-full" />
                <div className="h-1 bg-rose-400 rounded-xs w-full" />
              </div>
            </button>
          </div>

          {/* Tick Size / Grouping Selector */}
          <select
            value={tickSize}
            onChange={(e) => setTickSize(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/60 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
            title="Tick Size Aggregation"
          >
            {tickOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* Minimize / Close Drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="Hide Order Book"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Column Titles (Strict 3-Column Tabular Grid) */}
      <div className="grid grid-cols-[1.1fr_0.9fr_1fr] px-3 py-1 text-[10px] font-sans font-medium text-slate-400 uppercase tracking-wider border-b border-slate-800/60 bg-[#0c101a] shrink-0">
        <span className="text-left">Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* 3. Asks Section (Red - Sell Orders) */}
      {(viewMode === 'both' || viewMode === 'asks') && (
        <div className="flex-1 flex flex-col justify-end overflow-hidden">
          {visibleAsks.length === 0 ? (
            <div className="text-center py-4 text-slate-600 text-[10px]">Loading Asks...</div>
          ) : (
            visibleAsks.map((ask, i) => {
              const depthPercent = Math.min(100, Math.max(5, (ask.total / maxAskDepth) * 100));
              return (
                <div
                  key={`ask-${ask.price}-${i}`}
                  onClick={() => onSelectPrice?.(ask.price)}
                  className="relative grid grid-cols-[1.1fr_0.9fr_1fr] items-center px-3 h-[20px] hover:bg-slate-800/60 cursor-pointer transition-colors group select-none"
                >
                  {/* Visual Cumulative Depth Gradient Bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 pointer-events-none transition-all duration-150"
                    style={{
                      width: `${depthPercent}%`,
                      background: 'linear-gradient(to left, rgba(244, 63, 94, 0.18), rgba(244, 63, 94, 0.02))',
                    }}
                  />
                  <span className="text-left text-rose-400 font-semibold relative z-10 tabular-nums">
                    {formatPrice(ask.price)}
                  </span>
                  <span className="text-right text-slate-200 relative z-10 tabular-nums">
                    {formatSize(ask.size)}
                  </span>
                  <span className="text-right text-slate-400 relative z-10 tabular-nums text-[10.5px]">
                    {formatSize(ask.total)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. Center: Live Spread & Last Price Bar */}
      <div className="px-3 py-1.5 bg-[#101622] border-y border-slate-800/90 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-sm font-bold font-mono tracking-tight ${
              priceDirection === 'up'
                ? 'text-emerald-400'
                : priceDirection === 'down'
                ? 'text-rose-400'
                : 'text-slate-100'
            }`}
          >
            ${currentPrice ? formatPrice(currentPrice) : '--'}
          </span>
          {priceDirection === 'up' && (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
          )}
          {priceDirection === 'down' && (
            <TrendingDown className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
          <span title={`Spread: $${formatMarketPrice(spread, symbol)} (${spreadPercent.toFixed(2)}%)`}>
            Sprd {formatMarketPrice(spread, symbol)}
          </span>
        </div>
      </div>

      {/* 5. Bids Section (Green - Buy Orders) */}
      {(viewMode === 'both' || viewMode === 'bids') && (
        <div className="flex-1 overflow-hidden">
          {visibleBids.length === 0 ? (
            <div className="text-center py-4 text-slate-600 text-[10px]">Loading Bids...</div>
          ) : (
            visibleBids.map((bid, i) => {
              const depthPercent = Math.min(100, Math.max(5, (bid.total / maxBidDepth) * 100));
              return (
                <div
                  key={`bid-${bid.price}-${i}`}
                  onClick={() => onSelectPrice?.(bid.price)}
                  className="relative grid grid-cols-[1.1fr_0.9fr_1fr] items-center px-3 h-[20px] hover:bg-slate-800/60 cursor-pointer transition-colors group select-none"
                >
                  {/* Visual Cumulative Depth Gradient Bar */}
                  <div
                    className="absolute right-0 top-0 bottom-0 pointer-events-none transition-all duration-150"
                    style={{
                      width: `${depthPercent}%`,
                      background: 'linear-gradient(to left, rgba(16, 185, 129, 0.18), rgba(16, 185, 129, 0.02))',
                    }}
                  />
                  <span className="text-left text-emerald-400 font-semibold relative z-10 tabular-nums">
                    {formatPrice(bid.price)}
                  </span>
                  <span className="text-right text-slate-200 relative z-10 tabular-nums">
                    {formatSize(bid.size)}
                  </span>
                  <span className="text-right text-slate-400 relative z-10 tabular-nums text-[10.5px]">
                    {formatSize(bid.total)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

