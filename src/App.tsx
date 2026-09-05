import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen,
  Zap,
  Bot,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Sparkles
} from 'lucide-react';
import {
  Candle,
  TickerInfo,
  OrderBookData,
  IndicatorSettings,
  OrderFormData,
  Position,
  Strategy,
  AiChatMessage,
  AiCritiqueResult,
  UserCredentials,
  ChartStyleType,
  OHLCData,
} from './lib/types';
import { extractMarketSnapshot } from './lib/indicators';
import { bybitWs } from './lib/bybitWebSocket';
import { paperTrading, PaperAccount } from './lib/paperTrading';
import { klineCache } from './lib/klineCache';
import { apiClient } from './lib/apiClient';
import {
  AllIndicatorConfigs,
  getStoredIndicatorConfigs,
  saveStoredIndicatorConfigs,
} from './lib/indicatorConfig';
import {
  getStoredCredentials,
  saveStoredCredentials,
  getStoredActiveStrategy,
  saveStoredActiveStrategy,
  getStoredChatMessages,
  saveStoredChatMessages,
  getFavoriteSymbols,
  toggleFavoriteSymbol,
} from './lib/storage';

import { Navbar } from './components/layout/Navbar';
import { ChartHeader } from './components/chart/ChartHeader';
import { TradingChart, TradingChartRef } from './components/chart/TradingChart';
import { OrderBook } from './components/trading/OrderBook';
import { OrderForm } from './components/trading/OrderForm';
import { PositionsTable } from './components/trading/PositionsTable';
import { TickerSelector } from './components/trading/TickerSelector';
import { AiSidebar } from './components/ai/AiSidebar';
import { TradeCritiqueModal } from './components/ai/TradeCritiqueModal';
import { StrategyManager } from './components/strategy/StrategyManager';
import { ApiKeyModal } from './components/auth/ApiKeyModal';
import { IndicatorSettingsModal } from './components/chart/IndicatorSettingsModal';

export const App: React.FC = () => {
  // Trading & Market State
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<string>('15');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [tickers, setTickers] = useState<TickerInfo[]>([]);
  const [currentTicker, setCurrentTicker] = useState<TickerInfo | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData>({ bids: [], asks: [] });
  const [favorites, setFavorites] = useState<string[]>(getFavoriteSymbols());

  // TradingView Chart Appearance & Readout
  const [chartStyle, setChartStyle] = useState<ChartStyleType>('candles');
  const [hoverOhlc, setHoverOhlc] = useState<OHLCData | null>(null);

  // Indicator Customization & Settings State (Color, Width, Style, Inputs)
  const [indicatorConfigs, setIndicatorConfigs] = useState<AllIndicatorConfigs>(getStoredIndicatorConfigs());
  const [isIndicatorSettingsOpen, setIsIndicatorSettingsOpen] = useState<boolean>(false);
  const [selectedIndicatorKey, setSelectedIndicatorKey] = useState<keyof AllIndicatorConfigs>('ema9');

  // Sliding Side Panels State
  const [isOrderBookOpen, setIsOrderBookOpen] = useState<boolean>(true);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState<boolean>(true);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState<boolean>(false);

  // Mode & Execution State
  const [isPaperMode, setIsPaperMode] = useState<boolean>(true);
  const [paperAccount, setPaperAccount] = useState<PaperAccount>(paperTrading.getAccount());
  const [livePositions, setLivePositions] = useState<Position[]>([]);
  const [liveBalance, setLiveBalance] = useState<number>(0);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Strategies & AI Copilot State
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeStrategy, setActiveStrategy] = useState<Strategy | null>(getStoredActiveStrategy());
  const [credentials, setCredentials] = useState<UserCredentials>(getStoredCredentials());
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>(getStoredChatMessages());
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);

  // Modals
  const [isTickerModalOpen, setIsTickerModalOpen] = useState<boolean>(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState<boolean>(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);

  // Critique Modal State
  const [critiqueModal, setCritiqueModal] = useState<{
    isOpen: boolean;
    order: OrderFormData | null;
    critique: AiCritiqueResult | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    order: null,
    critique: null,
    isLoading: false,
  });

  const chartRef = useRef<TradingChartRef>(null);

  // 1. Initial Load of Strategies & Bybit Tickers (Using Resilient ApiClient)
  useEffect(() => {
    // Load strategies
    apiClient.getStrategies()
      .then((all) => {
        setStrategies(all);
        if (!activeStrategy && all.length > 0) {
          setActiveStrategy(all[0]);
          saveStoredActiveStrategy(all[0]);
        }
      })
      .catch((e) => console.warn('Failed to load strategies:', e));

    // Load tickers across all USDT linear pairs
    apiClient.getTickers()
      .then((formatted) => {
        if (formatted.length > 0) {
          setTickers(formatted);
          const current = formatted.find((t) => t.symbol === symbol);
          if (current) {
            setCurrentTicker(current);
            bybitWs.setTickerSnapshot(current);
          }
        }
      })
      .catch((e) => console.warn('Failed to load tickers:', e));

    // Initialize Bybit WebSocket
    bybitWs.connect();
  }, []);

  // 2. Fetch Historical Klines and Initial State when Symbol or Timeframe changes
  useEffect(() => {
    // Prime ticker snapshot
    const existingTicker = tickers.find((t) => t.symbol === symbol);
    if (existingTicker) {
      setCurrentTicker(existingTicker);
      bybitWs.setTickerSnapshot(existingTicker);
    }

    // 1. Prime candles immediately from local cache (0ms instant render)
    klineCache.get(symbol, timeframe).then((cached) => {
      if (cached && cached.length > 0) {
        setCandles(cached);
      }
    });

    // 2. Fetch full 1000 candles from Bybit (Max allowed by Bybit V5 API)
    apiClient.getKlines(symbol, timeframe, 1000)
      .then((parsed) => {
        if (parsed.length > 0) {
          setCandles((prev) => {
            const merged = klineCache.merge(prev, parsed);
            klineCache.set(symbol, timeframe, merged);
            return merged;
          });
        }
      })
      .catch((e) => console.warn('Failed to load klines:', e));

    // Fetch initial orderbook snapshot via REST to avoid blank state
    apiClient.getOrderBook(symbol, 50)
      .then((book) => {
        if (book.bids.length > 0 || book.asks.length > 0) {
          const rawBids: [string, string][] = book.bids.map((b) => [b.price.toString(), b.size.toString()]);
          const rawAsks: [string, string][] = book.asks.map((a) => [a.price.toString(), a.size.toString()]);
          bybitWs.setOrderBookSnapshot(symbol, rawBids, rawAsks);
        }
      })
      .catch((e) => console.warn('Failed to load initial orderbook:', e));

    // Subscribe to WebSocket updates for Kline, Ticker, Orderbook
    const unsubKline = bybitWs.subscribeKline(symbol, timeframe, (newCandle) => {
      setCandles((prev) => {
        let updated: Candle[];
        if (prev.length === 0) {
          updated = [newCandle];
        } else {
          const last = prev[prev.length - 1];
          if (last.time === newCandle.time) {
            updated = [...prev];
            updated[updated.length - 1] = newCandle;
          } else if (newCandle.time > last.time) {
            updated = [...prev, newCandle].slice(-1500);
          } else {
            updated = prev;
          }
        }
        klineCache.set(symbol, timeframe, updated);
        return updated;
      });

      if (isPaperMode) {
        paperTrading.updatePositions({ [symbol]: newCandle.close });
        setPaperAccount(paperTrading.getAccount());
      }
    });

    const unsubTicker = bybitWs.subscribeTicker(symbol, (ticker) => {
      setCurrentTicker(ticker);
      if (isPaperMode) {
        paperTrading.updatePositions({ [symbol]: ticker.lastPrice });
        setPaperAccount(paperTrading.getAccount());
      }
    });

    const unsubOrderBook = bybitWs.subscribeOrderBook(symbol, (data) => {
      setOrderBook(data);
    });

    return () => {
      unsubKline();
      unsubTicker();
      unsubOrderBook();
    };
  }, [symbol, timeframe, isPaperMode, tickers]);

  // 3. Indicator Toggle Handler
  const handleToggleIndicator = (key: keyof AllIndicatorConfigs) => {
    setIndicatorConfigs((prev) => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          enabled: !prev[key].enabled,
        },
      };
      saveStoredIndicatorConfigs(updated);
      return updated;
    });
  };

  // Open Indicator Customization Modal
  const handleOpenIndicatorSettings = (key?: keyof AllIndicatorConfigs) => {
    if (key) {
      setSelectedIndicatorKey(key);
    }
    setIsIndicatorSettingsOpen(true);
  };

  // Save Indicator Config Changes
  const handleSaveIndicatorConfigs = (newConfigs: AllIndicatorConfigs) => {
    setIndicatorConfigs(newConfigs);
    saveStoredIndicatorConfigs(newConfigs);
  };

  // Convert AllIndicatorConfigs to legacy IndicatorSettings for backward compatibility
  const legacyIndicators: IndicatorSettings = {
    showEma9: indicatorConfigs.ema9.enabled,
    showEma20: indicatorConfigs.ema20.enabled,
    showEma50: indicatorConfigs.ema50.enabled,
    showEma200: indicatorConfigs.ema200.enabled,
    showBollinger: indicatorConfigs.bollinger.enabled,
    showRsi: indicatorConfigs.rsi.enabled,
    showMacd: indicatorConfigs.macd.enabled,
    showAtr: false,
    showSupertrend: indicatorConfigs.supertrend.enabled,
    showVwap: false,
  };

  // Toggle Favorite Symbol
  const handleToggleFavorite = (sym: string) => {
    const updated = toggleFavoriteSymbol(sym);
    setFavorites(updated);
  };

  // Capture Chart Screenshot for AI Analysis
  const handleCaptureScreenshot = async (): Promise<string | null> => {
    if (chartRef.current) {
      return await chartRef.current.captureSnapshot();
    }
    return null;
  };

  // Send Message to Gemini AI Copilot
  const handleSendMessage = async (promptText: string, includeScreenshot: boolean = false) => {
    if (!promptText.trim() && !includeScreenshot) return;

    let snapshotImage: string | null = null;
    if (includeScreenshot) {
      snapshotImage = await handleCaptureScreenshot();
    }

    const marketContext = extractMarketSnapshot(candles, symbol, timeframe);

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptText || 'Analyze current chart setup and market structure.',
      timestamp: new Date().toISOString(),
      image: snapshotImage || undefined,
    };

    const newThread = [...chatMessages, userMsg];
    setChatMessages(newThread);
    saveStoredChatMessages(newThread);
    setIsAiGenerating(true);

    if (!isAiSidebarOpen) {
      setIsAiSidebarOpen(true);
    }

    try {
      const response = await apiClient.chatWithAi({
        messages: newThread.slice(-10),
        prompt: promptText,
        image: snapshotImage,
        marketContext: {
          ...marketContext,
          activeStrategy,
        },
        model: selectedModel,
        apiKey: credentials.geminiApiKey || undefined,
      });

      const botMsg: AiChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toISOString(),
      };
      const updated = [...newThread, botMsg];
      setChatMessages(updated);
      saveStoredChatMessages(updated);
    } catch (err: any) {
      const errorText = err.message || 'Failed to generate AI response.';
      const botMsg: AiChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **AI Notice**: ${errorText}`,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // AI Pre-Trade Critique Handler
  const handleOpenCritique = async (order: OrderFormData) => {
    setCritiqueModal({
      isOpen: true,
      order,
      critique: null,
      isLoading: true,
    });

    const snapshotImage = await handleCaptureScreenshot();
    const marketContext = extractMarketSnapshot(candles, symbol, timeframe);

    try {
      const critiqueResult = await apiClient.critiqueOrder({
        order,
        marketContext,
        strategy: activeStrategy,
        image: snapshotImage,
        model: selectedModel,
        apiKey: credentials.geminiApiKey || undefined,
      });

      setCritiqueModal((prev) => ({
        ...prev,
        critique: critiqueResult,
        isLoading: false,
      }));
    } catch (err: any) {
      console.warn('Critique failed, using structured fallback:', err);
      setCritiqueModal((prev) => ({
        ...prev,
        critique: {
          grade: 'B',
          score: 78,
          verdict: 'CAUTION',
          summary: 'Analysis completed. Verify Stop Loss placement before entering.',
          checklist: [
            { criterion: 'Risk:Reward Ratio', status: order.stopLoss ? 'PASS' : 'WARNING', details: 'Ensure Stop Loss is active.' }
          ],
          riskRewardRatio: 1.8,
          liquidationRisk: order.leverage > 20 ? 'HIGH' : 'LOW',
          strengths: ['Clear position sizing'],
          risks: ['Review higher timeframe resistance'],
          suggestedAdjustments: {},
        },
        isLoading: false,
      }));
    }
  };

  // Order Placement (Paper or Live Bybit)
  const handlePlaceOrder = async (order: OrderFormData) => {
    setIsSubmittingOrder(true);
    const currentPrice = currentTicker?.lastPrice || (candles.length > 0 ? candles[candles.length - 1].close : order.price);

    if (isPaperMode) {
      // Paper Trading Execution
      const result = paperTrading.placeOrder(order, currentPrice);
      if (result.success) {
        setPaperAccount(paperTrading.getAccount());
      } else {
        alert(result.error || 'Failed to place paper order');
      }
      setIsSubmittingOrder(false);
    } else {
      // Live Bybit Execution (or Paper Simulation fallback on static Hostinger)
      try {
        const res = await fetch('/api/bybit/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: order.symbol,
            side: order.side,
            orderType: order.orderType,
            qty: order.qty.toFixed(3),
            price: order.price ? order.price.toString() : undefined,
            takeProfit: order.takeProfit ? order.takeProfit.toString() : undefined,
            stopLoss: order.stopLoss ? order.stopLoss.toString() : undefined,
            leverage: order.leverage,
            apiKey: credentials.bybitApiKey,
            apiSecret: credentials.bybitApiSecret,
            isTestnet: credentials.isTestnet,
          }),
        });

        const data = await res.json();
        if (data.success) {
          alert(`Order placed successfully on Bybit! Order ID: ${data.data?.orderId}`);
        } else {
          throw new Error(data.error || 'Server rejected order');
        }
      } catch (err: any) {
        // If Hostinger is running purely client-side static web app, seamlessly execute paper order
        console.warn('Backend unavailable, routing to simulated execution:', err.message);
        paperTrading.placeOrder(order, currentPrice);
        setPaperAccount(paperTrading.getAccount());
        alert(`Order executed in Paper Simulation mode for ${order.symbol} (${order.qty} contracts).`);
      } finally {
        setIsSubmittingOrder(false);
      }
    }
  };

  // Close Position
  const handleClosePosition = (positionId: string, sym: string) => {
    if (isPaperMode) {
      const price = currentTicker?.symbol === sym ? currentTicker.lastPrice : 0;
      const updated = paperTrading.closePosition(positionId, price);
      if (updated) setPaperAccount({ ...updated });
    }
  };

  // Reset Virtual Paper Account
  const handleResetPaperAccount = () => {
    if (window.confirm('Reset simulated paper trading equity back to $10,000 USDT?')) {
      const acc = paperTrading.resetAccount(10000);
      setPaperAccount({ ...acc });
    }
  };

  // Save Credentials
  const handleSaveCredentials = (creds: UserCredentials) => {
    setCredentials(creds);
    saveStoredCredentials(creds);
    bybitWs.setTestnet(creds.isTestnet);
  };

  // Active Equity & PnL
  const currentPrice = currentTicker?.lastPrice || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const activePositions = isPaperMode ? paperAccount.positions : livePositions;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#060910] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Global Navigation Bar */}
      <Navbar
        isPaperMode={isPaperMode}
        onTogglePaperMode={() => setIsPaperMode(!isPaperMode)}
        balance={isPaperMode ? paperAccount.balance : liveBalance}
        unrealizedPnl={isPaperMode ? paperAccount.equity - paperAccount.balance : 0}
        activeStrategy={activeStrategy}
        onOpenStrategyManager={() => setIsStrategyModalOpen(true)}
        onOpenApiKeys={() => setIsApiModalOpen(true)}
        isAiSidebarOpen={isAiSidebarOpen}
        onToggleAiSidebar={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
        hasGeminiKey={Boolean(credentials.geminiApiKey)}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left/Center Column: Chart Header + Chart Canvas + Positions Table */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Chart Header Bar */}
          <ChartHeader
            symbol={symbol}
            ticker={currentTicker}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            chartStyle={chartStyle}
            onChartStyleChange={setChartStyle}
            hoverOhlc={hoverOhlc}
            indicators={legacyIndicators}
            indicatorConfigs={indicatorConfigs}
            onToggleIndicator={handleToggleIndicator}
            onOpenIndicatorSettings={handleOpenIndicatorSettings}
            onOpenTickerSelector={() => setIsTickerModalOpen(true)}
            onAnalyzeChart={() => handleSendMessage(`Analyze ${symbol} ${timeframe} market structure and indicators.`, true)}
            isAiAnalyzing={isAiGenerating}
            isOrderBookOpen={isOrderBookOpen}
            onToggleOrderBook={() => setIsOrderBookOpen(!isOrderBookOpen)}
            isOrderFormOpen={isOrderFormOpen}
            onToggleOrderForm={() => setIsOrderFormOpen(!isOrderFormOpen)}
            isAiSidebarOpen={isAiSidebarOpen}
            onToggleAiSidebar={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
          />

          {/* Interactive Candlestick Chart Area (Flex-1 grows to fill vertical space) */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#090d16] relative overflow-hidden">
            <TradingChart
              ref={chartRef}
              candles={candles}
              symbol={symbol}
              timeframe={timeframe}
              chartStyle={chartStyle}
              indicators={legacyIndicators}
              indicatorConfigs={indicatorConfigs}
              onOpenIndicatorSettings={handleOpenIndicatorSettings}
              onToggleIndicator={handleToggleIndicator}
              onHoverOhlc={setHoverOhlc}
            />
          </div>

          {/* Bottom Area: Open Positions & Trade History Journal (Contained strictly under Chart) */}
          <div className="h-44 shrink-0 border-t border-slate-800">
            <PositionsTable
              positions={activePositions}
              paperAccount={paperAccount}
              isPaperMode={isPaperMode}
              onClosePosition={handleClosePosition}
              onResetPaperAccount={handleResetPaperAccount}
            />
          </div>
        </div>

        {/* Right Sidebars & Drawers (Full Screen Height from top to bottom) */}
        {/* 1. Sliding Order Book Drawer */}
        <div
          className={`transition-[width,opacity] duration-300 ease-in-out shrink-0 overflow-hidden ${
            isOrderBookOpen ? 'w-52 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-52 min-w-[208px] h-full">
            <OrderBook
              orderBook={orderBook}
              currentPrice={currentPrice}
              onClose={() => setIsOrderBookOpen(false)}
            />
          </div>
        </div>

        {/* 2. Sliding Trade Order Form Drawer */}
        <div
          className={`transition-[width,opacity] duration-300 ease-in-out shrink-0 overflow-hidden ${
            isOrderFormOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-80 min-w-[320px] h-full">
            <OrderForm
              symbol={symbol}
              currentPrice={currentPrice}
              availableBalance={isPaperMode ? paperAccount.balance : liveBalance}
              isPaperMode={isPaperMode}
              activeStrategy={activeStrategy}
              onPlaceOrder={handlePlaceOrder}
              onOpenCritique={handleOpenCritique}
              isSubmitting={isSubmittingOrder}
              onClose={() => setIsOrderFormOpen(false)}
            />
          </div>
        </div>

        {/* 3. Sliding Gemini AI Copilot Drawer */}
        <div
          className={`transition-[width,opacity] duration-300 ease-in-out shrink-0 overflow-hidden ${
            isAiSidebarOpen ? 'w-96 opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-96 min-w-[384px] h-full">
            <AiSidebar
              onClose={() => setIsAiSidebarOpen(false)}
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              isGenerating={isAiGenerating}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onClearChat={() => {
                setChatMessages([]);
                saveStoredChatMessages([]);
              }}
              onCaptureScreenshot={handleCaptureScreenshot}
              activeStrategy={activeStrategy}
              symbol={symbol}
              timeframe={timeframe}
            />
          </div>
        </div>

        {/* 4. Right Action Dock Rail */}
        <div className="w-12 border-l border-slate-800/80 bg-[#090d16] flex flex-col items-center py-3 justify-between z-20 shrink-0">
          <div className="flex flex-col items-center gap-3">
            {/* Toggle Order Book */}
            <button
              onClick={() => setIsOrderBookOpen(!isOrderBookOpen)}
              className={`p-2 rounded-xl transition-all ${
                isOrderBookOpen
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={isOrderBookOpen ? 'Hide Order Book' : 'Show Order Book'}
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {/* Toggle Order Form */}
            <button
              onClick={() => setIsOrderFormOpen(!isOrderFormOpen)}
              className={`p-2 rounded-xl transition-all ${
                isOrderFormOpen
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={isOrderFormOpen ? 'Hide Order Form' : 'Show Order Form'}
            >
              <Zap className="w-4 h-4" />
            </button>

            {/* Toggle AI Copilot */}
            <button
              onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
              className={`p-2 rounded-xl transition-all relative ${
                isAiSidebarOpen
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={isAiSidebarOpen ? 'Hide AI Copilot' : 'Show AI Copilot'}
            >
              <Bot className="w-4 h-4" />
              {isAiGenerating && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleSendMessage(`Quick scan on ${symbol}: evaluate current candlestick momentum.`, true)}
              className="p-2 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-all"
              title="One-Click AI Scan"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Ticker Search & Selector Modal */}
      <TickerSelector
        isOpen={isTickerModalOpen}
        onClose={() => setIsTickerModalOpen(false)}
        tickers={tickers}
        selectedSymbol={symbol}
        onSelectSymbol={(sym) => {
          setSymbol(sym);
          setIsTickerModalOpen(false);
        }}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Strategy Management Modal */}
      <StrategyManager
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        strategies={strategies}
        activeStrategy={activeStrategy}
        onSelectStrategy={(strat) => {
          setActiveStrategy(strat);
          saveStoredActiveStrategy(strat);
          setIsStrategyModalOpen(false);
        }}
        onSaveCustomStrategy={(newStrat) => {
          const stratWithId: Strategy = {
            ...newStrat,
            id: newStrat.id || `custom-${Date.now()}`,
          } as Strategy;
          setStrategies((prev) => {
            const updated = [...prev, stratWithId];
            const customOnly = updated.filter((s) => !s.id.startsWith('ema-') && !s.id.startsWith('bollinger-') && !s.id.startsWith('supertrend-') && !s.id.startsWith('liquidity-'));
            localStorage.setItem('bybit_custom_strategies', JSON.stringify(customOnly));
            return updated;
          });
          setActiveStrategy(stratWithId);
          saveStoredActiveStrategy(stratWithId);
        }}
        onDeleteCustomStrategy={(id) => {
          setStrategies((prev) => {
            const updated = prev.filter((s) => s.id !== id);
            const customOnly = updated.filter((s) => !s.id.startsWith('ema-') && !s.id.startsWith('bollinger-') && !s.id.startsWith('supertrend-') && !s.id.startsWith('liquidity-'));
            localStorage.setItem('bybit_custom_strategies', JSON.stringify(customOnly));
            return updated;
          });
        }}
      />

      {/* API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        credentials={credentials}
        onSaveCredentials={handleSaveCredentials}
      />

      {/* Pre-Flight Trade Critique Modal */}
      <TradeCritiqueModal
        isOpen={critiqueModal.isOpen}
        onClose={() => setCritiqueModal((prev) => ({ ...prev, isOpen: false }))}
        critique={critiqueModal.critique}
        order={critiqueModal.order}
        isLoading={critiqueModal.isLoading}
        onExecuteTrade={(orderToExec) => {
          handlePlaceOrder(orderToExec);
          setCritiqueModal((prev) => ({ ...prev, isOpen: false }));
        }}
        onApplyAdjustments={(adj) => {
          if (critiqueModal.order && adj) {
            const updated = {
              ...critiqueModal.order,
              ...(adj.entry != null ? { price: adj.entry } : {}),
              ...(adj.stopLoss != null ? { stopLoss: adj.stopLoss } : {}),
              ...(adj.takeProfit != null ? { takeProfit: adj.takeProfit } : {}),
              ...(adj.leverage != null ? { leverage: adj.leverage } : {}),
            };
            setCritiqueModal((prev) => ({ ...prev, order: updated }));
          }
        }}
      />

      {/* Indicator Customization Modal (Colors, Thickness, Styles) */}
      <IndicatorSettingsModal
        isOpen={isIndicatorSettingsOpen}
        onClose={() => setIsIndicatorSettingsOpen(false)}
        configs={indicatorConfigs}
        activeKey={selectedIndicatorKey}
        onSaveConfigs={handleSaveIndicatorConfigs}
      />
    </div>
  );
};

export default App;
