
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

        } else if (trade.type === TradeType.SPLIT) {
            // trade.quantity is the Split Factor (e.g., 2 for 1:2 split)
            const factor = trade.quantity;
            if (factor > 0) {
                position.qty *= factor;
                position.buyQueue.forEach(batch => {
                    batch.qty *= factor;
                    batch.price /= factor;
                });
                position.latestBuyPrice /= factor;
            }
        } else if (trade.type === TradeType.BONUS) {
            // trade.quantity is the Bonus Shares added
            const bonusQty = trade.quantity;
            if (bonusQty > 0) {
                position.qty += bonusQty;
                // Bonus shares have 0 cost basis
                position.buyQueue.push({ qty: bonusQty, price: 0 });
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

export const calculateNetAssetValue = (): number => {
    const getLocal = (key: string) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch { return null; }
    };

    // 1. Indian Equity
    const rawIndianTrades: any[] = [...(getLocal('dhan_base_trades') || []), ...(getLocal('dhan_trades') || [])];
    const indianTrades = Array.from(new Map(rawIndianTrades.map(t => [t.id, t])).values());
    const indianPrices: Record<string, number> = getLocal('dhan_prices') || {};
    const indianSummaryObj = getLocal('dhan_summary') || {};
    const indianBaseSummaryObj = getLocal('dhan_base_summary') || {};
    const indianSummary = {
        cash: indianSummaryObj.cash !== undefined ? indianSummaryObj.cash : 0,
    };
    const indianLedger: any[] = getLocal('dhan_ledger') || [];
    
    const indFifo = calculateFIFO(indianTrades);
    let indCash = indianSummary.cash !== undefined ? indianSummary.cash : 0;
    if (indianSummary.cash === undefined && indianLedger.length > 0) {
        const sorted = [...indianLedger].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        indCash = sorted[0].balance;
    }

    let indCurrentVal = 0;
    let indGoldEtfVal = 0;
    Object.entries(indFifo.holdings).forEach(([ticker, data]) => {
        if (data.qty > 0) {
            const price = indianPrices[ticker.toUpperCase()] || (data.invested / data.qty);
            const marketVal = data.qty * price;
            if (ticker.toUpperCase() === 'NIPPON GOLD ETF (GOLDBEES)' || ticker.toUpperCase() === 'GOLDBEES' || ticker.toUpperCase().includes('GOLDBEES')) {
                indGoldEtfVal += marketVal;
            } else {
                indCurrentVal += marketVal;
            }
        }
    });

    // 2. International Equity
    const rawIntlTrades: any[] = [...(getLocal('intl_base_trades') || []), ...(getLocal('intl_trades') || [])];
    const intlTrades = Array.from(new Map(rawIntlTrades.map(t => [t.id, t])).values());
    const intlPrices: Record<string, number> = getLocal('intl_prices') || {};
    const intlSummaryObj = getLocal('intl_summary') || {};
    const intlSummary = {
        cash: intlSummaryObj.cash !== undefined ? intlSummaryObj.cash : 0,
    };
    
    const intlFifo = calculateFIFO(intlTrades);
    let intlCashEUR = intlSummary.cash !== undefined ? intlSummary.cash : 0;
    
    let intlCurrentValEUR = 0;
    Object.entries(intlFifo.holdings).forEach(([ticker, data]) => {
        if (data.qty > 0) {
            let price = intlPrices[ticker.toUpperCase()];
            if (!price) {
                 const key = Object.keys(intlPrices).find(k => k.startsWith(ticker.toUpperCase()) || ticker.toUpperCase().startsWith(k));
                 if (key) price = intlPrices[key];
            }
            const finalPrice = price || (data.invested / data.qty);
            intlCurrentValEUR += data.qty * finalPrice;
        }
    });

    let conversionRate = 90;
    try {
        const saved = localStorage.getItem('eur_to_inr_rate');
        if (saved) conversionRate = parseFloat(saved);
    } catch {}

    const intlCurrentValINR = intlCurrentValEUR * conversionRate;
    const intlCashINR = intlCashEUR * conversionRate;

    // 3. Mutual Funds
    const mfHoldings: any[] = getLocal('mf_holdings') || [];
    const mfCurrentVal = mfHoldings.reduce((acc, h) => acc + h.marketValue, 0);

    // 4. Gold ETF
    const goldHoldings: any[] = getLocal('gold_holdings') || [];
    const goldCurrentVal = goldHoldings.reduce((acc, h) => acc + h.marketValue, 0);

    // 5. Cash Equivalents
    const cashHoldings: any[] = getLocal('cash_holdings') || [];
    const cashEqVal = cashHoldings.reduce((acc, c) => acc + c.value, 0);

    const netAssetValue = indCurrentVal + indGoldEtfVal + indCash + intlCurrentValINR + intlCashINR + mfCurrentVal + goldCurrentVal + cashEqVal;
    return netAssetValue;
};
