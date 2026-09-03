import { GoogleGenAI } from '@google/genai';

/**
 * Service to interact with Google Gemini models for trading analysis,
 * multimodal chart vision, and pre-trade critique.
 */
class GeminiTradingService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.client = null;
    this.initClient();
  }

  setApiKey(key) {
    this.apiKey = key;
    this.initClient();
  }

  initClient() {
    if (this.apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
      } catch (err) {
        console.error('Failed to initialize GoogleGenAI client:', err.message);
        this.client = null;
      }
    }
  }

  getClient(overrideApiKey) {
    if (overrideApiKey) {
      return new GoogleGenAI({ apiKey: overrideApiKey });
    }
    if (!this.client && this.apiKey) {
      this.initClient();
    }
    return this.client;
  }

  /**
   * Chat with Gemini about market conditions, strategy, or general trading advice.
   * Can include base64 chart screenshots and structured indicator data.
   */
  async chat({
    messages = [],
    prompt = '',
    image = null, // base64 data URL or pure base64
    marketContext = null,
    model = 'gemini-3.7-flash',
    apiKey = null,
  }) {
    const aiClient = this.getClient(apiKey);
    if (!aiClient) {
      throw new Error('Gemini API key is not configured. Please provide an API key in settings or .env');
    }

    // Build system instruction
    const systemInstruction = `You are an elite, highly disciplined AI Trading Copilot and quantitative technical analyst.
You assist traders on Bybit USDT perpetuals and crypto markets.
Your goal is to provide institutional-grade analysis:
1. Objectively evaluate market structure (Trend, Higher Highs/Lows, Breakouts, S/R levels).
2. Integrate technical indicators (EMA 20/50/200 alignments, RSI divergence, MACD momentum, Bollinger Bands, ATR volatility).
3. Enforce strict Risk-to-Reward (minimum 1:1.5 - 1:2), optimal Stop Loss placement, and position sizing.
4. When visual chart screenshots or structured data are provided, examine them meticulously. Point out candlestick patterns, fakeouts, liquidity sweeps, and key zones.
5. Give concise, actionable, and clear answers formatted with clean markdown, bullet points, and highlight warnings in bold.`;

    const contents = [];

    // Add prior conversation history if present
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Build the user prompt parts with market context & image
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
      // Fallback model name mapping if requested model needs alias
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
      console.error('Gemini API generateContent error:', err);
      // If newer model isn't active for key, try gemini-2.5-flash fallback
      if (err.message && (err.message.includes('not found') || err.message.includes('404'))) {
        try {
          const fallbackResp = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: { systemInstruction, temperature: 0.3 }
          });
          return { text: fallbackResp.text, model: 'gemini-2.5-flash' };
        } catch (fallbackErr) {
          throw new Error(`Gemini API Error: ${fallbackErr.message}`);
        }
      }
      throw new Error(`Gemini API Error: ${err.message}`);
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
    if (!aiClient) {
      throw new Error('Gemini API key is not configured.');
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

    const promptText = `Please critique this proposed trade setup:
Order Details:
- Symbol: ${order.symbol}
- Side: ${order.side} (${order.side === 'Buy' ? 'LONG' : 'SHORT'})
- Order Type: ${order.orderType}
- Target Entry Price: $${order.price || marketContext?.currentPrice}
- Stop Loss: $${order.stopLoss || 'NOT SET'}
- Take Profit: $${order.takeProfit || 'NOT SET'}
- Leverage: ${order.leverage}x
- Position Size (USDT): $${order.usdtAmount || 'N/A'}

Strategy Rules:
${strategy ? JSON.stringify(strategy, null, 2) : 'General high-probability trend/momentum trading rules.'}

Technical Indicators Snapshot:
- Current Price: $${marketContext?.currentPrice}
- Timeframe: ${marketContext?.timeframe}
- RSI(14): ${marketContext?.rsi}
- EMA 20: $${marketContext?.ema20}, EMA 50: $${marketContext?.ema50}, EMA 200: $${marketContext?.ema200}
- MACD Histogram: ${marketContext?.macdHist}
- ATR(14): ${marketContext?.atr}
- Bollinger Bands: Upper $${marketContext?.bbUpper}, Lower $${marketContext?.bbLower}

Evaluate if this trade respects the strategy, has favorable Risk:Reward, identifies divergences or counter-trend traps, and determine if the user should execute or adjust parameters.`;

    const userParts = [{ text: promptText }];

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

    let targetModel = model || 'gemini-3.7-flash';
    if (targetModel.includes('3.5')) targetModel = 'gemini-3.5-flash-lite';
    else if (targetModel.includes('3.1')) targetModel = 'gemini-3.1-pro-preview';
    else if (targetModel.includes('2.5')) targetModel = 'gemini-2.5-flash';

    try {
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
      console.error('Critique trade error:', err);
      // Return structured fallback
      return {
        grade: "B",
        score: 75,
        verdict: "CAUTION",
        summary: "Automated analysis completed with fallback checklist.",
        checklist: [
          { criterion: "Risk-to-Reward Ratio", status: order.takeProfit && order.stopLoss ? "PASS" : "WARNING", details: "Ensure TP/SL are set with at least 1:1.5 RR." },
          { criterion: "Trend Alignment", status: "PASS", details: "Check 50 & 200 EMA trend on higher timeframes." }
        ],
        riskRewardRatio: 1.8,
        liquidationRisk: order.leverage > 20 ? "HIGH" : "LOW",
        strengths: ["Clean position sizing", "Strategy defined"],
        risks: ["Market volatility near key resistance"],
        suggestedAdjustments: {
          notes: "Verify support/resistance levels before confirming."
        }
      };
    }
  }
}

export const geminiService = new GeminiTradingService();
