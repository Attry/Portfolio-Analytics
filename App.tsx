import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatsCard } from './components/StatsCard';
import { ViewState, Trade, TradeType, PnLRecord, LedgerRecord, DividendRecord, StockPriceRecord, WatchlistItem, AssetContext } from './types';
import { analyzePortfolio } from './services/geminiService';
import { 
  Briefcase, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Search, 
  Filter, 
  Download,
  Send,
  Loader2,
  FileSpreadsheet,
  UploadCloud,
  BrainCircuit,
  Receipt,
  Landmark,
  Coins,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Scale,
  Wallet,
  CalendarClock,
  Sparkles,
  Zap,
  ExternalLink,
  Calendar,
  Link,
  Globe,
  Trash2,
  History,
  ListChecks,
  Plus,
  X,
  LineChart as LineChartIcon,
  BarChart3,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// New Vibrant Palette
const COLORS = ['#7042f8', '#00e5ff', '#ff2975', '#00ffa3', '#facc15', '#fb923c', '#a855f7'];

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

// --- Dynamic Storage Keys ---
const getStorageKeys = (context: AssetContext) => {
    let prefix = 'dhan'; // Default for Indian Equity
    
    if (context === 'INTERNATIONAL_EQUITY') prefix = 'intl';
    else if (context === 'GOLD_ETF') prefix = 'gold';
    else if (context === 'CASH_EQUIVALENTS') prefix = 'cash';

    return {
        TRADES: `${prefix}_trades`,
        PNL: `${prefix}_pnl`,
        LEDGER: `${prefix}_ledger`,
        DIVIDENDS: `${prefix}_dividends`,
        PRICES: `${prefix}_prices`,
        WATCHLIST: `${prefix}_watchlist`,
        META: `${prefix}_meta`,
        SUMMARY: `${prefix}_summary`,
        SHEET_ID: `${prefix}_sheet_id`
    };
};

// --- Helper Functions ---

const clean = (val: string) => val ? val.replace(/"/g, '').trim() : '';

// Helper to normalize headers (remove accents, lowercase) for robust matching
const normalizeHeader = (header: string) => {
    if (!header) return "";
    return header
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
};

const parseNum = (val: string) => {
    if (!val) return 0;
    
    // Clean string: remove spaces (thousands separators in French), quotes
    let cleaned = val.replace(/[\s"]/g, '').trim();
    
    if (cleaned.includes('(') && cleaned.includes(')')) {
        cleaned = '-' + cleaned.replace(/[()]/g, '');
    }

    // Remove currency symbols/text (keeping digits, minus sign, dots, commas)
    cleaned = cleaned.replace(/[^0-9.,-]/g, '');

    if (!cleaned) return 0;

    // Robust European vs Standard detection
    if (cleaned.indexOf(',') > -1 && (cleaned.indexOf('.') === -1 || cleaned.indexOf(',') > cleaned.indexOf('.'))) {
         cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } 
    else {
        cleaned = cleaned.replace(/,/g, '');
    }

    const res = parseFloat(cleaned);
    return isNaN(res) ? 0 : res;
};

interface PerStockData {
  qty: number;
  invested: number;
  realizedPnL: number;
  buyQueue: { qty: number, price: number }[];
  latestBuyDate: string | null;
}

// --- FIFO Calculation Engine ---
const calculateFIFO = (trades: Trade[]) => {
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const holdings: Record<string, PerStockData> = {};
    const tradePerformance: Record<string, { realizedPnL: number, investAmount: number }> = {};
    
    let grossRealizedPnL = 0;
    let totalInvested = 0;

    sortedTrades.forEach(trade => {
        if (!holdings[trade.ticker]) {
            holdings[trade.ticker] = { 
                qty: 0, 
                invested: 0, 
                realizedPnL: 0, 
                buyQueue: [],
                latestBuyDate: null
            };
        }
        const position = holdings[trade.ticker];

        if (trade.type === TradeType.BUY) {
            position.qty += trade.quantity;
            position.buyQueue.push({ qty: trade.quantity, price: trade.price });
            if (!position.latestBuyDate || new Date(trade.date) > new Date(position.latestBuyDate)) {
                position.latestBuyDate = trade.date;
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

// --- XIRR Helper Function ---
const calculateXIRR = (transactions: { amount: number; date: Date }[], terminalValue: number, guess = 0.1): number => {
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

// --- Footer Scanner ---
const findValueInFooter = (rows: string[][], keywords: string[]): number | null => {
    const startIdx = Math.max(0, rows.length - 50);
    for (let i = rows.length - 1; i >= startIdx; i--) {
        const row = rows[i];
        for (let j = 0; j < row.length; j++) {
            const cellText = clean(row[j] || '').toLowerCase();
            if (keywords.some(k => cellText === k.toLowerCase())) {
                let val = parseNum(row[j+1] || '');
                if ((val === 0 || isNaN(val)) && (row[j+1] === '')) val = parseNum(row[j+2] || '');
                if ((val === 0 || isNaN(val)) && (row[j+2] === '')) val = parseNum(row[j+3] || '');
                if (val > 0) return val;
            }
        }
    }
    return null;
};

// --- Header Detection (Row 0 to 50) ---
const findHeaderRowIndex = (rows: string[][], requiredKeywords: string[]): number => {
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const rowString = rows[i].map(normalizeHeader).join(' ');
        const allFound = requiredKeywords.every(k => rowString.includes(normalizeHeader(k)));
        if (allFound) return i;
    }
    return -1;
};

const getColIndex = (headers: string[], possibleNames: string[]): number => {
    if (!headers) return -1;
    const normalizedHeaders = headers.map(normalizeHeader);
    
    for (const name of possibleNames) {
        const normName = normalizeHeader(name);
        let index = normalizedHeaders.indexOf(normName);
        if (index !== -1) return index;
        index = normalizedHeaders.findIndex(h => h.includes(normName));
        if (index !== -1) return index;
    }
    return -1;
};

// --- Inner Component: Handles the Logic for a Specific Portfolio Context ---
const PortfolioDashboard: React.FC<{ context: AssetContext, currentView: ViewState, setView: (view: ViewState) => void }> = ({ context, currentView, setView }) => {
  const currencySymbol = context === 'INTERNATIONAL_EQUITY' ? '€' : '₹';
  const [uploadType, setUploadType] = useState<UploadType>('TRADE_HISTORY');
  const STORAGE_KEYS = useMemo(() => getStorageKeys(context), [context]);

  const [trades, setTrades] = useState<Trade[]>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.TRADES);
      return saved ? JSON.parse(saved) : [];
  });
  const [pnlData, setPnlData] = useState<PnLRecord[]>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.PNL);
      return saved ? JSON.parse(saved) : [];
  });
  const [ledgerData, setLedgerData] = useState<LedgerRecord[]>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.LEDGER);
      return saved ? JSON.parse(saved) : [];
  });
  const [dividendData, setDividendData] = useState<DividendRecord[]>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.DIVIDENDS);
      return saved ? JSON.parse(saved) : [];
  });
  const [priceData, setPriceData] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.PRICES);
      return saved ? JSON.parse(saved) : {};
  });
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
      return saved ? JSON.parse(saved) : [];
  });

  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);
  const [tradeSearch, setTradeSearch] = useState('');
  const [tradeFilterType, setTradeFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

  const [uploadMeta, setUploadMeta] = useState<UploadMeta>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.META);
      return saved ? JSON.parse(saved) : {};
  });

  const [sheetId, setSheetId] = useState<string>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.SHEET_ID);
      if (saved) {
          try {
            return JSON.parse(saved) as string;
          } catch (e) {
            return saved;
          }
      }
      if (context === 'INTERNATIONAL_EQUITY') return "1zQFW9FHFoyvw4uZR4z3klFeoCIGJPUlq7QuDYwz4lEY";
      return "1htAAZP9eWVH0sq1BHbiS-dKJNzcP-uoBEW6GXp4N3HI";
  });

  const [marketDate, setMarketDate] = useState<string>(uploadMeta.marketDate || '');
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(uploadMeta.marketDate || null);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

  const [extractedCharges, setExtractedCharges] = useState<number>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.SUMMARY);
      return saved ? JSON.parse(saved).charges || 0 : 0;
  });
  const [extractedNetPnL, setExtractedNetPnL] = useState<number | null>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.SUMMARY);
      return saved ? JSON.parse(saved).netPnL : null;
  });
  const [extractedDividends, setExtractedDividends] = useState<number>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.SUMMARY);
      return saved ? JSON.parse(saved).dividends || 0 : 0;
  });
  const [extractedCash, setExtractedCash] = useState<number>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.SUMMARY);
      return saved ? JSON.parse(saved).cash || 0 : 0;
  });

  const [lastUploadPreview, setLastUploadPreview] = useState<any[]>([]);
  const [lastUploadHeaders, setLastUploadHeaders] = useState<string[]>([]);
  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const persistData = (key: string, data: any) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
          console.error("Storage limit exceeded or error", e);
          alert("Warning: Could not save data to local storage. It may be lost on refresh.");
      }
  };

  useEffect(() => {
      persistData(STORAGE_KEYS.SHEET_ID, sheetId);
  }, [sheetId, STORAGE_KEYS.SHEET_ID]);

  const updateMeta = (updates: Partial<UploadMeta>) => {
      setUploadMeta(prev => {
          const newMeta = { ...prev, ...updates };
          persistData(STORAGE_KEYS.META, newMeta);
          return newMeta;
      });
  };

  const saveSummary = (updates: any) => {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUMMARY) || '{}');
      const updated = { ...current, ...updates };
      persistData(STORAGE_KEYS.SUMMARY, updated);
  };

  const clearAllData = () => {
      if(confirm(`Are you sure you want to clear all imported data for ${context.replace(/_/g, ' ')}? This cannot be undone.`)) {
          Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key as string));
          setTrades([]);
          setPnlData([]);
          setLedgerData([]);
          setDividendData([]);
          setPriceData({});
          setWatchlist([]);
          setUploadMeta({});
          setExtractedCharges(0);
          setExtractedNetPnL(null);
          setExtractedDividends(0);
          setExtractedCash(0);
          setMarketDate('');
          if (context === 'INTERNATIONAL_EQUITY') setSheetId("1zQFW9FHFoyvw4uZR4z3klFeoCIGJPUlq7QuDYwz4lEY");
          else setSheetId("1htAAZP9eWVH0sq1BHbiS-dKJNzcP-uoBEW6GXp4N3HI");
          alert(`All data cleared for ${context.replace(/_/g, ' ')}.`);
      }
  };

  const formatLastSync = (isoString?: string) => {
      if (!isoString) return null;
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const addToWatchlist = (ticker: string) => {
      if (watchlist.some(w => w.ticker === ticker)) {
          alert(`${ticker} is already in your watchlist.`);
          return;
      }
      const newItem: WatchlistItem = {
          id: Math.random().toString(36).substr(2, 9),
          ticker,
          desiredEntryPrice: 0,
          intrinsicValue: 0,
          researchLink: ''
      };
      const updated = [...watchlist, newItem];
      setWatchlist(updated);
      persistData(STORAGE_KEYS.WATCHLIST, updated);
      setIsAddingWatchlist(false);
      setWatchlistSearch('');
  };

  const removeFromWatchlist = (id: string) => {
      const updated = watchlist.filter(w => w.id !== id);
      setWatchlist(updated);
      persistData(STORAGE_KEYS.WATCHLIST, updated);
  };

  const updateWatchlistItem = (id: string, field: keyof WatchlistItem, value: any) => {
      const updated = watchlist.map(w => {
          if (w.id === id) {
              return { ...w, [field]: value };
          }
          return w;
      });
      setWatchlist(updated);
      persistData(STORAGE_KEYS.WATCHLIST, updated);
  };

  const metrics = useMemo(() => {
    const { grossRealizedPnL, totalInvested, holdings, tradePerformance } = calculateFIFO(trades);
    let charges = extractedCharges;
    let totalDividends = dividendData.reduce((acc, curr) => acc + curr.amount, 0);
    if (extractedDividends > totalDividends) totalDividends = extractedDividends;

    let cashBalance = extractedCash;
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

          // --- SMART FUZZY MATCHING FOR INTERNATIONAL EQUITY ---
          if (livePrice === undefined && context === 'INTERNATIONAL_EQUITY') {
              const cleanTicker = ticker.toUpperCase();
              const priceKey = Object.keys(priceData).find(pk => {
                  if (pk.length < 5) return false; 
                  if (cleanTicker.startsWith(pk)) return true;
                  if (pk.startsWith(cleanTicker)) return true;
                  if (cleanTicker.slice(0, 15) === pk.slice(0, 15)) return true;
                  return false;
              });
              if (priceKey) livePrice = priceData[priceKey];
          }
          // -----------------------------------------------------

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
              const diffTime = Math.abs(new Date().getTime() - new Date(data.latestBuyDate).getTime());
              daysHeld = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          }

          return {
              ticker,
              qty: data.qty,
              invested: data.invested,
              unrealized,
              realized: data.realizedPnL,
              netReturnPct,
              marketValue, 
              daysHeld,
              isLive 
          };
      });

    const netRealizedPnL = grossRealizedPnL - Math.abs(charges);
    const currentValue = totalInvested + totalUnrealizedPnL + cashBalance;

    const finalHoldings = portfolioHoldings.map(h => ({
        ...h,
        portfolioPct: currentValue > 0 ? (h.marketValue / currentValue) * 100 : 0
    })).sort((a, b) => b.portfolioPct - a.portfolioPct);

    let xirr = 0;
    if (trades.length > 0) {
        const flows = trades.map(t => ({
            amount: t.netAmount, 
            date: new Date(t.date)
        }));
        const terminalValue = totalInvested + totalUnrealizedPnL;
        try {
            const calculated = calculateXIRR(flows, terminalValue);
            if (!isNaN(calculated) && isFinite(calculated)) {
                xirr = calculated * 100;
            }
        } catch (e) {
            console.warn("XIRR calc failed", e);
        }
    }

    return { 
      totalInvested, 
      grossRealizedPnL,
      realizedPnL: grossRealizedPnL,
      unrealizedPnL: totalUnrealizedPnL,
      charges,
      netRealizedPnL,
      totalDividends,
      cashBalance,
      currentValue,
      xirr,
      reportedNetPnL: extractedNetPnL,
      holdings: finalHoldings,
      hasLiveData: Object.keys(priceData).length > 0,
      tradePerformance
    };
  }, [pnlData, ledgerData, dividendData, trades, extractedCharges, extractedNetPnL, extractedDividends, extractedCash, priceData, context]);

  const tickerDistribution = useMemo(() => {
    if (metrics.holdings.length > 0) {
        return metrics.holdings
            .map(h => ({ name: h.ticker, value: h.marketValue || 0 }))
            .sort((a, b) => b.value - a.value);
    }
    return [];
  }, [metrics.holdings]);

  const parseIndianDate = (dateStr: string): string => {
      if (!dateStr) return '';
      dateStr = dateStr.trim();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
      if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const [d, m, y] = dateStr.split('-');
          return `${y}-${m}-${d}`;
      }
      const months: {[key: string]: string} = {
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
          'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const parts = dateStr.split(/[-/ ]/);
      if (parts.length === 3) {
          let p0 = parts[0];
          let p1 = parts[1];
          let p2 = parts[2];
          let day, month, year;
          if (p0.length === 4) { year = p0; month = p1; day = p2; }
          else if (p2.length === 4) { day = p0; month = p1; year = p2; }
          else {
              day = p0; month = p1; year = '20' + p2;
          }
          if (isNaN(Number(month))) {
              const mStr = month.toLowerCase().substring(0, 3);
              if (months[mStr]) month = months[mStr];
              else return '';
          }
          if (year.length === 2) year = '20' + year;
          const m = month.toString().padStart(2, '0');
          const d = day.toString().padStart(2, '0');
          if (isNaN(Number(year)) || isNaN(Number(m)) || isNaN(Number(d))) return '';
          return `${year}-${m}-${d}`;
      }
      return '';
  };

  const processMarketDataCSV = (content: string) => {
    try {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const rawRows = lines.map(line => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/));
        setLastUploadPreview(rawRows.slice(0, 5));

        const tickerKeywords = ['Ticker', 'Symbol', 'Stock', 'Name', 'Scrip', 'Product'];
        const priceKeywords = ['Price', 'Close', 'LTP', 'Rate', 'Value'];
        
        let hIdx = -1;
        for(let i = 0; i < Math.min(rawRows.length, 50); i++) {
            const rowStr = rawRows[i].join(' ').toLowerCase();
            const hasTicker = tickerKeywords.some(k => rowStr.includes(k.toLowerCase()));
            const hasPrice = priceKeywords.some(k => rowStr.includes(k.toLowerCase()));
            if(hasTicker && hasPrice) {
                hIdx = i;
                break;
            }
        }
        
        if (hIdx === -1) {
            alert("Could not detect headers. Ensure CSV has columns named like 'Ticker'/'Name' and 'Price'/'Close'.");
            return;
        }
        
        const headers = rawRows[hIdx];
        setLastUploadHeaders(headers);
        const rows = rawRows.slice(hIdx + 1);

        const idxTicker = getColIndex(headers, tickerKeywords);
        const idxPrice = getColIndex(headers, priceKeywords);
        
        if (idxTicker === -1 || idxPrice === -1) {
                alert("Found potential header row but could not identify specific Ticker or Price columns.");
                return;
        }
        
        const newPrices: Record<string, number> = {};
        let count = 0;

        rows.forEach(row => {
            const ticker = clean(row[idxTicker] || '').toUpperCase();
            const priceRaw = row[idxPrice] || '';
            const price = Math.abs(parseNum(priceRaw));

            if (ticker && price > 0) {
                newPrices[ticker] = price;
                count++;
            }
        });
        
        if (count === 0) {
            alert("No valid price data extracted. Check file format.");
            return;
        }
        
        setPriceData(prev => {
            const updated = { ...prev, ...newPrices };
            persistData(STORAGE_KEYS.PRICES, updated);
            return updated;
        });
        setLastPriceUpdate(marketDate || new Date().toISOString().split('T')[0]);
        updateMeta({ market: new Date().toISOString(), marketDate: marketDate });
        
        alert(`Success: Updated prices for ${count} stocks.`);
    } catch (error: any) {
        console.error("Error processing market CSV:", error);
        alert("Error parsing market data. check console.");
    }
  };

  const processIndianEquityUpload = (content: string, type: UploadType, rawRows: string[][]) => {
      if (type === 'TRADE_HISTORY') {
             const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Price']);
             if (headerIdx === -1) {
                 alert("Could not find header row. Expecting 'Date' and 'Price'.");
                 return;
             }
             const headers = rawRows[headerIdx];
             const rows = rawRows.slice(headerIdx + 1);
             setLastUploadHeaders(headers);

             const idxDate = getColIndex(headers, ['Date', 'Time']);
             const idxTicker = getColIndex(headers, ['Symbol', 'Scrip', 'Name', 'Ticker']);
             const idxType = getColIndex(headers, ['Type', 'Buy/Sell', 'Side']);
             const idxQty = getColIndex(headers, ['Qty', 'Quantity']);
             const idxPrice = getColIndex(headers, ['Price', 'Rate', 'Trade Price']);
             
             const newTrades: Trade[] = [];
             rows.forEach(row => {
                 const dateStr = parseIndianDate(clean(row[idxDate] || ''));
                 if (!dateStr) return;

                 const ticker = clean(row[idxTicker] || '');
                 const typeStr = idxType !== -1 ? clean(row[idxType] || '').toUpperCase() : 'BUY'; 
                 const qty = Math.abs(parseNum(row[idxQty] || ''));
                 const price = Math.abs(parseNum(row[idxPrice] || ''));
                 const tradeType = (typeStr.includes('B') || typeStr.includes('P')) ? TradeType.BUY : TradeType.SELL;
                 const netAmount = tradeType === TradeType.BUY ? -(qty * price) : (qty * price);

                 if (ticker && qty > 0) {
                     newTrades.push({
                         id: Math.random().toString(36).substr(2, 9),
                         date: dateStr,
                         ticker,
                         type: tradeType,
                         quantity: qty,
                         price,
                         netAmount,
                         status: 'TRADED'
                     });
                 }
             });
             
             if (newTrades.length > 0) {
                 setTrades(newTrades);
                 persistData(STORAGE_KEYS.TRADES, newTrades);
                 updateMeta({ trades: new Date().toISOString() });
                 alert(`Success: Imported ${newTrades.length} trades.`);
             } else {
                 alert("No valid trades found. Check CSV format.");
             }
      }
      else if (type === 'MARKET_DATA') {
            processMarketDataCSV(content);
      }
      else if (type === 'PNL') {
             const totalCharges = findValueInFooter(rawRows, ['Total Charges', 'Charges']);
             if (totalCharges !== null) {
                 setExtractedCharges(totalCharges);
                 saveSummary({ charges: totalCharges });
             }
             const reportedNet = findValueInFooter(rawRows, ['Net P&L', 'Net Realised P&L']);
             if (reportedNet !== null) {
                 setExtractedNetPnL(reportedNet);
                 saveSummary({ netPnL: reportedNet });
             }

             const headerIdx = findHeaderRowIndex(rawRows, ['Scrip', 'Qty']);
             if (headerIdx !== -1) {
                 const headers = rawRows[headerIdx];
                 const rows = rawRows.slice(headerIdx + 1);
                 setLastUploadHeaders(headers);

                 const idxScrip = getColIndex(headers, ['Scrip', 'Symbol', 'Stock']);
                 const idxBuyQty = getColIndex(headers, ['Buy Qty']);
                 const idxBuyPrice = getColIndex(headers, ['Buy Avg', 'Buy Price']);
                 const idxSellQty = getColIndex(headers, ['Sell Qty']);
                 const idxSellPrice = getColIndex(headers, ['Sell Avg', 'Sell Price']);
                 const idxRealized = getColIndex(headers, ['Realized', 'Realised']);
                 const idxUnrealized = getColIndex(headers, ['Unrealized', 'Unrealised']);

                 const newPnl: PnLRecord[] = rows.map(row => ({
                     scripName: clean(row[idxScrip] || ''),
                     buyQty: idxBuyQty !== -1 ? parseNum(row[idxBuyQty] || '') : 0,
                     avgBuyPrice: idxBuyPrice !== -1 ? parseNum(row[idxBuyPrice] || '') : 0,
                     buyValue: (idxBuyQty !== -1 && idxBuyPrice !== -1) ? parseNum(row[idxBuyQty] || '') * parseNum(row[idxBuyPrice] || '') : 0, 
                     sellQty: idxSellQty !== -1 ? parseNum(row[idxSellQty] || '') : 0,
                     avgSellPrice: idxSellPrice !== -1 ? parseNum(row[idxSellPrice] || '') : 0,
                     sellValue: (idxSellQty !== -1 && idxSellPrice !== -1) ? parseNum(row[idxSellQty] || '') * parseNum(row[idxSellPrice] || '') : 0,
                     realizedPnL: idxRealized !== -1 ? parseNum(row[idxRealized] || '') : 0,
                     unrealizedPnL: idxUnrealized !== -1 ? parseNum(row[idxUnrealized] || '') : 0,
                 })).filter(r => r.scripName && r.scripName !== 'Total' && r.scripName !== '');

                 if (newPnl.length > 0) {
                     setPnlData(newPnl);
                     persistData(STORAGE_KEYS.PNL, newPnl);
                     updateMeta({ pnl: new Date().toISOString() });
                     alert(`Success: Imported ${newPnl.length} P&L records.`);
                 }
            }
      } 
      else if (type === 'LEDGER') {
             const closingBal = findValueInFooter(rawRows, ['Closing Balance', 'Balance']);
             if (closingBal !== null) {
                 setExtractedCash(closingBal);
                 saveSummary({ cash: closingBal });
             }

             const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Debit']);
             if (headerIdx !== -1) {
                 const headers = rawRows[headerIdx];
                 const rows = rawRows.slice(headerIdx + 1);
                 
                 const idxDate = getColIndex(headers, ['Date', 'Posting']);
                 const idxDesc = getColIndex(headers, ['Description', 'Narration']);
                 const idxDebit = getColIndex(headers, ['Debit']);
                 const idxCredit = getColIndex(headers, ['Credit']);
                 const idxBalance = getColIndex(headers, ['Balance', 'Net']);
                 
                 const newLedger: LedgerRecord[] = rows.map(row => ({
                     date: parseIndianDate(clean(row[idxDate] || '')),
                     description: idxDesc !== -1 ? clean(row[idxDesc] || '') : '',
                     credit: idxCredit !== -1 ? parseNum(row[idxCredit] || '') : 0,
                     debit: idxDebit !== -1 ? parseNum(row[idxDebit] || '') : 0,
                     balance: idxBalance !== -1 ? parseNum(row[idxBalance] || '') : 0,
                     type: 'OTHER' as const
                 })).filter(r => r.date);
                 
                 setLedgerData(newLedger);
                 persistData(STORAGE_KEYS.LEDGER, newLedger);
                 updateMeta({ ledger: new Date().toISOString() });
             }
             alert(`Success: Ledger imported.`);
      }
      else if (type === 'DIVIDEND') {
             const totalDiv = findValueInFooter(rawRows, ['Total Dividend Earned', 'Total Dividend', 'Total']);
             if (totalDiv !== null) {
                 setExtractedDividends(totalDiv);
                 saveSummary({ dividends: totalDiv });
             }

             const possibleHeaderKeywords = [
                 ['Date', 'Amount'], 
                 ['Date', 'Net'], 
                 ['Payout', 'Amount'],
                 ['Date', 'Dividend']
             ];
             
             let headerIdx = -1;
             for (const keywords of possibleHeaderKeywords) {
                 headerIdx = findHeaderRowIndex(rawRows, keywords);
                 if (headerIdx !== -1) break;
             }
             
             if (headerIdx === -1) headerIdx = findHeaderRowIndex(rawRows, ['Date']);

             if (headerIdx !== -1) {
                 const headers = rawRows[headerIdx];
                 const rows = rawRows.slice(headerIdx + 1);
                 setLastUploadHeaders(headers);

                 const idxDate = getColIndex(headers, ['Date', 'Payout Date']);
                 const idxScrip = getColIndex(headers, ['Symbol', 'Scrip', 'Security Name']);
                 const idxAmt = getColIndex(headers, ['Amount', 'Net', 'Net Amount', 'Dividend Amount', 'Credit']);
                 
                 let newDivs: DividendRecord[] = [];
                 if (idxDate !== -1 && idxAmt !== -1) {
                     newDivs = rows.map(row => {
                        const dateStr = parseIndianDate(clean(row[idxDate] || ''));
                        if (!dateStr) return null;
                        
                        const scripName = idxScrip !== -1 ? clean(row[idxScrip] || '') : 'Unknown';
                        const amount = Math.abs(parseNum(row[idxAmt] || ''));
                        if (amount <= 0) return null;

                        return { date: dateStr, scripName, amount };
                     }).filter((r): r is DividendRecord => r !== null);
                 }
                 
                 if (newDivs.length > 0) {
                    setDividendData(newDivs);
                    persistData(STORAGE_KEYS.DIVIDENDS, newDivs);
                    updateMeta({ dividend: new Date().toISOString() });
                    alert(`Success: Imported ${newDivs.length} dividend records.`);
                 } else if (totalDiv !== null && totalDiv > 0) {
                     const synthetic: DividendRecord[] = [{
                         date: new Date().toISOString().split('T')[0],
                         scripName: 'Total (Imported)',
                         amount: totalDiv
                     }];
                     setDividendData(synthetic);
                     persistData(STORAGE_KEYS.DIVIDENDS, synthetic);
                     updateMeta({ dividend: new Date().toISOString() });
                     alert(`Success: Imported Total Dividend of ₹${totalDiv} from footer. (Individual rows skipped).`);
                 } else {
                    alert("Headers found, but no valid dividend rows or footer total extracted.");
                 }
             } else {
                 if (totalDiv !== null && totalDiv > 0) {
                     const synthetic: DividendRecord[] = [{
                         date: new Date().toISOString().split('T')[0],
                         scripName: 'Total (Imported)',
                         amount: totalDiv
                     }];
                     setDividendData(synthetic);
                     persistData(STORAGE_KEYS.DIVIDENDS, synthetic);
                     updateMeta({ dividend: new Date().toISOString() });
                     alert(`Success: Imported Total Dividend of ₹${totalDiv} from footer. (Headers not detected).`);
                 } else {
                     alert("Could not detect headers or 'Total Dividend' footer.");
                 }
             }
      }
  };

  const processInternationalEquityUpload = (content: string, type: UploadType, rawRows: string[][]) => {
      if (type === 'TRADE_HISTORY') {
          const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Produit', 'Quantité']);
          if (headerIdx === -1) {
                alert("Could not find Degiro transactions header. Expecting 'Date', 'Produit' and 'Quantité'.");
                return;
          }
          
          const headers = rawRows[headerIdx];
          setLastUploadHeaders(headers);
          const rows = rawRows.slice(headerIdx + 1);

          const idxDate = getColIndex(headers, ['Date']);
          const idxTime = getColIndex(headers, ['Heure', 'Time']);
          const idxTicker = getColIndex(headers, ['Produit', 'Product']);
          const idxQty = getColIndex(headers, ['Quantité', 'Quantity', 'Quantite']); 
          const idxPrice = getColIndex(headers, ['Cours', 'Price']);
          const idxNetEUR = getColIndex(headers, ['Montant négocié EUR', 'Montant negocie EUR', 'Montant EUR', 'Net Amount', 'Total']); 
          
          // Fee/Tax Columns Logic
          const idxAutoFX = getColIndex(headers, ['Frais conversion AutoFX', 'AutoFX']);
          const idxBrokerage = getColIndex(headers, ['Frais de courtage et/ou de parties', 'Courtage', 'Brokerage', 'Commission']);

          const newTrades: Trade[] = [];
          let totalFeesAccumulated = 0;
          
          const orderedRows = [...rows].reverse();

          orderedRows.forEach(row => {
              let dateStr = parseIndianDate(clean(row[idxDate] || ''));
              if (!dateStr) return;

              if (idxTime !== -1) {
                  const timeStr = clean(row[idxTime] || '');
                  if (timeStr && timeStr.includes(':')) {
                      dateStr = `${dateStr}T${timeStr}`;
                  }
              }

              const ticker = clean(row[idxTicker] || '');
              const qtyRaw = parseNum(row[idxQty] || '');
              const qty = Math.abs(qtyRaw);
              const price = Math.abs(parseNum(row[idxPrice] || ''));
              const tradeType = qtyRaw > 0 ? TradeType.BUY : TradeType.SELL;
              
              // Accumulate Charges
              const autoFXFee = idxAutoFX !== -1 ? Math.abs(parseNum(row[idxAutoFX] || '')) : 0;
              const brokerageFee = idxBrokerage !== -1 ? Math.abs(parseNum(row[idxBrokerage] || '')) : 0;
              totalFeesAccumulated += (autoFXFee + brokerageFee);

              let netAmount = 0;
              if (idxNetEUR !== -1 && row[idxNetEUR]) {
                  netAmount = parseNum(row[idxNetEUR]);
              } else {
                  netAmount = tradeType === TradeType.BUY ? -(qty * price) : (qty * price);
              }

              if (ticker && qty > 0) {
                  newTrades.push({
                      id: Math.random().toString(36).substr(2, 9),
                      date: dateStr,
                      ticker,
                      type: tradeType,
                      quantity: qty,
                      price,
                      netAmount,
                      status: 'TRADED'
                  });
              }
          });

          if (newTrades.length > 0) {
            setTrades(newTrades);
            persistData(STORAGE_KEYS.TRADES, newTrades);
            
            // Save cumulative charges
            setExtractedCharges(totalFeesAccumulated);
            saveSummary({ charges: totalFeesAccumulated });

            updateMeta({ trades: new Date().toISOString() });
            alert(`Success: Imported ${newTrades.length} Degiro transactions with ${totalFeesAccumulated.toFixed(2)} in total charges/taxes.`);
          } else {
            alert("No valid trades parsed. Check CSV format.");
          }
      }
      else if (type === 'LEDGER') {
           const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Description']);
           if (headerIdx !== -1) {
               const headers = rawRows[headerIdx];
               setLastUploadHeaders(headers);
               const rows = rawRows.slice(headerIdx + 1);
               
               const idxDate = getColIndex(headers, ['Date', 'Value Date']);
               const idxDesc = getColIndex(headers, ['Description']);
               const idxProduct = getColIndex(headers, ['Produit', 'Product']);
               // "Mouvements" or "Change" column often contains the Currency (e.g. USD, EUR)
               const idxCurrency = getColIndex(headers, ['Mouvements', 'Movement', 'Change']); 
               
               const newDividends: DividendRecord[] = [];
               
               rows.forEach(row => {
                   if (idxDesc === -1 || idxDate === -1) return;

                   const desc = clean(row[idxDesc] || '');
                   
                   // Strict filter for 'Dividende'
                   if (desc === 'Dividende') {
                       const dateStr = parseIndianDate(clean(row[idxDate] || ''));
                       if (!dateStr) return;
                       
                       const scripName = idxProduct !== -1 ? clean(row[idxProduct] || '') : 'Unknown';
                       
                       let currency = 'EUR';
                       let valStr = '0';

                       if (idxCurrency !== -1) {
                           // Dynamic: Currency is at found index, Amount is in the adjacent column (Index + 1)
                           currency = clean(row[idxCurrency] || 'EUR').toUpperCase();
                           valStr = clean(row[idxCurrency + 1] || '0');
                       } else {
                           // Fallback: Look for 'Montant' or 'Amount' directly
                           const idxAmount = getColIndex(headers, ['Montant', 'Amount']);
                           if (idxAmount !== -1) {
                               valStr = clean(row[idxAmount] || '0');
                               const idxDevise = getColIndex(headers, ['Devise', 'Currency']);
                               if (idxDevise !== -1) currency = clean(row[idxDevise] || 'EUR').toUpperCase();
                           }
                       }

                       // Strict European Parsing: Remove dots (thousands), replace comma with dot (decimal)
                       // Example: "1.250,50" -> 1250.50
                       const amountVal = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));

                       if (!isNaN(amountVal) && amountVal !== 0) {
                           // Currency Conversion Rates
                           let rate = 1.0; 
                           if (currency === 'USD') rate = 0.92;
                           else if (currency === 'NO' || currency === 'NOK') rate = 0.088; 
                           else if (currency === 'SEK') rate = 0.087;
                           else if (currency === 'GBP') rate = 1.17;

                           const convertedAmount = Math.abs(amountVal) * rate;

                           newDividends.push({
                               date: dateStr,
                               scripName, 
                               amount: convertedAmount
                           });
                       }
                   }
               });

               if (newDividends.length > 0) {
                   setDividendData(newDividends);
                   persistData(STORAGE_KEYS.DIVIDENDS, newDividends);
                   
                   // Reset summary to ensure calculated total is used
                   setExtractedDividends(0);
                   saveSummary({ dividends: 0 });

                   updateMeta({ dividend: new Date().toISOString(), ledger: new Date().toISOString() });
                   alert(`Success: Imported ${newDividends.length} Dividend records using dynamic column mapping.`);
               } else {
                   alert("No rows with Description 'Dividende' found.");
               }
           } else {
               alert("Could not find Degiro Account headers (Date, Description).");
           }
      }
      else if (type === 'PORTFOLIO_SNAPSHOT') {
          // Extract cash from cell 2G (Row 2, Column G -> index 1, 6)
          if (rawRows.length > 1 && rawRows[1].length > 6) {
              const cashVal = parseNum(rawRows[1][6]);
              if (cashVal !== 0) {
                  setExtractedCash(cashVal);
                  saveSummary({ cash: cashVal });
              }
          }

          const headerIdx = findHeaderRowIndex(rawRows, ['Produit', 'Clôture']); 
          if (headerIdx === -1) {
               alert("Could not find Degiro Portfolio headers (Produit, Clôture).");
               return;
          }

          const finalIdx = headerIdx;
          const headers = rawRows[finalIdx];
          setLastUploadHeaders(headers);
          const rows = rawRows.slice(finalIdx + 1);
          
          const idxProduct = getColIndex(headers, ['Produit', 'Product']);
          const idxPrice = getColIndex(headers, ['Clôture', 'Close', 'Price']);
          
          const newPrices: Record<string, number> = {};
          let count = 0;
          
          rows.forEach(row => {
              const ticker = clean(row[idxProduct] || '').toUpperCase();
              const price = Math.abs(parseNum(row[idxPrice] || ''));
              
              if (ticker && price > 0) {
                  newPrices[ticker] = price;
                  count++;
              }
          });
          
          if (count > 0) {
              setPriceData(prev => {
                  const updated = { ...prev, ...newPrices };
                  persistData(STORAGE_KEYS.PRICES, updated);
                  return updated;
              });
              const today = new Date().toISOString().split('T')[0];
              setLastPriceUpdate(today);
              updateMeta({ portfolio: new Date().toISOString(), marketDate: today });
              alert(`Success: Updated prices for ${count} stocks and synced cash balance.`);
          } else {
              alert("No valid pricing data found in Portfolio CSV.");
          }
      }
      else if (type === 'MARKET_DATA') {
          processMarketDataCSV(content);
      }
  };

  const handleGoogleSheetFetch = async () => {
    if (!sheetId || !marketDate) {
        alert("Please provide both Sheet ID and Date.");
        return;
    }
    
    setIsFetchingSheet(true);
    try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch sheet: ${response.statusText}`);
        }
        const csvText = await response.text();
        if (csvText.toLowerCase().includes('<!doctype html>')) {
             throw new Error("Access denied. Please ensure the Sheet is 'Published to the web'.");
        }
        processMarketDataCSV(csvText);
    } catch (error: any) {
        console.error("Google Sheet Fetch Error:", error);
        alert(`Failed to fetch data: ${error.message}`);
    } finally {
        setIsFetchingSheet(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        if (sheetId && marketDate) {
            handleGoogleSheetFetch();
        }
    }, 5000);
    return () => clearTimeout(timer);
  }, [sheetId]); 

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: UploadType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === 'MARKET_DATA' && !marketDate) {
        alert("Please select the Date of Market Data before uploading.");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        try {
          const firstLine = content.substring(0, 1000).split('\n')[0];
          const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
          const splitRegex = delimiter === ';' ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/ : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

          const lines = content.split('\n').filter(line => line.trim() !== '');
          const rawRows = lines.map(line => line.split(splitRegex));
          setLastUploadPreview(rawRows.slice(0, 5));

          if (context === 'INDIAN_EQUITY') {
              processIndianEquityUpload(content, type, rawRows);
          } else if (context === 'INTERNATIONAL_EQUITY') {
              processInternationalEquityUpload(content, type, rawRows);
          }
        } catch (error) {
          console.error("Error parsing CSV:", error);
          alert("Error parsing CSV. Please check the console.");
        }
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAnalysis = async () => {
    if (!chatQuery.trim()) return;
    setIsAnalyzing(true);
    setChatResponse(null);
    try {
        const response = await analyzePortfolio(trades, chatQuery);
        setChatResponse(response);
    } catch (error) {
        setChatResponse("Failed to generate response.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  // Logic for Watchlist Search
  const availableTickers = useMemo(() => Object.keys(priceData).sort(), [priceData]);
  const filteredWatchlistSearch = useMemo(() => availableTickers.filter(t => t.toLowerCase().includes(watchlistSearch.toLowerCase())), [availableTickers, watchlistSearch]);

  // Logic for Transactions Filter
  const filteredTrades = useMemo(() => {
      return trades.filter(t => {
          const matchesSearch = t.ticker.toLowerCase().includes(tradeSearch.toLowerCase());
          const matchesType = tradeFilterType === 'ALL' || t.type === tradeFilterType;
          return matchesSearch && matchesType;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [trades, tradeSearch, tradeFilterType]);

  const displayedPnL = useMemo(() => {
      return filteredTrades.reduce((acc, t) => {
          const perf = metrics.tradePerformance[t.id];
          return acc + (perf ? perf.realizedPnL : 0);
      }, 0);
  }, [filteredTrades, metrics.tradePerformance]);

  const getUploadOptions = (ctx: AssetContext) => {
      if (ctx === 'INDIAN_EQUITY') {
          return [
             { id: 'TRADE_HISTORY', label: 'Trade History', icon: <History />, desc: 'CSV with Date, Ticker, Qty, Price', visible: true },
             { id: 'PNL', label: 'P&L Report', icon: <FileSpreadsheet />, desc: 'Extract Charges & Net P&L', visible: true },
             { id: 'LEDGER', label: 'Ledger', icon: <FileText />, desc: 'Extract Cash Balance', visible: true },
             { id: 'DIVIDEND', label: 'Dividends', icon: <Coins />, desc: 'Extract Dividend Payouts', visible: true },
             { id: 'MARKET_DATA', label: 'Market Prices', icon: <LineChartIcon />, desc: 'CSV or Sheet Sync', visible: true },
          ];
      }
      if (ctx === 'INTERNATIONAL_EQUITY') {
          return [
             { id: 'TRADE_HISTORY', label: 'Trade History', icon: <History />, desc: 'Degiro Transactions CSV', visible: true },
             { id: 'LEDGER', label: 'Account Statement', icon: <FileText />, desc: 'Degiro Account CSV (Dividends)', visible: true },
             { id: 'PORTFOLIO_SNAPSHOT', label: 'Portfolio', icon: <Briefcase />, desc: 'Degiro Portfolio CSV (Prices)', visible: true },
             { id: 'MARKET_DATA', label: 'Market Prices', icon: <LineChartIcon />, desc: 'General Market Data CSV', visible: true },
          ];
      }
      return [];
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full pb-24">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{context.replace(/_/g, ' ')}</h2>
                <p className="text-gray-400 text-sm mt-1">Overview of your investment portfolio</p>
            </div>
            <div className="flex items-center gap-3">
                 <div className="text-right">
                    <p className="text-xs text-gray-500">Market Data</p>
                    <p className={`text-xs font-bold ${metrics.hasLiveData ? 'text-success' : 'text-warning'}`}>
                        {metrics.hasLiveData ? 'LIVE' : 'OFFLINE'}
                    </p>
                 </div>
                 <button onClick={handleGoogleSheetFetch} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors" title="Sync Market Data">
                    <RefreshCw size={18} className={`text-primary-glow ${isFetchingSheet ? 'animate-spin' : ''}`} />
                 </button>
                 <button onClick={clearAllData} className="p-2 bg-danger/10 hover:bg-danger/20 rounded-lg border border-danger/20 transition-colors text-danger" title="Clear Data">
                    <Trash2 size={18} />
                 </button>
            </div>
        </div>

        {/* --- DASHBOARD VIEW --- */}
        {currentView === ViewState.DASHBOARD && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatsCard 
                        title="Current Value" 
                        value={`${currencySymbol}${metrics.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                        icon={<Wallet />}
                        change={metrics.totalInvested > 0 ? `${((metrics.unrealizedPnL / metrics.totalInvested) * 100).toFixed(2)}%` : undefined}
                        isPositive={metrics.unrealizedPnL >= 0}
                    />
                    <StatsCard 
                        title="Total Invested" 
                        value={`${currencySymbol}${metrics.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                        icon={<Briefcase />} 
                    />
                    <StatsCard 
                        title="Unrealized P&L" 
                        value={`${currencySymbol}${metrics.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                        icon={<TrendingUp />} 
                        isPositive={metrics.unrealizedPnL >= 0}
                    />
                     <StatsCard 
                        title="XIRR" 
                        value={`${metrics.xirr.toFixed(2)}%`} 
                        icon={<Activity />} 
                        isPositive={metrics.xirr >= 0}
                    />
                    <StatsCard 
                        title="Diversification" 
                        value={`${metrics.holdings.length}`} 
                        icon={<Scale />} 
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Allocation Chart */}
                    <div className="glass-card rounded-2xl p-6 lg:col-span-1 border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-accent-cyan" /> Allocation
                        </h3>
                        <div className="h-[300px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={tickerDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {tickerDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(value: number) => `${currencySymbol}${value.toLocaleString()}`}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="glass-card rounded-2xl p-6 lg:col-span-2 border border-white/5">
                         <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary-glow" /> Performance Summary
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Realized P&L</p>
                                <p className={`text-xl font-bold mt-1 ${metrics.grossRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {currencySymbol}{metrics.grossRealizedPnL.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Dividends</p>
                                <p className="text-xl font-bold mt-1 text-accent-cyan">
                                    {currencySymbol}{metrics.totalDividends.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Charges & Taxes</p>
                                <p className="text-xl font-bold mt-1 text-danger">
                                    {currencySymbol}{metrics.charges.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Cash Balance</p>
                                <p className="text-xl font-bold mt-1 text-accent-cyan">
                                    {currencySymbol}{metrics.cashBalance.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Net Realized P&L</p>
                                <p className={`text-xl font-bold mt-1 ${metrics.netRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {currencySymbol}{metrics.netRealizedPnL.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- HOLDINGS VIEW --- */}
        {currentView === ViewState.HOLDINGS && (
            <div className="glass-card rounded-2xl border border-white/5 overflow-hidden animate-fade-in">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase">Stock</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Qty</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Avg Price</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Invested</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Current Value</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Position</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">P&L</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">% Return</th>
                            </tr>
                        </thead>
                        <tbody>
                            {metrics.holdings.map((h, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                    <td className="p-4 font-medium text-white group-hover:text-primary-glow transition-colors">{h.ticker}</td>
                                    <td className="p-4 text-gray-300 text-right">{h.qty}</td>
                                    <td className="p-4 text-gray-300 text-right">{currencySymbol}{(h.invested / h.qty).toFixed(2)}</td>
                                    <td className="p-4 text-gray-300 text-right">{currencySymbol}{h.invested.toLocaleString()}</td>
                                    <td className="p-4 text-white font-medium text-right">{currencySymbol}{h.marketValue.toLocaleString()}</td>
                                    <td className="p-4 text-gray-300 text-right">{h.portfolioPct.toFixed(2)}%</td>
                                    <td className={`p-4 text-right font-bold ${h.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {h.unrealized >= 0 ? '+' : ''}{currencySymbol}{h.unrealized.toLocaleString()}
                                    </td>
                                    <td className={`p-4 text-right font-bold ${h.netReturnPct >= 0 ? 'text-success' : 'text-danger'}`}>
                                        {h.netReturnPct.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- TRANSACTIONS VIEW --- */}
        {currentView === ViewState.TRANSACTIONS && (
            <div className="glass-card rounded-2xl overflow-hidden animate-fade-in flex flex-col h-full">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <Receipt className="w-5 h-5 text-accent-pink" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Trade History & Performance</h2>
                            <p className="text-xs text-gray-400 mt-1">
                                Showing {filteredTrades.length} trades 
                                {Math.abs(displayedPnL) > 0 && (
                                    <span className={`ml-2 font-bold ${displayedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                        (Net P&L: {displayedPnL > 0 ? '+' : '-'}{currencySymbol}{Math.abs(displayedPnL).toLocaleString()})
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                         <div className="relative flex-1 md:flex-none">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                            <input 
                                type="text" 
                                placeholder="Search Ticker..."
                                value={tradeSearch}
                                onChange={(e) => setTradeSearch(e.target.value)}
                                className="bg-black/50 border border-white/10 text-white text-sm rounded-lg py-2 pl-9 pr-4 focus:ring-1 focus:ring-accent-pink outline-none w-full md:w-48"
                            />
                         </div>
                         <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
                            {['ALL', 'BUY', 'SELL'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setTradeFilterType(type as any)}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                                        tradeFilterType === type 
                                        ? 'bg-primary/20 text-white' 
                                        : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                         </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                    {filteredTrades.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10">
                             <History className="w-12 h-12 mb-4 opacity-50" />
                             <p className="text-sm">No trades found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 backdrop-blur-xl">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Ticker</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4 text-right">Qty</th>
                                    <th className="px-6 py-4 text-right">Price</th>
                                    <th className="px-6 py-4 text-right">Net Amount</th>
                                    <th className="px-6 py-4 text-right">Realized P&L</th>
                                    <th className="px-6 py-4 text-right">% Return</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredTrades.map((trade) => {
                                    const perf = metrics.tradePerformance[trade.id];
                                    const hasPerf = trade.type === TradeType.SELL && perf;
                                    
                                    const roi = hasPerf && perf.investAmount > 0 
                                        ? (perf.realizedPnL / perf.investAmount) * 100 
                                        : 0;

                                    return (
                                        <tr key={trade.id} className="hover:bg-white/5 transition-colors text-sm text-gray-300 group">
                                            <td className="px-6 py-4 font-mono text-gray-400 whitespace-nowrap">{trade.date}</td>
                                            <td className="px-6 py-4 font-bold text-white">{trade.ticker}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                                                    trade.type === TradeType.BUY 
                                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                                    : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                }`}>
                                                    {trade.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono">{trade.quantity}</td>
                                            <td className="px-6 py-4 text-right font-mono">{currencySymbol}{trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className={`px-6 py-4 text-right font-mono font-medium ${trade.netAmount > 0 ? 'text-success' : 'text-gray-400'}`}>
                                                {trade.netAmount > 0 ? '+' : ''}{currencySymbol}{Math.abs(trade.netAmount).toLocaleString()}
                                            </td>
                                            
                                            <td className="px-6 py-4 text-right font-mono font-bold">
                                                {hasPerf ? (
                                                    <span className={`flex items-center justify-end gap-1 ${perf.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                                        {perf.realizedPnL > 0 ? '+' : '-'}{currencySymbol}{Math.abs(perf.realizedPnL).toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600">-</span>
                                                )}
                                            </td>
                                            
                                            <td className="px-6 py-4 text-right font-mono font-bold">
                                                 {hasPerf ? (
                                                    <span className={`flex items-center justify-end gap-1 ${roi >= 0 ? 'text-success' : 'text-danger'}`}>
                                                        {roi >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                        {Math.abs(roi).toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-600">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        )}

        {/* --- WATCHLIST VIEW --- */}
        {currentView === ViewState.WATCHLIST && (
            <div className="glass-card rounded-2xl overflow-hidden animate-fade-in relative min-h-[500px]">
                <div className="p-6 border-b border-white/5 flex gap-4 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <ListChecks className="w-5 h-5 text-accent-pink" />
                        <h2 className="text-lg font-bold text-white">Watchlist</h2>
                    </div>
                    
                    <div className="relative">
                        {!isAddingWatchlist ? (
                            <button 
                                onClick={() => setIsAddingWatchlist(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary-glow border border-primary/30 rounded-lg text-sm font-bold transition-all"
                            >
                                <Plus size={16} /> Add Stock
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 animate-fade-in">
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                    <input 
                                        type="text" 
                                        autoFocus
                                        placeholder="Search Market Data..."
                                        value={watchlistSearch}
                                        onChange={(e) => setWatchlistSearch(e.target.value)}
                                        className="bg-black/50 border border-white/10 text-white text-sm rounded-lg py-2 pl-9 pr-4 focus:ring-1 focus:ring-accent-pink outline-none w-64"
                                    />
                                    {watchlistSearch && (
                                        <div className="absolute top-full mt-2 left-0 w-full bg-[#151925] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                            {filteredWatchlistSearch.length > 0 ? (
                                                filteredWatchlistSearch.map(ticker => (
                                                    <button
                                                        key={ticker}
                                                        onClick={() => addToWatchlist(ticker)}
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm text-gray-300 hover:text-white border-b border-white/5 last:border-0"
                                                    >
                                                        {ticker}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-sm text-gray-500">No stocks found in Market Data</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => { setIsAddingWatchlist(false); setWatchlistSearch(''); }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {watchlist.length === 0 ? (
                        <div className="text-center py-20">
                            <ListChecks className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <p className="text-gray-500 text-sm">Your watchlist is empty.</p>
                            {Object.keys(priceData).length === 0 && (
                                <p className="text-xs text-orange-400 mt-2">Note: You need to sync Market Data first to add stocks.</p>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4 text-right">Current Price</th>
                                    <th className="px-6 py-4 text-right">Desired Entry</th>
                                    <th className="px-6 py-4 text-right">Intrinsic Value</th>
                                    <th className="px-6 py-4 text-right">Margin of Safety</th>
                                    <th className="px-6 py-4 text-right">Call Ratio</th>
                                    <th className="px-6 py-4 text-center">Call</th>
                                    <th className="px-6 py-4 text-center">Report</th>
                                    <th className="px-6 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {watchlist.map(item => {
                                    const currentPrice = priceData[item.ticker] || 0;
                                    const mos = item.intrinsicValue > 0 
                                        ? (1 - (currentPrice / item.intrinsicValue)) * 100 
                                        : 0;
                                    const callRatio = currentPrice > 0 
                                        ? item.desiredEntryPrice / currentPrice 
                                        : 0;

                                    let callStatus = 'Expensive';
                                    let callColor = 'text-danger bg-danger/10 border-danger/20';
                                    
                                    if (callRatio > 0.9) {
                                        callStatus = 'Accumulate';
                                        callColor = 'text-success bg-success/10 border-success/20';
                                    } else if (callRatio >= 0.85) {
                                        callStatus = 'Monitor';
                                        callColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
                                    }

                                    return (
                                        <tr key={item.id} className="hover:bg-white/5 transition-colors text-sm group">
                                            <td className="px-6 py-4 font-bold text-white">{item.ticker}</td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-300">
                                                {currentPrice > 0 ? `${currencySymbol}${currentPrice.toLocaleString()}` : <span className="text-gray-600">N/A</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <input 
                                                    type="number" 
                                                    value={item.desiredEntryPrice || ''}
                                                    onChange={(e) => updateWatchlistItem(item.id, 'desiredEntryPrice', parseFloat(e.target.value))}
                                                    placeholder="0"
                                                    className="w-24 bg-transparent border-b border-white/10 focus:border-accent-pink text-right outline-none text-white font-mono"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <input 
                                                    type="number" 
                                                    value={item.intrinsicValue || ''}
                                                    onChange={(e) => updateWatchlistItem(item.id, 'intrinsicValue', parseFloat(e.target.value))}
                                                    placeholder="0"
                                                    className="w-24 bg-transparent border-b border-white/10 focus:border-accent-pink text-right outline-none text-white font-mono"
                                                />
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold ${mos > 0 ? 'text-success' : 'text-danger'}`}>
                                                {item.intrinsicValue > 0 ? `${mos.toFixed(2)}%` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-300">
                                                {callRatio.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${callColor}`}>
                                                    {callStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <input 
                                                        type="text"
                                                        value={item.researchLink || ''}
                                                        onChange={(e) => updateWatchlistItem(item.id, 'researchLink', e.target.value)}
                                                        placeholder="Paste Docs Link"
                                                        className="w-24 bg-transparent border-b border-white/10 focus:border-accent-pink text-xs outline-none text-gray-400"
                                                    />
                                                    {item.researchLink && (
                                                        <a href={item.researchLink} target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:text-white">
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => removeFromWatchlist(item.id)}
                                                    className="p-1.5 text-gray-500 hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        )}

        {/* --- AI INSIGHTS VIEW --- */}
        {currentView === ViewState.AI_INSIGHTS && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                 <div className="glass-card rounded-2xl p-8 border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent text-center">
                    <BrainCircuit className="w-12 h-12 text-primary-glow mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">AI Portfolio Analyst</h3>
                    <p className="text-gray-400 mb-6">Ask Gemini anything about your trades, performance, or strategy.</p>
                    
                    <div className="relative">
                        <textarea 
                            value={chatQuery}
                            onChange={(e) => setChatQuery(e.target.value)}
                            placeholder="e.g., Analyze my trade history for patterns..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary/50 transition-colors h-32 resize-none"
                        />
                        <button 
                            onClick={handleAnalysis}
                            disabled={isAnalyzing || !chatQuery.trim()}
                            className="absolute bottom-4 right-4 bg-primary hover:bg-primary-glow text-white px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                            Analyze
                        </button>
                    </div>
                 </div>

                 {chatResponse && (
                     <div className="glass-card rounded-2xl p-6 border border-white/10 animate-fade-in">
                         <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                             <img src="https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg" alt="Gemini" className="w-6 h-6" />
                             Analysis Result
                         </h4>
                         <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-line">
                             {chatResponse}
                         </div>
                     </div>
                 )}
            </div>
        )}

        {/* --- UPLOAD VIEW --- */}
        {currentView === ViewState.UPLOAD && (
             <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                 {getUploadOptions(context).map((type) => (
                     <div key={type.id} className="glass-card rounded-2xl p-6 border border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden">
                         <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-white/5 rounded-xl text-primary-glow group-hover:scale-110 transition-transform">
                                    {type.icon}
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white">{type.label}</h4>
                                    <p className="text-xs text-gray-500">{type.desc}</p>
                                </div>
                            </div>
                            
                            {type.id === 'MARKET_DATA' && (
                                <div className="space-y-3 mb-4 bg-black/20 p-3 rounded-xl border border-white/5">
                                    <div>
                                        <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">Data Date</label>
                                        <input 
                                            type="date" 
                                            value={marketDate}
                                            onChange={(e) => {
                                                setMarketDate(e.target.value);
                                                updateMeta({ marketDate: e.target.value });
                                            }}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">Google Sheet ID</label>
                                         <div className="flex gap-2">
                                             <input 
                                                type="text" 
                                                value={sheetId}
                                                onChange={(e) => setSheetId(e.target.value)}
                                                placeholder="Sheet ID"
                                                className="flex-1 bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs font-mono focus:outline-none focus:border-primary/50 transition-colors"
                                            />
                                            <button 
                                                onClick={() => {
                                                    setMarketDate('');
                                                    setSheetId('');
                                                }}
                                                className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                title="Reset Fields"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                            <button 
                                                onClick={handleGoogleSheetFetch}
                                                disabled={isFetchingSheet}
                                                className="px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg text-primary-glow text-xs font-bold transition-colors flex items-center gap-1"
                                            >
                                                {isFetchingSheet ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                Sync
                                            </button>
                                         </div>
                                    </div>
                                </div>
                            )}

                            <label className="flex items-center justify-center w-full py-3 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-primary/50 hover:text-primary-glow transition-all text-gray-400 text-sm font-medium bg-white/5 hover:bg-white/10">
                                <UploadCloud className="w-4 h-4 mr-2" />
                                <span>Select CSV</span>
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    className="hidden" 
                                    onChange={(e) => handleFileUpload(e, type.id as UploadType)}
                                />
                            </label>
                            
                            {/* Last Uploaded Info */}
                            {type.id === 'TRADE_HISTORY' && uploadMeta.trades && (
                                <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.trades)}</p>
                            )}
                            {type.id === 'PNL' && uploadMeta.pnl && (
                                <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.pnl)}</p>
                            )}
                            {type.id === 'LEDGER' && uploadMeta.ledger && (
                                <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.ledger)}</p>
                            )}
                            {type.id === 'DIVIDEND' && uploadMeta.dividend && (
                                <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.dividend)}</p>
                            )}
                            {type.id === 'PORTFOLIO_SNAPSHOT' && uploadMeta.portfolio && (
                                <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.portfolio)}</p>
                            )}
                            {type.id === 'MARKET_DATA' && uploadMeta.market && (
                                <p className="text-[10px] text-accent-cyan mt-2 flex items-center justify-center bg-accent-cyan/10 py-1 rounded-full"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.market)}</p>
                            )}
                         </div>
                     </div>
                 ))}
             </div>
        )}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [context, setContext] = useState<AssetContext>('INDIAN_EQUITY');

  return (
    <div className="flex h-screen bg-[#0f111a] text-white font-sans selection:bg-primary/30">
        <Sidebar currentView={view} setView={setView} currentContext={context} setContext={setContext} />
        <main className="flex-1 ml-64 relative">
             {/* Background Gradients */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-accent-cyan/5 rounded-full blur-[100px]"></div>
            </div>

            <div className="relative z-10 h-full">
                <PortfolioDashboard key={context} context={context} currentView={view} setView={setView} />
            </div>
        </main>
    </div>
  );
};

export default App;