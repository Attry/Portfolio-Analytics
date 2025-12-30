import React, { useState, useEffect, useMemo } from 'react';
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
  FileText
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
// e.g., "Quantité" -> "quantite", "Montant négocié EUR" -> "montant negocie eur"
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
    // Case 1: Euro format "1.234,56" or "1234,56" (Comma is decimal)
    // Heuristic: If comma exists and is the last separator, or matches Euro pattern
    if (cleaned.indexOf(',') > -1 && (cleaned.indexOf('.') === -1 || cleaned.indexOf(',') > cleaned.indexOf('.'))) {
         cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } 
    // Case 2: Standard "1,234.56" (Comma is thousands)
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
    // 1. Sort chronologically
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const holdings: Record<string, PerStockData> = {};
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
            
            // Update latest buy date
            if (!position.latestBuyDate || new Date(trade.date) > new Date(position.latestBuyDate)) {
                position.latestBuyDate = trade.date;
            }

        } else if (trade.type === TradeType.SELL) {
            let qtyToSell = trade.quantity;
            
            while (qtyToSell > 0 && position.buyQueue.length > 0) {
                const match = position.buyQueue[0]; // Oldest buy (FIFO)
                const qty = Math.min(qtyToSell, match.qty);
                
                // Realized PnL for this chunk
                // Formula: (Sell Price - Buy Price) * Qty
                const pnl = qty * (trade.price - match.price);
                grossRealizedPnL += pnl;
                position.realizedPnL += pnl;
                
                match.qty -= qty;
                qtyToSell -= qty;
                position.qty -= qty;
                
                if (match.qty <= 0.0001) { // Float tolerance
                    position.buyQueue.shift(); // Remove exhausted buy batch
                }
            }
        }
    });

    // Calculate Invested Value (Cost Basis of remaining Open Positions)
    Object.values(holdings).forEach(h => {
        h.invested = h.buyQueue.reduce((acc, batch) => acc + (batch.qty * batch.price), 0);
        totalInvested += h.invested;
    });

    return { grossRealizedPnL, totalInvested, holdings };
};


// --- XIRR Helper Function ---
const calculateXIRR = (transactions: { amount: number; date: Date }[], terminalValue: number, guess = 0.1): number => {
  if (transactions.length < 1) return 0;

  // Filter out invalid dates
  const validTrans = transactions.filter(t => !isNaN(t.date.getTime()));
  
  // Add Terminal Value as a cash inflow (positive) at today's date
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
    if (Math.abs(rate) > 1000) return 0; // Sanity check
  }
  
  return rate; 
};

// --- Footer Scanner ---
const findValueInFooter = (rows: string[][], keywords: string[]): number | null => {
    // Scan last 50 rows (Increased from 25)
    const startIdx = Math.max(0, rows.length - 50);
    for (let i = rows.length - 1; i >= startIdx; i--) {
        const row = rows[i];
        for (let j = 0; j < row.length; j++) {
            const cellText = clean(row[j]).toLowerCase();
            // Check if cell matches any keyword
            if (keywords.some(k => cellText === k.toLowerCase())) {
                // Try next cell
                let val = parseNum(row[j+1]);
                // If next cell is empty or text, try next next (sometimes there is a spacer)
                if ((val === 0 || isNaN(val)) && row[j+1] === '') val = parseNum(row[j+2]);
                // If still 0, try next next next
                if ((val === 0 || isNaN(val)) && row[j+2] === '') val = parseNum(row[j+3]);
                
                if (val > 0) return val;
            }
        }
    }
    return null;
};

// --- Header Detection (Row 0 to 50) ---
const findHeaderRowIndex = (rows: string[][], requiredKeywords: string[]): number => {
    // Increased scan range to 50 rows to handle large headers/disclaimers
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
        // Normalize the entire row string for matching
        const rowString = rows[i].map(normalizeHeader).join(' ');
        
        // Check if all required keywords exist in the normalized row
        const allFound = requiredKeywords.every(k => rowString.includes(normalizeHeader(k)));
        if (allFound) return i;
    }
    return -1;
};

const getColIndex = (headers: string[], possibleNames: string[]): number => {
    if (!headers) return -1;
    // Normalize headers for comparison
    const normalizedHeaders = headers.map(normalizeHeader);
    
    for (const name of possibleNames) {
        const normName = normalizeHeader(name);
        // Strict match first, then partial
        let index = normalizedHeaders.indexOf(normName);
        if (index !== -1) return index;
        
        index = normalizedHeaders.findIndex(h => h.includes(normName));
        if (index !== -1) return index;
    }
    return -1;
};

// --- Inner Component: Handles the Logic for a Specific Portfolio Context ---
function PortfolioDashboard({ context, currentView }: { context: AssetContext, currentView: ViewState }) {
  const [uploadType, setUploadType] = useState<UploadType>('TRADE_HISTORY');
  
  const STORAGE_KEYS = useMemo(() => getStorageKeys(context), [context]);

  // Data States (Lazy Load from LocalStorage)
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

  // Watchlist Search State
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);

  // Metadata State (Upload timestamps)
  const [uploadMeta, setUploadMeta] = useState<UploadMeta>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.META);
      return saved ? JSON.parse(saved) : {};
  });

  // Derived State helpers
  // Initialize Sheet ID from LocalStorage with fallback to the specific ID based on context
  const [sheetId, setSheetId] = useState<string>(() => {
      const saved = localStorage.getItem(STORAGE_KEYS.SHEET_ID);
      if (saved) {
          try {
            return JSON.parse(saved);
          } catch (e) {
            return saved;
          }
      }
      // Context specific defaults
      if (context === 'INTERNATIONAL_EQUITY') return "1zQFW9FHFoyvw4uZR4z3klFeoCIGJPUlq7QuDYwz4lEY";
      return "1htAAZP9eWVH0sq1BHbiS-dKJNzcP-uoBEW6GXp4N3HI";
  });

  const [marketDate, setMarketDate] = useState<string>(uploadMeta.marketDate || '');
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(uploadMeta.marketDate || null);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

  // Extracted Summary Data (Lazy Load from LocalStorage)
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

  // Debug State
  const [lastUploadPreview, setLastUploadPreview] = useState<any[]>([]);
  const [lastUploadHeaders, setLastUploadHeaders] = useState<string[]>([]);

  const [chatQuery, setChatQuery] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Helper to save data ---
  const persistData = (key: string, data: any) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
          console.error("Storage limit exceeded or error", e);
          alert("Warning: Could not save data to local storage. It may be lost on refresh.");
      }
  };

  // Persist Sheet ID whenever it changes
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
          // Only clear keys relevant to this context
          Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
          
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
          
          // Reset Sheet ID to default based on context
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

  // --- Watchlist Logic ---
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

  // --- Metrics Calculation ---
  const metrics = useMemo(() => {
    // 1. Calculate Gross P&L and Invested Value from Trade History (FIFO)
    const { grossRealizedPnL, totalInvested, holdings } = calculateFIFO(trades);

    // 2. Charges
    let charges = extractedCharges;

    // 3. Dividends
    let totalDividends = dividendData.reduce((acc, curr) => acc + curr.amount, 0);
    // If we have an extracted total from footer that is greater than sum of rows (or rows empty), use that
    if (extractedDividends > totalDividends) totalDividends = extractedDividends;

    // 4. Cash
    let cashBalance = extractedCash;
    if (ledgerData.length > 0 && cashBalance === 0) {
        // Try to find latest balance
        const sorted = [...ledgerData].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if(sorted.length > 0) cashBalance = sorted[0].balance;
    }
    
    // 5. Portfolio Holdings Valuation
    let totalUnrealizedPnL = 0;
    
    const portfolioHoldings = Object.entries(holdings)
      .filter(([_, data]) => data.qty > 0)
      .map(([ticker, data]) => {
          const pnlRecord = pnlData.find(p => p.scripName.toLowerCase() === ticker.toLowerCase());
          const livePrice = priceData[ticker.toUpperCase()]; 

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

    // 6. Net P&L Calculation
    const netRealizedPnL = grossRealizedPnL - Math.abs(charges);

    // 7. Portfolio Value
    const currentValue = totalInvested + totalUnrealizedPnL + cashBalance;

    // 8. Finalize Portfolio Percentages
    const finalHoldings = portfolioHoldings.map(h => ({
        ...h,
        portfolioPct: currentValue > 0 ? (h.marketValue / currentValue) * 100 : 0
    })).sort((a, b) => b.portfolioPct - a.portfolioPct);


    // 9. XIRR
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
      hasLiveData: Object.keys(priceData).length > 0
    };
  }, [pnlData, ledgerData, dividendData, trades, extractedCharges, extractedNetPnL, extractedDividends, extractedCash, priceData]);

  // Asset Distribution
  const tickerDistribution = useMemo(() => {
    if (metrics.holdings.length > 0) {
        return metrics.holdings
            .map(h => ({ name: h.ticker, value: h.marketValue || 0 }))
            .sort((a, b) => b.value - a.value);
    }
    return [];
  }, [metrics.holdings]);

  // --- Robust Date Parser ---
  const parseIndianDate = (dateStr: string): string => {
      if (!dateStr) return '';
      dateStr = dateStr.trim();
      
      // Try ISO YYYY-MM-DD
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
      
      // Handle DD-MM-YYYY
      if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
          const [d, m, y] = dateStr.split('-');
          return `${y}-${m}-${d}`;
      }

      // Handle Month Names (Jan, Feb, etc.)
      const months: {[key: string]: string} = {
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
          'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };

      // Split by common separators
      const parts = dateStr.split(/[-/ ]/);
      
      if (parts.length === 3) {
          let p0 = parts[0];
          let p1 = parts[1];
          let p2 = parts[2];
          
          let day, month, year;

          // Detect Year (4 digits)
          if (p0.length === 4) { year = p0; month = p1; day = p2; }
          else if (p2.length === 4) { day = p0; month = p1; year = p2; }
          else {
              // Ambiguous 2-digit year cases: Assume DD-MM-YY usually
              day = p0; month = p1; year = '20' + p2;
          }

          // Resolve Month
          if (isNaN(Number(month))) {
              const mStr = month.toLowerCase().substring(0, 3);
              if (months[mStr]) month = months[mStr];
              else return ''; // Invalid month
          }

          // Clean up Year
          if (year.length === 2) year = '20' + year;

          // Pad
          const m = month.toString().padStart(2, '0');
          const d = day.toString().padStart(2, '0');
          
          // Basic check
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
            const ticker = clean(row[idxTicker]).toUpperCase();
            const priceRaw = row[idxPrice];
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
    } catch (error) {
        console.error("Error processing market CSV:", error);
        alert("Error parsing market data. check console.");
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

  // --- Auto-Sync on Mount ---
  // Only auto-sync if we have a Sheet ID explicitly set.
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
          // --- AUTO DETECT DELIMITER (Comma vs Semicolon) ---
          const firstLine = content.substring(0, 1000).split('\n')[0];
          // Simple heuristic: count commas vs semicolons in the first line
          const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
            
          const lines = content.split('\n').filter(line => line.trim() !== '');
          
          // Regex to split by delimiter but ignore delimiter inside quotes
          const splitRegex = delimiter === ';' 
            ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/ 
            : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

          const rawRows = lines.map(line => line.split(splitRegex));
          setLastUploadPreview(rawRows.slice(0, 5));
          
          // --- INTERNATIONAL EQUITY (DEGIRO) LOGIC ---
          if (context === 'INTERNATIONAL_EQUITY') {
              if (type === 'TRADE_HISTORY') {
                  // Degiro: Date, Produit, Quantité, Montant négocié EUR
                  // Matching just "Date" and "Produit" to be safe against slight variations
                  const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Produit']);
                  if (headerIdx === -1) {
                      // Fallback for English: Date, Product
                       const headerIdxEn = findHeaderRowIndex(rawRows, ['Date', 'Product']);
                       if (headerIdxEn === -1) {
                           alert("Could not find Degiro transactions header. Expecting 'Date' and 'Produit' (or 'Product').");
                           return;
                       }
                  }
                  
                  const finalIdx = headerIdx !== -1 ? headerIdx : findHeaderRowIndex(rawRows, ['Date', 'Product']);
                  const headers = rawRows[finalIdx];
                  setLastUploadHeaders(headers);
                  const rows = rawRows.slice(finalIdx + 1);

                  const idxDate = getColIndex(headers, ['Date', 'Date']);
                  const idxTicker = getColIndex(headers, ['Produit', 'Product']);
                  const idxQty = getColIndex(headers, ['Quantité', 'Quantity', 'Quantite']); 
                  // "Montant EUR" is the trade value in EUR (Qty * Price)
                  const idxValEUR = getColIndex(headers, ['Montant EUR', 'Amount EUR']);
                  // "Montant négocié EUR" is the CASH impact (Price * Qty + Fees)
                  // Search for "Montant negocie" to be safe against accent issues
                  const idxNetEUR = getColIndex(headers, ['Montant négocié', 'Montant negocie', 'Net Amount', 'Total']); 

                  const newTrades: Trade[] = [];
                  rows.forEach(row => {
                      const dateStr = parseIndianDate(clean(row[idxDate]));
                      if (!dateStr) return;

                      const ticker = clean(row[idxTicker]);
                      // Degiro uses signed Quantity for Buy/Sell
                      const qtyRaw = parseNum(row[idxQty]);
                      const qty = Math.abs(qtyRaw);
                      
                      const valEUR = parseNum(row[idxValEUR]);
                      const netEUR = idxNetEUR !== -1 ? parseNum(row[idxNetEUR]) : valEUR;

                      // Implied EUR Price Logic
                      const effectiveValue = (valEUR !== 0) ? valEUR : netEUR;
                      const price = qty > 0 ? Math.abs(effectiveValue / qty) : 0;
                      
                      const tradeType = qtyRaw > 0 ? TradeType.BUY : TradeType.SELL;
                      // Ensure logic consistency: Buy should be negative netAmount
                      const netAmount = tradeType === TradeType.BUY ? -Math.abs(netEUR) : Math.abs(netEUR);

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
                    alert(`Success: Imported ${newTrades.length} Degiro transactions.`);
                  } else {
                    alert("No valid trades parsed. Check CSV format (Delimiter detected: " + delimiter + ").");
                  }
              }
              else if (type === 'LEDGER') {
                   // Degiro Account Statement
                   const headerIdx = findHeaderRowIndex(rawRows, ['Date', 'Description']);
                   if (headerIdx !== -1) {
                       const headers = rawRows[headerIdx];
                       setLastUploadHeaders(headers);
                       const rows = rawRows.slice(headerIdx + 1);
                       
                       const idxDate = getColIndex(headers, ['Date', 'Value Date']);
                       const idxDesc = getColIndex(headers, ['Description']);
                       // Look for various names for the Amount column
                       const idxChange = getColIndex(headers, ['Montant', 'Variation', 'Change', 'Amount', 'Mutation']);
                       
                       const newDividends: DividendRecord[] = [];
                       
                       rows.forEach(row => {
                           const desc = clean(row[idxDesc]);
                           if (desc.toLowerCase().includes('dividend') || desc.toLowerCase().includes('dividende')) {
                               const dateStr = parseIndianDate(clean(row[idxDate]));
                               if (!dateStr) return;
                               
                               const amount = parseNum(row[idxChange]);
                               if (amount > 0) {
                                   newDividends.push({
                                       date: dateStr,
                                       scripName: desc, 
                                       amount: amount
                                   });
                               }
                           }
                       });

                       if (newDividends.length > 0) {
                           setDividendData(newDividends);
                           persistData(STORAGE_KEYS.DIVIDENDS, newDividends);
                           updateMeta({ dividend: new Date().toISOString() });
                           alert(`Success: Imported ${newDividends.length} Dividend records.`);
                       } else {
                           alert("No dividend entries found in Account CSV (Delimiter detected: " + delimiter + ").");
                       }
                   } else {
                       alert("Could not find Degiro Account headers (Date, Description).");
                   }
              }
              else if (type === 'PORTFOLIO_SNAPSHOT') {
                  // Degiro Portfolio: Produit, Clôture
                  const headerIdx = findHeaderRowIndex(rawRows, ['Produit', 'Quantité']); 
                  if (headerIdx === -1) {
                       // Fallback
                       const headerIdxEn = findHeaderRowIndex(rawRows, ['Product', 'Quantity']);
                       if (headerIdxEn === -1) {
                           alert("Could not find Degiro Portfolio headers (Produit, Quantité).");
                           return;
                       }
                  }

                  const finalIdx = headerIdx !== -1 ? headerIdx : findHeaderRowIndex(rawRows, ['Product', 'Quantity']);
                  const headers = rawRows[finalIdx];
                  setLastUploadHeaders(headers);
                  const rows = rawRows.slice(finalIdx + 1);
                  
                  const idxProduct = getColIndex(headers, ['Produit', 'Product']);
                  const idxPrice = getColIndex(headers, ['Clôture', 'Close', 'Price', 'Cours', 'Valeur', 'Value']);
                  
                  const newPrices: Record<string, number> = {};
                  let count = 0;
                  
                  rows.forEach(row => {
                      const ticker = clean(row[idxProduct]).toUpperCase();
                      const price = Math.abs(parseNum(row[idxPrice]));
                      
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
                      alert(`Success: Updated prices for ${count} stocks.`);
                  } else {
                      alert("No valid pricing data found in Portfolio CSV (Delimiter detected: " + delimiter + ").");
                  }
              }
              else if (type === 'MARKET_DATA') {
                  processMarketDataCSV(content);
              }
              return; 
          }

          // --- EXISTING LOGIC FOR INDIAN EQUITY / GENERIC ---
          if (type === 'TRADE_HISTORY') {
             // Robust header finding
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
                 const dateStr = parseIndianDate(clean(row[idxDate]));
                 if (!dateStr) return;

                 const ticker = clean(row[idxTicker]);
                 const typeStr = idxType !== -1 ? clean(row[idxType]).toUpperCase() : 'BUY'; 
                 // Ensure Qty and Price are numbers
                 const qty = Math.abs(parseNum(row[idxQty]));
                 const price = Math.abs(parseNum(row[idxPrice]));
                 
                 const tradeType = (typeStr.includes('B') || typeStr.includes('P')) ? TradeType.BUY : TradeType.SELL;
                 const netAmount = tradeType === TradeType.BUY ? -(qty * price) : (qty * price);

                 // Only add if we have valid data
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
                     scripName: clean(row[idxScrip]),
                     buyQty: idxBuyQty !== -1 ? parseNum(row[idxBuyQty]) : 0,
                     avgBuyPrice: idxBuyPrice !== -1 ? parseNum(row[idxBuyPrice]) : 0,
                     buyValue: (idxBuyQty !== -1 && idxBuyPrice !== -1) ? parseNum(row[idxBuyQty]) * parseNum(row[idxBuyPrice]) : 0, 
                     sellQty: idxSellQty !== -1 ? parseNum(row[idxSellQty]) : 0,
                     avgSellPrice: idxSellPrice !== -1 ? parseNum(row[idxSellPrice]) : 0,
                     sellValue: (idxSellQty !== -1 && idxSellPrice !== -1) ? parseNum(row[idxSellQty]) * parseNum(row[idxSellPrice]) : 0,
                     realizedPnL: idxRealized !== -1 ? parseNum(row[idxRealized]) : 0,
                     unrealizedPnL: idxUnrealized !== -1 ? parseNum(row[idxUnrealized]) : 0,
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
                     date: parseIndianDate(clean(row[idxDate])),
                     description: idxDesc !== -1 ? clean(row[idxDesc]) : '',
                     credit: idxCredit !== -1 ? parseNum(row[idxCredit]) : 0,
                     debit: idxDebit !== -1 ? parseNum(row[idxDebit]) : 0,
                     balance: idxBalance !== -1 ? parseNum(row[idxBalance]) : 0,
                     type: 'OTHER' as const
                 })).filter(r => r.date);
                 
                 setLedgerData(newLedger);
                 persistData(STORAGE_KEYS.LEDGER, newLedger);
                 updateMeta({ ledger: new Date().toISOString() });
             }
             alert(`Success: Ledger imported.`);
          }
          else if (type === 'DIVIDEND') {
             // Search for Total Value first (User specified this location)
             const totalDiv = findValueInFooter(rawRows, ['Total Dividend Earned', 'Total Dividend', 'Total']);
             if (totalDiv !== null) {
                 setExtractedDividends(totalDiv);
                 saveSummary({ dividends: totalDiv });
             }

             // Relaxed Header Search Strategy
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
             
             // Super fallback: Look for just "Date" and assume standard columns might exist nearby
             if (headerIdx === -1) headerIdx = findHeaderRowIndex(rawRows, ['Date']);

             if (headerIdx !== -1) {
                 const headers = rawRows[headerIdx];
                 const rows = rawRows.slice(headerIdx + 1);
                 setLastUploadHeaders(headers);

                 const idxDate = getColIndex(headers, ['Date', 'Payout Date']);
                 const idxScrip = getColIndex(headers, ['Symbol', 'Scrip', 'Security Name']);
                 const idxAmt = getColIndex(headers, ['Amount', 'Net', 'Net Amount', 'Dividend Amount', 'Credit']);
                 
                 // Try to parse rows
                 let newDivs: DividendRecord[] = [];
                 if (idxDate !== -1 && idxAmt !== -1) {
                     newDivs = rows.map(row => {
                        const dateStr = parseIndianDate(clean(row[idxDate]));
                        if (!dateStr) return null;
                        
                        const scripName = idxScrip !== -1 ? clean(row[idxScrip]) : 'Unknown';
                        const amount = Math.abs(parseNum(row[idxAmt]));
                        
                        // Only import positive amounts
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
                     // Fallback: If rows failed but footer found
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
                 // No headers found, check total footer
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
          
          // Navigation logic removed from here
        } catch (error) {
          console.error("Error parsing CSV:", error);
          alert("Error parsing CSV. Please check the console.");
        }
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAiAnalysis = async () => {
    if (!chatQuery.trim()) return;
    setIsAnalyzing(true);
    setChatResponse(null);
    try {
        const response = await analyzePortfolio(trades, chatQuery);
        setChatResponse(response);
    } catch (e) {
        console.error("Analysis failed", e);
        setChatResponse("Unable to generate analysis.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  // --- Render Functions ---

  const renderWatchlist = () => {
      // Get all available tickers from priceData for search
      const availableTickers = Object.keys(priceData).sort();
      const filteredSearch = availableTickers.filter(t => t.toLowerCase().includes(watchlistSearch.toLowerCase()));

      return (
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
                                        {filteredSearch.length > 0 ? (
                                            filteredSearch.map(ticker => (
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
                                
                                // Margin of Safety: How much current price is down from Intrinsic
                                // If Price < Intrinsic, positive MoS. If Price > Intrinsic, negative MoS.
                                // Formula: (1 - (Price / Intrinsic)) * 100
                                const mos = item.intrinsicValue > 0 
                                    ? (1 - (currentPrice / item.intrinsicValue)) * 100 
                                    : 0;

                                // Call Ratio: Desired / Current
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
                                            {currentPrice > 0 ? `₹${currentPrice.toLocaleString()}` : <span className="text-gray-600">N/A</span>}
                                        </td>
                                        
                                        {/* Editable Desired Entry */}
                                        <td className="px-6 py-4 text-right">
                                            <input 
                                                type="number" 
                                                value={item.desiredEntryPrice || ''}
                                                onChange={(e) => updateWatchlistItem(item.id, 'desiredEntryPrice', parseFloat(e.target.value))}
                                                placeholder="0"
                                                className="w-24 bg-transparent border-b border-white/10 focus:border-accent-pink text-right outline-none text-white font-mono"
                                            />
                                        </td>

                                        {/* Editable Intrinsic Value */}
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

                                        {/* Editable Link */}
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
      );
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard 
                title="Current Value" 
                value={`₹${metrics.currentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} 
                icon={<Wallet />}
                change={metrics.hasLiveData ? `Live Prices` : "Invested + Unrealized + Cash"}
                isPositive={true}
            />
            <StatsCard 
                title="Gross Realized P&L" 
                value={`₹${metrics.grossRealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} 
                icon={<TrendingUp />}
                change="Before Charges"
                isPositive={metrics.grossRealizedPnL >= 0}
            />
            <StatsCard 
                title="Total Charges" 
                value={`₹${metrics.charges.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} 
                icon={<Coins />}
                change="From P&L Footer"
                isPositive={false}
            />
            <StatsCard 
                title="Net Realized P&L" 
                value={`₹${metrics.netRealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} 
                icon={<Receipt />}
                change={metrics.reportedNetPnL ? `Reported: ₹${metrics.reportedNetPnL.toLocaleString()}` : "Calculated"}
                isPositive={metrics.netRealizedPnL >= 0}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
             <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
                <div>
                   <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Invested Value</p>
                   <p className="text-xl font-bold mt-1 text-white">
                     ₹{metrics.totalInvested.toLocaleString()}
                   </p>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg"><Briefcase className="text-primary-glow w-5 h-5" /></div>
             </div>
             <div className="glass-card rounded-2xl p-4 flex items-center justify-between relative overflow-hidden group">
                {metrics.hasLiveData && (
                    <div className="absolute inset-0 bg-accent-green/5 animate-pulse pointer-events-none"></div>
                )}
                <div className="relative z-10">
                   <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                        Unrealized Gains
                        {metrics.hasLiveData && <Zap className="w-3 h-3 text-accent-green fill-accent-green" />}
                   </p>
                   <p className={`text-xl font-bold mt-1 ${metrics.unrealizedPnL >= 0 ? 'text-accent-green' : 'text-danger'}`}>
                     ₹{metrics.unrealizedPnL.toLocaleString()}
                   </p>
                </div>
                <div className="p-2 bg-accent-green/10 rounded-lg relative z-10"><TrendingUp className="text-accent-green w-5 h-5" /></div>
             </div>
             <div className="glass-card rounded-2xl p-4 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-xl pointer-events-none"></div>
                <div className="relative z-10">
                   <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">XIRR</p>
                   <p className={`text-xl font-bold mt-1 ${metrics.xirr >= 0 ? 'text-accent-cyan' : 'text-danger'}`}>
                     {metrics.xirr.toFixed(2)}%
                   </p>
                </div>
                <div className="p-2 bg-accent-cyan/10 rounded-lg relative z-10"><Activity className="text-accent-cyan w-5 h-5" /></div>
             </div>
             <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
                <div>
                   <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Total Dividends</p>
                   <p className="text-xl font-bold text-white mt-1 text-success">₹{metrics.totalDividends.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-success/10 rounded-lg"><DollarSign className="text-success w-5 h-5" /></div>
             </div>
             <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
                <div>
                   <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Cash Balance</p>
                   <p className="text-xl font-bold text-white mt-1">₹{metrics.cashBalance.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg"><Landmark className="text-gray-400 w-5 h-5" /></div>
             </div>
        </div>

        {/* Verification Alert */}
        {metrics.reportedNetPnL !== null && Math.abs(metrics.netRealizedPnL - metrics.reportedNetPnL) > 100 && (
             <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3 backdrop-blur-sm">
                 <Scale className="text-orange-500 w-5 h-5 mt-0.5" />
                 <div>
                     <h4 className="text-sm font-bold text-orange-200">Discrepancy Detected</h4>
                     <p className="text-xs text-orange-200/70 mt-1">
                         Calculated Net P&L (₹{metrics.netRealizedPnL.toLocaleString()}) differs from P&L Statement Report (₹{metrics.reportedNetPnL.toLocaleString()}). 
                     </p>
                 </div>
             </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-6 text-white tracking-wide flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent-cyan" /> Current Holdings
                </h3>
                <div className="h-64 w-full">
                    {tickerDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={tickerDistribution.slice(0, 8)}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#7042f8" stopOpacity={0.8}/>
                                        <stop offset="100%" stopColor="#7042f8" stopOpacity={0.3}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="name" stroke="#7B7F9E" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#7B7F9E" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#151925', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                                    itemStyle={{ color: '#E2E8F0' }}
                                    cursor={{fill: 'rgba(255,255,255,0.03)'}}
                                />
                                <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            Upload P&L Statement to visualize data
                        </div>
                    )}
                </div>
            </div>
            
            <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-6 text-white tracking-wide">Top Assets</h3>
                <div className="h-64 w-full relative">
                     {/* Center text overlay for donut effect */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <span className="text-xs text-gray-500 uppercase font-bold">Total</span>
                        </div>
                    </div>
                    {tickerDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={tickerDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {tickerDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                     contentStyle={{ backgroundColor: '#151925', border: 'none', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                                     itemStyle={{ color: '#f3f4f6' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                         <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            No data
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );

  const renderHoldings = () => (
      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-white/5 flex gap-4 items-center justify-between">
             <div className="flex items-center gap-4">
                <Briefcase className="w-5 h-5 text-accent-cyan" />
                <h2 className="text-lg font-bold text-white">Current Holdings</h2>
             </div>
             {metrics.hasLiveData && (
                 <span className="text-[10px] font-bold text-black bg-accent-cyan px-2 py-1 rounded-full flex items-center gap-1 animate-pulse">
                     <Zap className="w-3 h-3 fill-current" /> Live Prices Active ({lastPriceUpdate})
                 </span>
             )}
        </div>
        <div className="overflow-x-auto">
             {metrics.holdings.length === 0 ? (
                 <p className="text-center text-gray-500 py-10 text-sm">No open positions found.</p>
             ) : (
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Stock Name</th>
                            <th className="px-6 py-4 text-right">Invested</th>
                            <th className="px-6 py-4 text-right">Unrealized (Abs)</th>
                            <th className="px-6 py-4 text-right">Realized (Abs)</th>
                            <th className="px-6 py-4 text-right">Net Return %</th>
                            <th className="px-6 py-4 text-right">% Portfolio</th>
                            <th className="px-6 py-4 text-right">Days Held</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {metrics.holdings.map((stock) => (
                            <tr key={stock.ticker} className="hover:bg-white/5 transition-colors text-sm group">
                                <td className="px-6 py-4 font-bold text-white group-hover:text-accent-cyan transition-colors flex items-center gap-2">
                                    {stock.ticker}
                                    {stock.isLive && <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></div>}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-gray-300">₹{stock.invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                
                                <td className={`px-6 py-4 text-right font-mono font-medium ${stock.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {stock.unrealized >= 0 ? '+' : '-'}₹{Math.abs(stock.unrealized).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>

                                <td className={`px-6 py-4 text-right font-mono font-medium ${stock.realized > 0 ? 'text-success' : stock.realized < 0 ? 'text-danger' : 'text-gray-500'}`}>
                                    {stock.realized === 0 ? '-' : `${stock.realized > 0 ? '+' : '-'}₹${Math.abs(stock.realized).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                </td>

                                <td className={`px-6 py-4 text-right font-mono font-bold ${stock.netReturnPct >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {stock.netReturnPct >= 0 ? '+' : ''}{stock.netReturnPct.toFixed(2)}%
                                </td>

                                <td className="px-6 py-4 text-right font-mono">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        stock.portfolioPct >= 5 
                                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' 
                                        : 'bg-primary/10 text-primary-glow border border-primary/20'
                                    }`}>
                                        {stock.portfolioPct.toFixed(2)}%
                                    </span>
                                </td>

                                <td className="px-6 py-4 text-right font-mono text-gray-500 flex items-center justify-end gap-1">
                                    <CalendarClock className="w-3 h-3" />
                                    {stock.daysHeld}d
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             )}
        </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
        <div className="p-6 border-b border-white/5 flex gap-4 items-center">
             <Receipt className="w-5 h-5 text-accent-pink" />
             <h2 className="text-lg font-bold text-white">Trade History</h2>
        </div>
        <div className="overflow-x-auto">
             {trades.length === 0 ? (
                 <p className="text-center text-gray-500 py-10 text-sm">No trades imported.</p>
             ) : (
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Ticker</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-right">Qty</th>
                            <th className="px-6 py-4 text-right">Price</th>
                            <th className="px-6 py-4 text-right">Net Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {trades.map((trade) => (
                            <tr key={trade.id} className="hover:bg-white/5 transition-colors text-sm text-gray-300">
                                <td className="px-6 py-4 font-mono text-gray-400">{trade.date}</td>
                                <td className="px-6 py-4 font-bold text-white">{trade.ticker}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        trade.type === TradeType.BUY 
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                        : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                    }`}>
                                        {trade.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-mono">{trade.quantity}</td>
                                <td className="px-6 py-4 text-right font-mono">₹{trade.price.toFixed(2)}</td>
                                <td className={`px-6 py-4 text-right font-mono font-medium ${trade.netAmount > 0 ? 'text-success' : 'text-gray-400'}`}>
                                    {trade.netAmount > 0 ? '+' : ''}₹{Math.abs(trade.netAmount).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             )}
        </div>
    </div>
  );

  const renderUpload = () => (
    <div className="max-w-5xl mx-auto mt-6 animate-fade-in pb-20">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h3 className="text-2xl font-bold text-white">Data Management</h3>
                <p className="text-gray-400 text-sm mt-1">Manage data for <span className="text-accent-cyan font-bold">{context.replace(/_/g, ' ')}</span></p>
            </div>
            <button 
                onClick={clearAllData}
                className="px-4 py-2 text-xs font-bold bg-danger/10 text-danger border border-danger/30 rounded-lg hover:bg-danger/20 transition-colors flex items-center gap-2"
            >
                <Trash2 size={14} /> Reset {context.split('_')[0]} Data
            </button>
        </div>

        {/* SECTION 1: LIVE MARKET UPDATES */}
        <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 rounded-lg bg-accent-cyan/20 text-accent-cyan">
                    <Activity size={20} />
                 </div>
                 <div>
                     <h4 className="text-lg font-bold text-white">Live Market Data</h4>
                     <p className="text-xs text-gray-400">Sync daily price updates via Google Sheets or CSV</p>
                 </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border-l-4 border-l-accent-cyan">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-accent-cyan" /> 
                                Select Data Date
                            </label>
                            <input 
                                type="date" 
                                value={marketDate}
                                onChange={(e) => setMarketDate(e.target.value)}
                                onClick={(e) => {
                                    try {
                                        if('showPicker' in e.currentTarget) {
                                            (e.currentTarget as any).showPicker();
                                        }
                                    } catch (err) {}
                                }}
                                className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-3 focus:ring-1 focus:ring-accent-cyan outline-none transition-colors cursor-pointer"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-gray-400 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                                <Link className="w-3 h-3 text-accent-cyan" /> 
                                Google Sheet ID
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={sheetId}
                                    onChange={(e) => setSheetId(e.target.value)}
                                    placeholder="Paste Sheet ID..."
                                    className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg p-3 focus:ring-1 focus:ring-accent-cyan outline-none font-mono"
                                />
                                <a 
                                    href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <ExternalLink size={18} />
                                </a>
                            </div>
                        </div>
                     </div>

                     <div className="flex flex-col justify-end space-y-3">
                         <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                             <span>Last Synced:</span>
                             <span className="text-accent-cyan font-mono">{formatLastSync(uploadMeta.market) || 'Never'}</span>
                         </div>
                         <button 
                            onClick={handleGoogleSheetFetch}
                            disabled={!marketDate || !sheetId || isFetchingSheet}
                            className="w-full py-3 bg-accent-cyan text-black font-bold rounded-xl hover:bg-accent-cyan/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.3)] disabled:opacity-50"
                        >
                            {isFetchingSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Sync from Google Sheet
                        </button>
                        
                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-gray-700"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-600 text-xs uppercase">OR Upload CSV</span>
                            <div className="flex-grow border-t border-gray-700"></div>
                        </div>

                        <label className={`block w-full text-center py-3 border border-dashed border-gray-600 rounded-xl cursor-pointer hover:bg-white/5 transition-colors ${!marketDate ? 'opacity-50 pointer-events-none' : ''}`}>
                             <input 
                                type="file" 
                                className="hidden" 
                                accept=".csv" 
                                onChange={(e) => handleFileUpload(e, 'MARKET_DATA')} 
                            />
                            <span className="text-sm font-bold text-gray-300 flex items-center justify-center gap-2">
                                <UploadCloud size={16} /> Upload Market CSV
                            </span>
                        </label>
                     </div>
                </div>
            </div>
        </div>

        {/* SECTION 2: PORTFOLIO HOLDINGS */}
        <div>
            <div className="flex items-center gap-3 mb-4">
                 <div className="p-2 rounded-lg bg-primary/20 text-primary-glow">
                    <Briefcase size={20} />
                 </div>
                 <div>
                     <h4 className="text-lg font-bold text-white">Portfolio Configuration</h4>
                     <p className="text-xs text-gray-400">Update these only when your holdings change</p>
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {context === 'INTERNATIONAL_EQUITY' ? (
                     <>
                        {[
                            { id: 'TRADE_HISTORY', label: 'Transactions', metaKey: 'trades', icon: <History /> },
                            { id: 'LEDGER', label: 'Account Statement', metaKey: 'dividend', icon: <Landmark /> },
                            { id: 'PORTFOLIO_SNAPSHOT', label: 'Portfolio', metaKey: 'portfolio', icon: <FileText /> },
                        ].map((item) => {
                            const lastSync = formatLastSync(uploadMeta[item.metaKey as keyof UploadMeta]);
                            return (
                                <div key={item.id} className="glass-card rounded-xl p-5 border hover:border-primary/50 transition-colors group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-white/5 rounded-lg text-gray-400 group-hover:text-primary-glow group-hover:bg-primary/10 transition-colors">
                                            {item.icon}
                                        </div>
                                        {lastSync && <CheckCircle2 size={16} className="text-success" />}
                                    </div>
                                    
                                    <h5 className="font-bold text-white mb-1">{item.label}</h5>
                                    <p className="text-[10px] text-gray-500 mb-4 h-4">
                                        {lastSync ? `Updated: ${lastSync}` : 'No data uploaded'}
                                    </p>

                                    <label className="block w-full cursor-pointer">
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept=".csv" 
                                            onChange={(e) => handleFileUpload(e, item.id as UploadType)} 
                                        />
                                        <div className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-center transition-colors">
                                            Upload CSV
                                        </div>
                                    </label>
                                </div>
                            )
                        })}
                     </>
                ) : (
                    <>
                        {[
                            { id: 'TRADE_HISTORY', label: 'Trade History', metaKey: 'trades', icon: <History /> },
                            { id: 'PNL', label: 'P&L Statement', metaKey: 'pnl', icon: <TrendingUp /> },
                            { id: 'LEDGER', label: 'Ledger Report', metaKey: 'ledger', icon: <Landmark /> },
                            { id: 'DIVIDEND', label: 'Dividend Report', metaKey: 'dividend', icon: <DollarSign /> },
                        ].map((item) => {
                            const lastSync = formatLastSync(uploadMeta[item.metaKey as keyof UploadMeta]);
                            return (
                                <div key={item.id} className="glass-card rounded-xl p-5 border hover:border-primary/50 transition-colors group relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-white/5 rounded-lg text-gray-400 group-hover:text-primary-glow group-hover:bg-primary/10 transition-colors">
                                            {item.icon}
                                        </div>
                                        {lastSync && <CheckCircle2 size={16} className="text-success" />}
                                    </div>
                                    
                                    <h5 className="font-bold text-white mb-1">{item.label}</h5>
                                    <p className="text-[10px] text-gray-500 mb-4 h-4">
                                        {lastSync ? `Updated: ${lastSync}` : 'No data uploaded'}
                                    </p>

                                    <label className="block w-full cursor-pointer">
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept=".csv" 
                                            onChange={(e) => handleFileUpload(e, item.id as UploadType)} 
                                        />
                                        <div className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-center transition-colors">
                                            Upload CSV
                                        </div>
                                    </label>
                                </div>
                            )
                        })}
                    </>
                )}
            </div>
        </div>

        {/* Debug Preview Section */}
        {lastUploadPreview.length > 0 && (
            <div className="glass-card rounded-xl p-6 mt-10">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-primary" />
                        Last Upload Preview
                    </h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-400">
                        <tbody>
                            {lastUploadPreview.map((row, i) => (
                                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                    {row.map((cell: string, j: number) => (
                                        <td key={j} className="p-3 border-r border-white/5 last:border-0 max-w-[150px] truncate font-mono">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );

  const renderAI = () => (
      <div className="max-w-3xl mx-auto h-[calc(100vh-140px)] flex flex-col animate-fade-in">
          <div className="glass-card rounded-2xl p-8 mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/10 rounded-full blur-[80px] pointer-events-none"></div>
              <h2 className="text-2xl font-bold text-white flex items-center relative z-10">
                  <BrainCircuit className="w-8 h-8 mr-3 text-accent-cyan" />
                  Portfolio Intelligence
              </h2>
              <p className="text-gray-400 mt-2 text-sm max-w-lg relative z-10">
                  Powered by Gemini 2.5 Flash. Ask complex questions about your XIRR, hidden fees, or analyze your dividend yield strategy for your <span className="text-accent-cyan">{context.replace(/_/g, ' ')}</span> portfolio.
              </p>
          </div>

          <div className="flex-1 glass-card rounded-2xl p-6 mb-4 overflow-y-auto">
                {!chatResponse && !isAnalyzing && (
                     <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                        <TrendingUp size={48} className="mb-4" />
                        <p>Ask me anything about your portfolio</p>
                     </div>
                )}
                
                {isAnalyzing && (
                    <div className="flex items-center justify-center h-full">
                         <div className="text-center">
                             <Loader2 className="w-10 h-10 text-accent-cyan animate-spin mx-auto mb-4" />
                             <p className="text-gray-400 text-sm font-medium animate-pulse">Analyzing market data...</p>
                         </div>
                    </div>
                )}

                {chatResponse && (
                    <div className="prose prose-invert max-w-none">
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                            <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">{chatResponse}</p>
                        </div>
                    </div>
                )}
          </div>

          <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent-cyan rounded-xl opacity-30 group-hover:opacity-70 transition duration-500 blur"></div>
              <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiAnalysis()}
                    placeholder="Ask about your portfolio..."
                    className="w-full bg-[#0F0B1F] border border-white/10 text-white rounded-xl py-4 pl-6 pr-14 focus:outline-none focus:ring-1 focus:ring-accent-cyan placeholder-gray-600 shadow-xl"
                  />
                  <button 
                    onClick={handleAiAnalysis}
                    disabled={isAnalyzing || !chatQuery.trim()}
                    className="absolute right-2 p-2.5 bg-gradient-to-r from-primary to-accent-cyan hover:brightness-110 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                      <Send size={18} />
                  </button>
              </div>
          </div>
      </div>
  );

  return (
    <main className="flex-1 ml-64 p-10 relative z-0">
        <header className="flex justify-between items-center mb-10">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    {currentView === ViewState.DASHBOARD && 'Dashboard'}
                    {currentView === ViewState.HOLDINGS && 'Holdings'}
                    {currentView === ViewState.WATCHLIST && 'Watchlist'}
                    {currentView === ViewState.TRANSACTIONS && 'Transactions'}
                    {currentView === ViewState.UPLOAD && 'Data Import'}
                    {currentView === ViewState.AI_INSIGHTS && 'AI Analyst'}
                    <span className="text-sm font-medium px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                        {context.replace(/_/g, ' ')}
                    </span>
                </h1>
                
                <div className="flex gap-4 mt-3 text-[10px] uppercase font-bold tracking-wider">
                     <span className={`flex items-center gap-1.5 ${trades.length > 0 ? 'text-accent-green' : 'text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${trades.length > 0 ? 'bg-accent-green shadow-[0_0_8px_#00ffa3]' : 'bg-gray-700'}`}></div>
                        Trades {uploadMeta.trades && <span className="text-[9px] opacity-70 ml-0.5">({new Date(uploadMeta.trades).toLocaleDateString()})</span>}
                     </span>
                     <span className={`flex items-center gap-1.5 ${pnlData.length > 0 ? 'text-accent-green' : 'text-gray-600'}`}>
                        <div className={`w-2 h-2 rounded-full ${pnlData.length > 0 ? 'bg-accent-green shadow-[0_0_8px_#00ffa3]' : 'bg-gray-700'}`}></div>
                        P&L
                     </span>
                     <span className={`flex items-center gap-1.5 ${Object.keys(priceData).length > 0 ? 'text-accent-cyan' : 'text-gray-600'}`}>
                        {Object.keys(priceData).length > 0 && <Zap className="w-3 h-3 fill-current text-accent-cyan animate-pulse" />}
                        {Object.keys(priceData).length === 0 && <div className="w-2 h-2 rounded-full bg-gray-700"></div>}
                        Prices {lastPriceUpdate && <span className="text-[9px] ml-1 opacity-70">({lastPriceUpdate})</span>}
                     </span>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    System Online
                </div>
            </div>
        </header>

        {currentView === ViewState.DASHBOARD && renderDashboard()}
        {currentView === ViewState.HOLDINGS && renderHoldings()}
        {currentView === ViewState.WATCHLIST && renderWatchlist()}
        {currentView === ViewState.TRANSACTIONS && renderTransactions()}
        {currentView === ViewState.UPLOAD && renderUpload()}
        {currentView === ViewState.AI_INSIGHTS && renderAI()}
      </main>
  );
}

// --- Main App Wrapper ---
function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [context, setContext] = useState<AssetContext>('INDIAN_EQUITY');

  return (
    <div className="flex min-h-screen">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        currentContext={context}
        setContext={setContext}
      />
      {/* 
         The key prop is crucial here. When context changes, React treats this as a different component instance,
         forcing a full remount. This resets all state hooks inside PortfolioDashboard, causing them to 
         re-initialize with the new storage keys derived from the new context.
      */}
      <PortfolioDashboard key={context} context={context} currentView={currentView} />
    </div>
  );
}

export default App;