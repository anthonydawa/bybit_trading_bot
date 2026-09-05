# 🚀 AI Bybit Trading Copilot & Analytics Platform

> Institutional-grade cryptocurrency trading application with **TradingView-grade interactive charting**, real-time **Bybit market feeds** for 850+ USDT pairs, multimodal **Google Gemini AI Copilot**, quantitative **Strategy Engine**, pre-flight **AI Trade Critique**, and **Dual Execution** (Paper & Live).

---

## 🌐 Live Web App & Online Deployment

- **🔗 Hostinger Live URL**: `https://bybit-trading-bot.hostingersite.com` *(or your Hostinger temporary domain)*
- **📦 GitHub Repository**: [https://github.com/anthonydawa/bybit_trading_bot](https://github.com/anthonydawa/bybit_trading_bot)
- **⚙️ Deployment Preset**: Hostinger Express (`node server.js`, Branch: `main`, Node 20.x/22.x)
- **⚡ Status**: 🟢 Active CI/CD Auto-Deploy

---

## 🌟 Key Features

### 1. 📈 TradingView-Style Interactive Charting
- **Candlestick Charts**: Smooth 60fps rendering powered by TradingView Lightweight Charts.
- **Real-Time Bybit WebSocket**: Live candlestick ticks, price changes, and orderbook depth from `wss://stream.bybit.com/v5/public/linear`.
- **All Bybit Markets**: Instant access to 850+ USDT perpetual pairs (`BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `DOGEUSDT`, `PEPEUSDT`, `SUIUSDT`, etc.) with searchable ticker modal, 24h change sorting, volume ranking, and favorites.
- **Built-in Indicators**:
  - Exponential Moving Averages (EMA 9, 20, 50, 200)
  - Bollinger Bands (20, 2.0 SD)
  - Supertrend (10, 3.0)
  - Relative Strength Index (RSI 14)
  - MACD (12, 26, 9)
  - Average True Range (ATR 14)
  - Volume with color matching

### 2. 🤖 Gemini Multimodal AI Copilot Sidebar
- **Screen & Chart Vision ("See Screen")**: One-click chart canvas snapshot merged with structured technical indicators (EMA stack, RSI level, MACD momentum, BB bandwidth, ATR volatility).
- **Voice Transcription**: Built-in Web Speech API microphone dictation button for hands-free trading voice commands.
- **Multiple Model Support**:
  - `gemini-3.7-flash` (Fast & balanced multimodal)
  - `gemini-3.5-flash-lite` (Ultra-fast high throughput)
  - `gemini-3.1-pro-preview` (Deep quantitative reasoning)
  - `gemini-2.5-flash` (Reliable core engine)
- **Quick Action Prompts**: Market bias analysis, S/R zone mapping, divergence detection, and Risk-to-Reward optimization.

### 3. ⚖️ Strategy Engine & Pre-Trade AI Critique
- **Institutional Strategy Presets**:
  1. *EMA Trend Rider (20/50/200)*
  2. *Bollinger & RSI Mean Reversion*
  3. *Consolidation Breakout & Volatility Expansion*
  4. *Smart Money (SMC) & Liquidity Sweep*
  5. *Quick Momentum Scalper (1m - 5m)*
- **Custom Strategy Builder**: Define custom indicators, entry conditions, stop loss %, and checklist rules.
- **Pre-Flight AI Critique Modal**: Evaluates proposed trade orders against active strategy rules, assigns a Setup Grade (`A+` to `F`), calculates Risk:Reward, checks liquidation risks, and provides actionable parameter optimizations.

### 4. 💼 Dual Execution Engine (Paper & Live Bybit)
- **Paper Trading Simulator**: Realistic simulated trading with $10,000 virtual balance, real-time Bybit mark price fills, automated TP/SL and liquidation triggers, and trade history journal.
- **Live Bybit Unified Trading API**: Direct order placement with secure server-side HMAC-SHA256 signature generation (supports Market, Limit, Stop Market, Leverage 1x-100x, Take Profit, and Stop Loss).

---

## 🛠️ Quick Start (Local Testing)

### 1. Prerequisites
- Node.js v18+ (Node 20 or 24 recommended)
- Google Gemini API Key (get for free from [Google AI Studio](https://aistudio.google.com))

### 2. Install & Run
```bash
# Clone or navigate to the repository
cd trading_bot

# Install dependencies (if not already installed)
npm install

# Build the frontend bundle
npm run build

# Start the application on localhost
npm start
```

Open your browser to:
👉 **`http://localhost:3001`**

Alternatively, for frontend hot-reloading during development:
```bash
npm run dev
```
(Frontend runs on `http://localhost:3000` with proxy to backend on port 3001).

---

## 🌐 Hostinger Deployment Guide

This application is packaged for zero-friction deployment on **Hostinger Web Hosting (Node.js Application)** or **Hostinger VPS**.

### Method 1: Hostinger Node.js Web App
1. Log into your **Hostinger hPanel**.
2. Navigate to **Websites** > **Node.js** (or create a new Node.js App).
3. Set:
   - **Node.js version**: `20.x` or `22.x` / `24.x`
   - **Application root**: `/public_html` (or repository folder)
   - **Application startup file**: `server/index.js`
4. Upload project files (or connect via Git repository).
5. Add Environment Variables in hPanel:
   - `PORT=3000` (or leave default assigned by Hostinger)
   - `GEMINI_API_KEY=your_gemini_api_key`
   - `BYBIT_API_KEY=your_bybit_api_key` *(optional)*
   - `BYBIT_API_SECRET=your_bybit_api_secret` *(optional)*
6. In Hostinger Terminal, run:
   ```bash
   npm install
   npm run build
   ```
7. Click **Restart App** in hPanel. Your live app is now accessible worldwide!

---

## 📁 Project Architecture

```text
trading_bot/
├── dist/                         # Compiled production frontend build
├── server/
│   ├── index.js                  # Express API server entrypoint
│   ├── routes/
│   │   ├── gemini.js             # Gemini AI chat, vision analysis & trade critique
│   │   ├── bybit.js              # Bybit V5 REST & signed order proxy
│   │   └── strategies.js         # Strategy persistence & preset library
│   └── services/
│       ├── geminiService.js      # @google/genai SDK multimodal service
│       └── bybitService.js       # Bybit V5 Unified Trading API service
├── src/
│   ├── components/
│   │   ├── chart/
│   │   │   ├── TradingChart.tsx  # TradingView Lightweight Chart
│   │   │   └── ChartHeader.tsx   # Ticker stats, timeframes, indicators toolbar
│   │   ├── ai/
│   │   │   ├── AiSidebar.tsx     # Gemini Copilot chat sidebar
│   │   │   ├── VoiceInput.tsx    # Web Speech API voice transcription
│   │   │   └── TradeCritiqueModal.tsx # Pre-flight trade analysis modal
│   │   ├── trading/
│   │   │   ├── OrderForm.tsx     # Long/Short, Leverage, Margin & TP/SL
│   │   │   ├── OrderBook.tsx     # Real-time bids/asks depth
│   │   │   ├── PositionsTable.tsx# Open positions & trade journal
│   │   │   └── TickerSelector.tsx# 850+ Bybit market search & filter
│   │   ├── strategy/
│   │   │   └── StrategyManager.tsx# Strategy templates & custom builder
│   │   ├── auth/
│   │   │   └── ApiKeyModal.tsx   # Credentials & API keys configuration
│   │   └── layout/
│   │       └── Navbar.tsx        # Top header with balance & mode toggle
│   ├── lib/
│   │   ├── bybitWebSocket.ts     # Real-time WebSocket connection
│   │   ├── indicators.ts         # EMA, RSI, MACD, BB, ATR math algorithms
│   │   ├── paperTrading.ts       # $10,000 simulated trading engine
│   │   ├── storage.ts            # LocalStorage persistence manager
│   │   └── types.ts              # TypeScript interfaces
│   ├── App.tsx                   # Master dashboard container
│   ├── index.css                 # Dark trading theme styles
│   └── main.tsx                  # React DOM mount point
├── package.json
└── vite.config.ts
```

---

## 🔒 Security & Privacy
- **API Secret Protection**: Bybit orders are signed on the backend using HMAC SHA256. API secrets are never exposed to client-side scripts.
- **Paper Trading First**: Defaults to simulated paper trading with $10,000 virtual balance to test strategies safely without risking real capital.
