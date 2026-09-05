import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  Zap,
  Percent,
  ChevronRight
} from 'lucide-react';
import { OrderFormData, OrderSide, OrderType, Strategy } from '../../lib/types';
import { getMarketPrecision, formatMarketPrice, formatMarketQty } from '../../lib/marketUtils';

interface OrderFormProps {
  symbol: string;
  currentPrice: number;
  availableBalance: number;
  isPaperMode: boolean;
  activeStrategy: Strategy | null;
  onPlaceOrder: (order: OrderFormData) => void;
  onOpenCritique: (order: OrderFormData) => void;
  isSubmitting?: boolean;
  onClose?: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  symbol,
  currentPrice,
  availableBalance,
  isPaperMode,
  activeStrategy,
  onPlaceOrder,
  onOpenCritique,
  isSubmitting = false,
  onClose,
}) => {
  const [side, setSide] = useState<OrderSide>('Buy');
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [price, setPrice] = useState<string>('');
  const [usdtAmount, setUsdtAmount] = useState<string>('100');
  const [leverage, setLeverage] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [showTpSl, setShowTpSl] = useState<boolean>(true);

  useEffect(() => {
    if (currentPrice && (!price || orderType === 'Market')) {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType]);

  const marketPrecision = getMarketPrecision(symbol, currentPrice);
  const priceStep = marketPrecision.tickSize > 0 ? marketPrecision.tickSize.toString() : 'any';

  const numUsdt = parseFloat(usdtAmount) || 0;
  const numPrice = orderType === 'Market' ? currentPrice : parseFloat(price) || currentPrice;
  const numSl = parseFloat(stopLoss) || 0;
  const numTp = parseFloat(takeProfit) || 0;

  // Margin calculation
  const requiredMargin = leverage > 0 ? numUsdt / leverage : numUsdt;
  const positionQty = numPrice > 0 ? numUsdt / numPrice : 0;

  // Liquidation calculation
  const mmr = 0.005; // 0.5% MMR
  let estLiqPrice = 0;
  if (numPrice > 0 && leverage > 0) {
    if (side === 'Buy') {
      estLiqPrice = Math.max(0, numPrice * (1 - 1 / leverage + mmr));
    } else {
      estLiqPrice = numPrice * (1 + 1 / leverage - mmr);
    }
  }

  // Risk to Reward calculation
  let riskRewardRatio = 0;
  let estimatedLossUsdt = 0;
  let estimatedProfitUsdt = 0;

  if (numPrice > 0 && numSl > 0) {
    const riskPerUnit = Math.abs(numPrice - numSl);
    estimatedLossUsdt = riskPerUnit * positionQty;

    if (numTp > 0) {
      const rewardPerUnit = Math.abs(numTp - numPrice);
      estimatedProfitUsdt = rewardPerUnit * positionQty;
      if (riskPerUnit > 0) {
        riskRewardRatio = Number((rewardPerUnit / riskPerUnit).toFixed(2));
      }
    }
  }

  const handleQuickPercent = (pct: number) => {
    const margin = (availableBalance * pct) / 100;
    const totalNotional = margin * leverage;
    setUsdtAmount(totalNotional.toFixed(2));
  };

  const getFormData = (): OrderFormData => ({
    symbol,
    side,
    orderType,
    price: numPrice,
    usdtAmount: numUsdt,
    qty: positionQty,
    leverage,
    stopLoss: numSl > 0 ? numSl : null,
    takeProfit: numTp > 0 ? numTp : null,
    riskPercent: availableBalance > 0 ? (requiredMargin / availableBalance) * 100 : 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numUsdt <= 0) return;
    onPlaceOrder(getFormData());
  };

  const handleCritiqueClick = () => {
    onOpenCritique(getFormData());
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0d131f] border-l border-slate-800 text-xs select-none p-4 overflow-y-auto">
      {/* Header with Title and Minimize Button */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 font-bold text-white text-xs">
          <span>Trade Execution</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
            {symbol}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title="Minimize Order Form"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Side Toggle: Long vs Short */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl mb-4 border border-slate-800">
        <button
          type="button"
          onClick={() => setSide('Buy')}
          className={`flex items-center justify-center gap-1.5 py-2.5 font-bold rounded-lg transition-all ${
            side === 'Buy'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Long / Buy</span>
        </button>
        <button
          type="button"
          onClick={() => setSide('Sell')}
          className={`flex items-center justify-center gap-1.5 py-2.5 font-bold rounded-lg transition-all ${
            side === 'Sell'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Short / Sell</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Order Type: Market / Limit */}
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setOrderType('Market')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                orderType === 'Market'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => setOrderType('Limit')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                orderType === 'Limit'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Limit
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-mono">
            Avail: <strong className="text-slate-200">${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
        </div>

        {/* Limit Price Input */}
        {orderType === 'Limit' && (
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Limit Order Price</label>
            <div className="relative">
              <input
                type="number"
                step={priceStep}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                placeholder={formatMarketPrice(currentPrice, symbol) || '0.00'}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">USDT</span>
            </div>
          </div>
        )}

        {/* Position Size (USDT) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] text-slate-400">Position Notional (USDT)</label>
            <span className="text-[10px] text-slate-500 font-mono">
              Margin: ${requiredMargin.toFixed(2)}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="any"
              value={usdtAmount}
              onChange={(e) => setUsdtAmount(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
              placeholder="100.00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">USDT</span>
          </div>

          {/* Quick % buttons */}
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[10, 25, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleQuickPercent(pct)}
                className="py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-[11px] font-mono text-slate-400 hover:text-slate-200 transition-all"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Leverage Slider */}
        <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" /> Leverage
            </span>
            <span className="font-mono font-bold text-yellow-400 text-xs bg-yellow-400/10 px-2 py-0.5 rounded">
              {leverage}x
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="w-full accent-yellow-400 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
            <span>1x</span>
            <span>25x</span>
            <span>50x</span>
            <span>100x</span>
          </div>
        </div>

        {/* TP / SL Toggle & Inputs */}
        <div className="border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowTpSl(!showTpSl)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-300 hover:text-white mb-2"
          >
            <span>Take Profit / Stop Loss</span>
            <span className="text-[10px] text-blue-400">{showTpSl ? 'Hide' : 'Set TP/SL'}</span>
          </button>

          {showTpSl && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-emerald-400 font-medium">Take Profit Price</span>
                  {estimatedProfitUsdt > 0 && (
                    <span className="text-emerald-400 font-mono text-[10px]">
                      +${estimatedProfitUsdt.toFixed(2)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step={priceStep}
                  placeholder="Target Price..."
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-rose-400 font-medium">Stop Loss Price</span>
                  {estimatedLossUsdt > 0 && (
                    <span className="text-rose-400 font-mono text-[10px]">
                      -${estimatedLossUsdt.toFixed(2)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step={priceStep}
                  placeholder="Stop Price..."
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-white font-mono focus:border-rose-500 focus:outline-none"
                />
              </div>

              {/* R:R Banner */}
              {riskRewardRatio > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 font-mono text-[11px]">
                  <span className="text-slate-400">Risk/Reward:</span>
                  <span className={`font-bold ${riskRewardRatio >= 1.5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    1 : {riskRewardRatio}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order Details Summary */}
        <div className="space-y-1 text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
          <div className="flex justify-between">
            <span>Est. Liq Price:</span>
            <span className="text-rose-400 font-semibold">${formatMarketPrice(estLiqPrice, symbol)}</span>
          </div>
          <div className="flex justify-between">
            <span>Order Size:</span>
            <span className="text-slate-200">{formatMarketQty(positionQty, symbol)} {symbol.replace('USDT', '')}</span>
          </div>
          {activeStrategy && (
            <div className="flex justify-between pt-1 border-t border-slate-800/80 text-[10px]">
              <span className="text-blue-400">Strategy:</span>
              <span className="text-slate-300 truncate max-w-[140px]">{activeStrategy.name}</span>
            </div>
          )}
        </div>

        {/* AI Pre-Trade Critique Button */}
        <button
          type="button"
          onClick={handleCritiqueClick}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-purple-600/30 to-blue-600/30 hover:from-purple-600/50 hover:to-blue-600/50 border border-purple-500/40 text-purple-200 font-semibold transition-all group"
        >
          <Sparkles className="w-4 h-4 text-yellow-300 group-hover:scale-110 transition-transform" />
          <span>Critique Setup with AI</span>
        </button>

        {/* Submit Execution Button */}
        <button
          type="submit"
          disabled={isSubmitting || numUsdt <= 0}
          className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide text-white transition-all shadow-lg disabled:opacity-50 ${
            side === 'Buy'
              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
          }`}
        >
          {isSubmitting
            ? 'Executing Order...'
            : isPaperMode
            ? `Paper ${side === 'Buy' ? 'Buy / Long' : 'Sell / Short'} (${symbol})`
            : `Live Bybit ${side === 'Buy' ? 'Buy / Long' : 'Sell / Short'}`}
        </button>
      </form>
    </div>
  );
};
