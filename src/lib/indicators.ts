import { Candle } from './types';

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface BollingerPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface SupertrendPoint {
  time: number;
  value: number;
  direction: 1 | -1; // 1 = bullish (green), -1 = bearish (red)
}

/**
 * Exponential Moving Average (EMA)
 * Seamlessly calculates from the very first candle (i = 0) with progressive smoothing.
 * Even if there are fewer candles than the requested period (e.g. 100 candles for EMA 200),
 * it dynamically renders the trend line across all available data and converges accurately.
 */
export function calculateEMA(candles: Candle[], period: number): IndicatorPoint[] {
  if (!candles || candles.length === 0) return [];
  const standardK = 2 / (period + 1);
  const result: IndicatorPoint[] = [];

  let prevEma = candles[0].close;
  result.push({ time: candles[0].time, value: Number(prevEma.toFixed(4)) });

  for (let i = 1; i < candles.length; i++) {
    // Dynamic progressive smoothing factor for warmup phase if fewer candles than period
    const k = i < period ? 2 / (i + 2) : standardK;
    const currentPrice = candles[i].close;
    const currentEma = currentPrice * k + prevEma * (1 - k);
    result.push({ time: candles[i].time, value: Number(currentEma.toFixed(4)) });
    prevEma = currentEma;
  }

  return result;
}

/**
 * Relative Strength Index (RSI)
 * Renders gracefully from initial candles with progressive smoothing.
 */
export function calculateRSI(candles: Candle[], period: number = 14): IndicatorPoint[] {
  if (!candles || candles.length < 2) return [];
  const result: IndicatorPoint[] = [];

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    const w = Math.min(period, i);
    if (i === 1) {
      avgGain = gain;
      avgLoss = loss;
    } else {
      avgGain = (avgGain * (w - 1) + gain) / w;
      avgLoss = (avgLoss * (w - 1) + loss) / w;
    }

    let rsi = 50;
    if (avgLoss === 0 && avgGain === 0) {
      rsi = 50;
    } else if (avgLoss === 0) {
      rsi = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }

    result.push({ time: candles[i].time, value: Number(rsi.toFixed(2)) });
  }

  return result;
}

/**
 * Bollinger Bands
 * Renders starting from candle 0 using expanding window until full period is reached.
 */
export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerPoint[] {
  if (!candles || candles.length === 0) return [];
  const result: BollingerPoint[] = [];

  for (let i = 0; i < candles.length; i++) {
    const windowSize = Math.min(period, i + 1);
    const slice = candles.slice(Math.max(0, i - windowSize + 1), i + 1);

    const mean = slice.reduce((acc, c) => acc + c.close, 0) / windowSize;
    const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / windowSize;
    const stdDev = Math.sqrt(variance);

    result.push({
      time: candles[i].time,
      middle: Number(mean.toFixed(4)),
      upper: Number((mean + stdDev * stdDevMultiplier).toFixed(4)),
      lower: Number((mean - stdDev * stdDevMultiplier).toFixed(4)),
    });
  }

  return result;
}

/**
 * Average True Range (ATR)
 * Starts from candle 0 with expanding true range smoothing.
 */
export function calculateATR(candles: Candle[], period: number = 14): IndicatorPoint[] {
  if (!candles || candles.length === 0) return [];
  const result: IndicatorPoint[] = [];

  let prevAtr = candles[0].high - candles[0].low;
  result.push({ time: candles[0].time, value: Number(prevAtr.toFixed(4)) });

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));

    const w = Math.min(period, i + 1);
    const currentAtr = (prevAtr * (w - 1) + tr) / w;
    result.push({ time: candles[i].time, value: Number(currentAtr.toFixed(4)) });
    prevAtr = currentAtr;
  }

  return result;
}

/**
 * Supertrend Indicator
 * Starts from candle 0 using adaptive ATR and trailing stops.
 */
export function calculateSupertrend(
  candles: Candle[],
  period: number = 10,
  multiplier: number = 3
): SupertrendPoint[] {
  if (!candles || candles.length === 0) return [];
  const atrs = calculateATR(candles, period);
  const atrMap = new Map(atrs.map((a) => [a.time, a.value]));

  const result: SupertrendPoint[] = [];
  let prevUpper = 0;
  let prevLower = 0;
  let prevSupertrend = 0;
  let prevDirection: 1 | -1 = 1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const atr = atrMap.get(c.time) || (c.high - c.low || 1);
    const hl2 = (c.high + c.low) / 2;

    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > 0) {
      finalUpper = (basicUpper < prevUpper || candles[i - 1].close > prevUpper) ? basicUpper : prevUpper;
      finalLower = (basicLower > prevLower || candles[i - 1].close < prevLower) ? basicLower : prevLower;
    }

    let direction: 1 | -1 = prevDirection;
    if (i > 0) {
      if (prevSupertrend === prevUpper) {
        direction = c.close > finalUpper ? 1 : -1;
      } else {
        direction = c.close < finalLower ? -1 : 1;
      }
    } else {
      direction = c.close >= hl2 ? 1 : -1;
    }

    const supertrend = direction === 1 ? finalLower : finalUpper;

    result.push({
      time: c.time,
      value: Number(supertrend.toFixed(4)),
      direction,
    });

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevSupertrend = supertrend;
    prevDirection = direction;
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdPoint[] {
  if (!candles || candles.length === 0) return [];

  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  const slowMap = new Map(slowEMA.map((item) => [item.time, item.value]));
  const macdValues: { time: number; value: number }[] = [];

  for (const fast of fastEMA) {
    const slowVal = slowMap.get(fast.time) ?? fast.value;
    macdValues.push({
      time: fast.time,
      value: fast.value - slowVal,
    });
  }

  const signalK = 2 / (signalPeriod + 1);
  const result: MacdPoint[] = [];

  let prevSignal = macdValues[0].value;
  for (let i = 0; i < macdValues.length; i++) {
    const k = i < signalPeriod ? 2 / (i + 2) : signalK;
    const currentMacd = macdValues[i].value;
    const currentSignal = i === 0 ? currentMacd : currentMacd * k + prevSignal * (1 - k);
    const histogram = currentMacd - currentSignal;

    result.push({
      time: macdValues[i].time,
      macd: Number(currentMacd.toFixed(4)),
      signal: Number(currentSignal.toFixed(4)),
      histogram: Number(histogram.toFixed(4)),
    });

    prevSignal = currentSignal;
  }

  return result;
}

/**
 * Extract comprehensive market context snapshot for Gemini AI Copilot
 */
export function extractMarketSnapshot(candles: Candle[], symbol: string, timeframe: string) {
  if (!candles || candles.length === 0) {
    return {
      symbol,
      timeframe,
      price: 0,
      trend: 'UNKNOWN',
      summary: 'Insufficient candle data',
    };
  }

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  const ema9 = calculateEMA(candles, 9);
  const ema20 = calculateEMA(candles, 20);
  const ema50 = calculateEMA(candles, 50);
  const ema200 = calculateEMA(candles, 200);
  const rsi = calculateRSI(candles, 14);
  const bb = calculateBollingerBands(candles, 20, 2);
  const supertrend = calculateSupertrend(candles, 10, 3);
  const atr = calculateATR(candles, 14);

  const valEma9 = ema9[ema9.length - 1]?.value ?? currentPrice;
  const valEma20 = ema20[ema20.length - 1]?.value ?? currentPrice;
  const valEma50 = ema50[ema50.length - 1]?.value ?? currentPrice;
  const valEma200 = ema200[ema200.length - 1]?.value ?? currentPrice;
  const valRsi = rsi[rsi.length - 1]?.value ?? 50;
  const valBb = bb[bb.length - 1] ?? { upper: currentPrice, middle: currentPrice, lower: currentPrice };
  const valSt = supertrend[supertrend.length - 1] ?? { value: currentPrice, direction: 1 };
  const valAtr = atr[atr.length - 1]?.value ?? 0;

  let trend = 'NEUTRAL';
  if (currentPrice > valEma50 && valEma50 > valEma200) {
    trend = 'BULLISH';
  } else if (currentPrice < valEma50 && valEma50 < valEma200) {
    trend = 'BEARISH';
  }

  return {
    symbol,
    timeframe,
    currentPrice,
    open: lastCandle.open,
    high: lastCandle.high,
    low: lastCandle.low,
    close: lastCandle.close,
    volume: lastCandle.volume,
    indicators: {
      ema9: valEma9,
      ema20: valEma20,
      ema50: valEma50,
      ema200: valEma200,
      rsi14: valRsi,
      bollinger: {
        upper: valBb.upper,
        middle: valBb.middle,
        lower: valBb.lower,
      },
      supertrend: {
        value: valSt.value,
        direction: valSt.direction === 1 ? 'BULLISH' : 'BEARISH',
      },
      atr14: valAtr,
    },
    trend,
    candlesCount: candles.length,
  };
}
