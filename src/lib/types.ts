export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartStyleType = 'candles' | 'hollow' | 'line' | 'area' | 'bars';

export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

export interface TickerInfo {
  symbol: string;
  lastPrice: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
  turnover24h: number;
  markPrice?: number;
  fundingRate?: number;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total?: number;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface IndicatorSettings {
  showEma9: boolean;
  showEma20: boolean;
  showEma50: boolean;
  showEma200: boolean;
  showBollinger: boolean;
  showRsi: boolean;
  showMacd: boolean;
  showAtr: boolean;
  showSupertrend: boolean;
  showVwap: boolean;
}

export type OrderSide = 'Buy' | 'Sell';
export type OrderType = 'Market' | 'Limit' | 'StopMarket';

export interface OrderFormData {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  price: number;
  usdtAmount: number;
  qty: number;
  leverage: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskPercent: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: OrderSide;
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  unrealizedPnl: number;
  pnlPercent: number;
  liquidationPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  margin: number;
  isPaper: boolean;
  openedAt: string;
}

export interface Strategy {
  id: string;
  name: string;
  category?: string;
  type?: string;
  timeframes: string[];
  description: string;
  rules: {
    longCondition?: string;
    shortCondition?: string;
    entryLong?: string;
    entryShort?: string;
    stopLoss: string;
    takeProfit: string;
    minRiskReward?: number;
    maxLeverage?: number;
    maxRiskPerTradePcnt?: number;
  };
  checklist?: string[];
  createdAt?: string;
}

export interface ChecklistItem {
  criterion: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  details: string;
}

export interface AiCritiqueResult {
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  score: number;
  verdict: 'EXECUTE' | 'CAUTION' | 'DO_NOT_TRADE';
  summary: string;
  checklist: ChecklistItem[];
  riskRewardRatio: number;
  liquidationRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  strengths: string[];
  risks: string[];
  suggestedAdjustments: {
    entry?: number | null;
    stopLoss?: number | null;
    takeProfit?: number | null;
    leverage?: number | null;
    notes?: string;
  };
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  image?: string; // base64
  isVoice?: boolean;
  critiqueData?: AiCritiqueResult;
}

export interface UserCredentials {
  geminiApiKey: string;
  bybitApiKey: string;
  bybitApiSecret: string;
  isTestnet: boolean;
}
