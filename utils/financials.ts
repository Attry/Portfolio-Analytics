
import { Trade, TradeType } from '../types';

export interface PerStockData {
  qty: number;
  invested: number;
  realizedPnL: number;
  buyQueue: { qty: number, price: number }[];
  latestBuyDate: string | null;
  latestBuyPrice: number; // Added field
}

export const calculateFIFO = (trades: Trade[]) => {
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const holdings: Record<string, PerStockData> = {};
    const tradePerformance: Record<string, { realizedPnL: number, investAmount: number }> = {};
    
    let grossRealizedPnL = 0;
    let totalInvested = 0;

    sortedTrades.forEach(trade => {
        // Ensure ticker is uppercase for consistency keying
        const tickerKey = trade.ticker.toUpperCase(); 

        if (!holdings[tickerKey]) {
            holdings[tickerKey] = { 
                qty: 0, 
                invested: 0, 
                realizedPnL: 0, 
                buyQueue: [],
                latestBuyDate: null,
                latestBuyPrice: 0 
            };
        }
        const position = holdings[tickerKey];

        if (trade.type === TradeType.BUY) {
            position.qty += trade.quantity;
            position.buyQueue.push({ qty: trade.quantity, price: trade.price });
            
            // Update latest buy details
            if (!position.latestBuyDate || new Date(trade.date) >= new Date(position.latestBuyDate)) {
                position.latestBuyDate = trade.date;
                position.latestBuyPrice = trade.price;
            }

        } else if (trade.type === TradeType.SELL) {
            let qtyToSell = trade.quantity;
            let currentTradePnL = 0;
            let currentTradeInvested = 0;
            
            while (qtyToSell > 0 && position.buyQueue.length > 0) {
                const match = position.buyQueue[0];
                const qty = Math.min(qtyToSell, match.qty);
                const cost = qty * match.price;
                const pnl = qty * (trade.price - match.price);
                
                grossRealizedPnL += pnl;
                position.realizedPnL += pnl;
                currentTradePnL += pnl;
                currentTradeInvested += cost;
                
                match.qty -= qty;
                qtyToSell -= qty;
                position.qty -= qty;
                
                if (match.qty <= 0.0001) {
                    position.buyQueue.shift();
                }
            }
            if (currentTradeInvested > 0) {
                 tradePerformance[trade.id] = {
                     realizedPnL: currentTradePnL,
                     investAmount: currentTradeInvested
                 };
            }
        }
    });

    Object.values(holdings).forEach(h => {
        h.invested = h.buyQueue.reduce((acc, batch) => acc + (batch.qty * batch.price), 0);
        totalInvested += h.invested;
    });

    return { grossRealizedPnL, totalInvested, holdings, tradePerformance };
};

export const calculateXIRR = (transactions: { amount: number; date: Date }[], terminalValue: number, guess = 0.1): number => {
  if (transactions.length < 1) return 0;
  const validTrans = transactions.filter(t => !isNaN(t.date.getTime()));
  if (terminalValue > 0) {
      validTrans.push({
          amount: terminalValue,
          date: new Date()
      });
  }
  const hasPos = validTrans.some(t => t.amount > 0);
  const hasNeg = validTrans.some(t => t.amount < 0);
  if (!hasPos || !hasNeg) return 0;

  const dates = validTrans.map(t => t.date.getTime() / 86400000); 
  const minDate = Math.min(...dates);
  const normalizedDates = dates.map(d => d - minDate);
  const amounts = validTrans.map(t => t.amount);

  const xirrFunction = (rate: number) => {
    return amounts.reduce((sum, amount, i) => sum + amount / Math.pow(1 + rate, normalizedDates[i] / 365), 0);
  };

  const xirrDerivative = (rate: number) => {
    return amounts.reduce((sum, amount, i) => sum - (normalizedDates[i] / 365) * amount / Math.pow(1 + rate, normalizedDates[i] / 365 + 1), 0);
  };

  let rate = guess;
  for (let i = 0; i < 50; i++) {
    const fValue = xirrFunction(rate);
    const fDerivative = xirrDerivative(rate);
    if (Math.abs(fDerivative) < 1e-8) break;
    const newRate = rate - fValue / fDerivative;
    if (Math.abs(newRate - rate) < 1e-6) return newRate;
    rate = newRate;
    if (Math.abs(rate) > 1000) return 0;
  }
  
  return rate; 
};
