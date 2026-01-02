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
const PortfolioDashboard = ({ context, currentView, setView }: { context: AssetContext, currentView: ViewState, setView: (view: ViewState) => void }) => {
  const [uploadType, setUploadType] = useState<UploadType>('TRADE_HISTORY');
  const STORAGE_KEYS = useMemo(() => getStorageKeys(context), [context]);

  const currencySymbol = useMemo(() => {
      if (context === 'INTERNATIONAL_EQUITY') return '€';
      if (context === 'USD_ASSETS') return '$';
      return '₹';
  }, [context]);

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
    // Only override if extracted is significantly larger (indicating full report value), 
    // but prefer calculated sum if we have valid rows to avoid stale data issues.
    if (extractedDividends > totalDividends && dividendData.length === 0) {
        totalDividends = extractedDividends;
    }

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
        // Find header row (expecting Date and Description at minimum)
        const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Description']);
        if (headerIdx !== -1) {
          const headers = rawRows[headerIdx];
          setLastUploadHeaders(headers);
          // Process rows after the header
          const rows = rawRows.slice(headerIdx + 1);

          const newDividends: DividendRecord[] = [];

          rows.forEach((row) => {
            // Strict mapping for "Dividende" rows in Account.csv
            // Column F (Index 5): Description
            // Column H (Index 7): Currency
            // Column I (Index 8): Amount (Unconverted)
            
            // Ensure row has enough columns
            if (row.length < 9) return;

            // 1. Strict Case-Sensitive Filtering
            const desc = clean(row[5] || '');
            
            if (desc === 'Dividende') {
              const dateStr = parseIndianDate(clean(row[0] || '')); // Date at Index 0
              if (!dateStr) return;

              const scripName = clean(row[3] || 'Unknown'); // Product at Index 3

              // 2. Fetch Currency and Value
              const currency = clean(row[7] || 'EUR').toUpperCase(); // Column H
              const valStr = clean(row[8] || '0');                   // Column I

              // Handle European number format (comma as decimal: "2,21" -> 2.21)
              let amountVal = parseFloat(valStr.replace(',', '.'));

              if (!isNaN(amountVal) && amountVal !== 0) {
                // 3. Currency Conversion to EURO
                let rate = 1.0; // Default for EUR
                if (currency === 'USD') rate = 0.92;
                else if (currency === 'NO' || currency === 'NOK') rate = 0.088; // NOK as 'NO'
                else if (currency === 'SEK') rate = 0.087;
                else if (currency === 'GBP') rate = 1.17;

                // Calculate final EUR amount
                const convertedAmount = Math.abs(amountVal) * rate;

                newDividends.push({
                  date: dateStr,
                  scripName,
                  amount: convertedAmount,
                });
              }
            }
          });

          if (newDividends.length > 0) {
            setDividendData(newDividends);
            persistData(STORAGE_KEYS.DIVIDENDS, newDividends);
            
            // Force reset summary to ensure row calculation is used
            setExtractedDividends(0);
            saveSummary({ dividends: 0 });

            updateMeta({ dividend: new Date().toISOString(), ledger: new Date().toISOString() });
            alert(`Success: Imported ${newDividends.length} Dividend records.`);
          } else {
            alert('No dividend entries found in Account CSV.');
          }
        } else {
          alert('Could not find Degiro Account headers (Date, Description).');
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