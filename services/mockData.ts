import { Trade, TradeType, PnLRecord, LedgerRecord, DividendRecord } from '../types';

export const generateMockTrades = (): Trade[] => {
  return [
    { id: '1', date: '2024-01-10', ticker: 'TATASTEEL', type: TradeType.BUY, quantity: 100, price: 135.5, netAmount: -13550, status: 'TRADED' },
    { id: '2', date: '2024-01-15', ticker: 'RELIANCE', type: TradeType.BUY, quantity: 10, price: 2450.0, netAmount: -24500, status: 'TRADED' },
    { id: '3', date: '2024-02-01', ticker: 'TATASTEEL', type: TradeType.SELL, quantity: 50, price: 142.0, netAmount: 7100, status: 'TRADED' },
  ];
};

export const generateMockPnL = (): PnLRecord[] => {
  return [
    { scripName: 'TATASTEEL', buyQty: 100, avgBuyPrice: 135.5, buyValue: 13550, sellQty: 50, avgSellPrice: 142.0, sellValue: 7100, realizedPnL: 325, unrealizedPnL: 650 },
    { scripName: 'RELIANCE', buyQty: 10, avgBuyPrice: 2450.0, buyValue: 24500, sellQty: 0, avgSellPrice: 0, sellValue: 0, realizedPnL: 0, unrealizedPnL: 1200 },
    { scripName: 'HDFCBANK', buyQty: 25, avgBuyPrice: 1450.0, buyValue: 36250, sellQty: 25, avgSellPrice: 1420.0, sellValue: 35500, realizedPnL: -750, unrealizedPnL: 0 },
    { scripName: 'INFY', buyQty: 40, avgBuyPrice: 1600.0, buyValue: 64000, sellQty: 0, avgSellPrice: 0, sellValue: 0, realizedPnL: 0, unrealizedPnL: -2000 },
  ];
};

export const generateMockLedger = (): LedgerRecord[] => {
  return [
    { date: '2024-01-01', description: 'Funds Added', credit: 150000, debit: 0, balance: 150000, type: 'DEPOSIT' },
    { date: '2024-01-10', description: 'Bill for TATASTEEL', credit: 0, debit: 13550, balance: 136450, type: 'TRADE' },
    { date: '2024-01-10', description: 'DP Charges', credit: 0, debit: 15.34, balance: 136434.66, type: 'CHARGE' },
    { date: '2024-01-10', description: 'GST on Charges', credit: 0, debit: 2.76, balance: 136431.90, type: 'CHARGE' },
    { date: '2024-02-01', description: 'Bill for RELIANCE', credit: 0, debit: 24500, balance: 111931.90, type: 'TRADE' },
  ];
};

export const generateMockDividends = (): DividendRecord[] => {
  return [
    { date: '2024-03-15', scripName: 'TATASTEEL', amount: 350 },
    { date: '2024-03-20', scripName: 'RELIANCE', amount: 120 },
  ];
};