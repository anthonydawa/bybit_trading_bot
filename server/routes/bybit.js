import { Router } from 'express';
import { bybitService } from '../services/bybitService.js';

const router = Router();

// Helper to extract credentials if provided in headers/body
const getAuthFromReq = (req) => {
  const apiKey = req.headers['x-bybit-api-key'] || req.body?.apiKey;
  const apiSecret = req.headers['x-bybit-api-secret'] || req.body?.apiSecret;
  const isTestnet = req.headers['x-bybit-testnet'] === 'true' || req.body?.isTestnet;
  if (apiKey && apiSecret) {
    return { apiKey, apiSecret, isTestnet };
  }
  return null;
};

// 1. Get all linear perpetual symbols
router.get('/instruments', async (req, res) => {
  try {
    const category = req.query.category || 'linear';
    const result = await bybitService.getInstruments(category);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get tickers
router.get('/tickers', async (req, res) => {
  try {
    const category = req.query.category || 'linear';
    const symbol = req.query.symbol || '';
    const result = await bybitService.getTickers(category, symbol);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Kline History (Supports up to Bybit maximum 1000 candles)
router.get('/klines', async (req, res) => {
  try {
    const { symbol, interval = '15', limit = '1000', category = 'linear' } = req.query;
    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol query parameter is required' });
    }
    const maxLimit = Math.min(1000, Math.max(1, Number(limit) || 1000));
    const result = await bybitService.getKlines(symbol, interval, maxLimit, category);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Orderbook
router.get('/orderbook', async (req, res) => {
  try {
    const { symbol, category = 'linear', limit = '25' } = req.query;
    if (!symbol) {
      return res.status(400).json({ success: false, error: 'Symbol is required' });
    }
    const result = await bybitService.getOrderbook(symbol, category, Number(limit));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get Wallet Balance (Signed)
router.get('/balance', async (req, res) => {
  try {
    const customAuth = getAuthFromReq(req);
    const result = await bybitService.getWalletBalance('UNIFIED', customAuth);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get Open Positions (Signed)
router.get('/positions', async (req, res) => {
  try {
    const { symbol, category = 'linear' } = req.query;
    const customAuth = getAuthFromReq(req);
    const result = await bybitService.getPositions(category, symbol, customAuth);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Place Order (Signed)
router.post('/order', async (req, res) => {
  try {
    const {
      symbol,
      side,
      orderType,
      qty,
      price,
      takeProfit,
      stopLoss,
      timeInForce,
      category,
      leverage,
    } = req.body;

    const customAuth = getAuthFromReq(req);

    // If leverage specified, set leverage first
    if (leverage && symbol) {
      try {
        await bybitService.setLeverage(symbol, leverage, leverage, category || 'linear', customAuth);
      } catch (levErr) {
        // Continue if leverage already set
        console.log('Set leverage info:', levErr.message);
      }
    }

    const result = await bybitService.placeOrder({
      symbol,
      side,
      orderType,
      qty,
      price,
      takeProfit,
      stopLoss,
      timeInForce,
      category,
      customAuth,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Cancel Order (Signed)
router.post('/order/cancel', async (req, res) => {
  try {
    const { symbol, orderId, category = 'linear' } = req.body;
    const customAuth = getAuthFromReq(req);
    const result = await bybitService.cancelOrder(symbol, orderId, category, customAuth);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
