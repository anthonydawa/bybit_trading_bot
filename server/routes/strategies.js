import { Router } from 'express';

const router = Router();

// Preset built-in institutional strategies
const PRESET_STRATEGIES = [
  {
    id: 'ema-trend-master',
    name: 'EMA Trend Rider (20/50/200)',
    category: 'Trend Following',
    timeframes: ['15m', '1h', '4h'],
    description: 'Rides sustained multi-timeframe trends with 20/50/200 EMA alignment and pullback entries.',
    rules: {
      longCondition: 'Price > 200 EMA AND 20 EMA > 50 EMA. Pullback to 20/50 EMA dynamic support zone with RSI > 45-55 bouncing.',
      shortCondition: 'Price < 200 EMA AND 20 EMA < 50 EMA. Pullback to 20/50 EMA dynamic resistance zone with RSI < 55 rejection.',
      stopLoss: 'Placed 1 ATR or previous swing high/low beyond the 50 EMA.',
      takeProfit: 'Target next key liquidity level or 1:2.0 - 1:3.0 Risk/Reward ratio.',
      minRiskReward: 2.0,
      maxLeverage: 15,
    },
    checklist: [
      'Is 200 EMA sloping in trade direction?',
      'Are 20 & 50 EMAs ordered correctly?',
      'Is price testing the dynamic EMA ribbon?',
      'Is RSI holding above 50 (for Long) or below 50 (for Short)?',
      'Is Stop Loss safely behind swing structure?'
    ]
  },
  {
    id: 'bollinger-mean-reversion',
    name: 'Bollinger & RSI Mean Reversion',
    category: 'Mean Reversion',
    timeframes: ['5m', '15m', '1h'],
    description: 'Catches extreme exhaustion reversals when price pierces 2.0 Bollinger Bands with RSI divergence.',
    rules: {
      longCondition: 'Price touches or closes outside lower 2.0 SD Bollinger Band AND RSI(14) < 30 (Oversold) with bullish divergence or pin bar.',
      shortCondition: 'Price touches or closes outside upper 2.0 SD Bollinger Band AND RSI(14) > 70 (Overbought) with bearish divergence or shooting star.',
      stopLoss: 'Strict stop 0.5% - 1% beyond reversal candle wick.',
      takeProfit: 'TP1 at 20 EMA (Middle BB), TP2 at Opposite Bollinger Band.',
      minRiskReward: 1.8,
      maxLeverage: 20,
    },
    checklist: [
      'Did candle pierce outer Bollinger Band?',
      'Is RSI in extreme territory (<30 or >70)?',
      'Is there a visible reversal candle (hammer / pin bar)?',
      'Are we entering against a major multi-hour parabolic breakout? (Avoid if high volume breakout)',
    ]
  },
  {
    id: 'breakout-volume-expansion',
    name: 'Consolidation Breakout & Volatility Expansion',
    category: 'Breakout',
    timeframes: ['15m', '1h', '4h'],
    description: 'Exploits high-volatility expansions after Bollinger Band squeezes with 1.5x+ volume confirmation.',
    rules: {
      longCondition: 'Clear resistance breakout of 20+ candle consolidation box + Volume >= 1.5x 20-period average + MACD histogram expanding positive.',
      shortCondition: 'Clear support breakdown of 20+ candle consolidation box + Volume >= 1.5x 20-period average + MACD histogram expanding negative.',
      stopLoss: 'Placed just back inside the broken range boundary.',
      takeProfit: 'Target 1.5x - 2.5x the range height measured move.',
      minRiskReward: 2.0,
      maxLeverage: 10,
    },
    checklist: [
      'Was there a tight consolidation range prior to breakout?',
      'Did volume spike significantly on the breakout candle?',
      'Did the candle close decisively outside the range?',
      'Is MACD momentum accelerating?'
    ]
  },
  {
    id: 'smc-liquidity-sweep',
    name: 'Smart Money (SMC) & Liquidity Sweep',
    category: 'Smart Money Concepts',
    timeframes: ['5m', '15m', '1h'],
    description: 'Identifies institutional liquidity grabs above/below equal highs/lows followed by Fair Value Gap (FVG) retests.',
    rules: {
      longCondition: 'Liquidity sweep below key equal lows followed by rapid Market Structure Shift (MSS) bullish + retest of Fair Value Gap (FVG) or Order Block.',
      shortCondition: 'Liquidity sweep above key equal highs followed by rapid Market Structure Shift (MSS) bearish + retest of Fair Value Gap (FVG) or Bearish Order Block.',
      stopLoss: 'Below the liquidity sweep wick low / high.',
      takeProfit: 'Opposing liquidity pool / swing high / swing low.',
      minRiskReward: 2.5,
      maxLeverage: 12,
    },
    checklist: [
      'Was obvious liquidity swept (stop hunt)?',
      'Did market structure break cleanly on lower timeframe?',
      'Is there an unfilled Fair Value Gap (FVG)?',
      'Is the R:R at least 1:2.5 to target?'
    ]
  },
  {
    id: 'scalper-momentum-pro',
    name: 'Quick Momentum Scalper (1m - 5m)',
    category: 'Scalping',
    timeframes: ['1m', '3m', '5m'],
    description: 'High-frequency momentum scalp using Supertrend flips and 9/21 EMA ribbon momentum.',
    rules: {
      longCondition: 'Supertrend turns Green + 9 EMA crosses above 21 EMA + Price above VWAP.',
      shortCondition: 'Supertrend turns Red + 9 EMA crosses below 21 EMA + Price below VWAP.',
      stopLoss: 'Tight 0.4% - 0.8% or Supertrend line value.',
      takeProfit: '1:1.5 quick risk/reward or trailing stop.',
      minRiskReward: 1.5,
      maxLeverage: 25,
    },
    checklist: [
      'Is Supertrend aligned with 9/21 EMA?',
      'Is price respecting VWAP line?',
      'Is spread / slippage low on this ticker?'
    ]
  }
];

// In-memory store for custom user strategies (will sync with Supabase or localStorage on client)
let userStrategies = [];

// GET all preset and custom strategies
router.get('/', (req, res) => {
  res.json({
    success: true,
    presets: PRESET_STRATEGIES,
    custom: userStrategies,
  });
});

// POST save a new custom strategy
router.post('/', (req, res) => {
  try {
    const { name, category, timeframes, description, rules, checklist } = req.body;
    if (!name || !rules) {
      return res.status(400).json({ success: false, error: 'Strategy name and rules required' });
    }
    const newStrategy = {
      id: `custom-${Date.now()}`,
      name,
      category: category || 'Custom',
      timeframes: timeframes || ['15m'],
      description: description || '',
      rules,
      checklist: checklist || ['Check trend alignment', 'Verify Risk to Reward'],
      createdAt: new Date().toISOString(),
    };
    userStrategies.push(newStrategy);
    res.json({ success: true, data: newStrategy });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE a custom strategy
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  userStrategies = userStrategies.filter((s) => s.id !== id);
  res.json({ success: true, message: 'Strategy deleted' });
});

export default router;
