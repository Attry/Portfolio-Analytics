
import { useState, useEffect, useMemo } from 'react';
import { Trade, TradeType, CashHolding, LedgerRecord, DividendRecord, PnLRecord } from '../types';
import { calculateFIFO } from '../utils/financials';

export const useConsolidatedData = () => {
    const [conversionRate, setConversionRate] = useState<number>(90); // Default fallback
    const [isLoading, setIsLoading] = useState(true);

    // --- READ DATA FROM LOCAL STORAGE ---
    const getLocal = (key: string) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch { return null; }
    };

    // Indian Equity Data
    const indianTrades: Trade[] = getLocal('dhan_trades') || [];
    const indianPrices: Record<string, number> = getLocal('dhan_prices') || {};
    const indianSummary = getLocal('dhan_summary') || {};
    const indianLedger: LedgerRecord[] = getLocal('dhan_ledger') || [];
    const indianDividends: DividendRecord[] = getLocal('dhan_dividends') || [];
    
    // International Equity Data
    const intlTrades: Trade[] = getLocal('intl_trades') || [];
    const intlPrices: Record<string, number> = getLocal('intl_prices') || {};
    const intlSummary = getLocal('intl_summary') || {};
    const intlDividends: DividendRecord[] = getLocal('intl_dividends') || [];
    
    // Mutual Funds
    const mfHoldings: any[] = getLocal('mf_holdings') || [];
    
    // Gold ETF
    const goldHoldings: any[] = getLocal('gold_holdings') || [];
    
    // Cash Equivalents
    const cashHoldings: CashHolding[] = getLocal('cash_holdings') || [];

    // --- FETCH CURRENCY ---
    useEffect(() => {
        const fetchRate = async () => {
            try {
                const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSiV0YXsSJGbeTvvuxX2u1_6br8R9JDDzXe-eH03Fj29gt43Z2cTgjiDxYt7jBRs_LG74bF4pTZmebz/pub?gid=0&single=true&output=csv');
                const text = await response.text();
                // Assuming cell A1 is the first value
                const val = parseFloat(text.split(',')[0]);
                if (!isNaN(val) && val > 0) {
                    setConversionRate(val);
                }
            } catch (e) {
                console.error("Failed to fetch EUR rate", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRate();
    }, []);

    // --- CALCULATE METRICS ---
    const metrics = useMemo(() => {
        // --- 1. INDIAN EQUITY ---
        const indFifo = calculateFIFO(indianTrades);
        
        // Cash: Prefer summary, fallback to ledger
        let indCash = indianSummary.cash || 0;
        if (indCash === 0 && indianLedger.length > 0) {
            const sorted = [...indianLedger].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            indCash = sorted[0].balance;
        }

        // Calculate Market Value & Unrealized P&L using Price Data
        let indCurrentVal = 0;
        let indUnrealized = 0;
        
        Object.entries(indFifo.holdings).forEach(([ticker, data]) => {
            if (data.qty > 0) {
                const price = indianPrices[ticker.toUpperCase()] || (data.invested / data.qty); // Fallback to cost if no price
                const marketVal = data.qty * price;
                indCurrentVal += marketVal;
                indUnrealized += (marketVal - data.invested);
            }
        });

        // Profit Components
        const indRealized = indFifo.grossRealizedPnL; // Gross from FIFO
        const indTotalDivs = indianDividends.reduce((acc, d) => acc + d.amount, 0) || (indianSummary.dividends || 0);
        const indFees = indianSummary.charges || 0;

        // Formula: Profit = Realized + Unrealized + Divs - Fees
        const indProfit = indRealized + indUnrealized + indTotalDivs - indFees;

        // Formula: Capital = Sum of Buy Price x Qty (Invested) + Current Cash
        const indCapital = indFifo.totalInvested + indCash;


        // --- 2. INTERNATIONAL EQUITY (EUR) ---
        const intlFifo = calculateFIFO(intlTrades);
        
        const intlCashEUR = intlSummary.cash || 0;
        
        let intlCurrentValEUR = 0;
        let intlUnrealizedEUR = 0;

        Object.entries(intlFifo.holdings).forEach(([ticker, data]) => {
            if (data.qty > 0) {
                // Fuzzy Match for Intl Prices
                let price = intlPrices[ticker.toUpperCase()];
                if (!price) {
                     const key = Object.keys(intlPrices).find(k => k.startsWith(ticker.toUpperCase()) || ticker.toUpperCase().startsWith(k));
                     if (key) price = intlPrices[key];
                }
                const finalPrice = price || (data.invested / data.qty);

                const marketVal = data.qty * finalPrice;
                intlCurrentValEUR += marketVal;
                intlUnrealizedEUR += (marketVal - data.invested);
            }
        });

        const intlRealizedEUR = intlFifo.grossRealizedPnL;
        const intlTotalDivsEUR = intlDividends.reduce((acc, d) => acc + d.amount, 0) || (intlSummary.dividends || 0);
        const intlFeesEUR = intlSummary.charges || 0;

        // Calculations in INR
        const intlProfitINR = (intlRealizedEUR + intlUnrealizedEUR + intlTotalDivsEUR - intlFeesEUR) * conversionRate;
        // Capital = (Invested + Cash) * Rate
        const intlCapitalINR = (intlFifo.totalInvested + intlCashEUR) * conversionRate;
        const intlCurrentValINR = intlCurrentValEUR * conversionRate;
        const intlCashINR = intlCashEUR * conversionRate;


        // --- 3. MUTUAL FUNDS ---
        const mfInvested = mfHoldings.reduce((acc, h) => acc + h.invested, 0);
        const mfCurrentVal = mfHoldings.reduce((acc, h) => acc + h.marketValue, 0);
        
        // Formula: Profit = Unrealized Gain
        const mfProfit = mfCurrentVal - mfInvested;
        // Formula: Capital = Total Invested
        const mfCapital = mfInvested;


        // --- 4. GOLD ETF ---
        const goldInvested = goldHoldings.reduce((acc, h) => acc + h.invested, 0);
        const goldCurrentVal = goldHoldings.reduce((acc, h) => acc + h.marketValue, 0);
        
        // Formula: Profit = Unrealized Gain
        const goldProfit = goldCurrentVal - goldInvested;
        // Formula: Capital = Total Invested
        const goldCapital = goldInvested;


        // --- 5. CASH EQUIVALENTS ---
        const cashEqVal = cashHoldings.reduce((acc, c) => acc + c.value, 0);
        // Treated as pure capital, no profit component for calculation structure provided
        const cashEqProfit = 0; 


        // --- AGGREGATES ---

        // Net Returns Absolute = Sum of Profits
        const netReturnAbs = indProfit + intlProfitINR + mfProfit + goldProfit + cashEqProfit;

        // Denominator: Capital (Ind) + Capital (Intl) + Capital (MF) + Capital (Gold) + CashEq Value
        const totalCapitalBase = indCapital + intlCapitalINR + mfCapital + goldCapital + cashEqVal;

        // Net Returns %
        const netReturnPct = totalCapitalBase > 0 ? (netReturnAbs / totalCapitalBase) * 100 : 0;

        // Net Asset Value (NAV) = Sum of all current Assets + cash
        // Assets = (Ind Stock Val) + (Ind Cash) + (Intl Stock Val) + (Intl Cash) + (MF Val) + (Gold Val) + (Cash Eq)
        const netAssetValue = indCurrentVal + indCash + intlCurrentValINR + intlCashINR + mfCurrentVal + goldCurrentVal + cashEqVal;
        
        // Net Cash (for display)
        const netCash = indCash + intlCashINR + cashEqVal;


        // --- ALLOCATIONS FOR PIE CHART ---
        // Indian Equity: (Current Value - Cash) in Indian Equity + Current Value Mutual Fund
        // Note: indCurrentVal is just the stock value (Market Value of holdings), so it excludes cash already.
        const allocIndianEquity = indCurrentVal + mfCurrentVal;
        
        // International Equity: (Current Value - Cash)
        // intlCurrentValINR is just the stock value.
        const allocIntlEquity = intlCurrentValINR;

        // Gold
        const allocGold = goldCurrentVal;

        // Cash (Net Cash)
        const allocCash = netCash;


        return {
            netAssetValue,
            netCash,
            netReturnAbs,
            netReturnPct,
            allocations: [
                { name: 'Indian Equity & MF', value: allocIndianEquity, color: '#7042f8' }, 
                { name: 'International Equity', value: allocIntlEquity, color: '#00e5ff' }, 
                { name: 'Gold', value: allocGold, color: '#facc15' }, 
                { name: 'Net Cash', value: allocCash, color: '#00ffa3' }, 
            ],
            conversionRate
        };

    }, [indianTrades, indianPrices, indianSummary, indianLedger, indianDividends, intlTrades, intlPrices, intlSummary, intlDividends, mfHoldings, goldHoldings, cashHoldings, conversionRate]);

    return { ...metrics, isLoading };
};
