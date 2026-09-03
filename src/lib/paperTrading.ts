import { OrderFormData, Position } from './types';

export interface PaperAccount {
  balance: number; // Available USDT
  equity: number; // Balance + Unrealized PnL
  positions: Position[];
  tradeHistory: {
    id: string;
    symbol: string;
    side: 'Buy' | 'Sell';
    size: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    closedAt: string;
    reason: 'MARKET_CLOSE' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATED';
  }[];
}

const STORAGE_KEY = 'bybit_ai_paper_account';

const INITIAL_ACCOUNT: PaperAccount = {
  balance: 10000.0,
  equity: 10000.0,
  positions: [],
  tradeHistory: [],
};

class PaperTradingEngine {
  private account: PaperAccount;

  constructor() {
    this.account = this.load();
  }

  private load(): PaperAccount {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load paper account from localStorage:', e);
    }
    return { ...INITIAL_ACCOUNT };
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.account));
    } catch (e) {
      console.warn('Failed to save paper account:', e);
    }
  }

  public getAccount(): PaperAccount {
    return { ...this.account };
  }

  public resetAccount(initialBalance = 10000) {
    this.account = {
      balance: initialBalance,
      equity: initialBalance,
      positions: [],
      tradeHistory: [],
    };
    this.save();
    return this.account;
  }

  /**
   * Execute paper trade order
   */
  public placeOrder(order: OrderFormData, currentPrice: number): { success: boolean; error?: string; position?: Position } {
    const executionPrice = order.orderType === 'Market' ? currentPrice : order.price || currentPrice;
    const requiredMargin = order.usdtAmount / order.leverage;

    if (requiredMargin > this.account.balance) {
      return { success: false, error: `Insufficient virtual balance. Required: $${requiredMargin.toFixed(2)}, Available: $${this.account.balance.toFixed(2)}` };
    }

    // Deduct margin from available balance
    this.account.balance -= requiredMargin;

    // Calculate liquidation price
    const mmr = 0.005; // 0.5% Maintenance margin rate
    let liquidationPrice = 0;
    if (order.side === 'Buy') {
      liquidationPrice = executionPrice * (1 - (1 / order.leverage) + mmr);
    } else {
      liquidationPrice = executionPrice * (1 + (1 / order.leverage) - mmr);
    }

    const positionSize = order.usdtAmount / executionPrice;

    const newPosition: Position = {
      id: `paper-pos-${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      size: positionSize,
      entryPrice: executionPrice,
      markPrice: executionPrice,
      leverage: order.leverage,
      unrealizedPnl: 0,
      pnlPercent: 0,
      liquidationPrice: Math.max(0, liquidationPrice),
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      margin: requiredMargin,
      isPaper: true,
      openedAt: new Date().toISOString(),
    };

    this.account.positions.push(newPosition);
    this.save();

    return { success: true, position: newPosition };
  }

  /**
   * Update mark prices of open positions, check TP/SL/Liquidation
   */
  public updatePositions(priceMap: Record<string, number>): PaperAccount {
    let totalUnrealizedPnl = 0;
    const remainingPositions: Position[] = [];

    for (const pos of this.account.positions) {
      const currentPrice = priceMap[pos.symbol] || pos.markPrice;
      pos.markPrice = currentPrice;

      // Calculate PnL
      let pnl = 0;
      if (pos.side === 'Buy') {
        pnl = (currentPrice - pos.entryPrice) * pos.size;
      } else {
        pnl = (pos.entryPrice - currentPrice) * pos.size;
      }

      pos.unrealizedPnl = pnl;
      pos.pnlPercent = (pnl / pos.margin) * 100;
      totalUnrealizedPnl += pnl;

      // Check Stop Loss trigger
      if (pos.stopLoss) {
        if ((pos.side === 'Buy' && currentPrice <= pos.stopLoss) || (pos.side === 'Sell' && currentPrice >= pos.stopLoss)) {
          this.closePosition(pos.id, currentPrice, 'STOP_LOSS');
          continue;
        }
      }

      // Check Take Profit trigger
      if (pos.takeProfit) {
        if ((pos.side === 'Buy' && currentPrice >= pos.takeProfit) || (pos.side === 'Sell' && currentPrice <= pos.takeProfit)) {
          this.closePosition(pos.id, currentPrice, 'TAKE_PROFIT');
          continue;
        }
      }

      // Check Liquidation
      if ((pos.side === 'Buy' && currentPrice <= pos.liquidationPrice) || (pos.side === 'Sell' && currentPrice >= pos.liquidationPrice)) {
        this.closePosition(pos.id, pos.liquidationPrice, 'LIQUIDATED');
        continue;
      }

      remainingPositions.push(pos);
    }

    this.account.positions = remainingPositions;
    this.account.equity = this.account.balance + this.account.positions.reduce((acc, p) => acc + p.margin + p.unrealizedPnl, 0);
    this.save();

    return { ...this.account };
  }

  /**
   * Close a specific position
   */
  public closePosition(positionId: string, currentPrice: number, reason: 'MARKET_CLOSE' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'LIQUIDATED' = 'MARKET_CLOSE') {
    const index = this.account.positions.findIndex((p) => p.id === positionId);
    if (index === -1) return null;

    const pos = this.account.positions[index];
    const exitPrice = currentPrice || pos.markPrice;

    let realizedPnl = 0;
    if (pos.side === 'Buy') {
      realizedPnl = (exitPrice - pos.entryPrice) * pos.size;
    } else {
      realizedPnl = (pos.entryPrice - exitPrice) * pos.size;
    }

    // In case of liquidation, entire margin is lost
    if (reason === 'LIQUIDATED') {
      realizedPnl = -pos.margin;
    }

    // Return margin + realized PnL to balance
    this.account.balance += Math.max(0, pos.margin + realizedPnl);

    this.account.tradeHistory.unshift({
      id: `trade-${Date.now()}`,
      symbol: pos.symbol,
      side: pos.side,
      size: pos.size,
      entryPrice: pos.entryPrice,
      exitPrice,
      pnl: realizedPnl,
      pnlPercent: (realizedPnl / pos.margin) * 100,
      closedAt: new Date().toISOString(),
      reason,
    });

    this.account.positions.splice(index, 1);
    this.account.equity = this.account.balance + this.account.positions.reduce((acc, p) => acc + p.margin + p.unrealizedPnl, 0);
    this.save();

    return this.account;
  }
}

export const paperTrading = new PaperTradingEngine();
