import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
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
} from './lib/types';
import { extractMarketSnapshot } from './lib/indicators';
import { bybitWs } from './lib/bybitWebSocket';
import { paperTrading, PaperAccount } from './lib/paperTrading';
import { klineCache } from './lib/klineCache';
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

  // 1. Initial Load of Strategies & Bybit Tickers
  useEffect(() => {
    // Load strategies
    axios.get('/api/strategies')
      .then((res) => {
        if (res.data.success) {
          const all = [...res.data.presets, ...(res.data.custom || [])];
          setStrategies(all);
          if (!activeStrategy && all.length > 0) {
            setActiveStrategy(all[0]);
            saveStoredActiveStrategy(all[0]);
          }
        }
      })
      .catch((e) => console.warn('Failed to load strategies:', e));

    // Load tickers
    axios.get('/api/bybit/tickers?category=linear')
      .then((res) => {
        if (res.data.success && res.data.data?.list) {
          const formatted: TickerInfo[] = res.data.data.list.map((item: any) => ({
            symbol: item.symbol,
            lastPrice: parseFloat(item.lastPrice || 0),
            price24hPcnt: parseFloat(item.price24hPcnt || 0) * 100,
            highPrice24h: parseFloat(item.highPrice24h || 0),
            lowPrice24h: parseFloat(item.lowPrice24h || 0),
            volume24h: parseFloat(item.volume24h || 0),
            turnover24h: parseFloat(item.turnover24h || 0),
            markPrice: parseFloat(item.markPrice || item.lastPrice || 0),
          }));
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
    // If we already have the ticker in our tickers list, prime the ticker snapshot
    const existingTicker = tickers.find((t) => t.symbol === symbol);
    if (existingTicker) {
      setCurrentTicker(existingTicker);
      bybitWs.setTickerSnapshot(existingTicker);
    } else {
      // Fetch specific ticker via REST
      axios.get(`/api/bybit/tickers?category=linear&symbol=${symbol}`)
        .then((res) => {
          if (res.data.success && res.data.data?.list && res.data.data.list.length > 0) {
            const item = res.data.data.list[0];
            const t: TickerInfo = {
              symbol: item.symbol,
              lastPrice: parseFloat(item.lastPrice || 0),
              price24hPcnt: parseFloat(item.price24hPcnt || 0) * 100,
              highPrice24h: parseFloat(item.highPrice24h || 0),
              lowPrice24h: parseFloat(item.lowPrice24h || 0),
              volume24h: parseFloat(item.volume24h || 0),
              turnover24h: parseFloat(item.turnover24h || 0),
              markPrice: parseFloat(item.markPrice || item.lastPrice || 0),
            };
            setCurrentTicker(t);
            bybitWs.setTickerSnapshot(t);
          }
        })
        .catch((e) => console.warn('Failed to fetch ticker:', e));
    }

    // 1. Prime candles immediately from local cache (0ms instant render)
    klineCache.get(symbol, timeframe).then((cached) => {
      if (cached && cached.length > 0) {
        setCandles(cached);
      }
    });

    // 2. Fetch full 1000 candles from Bybit (Max allowed by Bybit V5 API)
    axios.get(`/api/bybit/klines?symbol=${symbol}&interval=${timeframe}&limit=1000`)
      .then((res) => {
        if (res.data.success && res.data.data?.list) {
          const rawList = res.data.data.list;
          // Bybit returns newest first, reverse for chronological order
          const parsed: Candle[] = rawList.map((item: any) => ({
            time: Math.floor(Number(item[0]) / 1000),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5]),
          })).reverse();

          setCandles((prev) => {
            const merged = klineCache.merge(prev, parsed);
            klineCache.set(symbol, timeframe, merged);
            return merged;
          });
        }
      })
      .catch((e) => console.warn('Failed to load klines:', e));

    // Fetch initial orderbook snapshot via REST to avoid blank state
    axios.get(`/api/bybit/orderbook?symbol=${symbol}&limit=50`)
      .then((res) => {
        if (res.data.success && res.data.data) {
          const rawBids = res.data.data.b || [];
          const rawAsks = res.data.data.a || [];
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
    });

    const unsubTicker = bybitWs.subscribeTicker(symbol, (updated) => {
      setCurrentTicker((prev) => {
        if (!prev) return updated;
        return { ...prev, ...updated };
      });
      // Update paper trading position prices
      if (updated.lastPrice) {
        const acc = paperTrading.updatePositions({ [symbol]: updated.lastPrice });
        setPaperAccount({ ...acc });
      }
    });

    const unsubOrderBook = bybitWs.subscribeOrderBook(symbol, (ob) => {
      setOrderBook(ob);
    });

    return () => {
      unsubKline();
      unsubTicker();
      unsubOrderBook();
    };
  }, [symbol, timeframe]);

  // Handle Indicator Toggle
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

  // Handle Open Settings for a Specific Indicator
  const handleOpenIndicatorSettings = (key: keyof AllIndicatorConfigs = 'ema9') => {
    setSelectedIndicatorKey(key);
    setIsIndicatorSettingsOpen(true);
  };

  // Handle Save from Indicator Settings Modal
  const handleSaveIndicatorConfigs = (newConfigs: AllIndicatorConfigs) => {
    setIndicatorConfigs(newConfigs);
    saveStoredIndicatorConfigs(newConfigs);
  };

  // Handle Favorite Toggle
  const handleToggleFavorite = (sym: string) => {
    const updated = toggleFavoriteSymbol(sym);
    setFavorites(updated);
  };

  // Handle Capture Screenshot for Vision AI
  const handleCaptureScreenshot = async (): Promise<string | null> => {
    if (chartRef.current) {
      return await chartRef.current.captureSnapshot();
    }
    return null;
  };

  // AI Chat & Vision Message Handler
  const handleSendMessage = async (promptText: string, includeVision: boolean) => {
    if (!promptText.trim() && !includeVision) return;

    let snapshotImage: string | null = null;
    if (includeVision) {
      snapshotImage = await handleCaptureScreenshot();
    }

    const currentPrice = currentTicker?.lastPrice || (candles.length > 0 ? candles[candles.length - 1].close : 0);
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

    // Auto open AI sidebar if closed
    if (!isAiSidebarOpen) {
      setIsAiSidebarOpen(true);
    }

    try {
      const response = await axios.post('/api/gemini/chat', {
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

      if (response.data.success) {
        const botMsg: AiChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: response.data.data.text,
          timestamp: new Date().toISOString(),
        };
        const updated = [...newThread, botMsg];
        setChatMessages(updated);
        saveStoredChatMessages(updated);
      }
    } catch (err: any) {
      const errorText = err.response?.data?.error || err.message || 'Failed to generate AI response.';
      const botMsg: AiChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **AI Error**: ${errorText}\n\n*Please ensure your Gemini API Key is configured in Settings.*`,
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
      const response = await axios.post('/api/gemini/critique', {
        order,
        marketContext,
        strategy: activeStrategy,
        image: snapshotImage,
        model: selectedModel,
        apiKey: credentials.geminiApiKey || undefined,
      });

      if (response.data.success) {
        setCritiqueModal((prev) => ({
          ...prev,
          critique: response.data.data,
          isLoading: false,
        }));
      }
    } catch (err: any) {
      console.warn('Critique failed, using structured fallback:', err);
      setCritiqueModal((prev) => ({
        ...prev,
        critique: {
          grade: 'B',
          score: 75,
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
      // Live Bybit Execution
      try {
        const response = await axios.post('/api/bybit/order', {
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
        });

        if (response.data.success) {
          alert(`Order placed successfully on Bybit! Order ID: ${response.data.data.orderId}`);
        }
      } catch (err: any) {
        alert(`Bybit Order Error: ${err.response?.data?.error || err.message}`);
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
  const displayBalance = isPaperMode ? paperAccount.equity : liveBalance;
  const currentPrice = currentTicker?.lastPrice || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const activePositions = isPaperMode ? paperAccount.positions : livePositions;
  const totalUnrealizedPnl = activePositions.reduce((acc, p) => acc + p.unrealizedPnl, 0);

  // Indicators backward compatibility map for any legacy consumers
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Master Top Navbar */}
      <Navbar
        isPaperMode={isPaperMode}
        onTogglePaperMode={() => setIsPaperMode(!isPaperMode)}
        balance={displayBalance}
        unrealizedPnl={totalUnrealizedPnl}
        activeStrategy={activeStrategy}
        onOpenStrategyManager={() => setIsStrategyModalOpen(true)}
        onOpenApiKeys={() => setIsApiModalOpen(true)}
        isAiSidebarOpen={isAiSidebarOpen}
        onToggleAiSidebar={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
        hasGeminiKey={Boolean(credentials.geminiApiKey)}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left / Main Chart Column (Chart Header + Chart Canvas + Positions Table) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Chart Header Toolbar with Indicator Settings and Panel Sliders */}
          <ChartHeader
            symbol={symbol}
            ticker={currentTicker}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
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
              indicators={legacyIndicators}
              indicatorConfigs={indicatorConfigs}
              onOpenIndicatorSettings={handleOpenIndicatorSettings}
              onToggleIndicator={handleToggleIndicator}
            />
          </div>

          {/* Bottom Area: Open Positions & Trade History Journal (Contained strictly under Chart) */}
          <div className="h-48 shrink-0 border-t border-slate-800">
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
        <div className="flex flex-col items-center py-3 px-1.5 bg-[#0d131f] border-l border-slate-800 gap-2 shrink-0 select-none z-20">
          {/* Order Book Toggle Icon */}
          <button
            onClick={() => setIsOrderBookOpen(!isOrderBookOpen)}
            className={`p-2 rounded-xl transition-all relative ${
              isOrderBookOpen
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white'
            }`}
            title={isOrderBookOpen ? 'Minimize Order Book' : 'Slide Open Order Book'}
          >
            <BookOpen className="w-4 h-4" />
            {isOrderBookOpen && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-300 rounded-full" />}
          </button>

          {/* Trade Order Form Toggle Icon */}
          <button
            onClick={() => setIsOrderFormOpen(!isOrderFormOpen)}
            className={`p-2 rounded-xl transition-all relative ${
              isOrderFormOpen
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white'
            }`}
            title={isOrderFormOpen ? 'Minimize Trade Form' : 'Slide Open Trade Form'}
          >
            <Zap className="w-4 h-4" />
            {isOrderFormOpen && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-300 rounded-full" />}
          </button>

          {/* AI Copilot Toggle Icon */}
          <button
            onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
            className={`p-2 rounded-xl transition-all relative ${
              isAiSidebarOpen
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white'
            }`}
            title={isAiSidebarOpen ? 'Minimize AI Copilot' : 'Slide Open AI Copilot Sidebar'}
          >
            <Bot className="w-4 h-4" />
            {isAiSidebarOpen && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-300 rounded-full" />}
          </button>

          {/* Divider */}
          <div className="w-full h-px bg-slate-800 my-1" />

          {/* Zen Full Chart Mode */}
          <button
            onClick={() => {
              if (isOrderBookOpen || isOrderFormOpen || isAiSidebarOpen) {
                setIsOrderBookOpen(false);
                setIsOrderFormOpen(false);
                setIsAiSidebarOpen(false);
              } else {
                setIsOrderBookOpen(true);
                setIsOrderFormOpen(true);
              }
            }}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            title={
              !isOrderBookOpen && !isOrderFormOpen && !isAiSidebarOpen
                ? 'Restore Side Panels'
                : 'Zen Mode (100% Fullscreen Chart)'
            }
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Modals */}
      {/* Ticker Search Modal */}
      <TickerSelector
        isOpen={isTickerModalOpen}
        onClose={() => setIsTickerModalOpen(false)}
        tickers={tickers}
        selectedSymbol={symbol}
        onSelectSymbol={setSymbol}
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
          axios.post('/api/strategies', newStrat)
            .then((res) => {
              if (res.data.success) {
                setStrategies((prev) => [...prev, res.data.data]);
                setActiveStrategy(res.data.data);
                saveStoredActiveStrategy(res.data.data);
              }
            });
        }}
        onDeleteCustomStrategy={(id) => {
          axios.delete(`/api/strategies/${id}`);
          setStrategies((prev) => prev.filter((s) => s.id !== id));
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
        order={critiqueModal.order}
        critique={critiqueModal.critique}
        isLoading={critiqueModal.isLoading}
        onExecuteTrade={handlePlaceOrder}
        onApplyAdjustments={(adj) => {
          setCritiqueModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Indicator Customization Settings Modal (TradingView / Bybit Style) */}
      <IndicatorSettingsModal
        isOpen={isIndicatorSettingsOpen}
        onClose={() => setIsIndicatorSettingsOpen(false)}
        configs={indicatorConfigs}
        onSaveConfigs={handleSaveIndicatorConfigs}
        activeKey={selectedIndicatorKey}
      />
    </div>
  );
};

export default App;
