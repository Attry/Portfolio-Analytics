
import { useState, useMemo, useEffect } from 'react';
import { AssetContext, Trade, PnLRecord, LedgerRecord, DividendRecord, WatchlistItem, ViewState, CashHolding } from '../types';
import { calculateFIFO, calculateXIRR, PerStockData } from '../utils/financials';
import { parseMarketDataCSV, parseIndianEquity, parseInternationalEquity, parseMutualFundCSV, parseGoldETFCSV, ParseResult } from '../services/csvParsers';

type UploadType = 'PNL' | 'LEDGER' | 'DIVIDEND' | 'TRADE_HISTORY' | 'MARKET_DATA' | 'PORTFOLIO_SNAPSHOT';

interface UploadMeta {
    trades?: string;
    pnl?: string;
    ledger?: string;
    dividend?: string;
    market?: string;
    portfolio?: string;
    marketDate?: string;
}

const getStorageKeys = (context: AssetContext) => {
    let prefix = 'dhan';
    if (context === 'INTERNATIONAL_EQUITY') prefix = 'intl';
    else if (context === 'GOLD_ETF') prefix = 'gold';
    else if (context === 'CASH_EQUIVALENTS') prefix = 'cash';
    else if (context === 'MUTUAL_FUNDS') prefix = 'mf';

    return {
        TRADES: `${prefix}_trades`,
        PNL: `${prefix}_pnl`,
        LEDGER: `${prefix}_ledger`,
        DIVIDENDS: `${prefix}_dividends`,
        PRICES: `${prefix}_prices`,
        WATCHLIST: `${prefix}_watchlist`,
        META: `${prefix}_meta`,
        SUMMARY: `${prefix}_summary`,
        SHEET_ID: `${prefix}_sheet_id`,
        MF_HOLDINGS: `${prefix}_holdings`, 
        GOLD_HOLDINGS: `${prefix}_holdings`,
        CASH_HOLDINGS: `${prefix}_holdings` 
    };
};

// Explicit URL for Mutual Funds as provided
const MUTUAL_FUND_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTXbYB5_8MwjNl-J6vYg7_vxhr2ks3F46pXZbzZBLz7nuCCvxP24nLYZicQzxo5ej00hxIIw7Eduh1n/pub?gid=0&single=true&output=csv";
// Explicit URL for Gold ETF
const GOLD_ETF_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRyY8J5hELCaeUrMKMLOd2rU_tbdPUiR_dUG3llLRa2YKoP41cMyKkaQAzXBoE1IvCBpUuAa2Ld0Hri/pub?gid=0&single=true&output=csv";

export const usePortfolioData = (context: AssetContext) => {
    const STORAGE_KEYS = useMemo(() => getStorageKeys(context), [context]);

    // -- State --
    const [trades, setTrades] = useState<Trade[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.TRADES) || '[]'));
    const [pnlData, setPnlData] = useState<PnLRecord[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PNL) || '[]'));
    const [ledgerData, setLedgerData] = useState<LedgerRecord[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.LEDGER) || '[]'));
    const [dividendData, setDividendData] = useState<DividendRecord[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.DIVIDENDS) || '[]'));
    const [priceData, setPriceData] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.PRICES) || '{}'));
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.WATCHLIST) || '[]'));
    const [uploadMeta, setUploadMeta] = useState<UploadMeta>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.META) || '{}'));
    
    // MF Specific State
    const [mfHoldings, setMfHoldings] = useState<any[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.MF_HOLDINGS) || '[]'));
    // Gold Specific State
    const [goldHoldings, setGoldHoldings] = useState<any[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.GOLD_HOLDINGS) || '[]'));
    // Cash Specific State
    const [cashHoldings, setCashHoldings] = useState<CashHolding[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.CASH_HOLDINGS) || '[]'));
    
    // Global Market Date
    const [globalMarketDate, setGlobalMarketDate] = useState(() => localStorage.getItem('GLOBAL_MARKET_DATE') || new Date().toISOString().split('T')[0]);

    const [summary, setSummary] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.SUMMARY) || '{}'));
    const [sheetId, setSheetId] = useState<string>(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.SHEET_ID);
        if (saved) {
             try { return JSON.parse(saved); } catch(e) { return saved; }
        }
        if (context === 'INTERNATIONAL_EQUITY') return "1zQFW9FHFoyvw4uZR4z3klFeoCIGJPUlq7QuDYwz4lEY";
        if (context === 'MUTUAL_FUNDS') return "LINKED_TO_PUB_URL_MF"; 
        if (context === 'GOLD_ETF') return "LINKED_TO_PUB_URL_GOLD";
        return "1htAAZP9eWVH0sq1BHbiS-dKJNzcP-uoBEW6GXp4N3HI";
    });

    const [lastUploadPreview, setLastUploadPreview] = useState<any[]>([]);

    // -- Persistence --
    const persist = (key: string, data: any) => {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error("Storage Error", e); }
    };

    const updateMeta = (updates: Partial<UploadMeta>) => {
        const newMeta = { ...uploadMeta, ...updates };
        setUploadMeta(newMeta);
        persist(STORAGE_KEYS.META, newMeta);
    };

    const updateSummary = (updates: any) => {
        const newSummary = { ...summary, ...updates };
        setSummary(newSummary);
        persist(STORAGE_KEYS.SUMMARY, newSummary);
    };

    const saveSheetId = (id: string) => {
        setSheetId(id);
        persist(STORAGE_KEYS.SHEET_ID, id);
    }

    const updateGlobalDate = (date: string) => {
        setGlobalMarketDate(date);
        localStorage.setItem('GLOBAL_MARKET_DATE', date);
        updateMeta({ marketDate: date });
    }

    // -- Actions --
    const clearAllData = () => {
        if (!confirm(`Clear all data for ${context}?`)) return;
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        setTrades([]); setPnlData([]); setLedgerData([]); setDividendData([]); setPriceData({}); setWatchlist([]); setUploadMeta({}); setSummary({}); setMfHoldings([]); setGoldHoldings([]); setCashHoldings([]);
        alert('Data cleared.');
    };

    // -- Watchlist Actions --
    const addToWatchlist = (ticker: string) => {
        if (watchlist.some(w => w.ticker === ticker)) return;
        const newItem: WatchlistItem = { id: Math.random().toString(36).substr(2, 9), ticker, desiredEntryPrice: 0, intrinsicValue: 0, researchLink: '' };
        const updated = [...watchlist, newItem];
        setWatchlist(updated);
        persist(STORAGE_KEYS.WATCHLIST, updated);
    };
    const removeFromWatchlist = (id: string) => {
        const updated = watchlist.filter(w => w.id !== id);
        setWatchlist(updated);
        persist(STORAGE_KEYS.WATCHLIST, updated);
    };
    const updateWatchlistItem = (id: string, field: keyof WatchlistItem, value: any) => {
        const updated = watchlist.map(w => w.id === id ? { ...w, [field]: value } : w);
        setWatchlist(updated);
        persist(STORAGE_KEYS.WATCHLIST, updated);
    };

    // -- Cash Actions --
    const addSalary = (account: string, amount: number) => {
        const existingIndex = cashHoldings.findIndex(c => c.account.toLowerCase() === account.toLowerCase());
        let updatedCashHoldings;
        if (existingIndex >= 0) {
            updatedCashHoldings = [...cashHoldings];
            updatedCashHoldings[existingIndex] = {
                ...updatedCashHoldings[existingIndex],
                value: updatedCashHoldings[existingIndex].value + amount
            };
        } else {
            updatedCashHoldings = [...cashHoldings, { id: Math.random().toString(36).substr(2, 9), account, value: amount }];
        }
        setCashHoldings(updatedCashHoldings);
        persist(STORAGE_KEYS.CASH_HOLDINGS, updatedCashHoldings);
    };

    const updateCashHolding = (id: string, field: keyof CashHolding, value: any) => {
        const updated = cashHoldings.map(c => c.id === id ? { ...c, [field]: value } : c);
        setCashHoldings(updated);
        persist(STORAGE_KEYS.CASH_HOLDINGS, updated);
    };

    const deleteCashHolding = (id: string) => {
        const updated = cashHoldings.filter(c => c.id !== id);
        setCashHoldings(updated);
        persist(STORAGE_KEYS.CASH_HOLDINGS, updated);
    };

    // -- File Processing --
    const processFile = (content: string, type: UploadType, marketDate?: string) => {
        let result: ParseResult<any> = { success: false, message: "No parser matched." };

        if (context === 'MUTUAL_FUNDS') {
             result = parseMutualFundCSV(content);
             if (result.success && result.data) {
                 setMfHoldings(result.data);
                 persist(STORAGE_KEYS.MF_HOLDINGS, result.data);
                 updateMeta({ market: new Date().toISOString() });
             }
        } else if (context === 'GOLD_ETF') {
            result = parseGoldETFCSV(content);
            if (result.success && result.data) {
                setGoldHoldings(result.data);
                persist(STORAGE_KEYS.GOLD_HOLDINGS, result.data);
                updateMeta({ market: new Date().toISOString() });
            }
        } else {
             // ... Existing generic parsing logic ...
             const lines = content.split('\n').filter(line => line.trim() !== '');
             setLastUploadPreview(lines.slice(0, 5).map(l => l.split(',')));

             const firstLine = lines[0] || '';
             const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
             const splitRegex = delimiter === ';' ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/ : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
             const rawRows = lines.map(line => line.split(splitRegex));

            if (type === 'MARKET_DATA') {
                result = parseMarketDataCSV(content);
                if (result.success && result.data) {
                    const updatedPrices = { ...priceData, ...result.data };
                    setPriceData(updatedPrices);
                    persist(STORAGE_KEYS.PRICES, updatedPrices);
                    updateMeta({ market: new Date().toISOString(), marketDate });
                }
            } else if (context === 'INDIAN_EQUITY') {
                result = parseIndianEquity(type, rawRows);
                if (result.success && result.data) {
                    if (type === 'TRADE_HISTORY') { setTrades(result.data); persist(STORAGE_KEYS.TRADES, result.data); updateMeta({ trades: new Date().toISOString() }); }
                    if (type === 'PNL') { setPnlData(result.data); persist(STORAGE_KEYS.PNL, result.data); updateMeta({ pnl: new Date().toISOString() }); }
                    if (type === 'LEDGER') { setLedgerData(result.data); persist(STORAGE_KEYS.LEDGER, result.data); updateMeta({ ledger: new Date().toISOString() }); }
                    if (type === 'DIVIDEND') { setDividendData(result.data); persist(STORAGE_KEYS.DIVIDENDS, result.data); updateMeta({ dividend: new Date().toISOString() }); }
                }
            } else if (context === 'INTERNATIONAL_EQUITY') {
                result = parseInternationalEquity(type, rawRows);
                if (result.success && result.data) {
                    if (type === 'TRADE_HISTORY') { setTrades(result.data); persist(STORAGE_KEYS.TRADES, result.data); updateMeta({ trades: new Date().toISOString() }); }
                    if (type === 'LEDGER') { 
                        setDividendData(result.data); 
                        persist(STORAGE_KEYS.DIVIDENDS, result.data); 
                        updateMeta({ dividend: new Date().toISOString(), ledger: new Date().toISOString() }); 
                    }
                    if (type === 'PORTFOLIO_SNAPSHOT') { 
                        const updatedPrices = { ...priceData, ...result.data };
                        setPriceData(updatedPrices);
                        persist(STORAGE_KEYS.PRICES, updatedPrices);
                        updateMeta({ portfolio: new Date().toISOString(), marketDate: new Date().toISOString().split('T')[0] });
                    }
                }
            }
        }

        if (result.summary) updateSummary(result.summary);
        alert(result.message);
    };

    // -- Metrics Calculation --
    const metrics = useMemo(() => {
        const referenceDate = new Date(globalMarketDate || new Date());

        if (context === 'CASH_EQUIVALENTS') {
            const totalCash = cashHoldings.reduce((acc, c) => acc + (c.value || 0), 0);
            return {
                totalInvested: totalCash,
                currentValue: totalCash,
                unrealizedPnL: 0,
                grossRealizedPnL: 0,
                netRealizedPnL: 0,
                charges: 0,
                totalDividends: 0,
                cashBalance: totalCash,
                xirr: 0,
                holdings: cashHoldings,
                hasLiveData: true,
                tradePerformance: {}
            };
        }

        if (context === 'MUTUAL_FUNDS') {
             const totalInvested = mfHoldings.reduce((acc, h) => acc + h.invested, 0);
             const currentValue = mfHoldings.reduce((acc, h) => acc + h.marketValue, 0);
             const unrealizedPnL = currentValue - totalInvested;
             const grossRealizedPnL = 0;
             const netRealizedPnL = 0;
             const charges = 0;
             const totalDividends = 0;
             const cashBalance = 0;
             const xirr = 0; 

             const finalHoldings = mfHoldings.map(h => {
                 let daysHeld = 0;
                 if (h.latestBuyDate) {
                     const buyDate = new Date(h.latestBuyDate);
                     if (!isNaN(buyDate.getTime())) {
                        const diff = referenceDate.getTime() - buyDate.getTime();
                        daysHeld = Math.floor(diff / (1000 * 3600 * 24));
                        if (daysHeld < 0) daysHeld = 0;
                     }
                 }
                 
                 return {
                    ...h,
                    unrealized: h.marketValue - h.invested,
                    netReturnPct: h.invested > 0 ? ((h.marketValue - h.invested) / h.invested) * 100 : 0,
                    portfolioPct: currentValue > 0 ? (h.marketValue / currentValue) * 100 : 0,
                    daysHeld: isNaN(daysHeld) ? 0 : daysHeld,
                    realized: 0
                 };
             }).sort((a, b) => b.portfolioPct - a.portfolioPct);

             return {
                 totalInvested, currentValue, unrealizedPnL, grossRealizedPnL, netRealizedPnL,
                 charges, totalDividends, cashBalance, xirr,
                 holdings: finalHoldings,
                 hasLiveData: mfHoldings.length > 0,
                 tradePerformance: {}
             };
        }

        if (context === 'GOLD_ETF') {
            const totalInvested = goldHoldings.reduce((acc, h) => acc + h.invested, 0);
            const currentValue = goldHoldings.reduce((acc, h) => acc + h.marketValue, 0);
            const unrealizedPnL = currentValue - totalInvested;
            const grossRealizedPnL = 0;
            const netRealizedPnL = 0;
            const charges = 0;
            const totalDividends = 0;
            const cashBalance = 0;
            const xirr = 0; 

            const finalHoldings = goldHoldings.map(h => {
                let daysHeld = 0;
                if (h.latestBuyDate) {
                    const buyDate = new Date(h.latestBuyDate);
                    if (!isNaN(buyDate.getTime())) {
                        const diff = referenceDate.getTime() - buyDate.getTime();
                        daysHeld = Math.floor(diff / (1000 * 3600 * 24));
                        if (daysHeld < 0) daysHeld = 0;
                    }
                }

                return {
                    ...h,
                    unrealized: h.marketValue - h.invested,
                    netReturnPct: h.invested > 0 ? ((h.marketValue - h.invested) / h.invested) * 100 : 0,
                    portfolioPct: currentValue > 0 ? (h.marketValue / currentValue) * 100 : 0,
                    daysHeld: isNaN(daysHeld) ? 0 : daysHeld,
                    realized: 0
                };
            }).sort((a, b) => b.portfolioPct - a.portfolioPct);

            return {
                totalInvested, currentValue, unrealizedPnL, grossRealizedPnL, netRealizedPnL,
                charges, totalDividends, cashBalance, xirr,
                holdings: finalHoldings,
                hasLiveData: goldHoldings.length > 0,
                tradePerformance: {}
            };
       }

        const { grossRealizedPnL, totalInvested, holdings, tradePerformance } = calculateFIFO(trades);
        
        let charges = summary.charges || 0;
        let totalDividends = Math.max(dividendData.reduce((acc, curr) => acc + curr.amount, 0), summary.dividends || 0);
        let cashBalance = summary.cash || 0;
        if (ledgerData.length > 0 && cashBalance === 0) {
            const sorted = [...ledgerData].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            if(sorted.length > 0) cashBalance = sorted[0].balance;
        }

        let totalUnrealizedPnL = 0;
        
        const portfolioHoldings = Object.entries(holdings)
          .filter(([_, data]) => data.qty > 0)
          .map(([ticker, data]) => {
              const pnlRecord = pnlData.find(p => p.scripName.toLowerCase() === ticker.toLowerCase());
              let livePrice = priceData[ticker.toUpperCase()]; 

              if (livePrice === undefined && context === 'INTERNATIONAL_EQUITY') {
                  const cleanTicker = ticker.toUpperCase();
                  const priceKey = Object.keys(priceData).find(pk => {
                      if (pk.length < 5) return false; 
                      return cleanTicker.startsWith(pk) || pk.startsWith(cleanTicker) || cleanTicker.slice(0, 15) === pk.slice(0, 15);
                  });
                  if (priceKey) livePrice = priceData[priceKey];
              }

              let unrealized = 0;
              let marketValue = data.invested; 
              let isLive = false;

              if (livePrice !== undefined) {
                  marketValue = data.qty * livePrice;
                  unrealized = marketValue - data.invested;
                  isLive = true;
              } else if (pnlRecord) {
                  unrealized = pnlRecord.unrealizedPnL;
                  marketValue = data.invested + unrealized;
              }

              totalUnrealizedPnL += unrealized;
              const netReturnPct = data.invested > 0 ? (unrealized / data.invested) * 100 : 0;
              let daysHeld = 0;
              if (data.latestBuyDate) {
                  const diffTime = Math.abs(referenceDate.getTime() - new Date(data.latestBuyDate).getTime());
                  daysHeld = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              }

              return {
                  ticker, qty: data.qty, invested: data.invested, unrealized, realized: data.realizedPnL,
                  netReturnPct, marketValue, daysHeld: isNaN(daysHeld) ? 0 : daysHeld, isLive, portfolioPct: 0
              };
          });

        const currentValue = totalInvested + totalUnrealizedPnL + cashBalance;
        const netRealizedPnL = grossRealizedPnL - Math.abs(charges);

        const finalHoldings = portfolioHoldings.map(h => ({
            ...h, portfolioPct: currentValue > 0 ? (h.marketValue / currentValue) * 100 : 0
        }));
        
        if (cashBalance > 0) {
            finalHoldings.push({
                ticker: 'CASH BALANCE', qty: 1, invested: cashBalance, unrealized: 0, realized: 0,
                netReturnPct: 0, marketValue: cashBalance, daysHeld: 0, isLive: true,
                portfolioPct: currentValue > 0 ? (cashBalance / currentValue) * 100 : 0
            });
        }
        finalHoldings.sort((a, b) => b.portfolioPct - a.portfolioPct);

        let xirr = 0;
        if (trades.length > 0) {
             try {
                const flows = trades.map(t => ({ amount: t.netAmount, date: new Date(t.date) }));
                const val = calculateXIRR(flows, totalInvested + totalUnrealizedPnL);
                if (!isNaN(val) && isFinite(val)) xirr = val * 100;
             } catch(e) {}
        }

        return {
            totalInvested, grossRealizedPnL, realizedPnL: grossRealizedPnL, unrealizedPnL: totalUnrealizedPnL,
            charges, netRealizedPnL, totalDividends, cashBalance, currentValue, xirr,
            holdings: finalHoldings,
            hasLiveData: Object.keys(priceData).length > 0,
            tradePerformance
        };
    }, [trades, pnlData, ledgerData, dividendData, priceData, summary, context, mfHoldings, goldHoldings, cashHoldings, globalMarketDate]);

    return {
        trades, pnlData, ledgerData, dividendData, priceData, watchlist, uploadMeta, sheetId,
        metrics, lastUploadPreview, MUTUAL_FUND_SHEET_URL, GOLD_ETF_SHEET_URL, globalMarketDate,
        processFile, clearAllData, addToWatchlist, removeFromWatchlist, updateWatchlistItem, updateMeta, saveSheetId, updateGlobalDate,
        addSalary, updateCashHolding, deleteCashHolding
    };
};
