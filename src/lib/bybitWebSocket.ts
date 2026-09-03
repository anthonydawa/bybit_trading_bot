import { Candle, OrderBookData, OrderBookEntry, TickerInfo } from './types';

type KlineCallback = (candle: Candle) => void;
type TickerCallback = (ticker: TickerInfo) => void;
type OrderBookCallback = (data: OrderBookData) => void;

interface LocalOrderBook {
  bids: Map<number, number>; // price -> size
  asks: Map<number, number>; // price -> size
  lastEmitted: number;
}

class BybitWebSocketClient {
  private ws: WebSocket | null = null;
  private isTestnet: boolean = false;
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private currentSubscriptions: Set<string> = new Set();
  
  private onKlineListeners: Map<string, Set<KlineCallback>> = new Map();
  private onTickerListeners: Map<string, Set<TickerCallback>> = new Map();
  private onOrderBookListeners: Map<string, Set<OrderBookCallback>> = new Map();

  // Local stateful orderbooks to process Bybit snapshots and deltas
  private orderBooks: Map<string, LocalOrderBook> = new Map();

  // Local stateful tickers to prevent fields (high, low, volume) from disappearing on deltas
  private tickers: Map<string, TickerInfo> = new Map();

  constructor(isTestnet: boolean = false) {
    this.isTestnet = isTestnet;
  }

  public setTestnet(isTestnet: boolean) {
    if (this.isTestnet !== isTestnet) {
      this.isTestnet = isTestnet;
      this.reconnect();
    }
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = this.isTestnet
      ? 'wss://stream-testnet.bybit.com/v5/public/linear'
      : 'wss://stream.bybit.com/v5/public/linear';

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[Bybit WS] Connected to', url);
        this.startHeartbeat();
        // Resubscribe to active topics
        if (this.currentSubscriptions.size > 0) {
          this.send({
            op: 'subscribe',
            args: Array.from(this.currentSubscriptions),
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          // ignore non-json messages like pong
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Bybit WS] Error:', err);
      };

      this.ws.onclose = () => {
        console.log('[Bybit WS] Connection closed. Reconnecting in 3s...');
        this.stopHeartbeat();
        this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
      };
    } catch (err) {
      console.error('[Bybit WS] Failed to create WebSocket:', err);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 'ping' }));
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(data: any) {
    if (data.op === 'pong' || data.ret_msg === 'pong') {
      return;
    }

    const topic: string = data.topic;
    if (!topic) return;

    // Kline message: "kline.<interval>.<symbol>"
    if (topic.startsWith('kline.')) {
      const parts = topic.split('.');
      const interval = parts[1];
      const symbol = parts[2];
      const key = `${symbol}_${interval}`;
      const listeners = this.onKlineListeners.get(key);

      if (listeners && data.data && data.data.length > 0) {
        const item = data.data[0];
        const candle: Candle = {
          time: Math.floor(Number(item.start) / 1000),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume),
        };
        listeners.forEach((cb) => cb(candle));
      }
    }

    // Ticker message: "tickers.<symbol>"
    if (topic.startsWith('tickers.')) {
      const symbol = topic.replace('tickers.', '');
      this.handleTickerUpdate(symbol, data);
    }

    // Orderbook message: "orderbook.50.<symbol>"
    if (topic.startsWith('orderbook.')) {
      const parts = topic.split('.');
      const symbol = parts[2];
      this.handleOrderBookUpdate(symbol, data);
    }
  }

  public setTickerSnapshot(ticker: TickerInfo) {
    if (!ticker || !ticker.symbol) return;
    const existing = this.tickers.get(ticker.symbol) || { ...ticker };
    const merged: TickerInfo = {
      symbol: ticker.symbol,
      lastPrice: ticker.lastPrice ?? existing.lastPrice ?? 0,
      price24hPcnt: ticker.price24hPcnt ?? existing.price24hPcnt ?? 0,
      highPrice24h: ticker.highPrice24h ?? existing.highPrice24h ?? 0,
      lowPrice24h: ticker.lowPrice24h ?? existing.lowPrice24h ?? 0,
      volume24h: ticker.volume24h ?? existing.volume24h ?? 0,
      turnover24h: ticker.turnover24h ?? existing.turnover24h ?? 0,
      markPrice: ticker.markPrice ?? existing.markPrice ?? ticker.lastPrice ?? 0,
    };
    this.tickers.set(ticker.symbol, merged);

    const listeners = this.onTickerListeners.get(ticker.symbol);
    if (listeners) {
      listeners.forEach((cb) => cb({ ...merged }));
    }
  }

  private handleTickerUpdate(symbol: string, data: any) {
    const listeners = this.onTickerListeners.get(symbol);
    if (!listeners || listeners.size === 0 || !data.data) return;

    const item = data.data;
    let current = this.tickers.get(symbol);
    if (!current) {
      current = {
        symbol,
        lastPrice: 0,
        price24hPcnt: 0,
        highPrice24h: 0,
        lowPrice24h: 0,
        volume24h: 0,
        turnover24h: 0,
        markPrice: 0,
      };
      this.tickers.set(symbol, current);
    }

    // Update only defined fields from delta
    if (item.lastPrice != null && item.lastPrice !== '') {
      current.lastPrice = parseFloat(item.lastPrice);
    }
    if (item.price24hPcnt != null && item.price24hPcnt !== '') {
      current.price24hPcnt = parseFloat(item.price24hPcnt) * 100;
    }
    if (item.highPrice24h != null && item.highPrice24h !== '') {
      current.highPrice24h = parseFloat(item.highPrice24h);
    }
    if (item.lowPrice24h != null && item.lowPrice24h !== '') {
      current.lowPrice24h = parseFloat(item.lowPrice24h);
    }
    if (item.volume24h != null && item.volume24h !== '') {
      current.volume24h = parseFloat(item.volume24h);
    }
    if (item.turnover24h != null && item.turnover24h !== '') {
      current.turnover24h = parseFloat(item.turnover24h);
    }
    if (item.markPrice != null && item.markPrice !== '') {
      current.markPrice = parseFloat(item.markPrice);
    }

    // Emit merged full ticker object to listeners
    const payload = { ...current };
    listeners.forEach((cb) => cb(payload));
  }

  private handleOrderBookUpdate(symbol: string, data: any) {
    const listeners = this.onOrderBookListeners.get(symbol);
    if (!listeners || listeners.size === 0) return;

    let book = this.orderBooks.get(symbol);
    if (!book) {
      book = {
        bids: new Map(),
        asks: new Map(),
        lastEmitted: 0,
      };
      this.orderBooks.set(symbol, book);
    }

    const isSnapshot = data.type === 'snapshot';
    if (isSnapshot) {
      book.bids.clear();
      book.asks.clear();
    }

    // Process Bids
    const rawBids = data.data?.b || [];
    for (const [pStr, sStr] of rawBids) {
      const price = parseFloat(pStr);
      const size = parseFloat(sStr);
      if (size === 0) {
        book.bids.delete(price);
      } else {
        book.bids.set(price, size);
      }
    }

    // Process Asks
    const rawAsks = data.data?.a || [];
    for (const [pStr, sStr] of rawAsks) {
      const price = parseFloat(pStr);
      const size = parseFloat(sStr);
      if (size === 0) {
        book.asks.delete(price);
      } else {
        book.asks.set(price, size);
      }
    }

    // Throttle UI update emission to max ~15fps (66ms) to prevent UI jitter and flashing
    const now = Date.now();
    if (now - book.lastEmitted >= 60 || isSnapshot) {
      book.lastEmitted = now;
      this.emitOrderBook(symbol, book, listeners);
    }
  }

  private emitOrderBook(symbol: string, book: LocalOrderBook, listeners: Set<OrderBookCallback>) {
    // Sort Bids descending (highest price first)
    const sortedBids = Array.from(book.bids.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 30);

    // Sort Asks ascending (lowest price first)
    const sortedAsks = Array.from(book.asks.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, 30);

    let cumulativeBidTotal = 0;
    const bids: OrderBookEntry[] = sortedBids.map(([price, size]) => {
      cumulativeBidTotal += size;
      return { price, size, total: cumulativeBidTotal };
    });

    let cumulativeAskTotal = 0;
    const asks: OrderBookEntry[] = sortedAsks.map(([price, size]) => {
      cumulativeAskTotal += size;
      return { price, size, total: cumulativeAskTotal };
    });

    const payload: OrderBookData = { bids, asks };
    listeners.forEach((cb) => cb(payload));
  }

  public setOrderBookSnapshot(symbol: string, rawBids: [string, string][], rawAsks: [string, string][]) {
    let book = this.orderBooks.get(symbol);
    if (!book) {
      book = {
        bids: new Map(),
        asks: new Map(),
        lastEmitted: 0,
      };
      this.orderBooks.set(symbol, book);
    }
    book.bids.clear();
    book.asks.clear();

    for (const [pStr, sStr] of rawBids) {
      book.bids.set(parseFloat(pStr), parseFloat(sStr));
    }
    for (const [pStr, sStr] of rawAsks) {
      book.asks.set(parseFloat(pStr), parseFloat(sStr));
    }

    const listeners = this.onOrderBookListeners.get(symbol);
    if (listeners) {
      this.emitOrderBook(symbol, book, listeners);
    }
  }

  public subscribeKline(symbol: string, interval: string, callback: KlineCallback) {
    const topic = `kline.${interval}.${symbol}`;
    const key = `${symbol}_${interval}`;

    if (!this.onKlineListeners.has(key)) {
      this.onKlineListeners.set(key, new Set());
    }
    this.onKlineListeners.get(key)!.add(callback);

    if (!this.currentSubscriptions.has(topic)) {
      this.currentSubscriptions.add(topic);
      this.send({ op: 'subscribe', args: [topic] });
    }

    return () => {
      const listeners = this.onKlineListeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.onKlineListeners.delete(key);
          this.currentSubscriptions.delete(topic);
          this.send({ op: 'unsubscribe', args: [topic] });
        }
      }
    };
  }

  public subscribeTicker(symbol: string, callback: TickerCallback) {
    const topic = `tickers.${symbol}`;

    if (!this.onTickerListeners.has(symbol)) {
      this.onTickerListeners.set(symbol, new Set());
    }
    this.onTickerListeners.get(symbol)!.add(callback);

    if (!this.currentSubscriptions.has(topic)) {
      this.currentSubscriptions.add(topic);
      this.send({ op: 'subscribe', args: [topic] });
    }

    return () => {
      const listeners = this.onTickerListeners.get(symbol);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.onTickerListeners.delete(symbol);
          this.currentSubscriptions.delete(topic);
          this.send({ op: 'unsubscribe', args: [topic] });
          this.tickers.delete(symbol);
        }
      }
    };
  }

  public subscribeOrderBook(symbol: string, callback: OrderBookCallback) {
    const topic = `orderbook.50.${symbol}`;

    if (!this.onOrderBookListeners.has(symbol)) {
      this.onOrderBookListeners.set(symbol, new Set());
    }
    this.onOrderBookListeners.get(symbol)!.add(callback);

    if (!this.currentSubscriptions.has(topic)) {
      this.currentSubscriptions.add(topic);
      this.send({ op: 'subscribe', args: [topic] });
    }

    return () => {
      const listeners = this.onOrderBookListeners.get(symbol);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.onOrderBookListeners.delete(symbol);
          this.currentSubscriptions.delete(topic);
          this.send({ op: 'unsubscribe', args: [topic] });
          this.orderBooks.delete(symbol);
        }
      }
    };
  }

  public reconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.connect();
  }
}

export const bybitWs = new BybitWebSocketClient();
