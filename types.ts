
export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  ticker: string;
  type: TradeType;
  quantity: number;
  price: number;
  netAmount: number; // Negative for buy, positive for sell
  status: string;
}

export interface PnLRecord {
  scripName: string;
  buyQty: number;
  avgBuyPrice: number;
  buyValue: number;
  sellQty: number;
  avgSellPrice: number;
  sellValue: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

export interface LedgerRecord {
  date: string;
  description: string;
  credit: number;
  debit: number;
  balance: number;
  type: 'CHARGE' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'OTHER';
}

export interface DividendRecord {
  date: string;
  scripName: string;
  amount: number;
}

export interface StockPriceRecord {
  ticker: string;
  price: number;
  date?: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  desiredEntryPrice: number;
  intrinsicValue: number;
  researchLink: string;
}

export interface CashHolding {
  id: string;
  account: string;
  value: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  realizedPnL: number;
  unrealizedPnL: number;
  charges: number;
  netRealizedPnL: number;
  dividends: number;
  cashBalance: number;
  winRate: number;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  HOLDINGS = 'HOLDINGS',
  WATCHLIST = 'WATCHLIST',
  TRANSACTIONS = 'TRANSACTIONS',
  UPLOAD = 'UPLOAD',
  AI_INSIGHTS = 'AI_INSIGHTS'
}

export type AssetContext = 'INDIAN_EQUITY' | 'INTERNATIONAL_EQUITY' | 'GOLD_ETF' | 'CASH_EQUIVALENTS' | 'MUTUAL_FUNDS';
