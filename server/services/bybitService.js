import crypto from 'crypto';

class BybitService {
  constructor() {
    this.apiKey = process.env.BYBIT_API_KEY || '';
    this.apiSecret = process.env.BYBIT_API_SECRET || '';
    this.isTestnet = process.env.BYBIT_TESTNET === 'true';
    this.baseUrl = this.isTestnet
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';
    this.recvWindow = 5000;
  }

  setCredentials(apiKey, apiSecret, isTestnet = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.isTestnet = isTestnet;
    this.baseUrl = isTestnet
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';
  }

  /**
   * Generates Bybit V5 HMAC SHA256 signature
   * Signature payload: timestamp + apiKey + recvWindow + (queryString or body)
   */
  generateSignature(timestamp, apiKey, apiSecret, recvWindow, payloadString) {
    const message = `${timestamp}${apiKey}${recvWindow}${payloadString}`;
    return crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  }

  async makeRequest(method, endpoint, params = {}, customAuth = null) {
    const apiKey = customAuth?.apiKey || this.apiKey;
    const apiSecret = customAuth?.apiSecret || this.apiSecret;
    const isTestnet = customAuth?.isTestnet ?? this.isTestnet;
    const baseUrl = isTestnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';

    const timestamp = Date.now().toString();
    const recvWindow = this.recvWindow.toString();
    const headers = {
      'Content-Type': 'application/json',
    };

    let url = `${baseUrl}${endpoint}`;
    let body = undefined;

    if (apiKey && apiSecret) {
      headers['X-BAPI-API-KEY'] = apiKey;
      headers['X-BAPI-TIMESTAMP'] = timestamp;
      headers['X-BAPI-RECV-WINDOW'] = recvWindow;

      if (method.toUpperCase() === 'GET') {
        const queryParams = new URLSearchParams(params).toString();
        const signature = this.generateSignature(timestamp, apiKey, apiSecret, recvWindow, queryParams);
        headers['X-BAPI-SIGN'] = signature;
        if (queryParams) {
          url += `?${queryParams}`;
        }
      } else {
        const payloadString = JSON.stringify(params);
        body = payloadString;
        const signature = this.generateSignature(timestamp, apiKey, apiSecret, recvWindow, payloadString);
        headers['X-BAPI-SIGN'] = signature;
      }
    } else if (method.toUpperCase() === 'GET' && Object.keys(params).length > 0) {
      url += `?${new URLSearchParams(params).toString()}`;
    } else if (method.toUpperCase() === 'POST') {
      body = JSON.stringify(params);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
      });

      const data = await response.json();

      if (data.retCode !== 0) {
        throw new Error(data.retMsg || `Bybit error code: ${data.retCode}`);
      }

      return data.result;
    } catch (err) {
      console.error(`Bybit API [${endpoint}] Error:`, err.message);
      throw new Error(err.message);
    }
  }

  // 1. Get all Linear USDT Perpetual instruments
  async getInstruments(category = 'linear') {
    return this.makeRequest('GET', '/v5/market/instruments-info', { category, limit: 1000 });
  }

  // 2. Get 24hr tickers
  async getTickers(category = 'linear', symbol = '') {
    const params = { category };
    if (symbol) params.symbol = symbol;
    return this.makeRequest('GET', '/v5/market/tickers', params);
  }

  // 3. Get Kline Candlestick History (Bybit supports up to 1000 candles)
  async getKlines(symbol, interval = '15', limit = 1000, category = 'linear') {
    return this.makeRequest('GET', '/v5/market/kline', {
      category,
      symbol,
      interval,
      limit: Math.min(1000, limit).toString(),
    });
  }

  // 4. Get Orderbook
  async getOrderbook(symbol, category = 'linear', limit = 25) {
    return this.makeRequest('GET', '/v5/market/orderbook', {
      category,
      symbol,
      limit: limit.toString(),
    });
  }

  // 5. Get Wallet Balance
  async getWalletBalance(accountType = 'UNIFIED', customAuth = null) {
    return this.makeRequest('GET', '/v5/account/wallet-balance', { accountType }, customAuth);
  }

  // 6. Get Positions
  async getPositions(category = 'linear', symbol = '', customAuth = null) {
    const params = { category, settleCoin: 'USDT' };
    if (symbol) params.symbol = symbol;
    return this.makeRequest('GET', '/v5/position/list', params, customAuth);
  }

  // 7. Place Order
  async placeOrder({
    symbol,
    side,
    orderType = 'Market',
    qty,
    price,
    takeProfit,
    stopLoss,
    timeInForce = 'GTC',
    category = 'linear',
    positionIdx = 0,
    customAuth = null,
  }) {
    const payload = {
      category,
      symbol,
      side,
      orderType,
      qty: qty.toString(),
      timeInForce,
      positionIdx,
    };

    if (orderType === 'Limit' && price) {
      payload.price = price.toString();
    }
    if (takeProfit) {
      payload.takeProfit = takeProfit.toString();
      payload.tpTriggerBy = 'MarkPrice';
    }
    if (stopLoss) {
      payload.stopLoss = stopLoss.toString();
      payload.slTriggerBy = 'MarkPrice';
    }

    return this.makeRequest('POST', '/v5/order/create', payload, customAuth);
  }

  // 8. Cancel Order
  async cancelOrder(symbol, orderId, category = 'linear', customAuth = null) {
    return this.makeRequest('POST', '/v5/order/cancel', {
      category,
      symbol,
      orderId,
    }, customAuth);
  }

  // 9. Set Leverage
  async setLeverage(symbol, buyLeverage, sellLeverage, category = 'linear', customAuth = null) {
    return this.makeRequest('POST', '/v5/position/set-leverage', {
      category,
      symbol,
      buyLeverage: buyLeverage.toString(),
      sellLeverage: (sellLeverage || buyLeverage).toString(),
    }, customAuth);
  }
}

export const bybitService = new BybitService();
