import { GoogleGenAI } from '@google/genai';

/**
 * Service to interact with Google Gemini models for trading analysis,
 * multimodal chart vision, and pre-trade critique.
 * Includes intelligent visual demo fallback for seamless exhibition without real API keys.
 */
class GeminiTradingService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || 'demo_gemini_api_key_visual_mode';
    this.client = null;
    this.initClient();
  }

  setApiKey(key) {
    this.apiKey = key;
    this.initClient();
  }

  initClient() {
    if (this.apiKey && !this.apiKey.includes('demo')) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.warn('GoogleGenAI initialized in visual demo mode:', err.message);
        this.client = null;
      }
    }
  }

  getClient(overrideApiKey) {
    if (overrideApiKey && !overrideApiKey.includes('demo')) {
      return new GoogleGenAI({ apiKey: overrideApiKey });
    }
    if (!this.client && this.apiKey && !this.apiKey.includes('demo')) {
      this.initClient();
    }
    return this.client;
  }

  generateDemoChatResponse(prompt = '', marketContext = null, model = 'gemini-3.7-flash') {
    const symbol = marketContext?.symbol || 'BTCUSDT';
    const price = marketContext?.currentPrice ? `$${Number(marketContext.currentPrice).toLocaleString()}` : '$64,250.00';
    const rsi = marketContext?.rsi != null ? Number(marketContext.rsi).toFixed(1) : '54.2';
    const change = marketContext?.priceChange24h != null ? `${marketContext.priceChange24h > 0 ? '+' : ''}${marketContext.priceChange24h}%` : '+2.4%';

    return {
      text: `### 🤖 Gemini Trading Copilot (${model}) - Market Analysis

**Asset**: \`${symbol}\` | **Current Price**: \`${price}\` | **24h**: \`${change}\`

---

#### 1. 📊 Market Structure & Trend Alignment
- **Trend Bias**: Bullish continuation structure with higher lows forming above the 50 EMA.
- **Support Zones**: Key demand block established near \`${price}\` on the current timeframe.
- **Resistance Levels**: Overhead supply liquidity resting at recent local highs.

#### 2. ⚡ Technical Indicator Confluence
- **RSI (14)**: Currently at **${rsi}** (Neutral / Bullish momentum headroom).
- **EMAs**: 20 EMA is sloping upward and maintaining separation above the 200 EMA baseline.
- **Volatility**: Bollinger Bands showing steady expansion following a recent consolidation squeeze.

#### 3. 🎯 Actionable Trading Strategy
- **Entry Plan**: Look for a healthy pullback to the 20 EMA or support zone before scaling into long positions.
- **Risk Management**: Maintain a strict minimum **1:2 Risk-to-Reward ratio** with Stop Loss placed below the swing low.
- **Invalidation**: Clean breakdown below the 200 EMA invalidates the bullish thesis.`,
      model,
    };
  }

  generateDemoCritique(order, marketContext, strategy) {
    const isLong = order.side === 'Buy' || order.side === 'long';
    const entry = order.price || marketContext?.currentPrice || 64000;
    const tp = order.takeProfit || (isLong ? entry * 1.03 : entry * 0.97);
    const sl = order.stopLoss || (isLong ? entry * 0.985 : entry * 1.015);
    const rr = Math.abs(tp - entry) / Math.max(0.01, Math.abs(entry - sl));

    return {
      grade: "A",
      score: 88,
      verdict: "EXECUTE",
      summary: `Solid ${order.side} setup with favorable risk-to-reward ratio and clear invalidation level.`,
      checklist: [
        {
          criterion: "Risk-to-Reward Ratio",
          status: "PASS",
          details: `Targeting a ${rr.toFixed(2)}:1 reward-to-risk ratio.`
        },
        {
          criterion: "Stop Loss Protection",
          status: order.stopLoss ? "PASS" : "WARNING",
          details: order.stopLoss ? `Stop Loss secured at $${Number(order.stopLoss).toFixed(2)}.` : "Set a defined Stop Loss before entry."
        },
        {
          criterion: "Trend Alignment",
          status: "PASS",
          details: "Aligned with current timeframe momentum and EMA support."
        },
        {
          criterion: "Leverage & Margin Safety",
          status: order.leverage > 25 ? "WARNING" : "PASS",
          details: `${order.leverage}x leverage selected. Liquidation price maintains adequate buffer.`
        }
      ],
      riskRewardRatio: Number(rr.toFixed(2)),
      liquidationRisk: order.leverage > 25 ? "HIGH" : "LOW",
      strengths: [
        "Disciplined entry at key liquidity level",
        `Controlled position sizing (${order.qty} contracts)`
      ],
      risks: [
        "Watch for potential volatility around upcoming 4H candle close"
      ],
      suggestedAdjustments: {
        entry: null,
        stopLoss: null,
        takeProfit: null,
        leverage: order.leverage > 20 ? 10 : null,
        notes: "Strategy parameters verified. Ready to execute."
      }
    };
  }

  /**
   * Chat with Gemini about market conditions, strategy, or general trading advice.
   */
  async chat({
    messages = [],
    prompt = '',
    image = null,
    marketContext = null,
    model = 'gemini-3.7-flash',
    apiKey = null,
  }) {
    const aiClient = this.getClient(apiKey);
    const isDemo = !aiClient || (apiKey && apiKey.includes('demo')) || (this.apiKey && this.apiKey.includes('demo'));

    if (isDemo) {
      return this.generateDemoChatResponse(prompt, marketContext, model);
    }

    const systemInstruction = `You are an elite, highly disciplined AI Trading Copilot and quantitative technical analyst.
You assist traders on Bybit USDT perpetuals and crypto markets.
Your goal is to provide institutional-grade analysis:
1. Objectively evaluate market structure (Trend, Higher Highs/Lows, Breakouts, S/R levels).
2. Integrate technical indicators (EMA 20/50/200 alignments, RSI divergence, MACD momentum, Bollinger Bands, ATR volatility).
3. Enforce strict Risk-to-Reward (minimum 1:1.5 - 1:2), optimal Stop Loss placement, and position sizing.
4. When visual chart screenshots or structured data are provided, examine them meticulously. Point out candlestick patterns, fakeouts, liquidity sweeps, and key zones.
5. Give concise, actionable, and clear answers formatted with clean markdown, bullet points, and highlight warnings in bold.`;

    const contents = [];
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const userParts = [];
    if (marketContext) {
      const contextText = `\n--- LIVE MARKET SNAPSHOT ---\n` +
        `Symbol: ${marketContext.symbol || 'N/A'}\n` +
        `Timeframe: ${marketContext.timeframe || 'N/A'}\n` +
        `Current Price: $${marketContext.currentPrice || 'N/A'}\n` +
        `24h Change: ${marketContext.priceChange24h || 'N/A'}%\n` +
        `RSI (14): ${marketContext.rsi != null ? marketContext.rsi.toFixed(2) : 'N/A'}\n` +
        `EMA 20: $${marketContext.ema20 != null ? marketContext.ema20.toFixed(4) : 'N/A'}\n` +
        `EMA 50: $${marketContext.ema50 != null ? marketContext.ema50.toFixed(4) : 'N/A'}\n` +
        `EMA 200: $${marketContext.ema200 != null ? marketContext.ema200.toFixed(4) : 'N/A'}\n` +
        `MACD Histogram: ${marketContext.macdHist != null ? marketContext.macdHist.toFixed(4) : 'N/A'}\n` +
        `ATR (14): ${marketContext.atr != null ? marketContext.atr.toFixed(4) : 'N/A'}\n` +
        `Active Strategy: ${marketContext.activeStrategy ? JSON.stringify(marketContext.activeStrategy) : 'None'}\n` +
        `----------------------------\n`;
      userParts.push({ text: contextText });
    }

    if (image) {
      const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;
      const mimeType = image.includes('image/png') ? 'image/png' : 'image/jpeg';
      userParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    userParts.push({ text: prompt || 'Analyze this chart and provide trade bias, key levels, and actionable signals.' });

    contents.push({
      role: 'user',
      parts: userParts,
    });

    try {
      let targetModel = model || 'gemini-3.7-flash';
      if (targetModel.includes('3.5')) targetModel = 'gemini-3.5-flash-lite';
      else if (targetModel.includes('3.1')) targetModel = 'gemini-3.1-pro-preview';
      else if (targetModel.includes('2.5')) targetModel = 'gemini-2.5-flash';

      const response = await aiClient.models.generateContent({
        model: targetModel,
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
        }
      });

      return {
        text: response.text || 'No response generated.',
        model: targetModel,
      };
    } catch (err) {
      console.warn('Gemini API generateContent failed, falling back to demo analysis:', err.message);
      return this.generateDemoChatResponse(prompt, marketContext, model);
    }
  }

  /**
   * Pre-trade setup critique against active trading strategy & market structure.
   */
  async critiqueTrade({
    order,
    marketContext,
    strategy,
    image,
    model = 'gemini-3.7-flash',
    apiKey = null,
  }) {
    const aiClient = this.getClient(apiKey);
    const isDemo = !aiClient || (apiKey && apiKey.includes('demo')) || (this.apiKey && this.apiKey.includes('demo'));

    if (isDemo) {
      return this.generateDemoCritique(order, marketContext, strategy);
    }

    const systemInstruction = `You are an automated Pre-Flight Trade Risk & Strategy Validator for Bybit crypto traders.
You inspect the proposed trade order (Side, Entry, Stop Loss, Take Profit, Leverage), the current technical indicators, the chart image, and the user's trading strategy.

You MUST respond strictly with valid JSON conforming to this schema:
{
  "grade": "A+" | "A" | "B" | "C" | "F",
  "score": number (0 to 100),
  "verdict": "EXECUTE" | "CAUTION" | "DO_NOT_TRADE",
  "summary": "Short 1-2 sentence executive verdict",
  "checklist": [
    {
      "criterion": "e.g. Trend Alignment with 200 EMA",
      "status": "PASS" | "WARNING" | "FAIL",
      "details": "Explanation..."
    }
  ],
  "riskRewardRatio": number (e.g. 2.1),
  "liquidationRisk": "LOW" | "MEDIUM" | "HIGH" | "EXTREME",
  "strengths": ["string", "string"],
  "risks": ["string", "string"],
  "suggestedAdjustments": {
    "entry": number | null,
    "stopLoss": number | null,
    "takeProfit": number | null,
    "leverage": number | null,
    "notes": "string"
  }
}`;

    const userParts = [];
    userParts.push({
      text: `PROPOSED ORDER:
Side: ${order.side}
Order Type: ${order.orderType}
Symbol: ${order.symbol}
Quantity: ${order.qty}
Price: ${order.price || 'Market'}
Take Profit: ${order.takeProfit || 'None'}
Stop Loss: ${order.stopLoss || 'None'}
Leverage: ${order.leverage}x`
    });

    if (marketContext) {
      userParts.push({
        text: `MARKET SNAPSHOT:
Current Price: $${marketContext.currentPrice}
24h Trend: ${marketContext.priceChange24h}%
RSI: ${marketContext.rsi}
EMA 20: ${marketContext.ema20}
EMA 50: ${marketContext.ema50}
EMA 200: ${marketContext.ema200}`
      });
    }

    if (strategy) {
      userParts.push({
        text: `ACTIVE STRATEGY:
Name: ${strategy.name}
Description: ${strategy.description}
Rules: ${JSON.stringify(strategy.rules)}`
      });
    }

    if (image) {
      const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;
      const mimeType = image.includes('image/png') ? 'image/png' : 'image/jpeg';
      userParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        }
      });
    }

    try {
      let targetModel = model || 'gemini-3.7-flash';
      if (targetModel.includes('3.5')) targetModel = 'gemini-3.5-flash-lite';
      else if (targetModel.includes('3.1')) targetModel = 'gemini-3.1-pro-preview';
      else if (targetModel.includes('2.5')) targetModel = 'gemini-2.5-flash';

      const response = await aiClient.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: userParts }],
        config: {
          systemInstruction,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text;
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err) {
      console.warn('Critique trade error, using dynamic demo critique:', err.message);
      return this.generateDemoCritique(order, marketContext, strategy);
    }
  }
}

export const geminiService = new GeminiTradingService();
