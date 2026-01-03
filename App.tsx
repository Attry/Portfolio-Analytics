
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatsCard } from './components/StatsCard';
import { ViewState, Trade, TradeType, PnLRecord, LedgerRecord, DividendRecord, StockPriceRecord, WatchlistItem, AssetContext } from './types';
import { analyzePortfolio } from './services/geminiService';
import { 
  Briefcase, 
  TrendingUp, 
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
  RotateCcw,
  WalletCards,
  Menu // Import Menu icon
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

// New Imports
import { usePortfolioData } from './hooks/usePortfolioData';
import { DashboardView } from './components/views/DashboardView';
import { HoldingsView } from './components/views/HoldingsView';
import { TransactionsView } from './components/views/TransactionsView';
import { WatchlistView } from './components/views/WatchlistView';
import { AIInsightsView } from './components/views/AIInsightsView';
import { UploadView } from './components/views/UploadView';
import { NetWorthView } from './components/views/NetWorthView';

const toTitleCase = (str: string) => {
  return str.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const PortfolioDashboard: React.FC<{ context: AssetContext, currentView: ViewState, setView: (view: ViewState) => void }> = ({ context, currentView, setView }) => {
  const currencySymbol = context === 'INTERNATIONAL_EQUITY' ? '€' : '₹';
  
  const {
      trades, metrics, watchlist, priceData, uploadMeta, sheetId, MUTUAL_FUND_SHEET_URL, GOLD_ETF_SHEET_URL, globalMarketDate,
      processFile, addToWatchlist, removeFromWatchlist, updateWatchlistItem, updateMeta, saveSheetId, updateGlobalDate,
      addSalary, updateCashHolding, deleteCashHolding
  } = usePortfolioData(context);

  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // -- Google Sheet Sync --
  const handleGoogleSheetFetch = async (isBackground = false) => {
    setIsFetchingSheet(true);
    try {
        let url = '';
        if (context === 'MUTUAL_FUNDS') {
             url = MUTUAL_FUND_SHEET_URL;
        } else if (context === 'GOLD_ETF') {
             url = GOLD_ETF_SHEET_URL;
        } else {
            if (!sheetId || !globalMarketDate) { 
                if (!isBackground) alert("Please provide both Sheet ID and Market Date."); 
                setIsFetchingSheet(false); 
                return; 
            }
            url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
        const csvText = await response.text();
        if (csvText.toLowerCase().includes('<!doctype html>')) throw new Error("Access denied. Publish sheet to web.");
        
        // Use the hook's processor
        processFile(csvText, 'MARKET_DATA', globalMarketDate, isBackground);
    } catch (error: any) {
        console.error(error);
        if (!isBackground) alert(`Failed to fetch data: ${error.message}`);
    } finally {
        setIsFetchingSheet(false);
    }
  };

  // Auto-sync effect
  useEffect(() => {
    const timer = setTimeout(() => {
        if (context === 'MUTUAL_FUNDS' || context === 'GOLD_ETF' || (sheetId && globalMarketDate && Object.keys(priceData).length === 0)) {
             handleGoogleSheetFetch(true);
        }
    }, 5000);
    return () => clearTimeout(timer);
  }, [sheetId, context]); 

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (type === 'MARKET_DATA' && !globalMarketDate && context !== 'MUTUAL_FUNDS' && context !== 'GOLD_ETF') {
        alert("Please set the Reference Date in the header before uploading.");
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) processFile(content, type, globalMarketDate);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (currentView === ViewState.NET_WORTH) {
      return (
          <div className="p-6 h-full overflow-y-auto">
              <NetWorthView />
          </div>
      );
  }

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6 overflow-y-auto h-full pb-24 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-8 gap-4 md:gap-0">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-normal">{toTitleCase(context)}</h2>
                {/* Subtitle Removed as per request */}
            </div>
            
            <div className="flex flex-col-reverse md:flex-row items-center gap-4 w-full md:w-auto">
                 {/* Ref Date Button - Only on Dashboard */}
                 {currentView === ViewState.DASHBOARD && (
                     <div className="relative group w-full md:w-auto">
                        <div 
                            className="flex items-center justify-center gap-3 bg-surface border border-white/10 rounded-xl px-5 py-2.5 shadow-sm hover:border-primary/50 hover:bg-white/5 transition-all cursor-pointer w-full md:w-auto" 
                            onClick={() => dateInputRef.current?.showPicker()}
                        >
                            <Calendar className="w-4 h-4 text-primary group-hover:text-primary-glow" />
                            <span className="text-sm font-bold text-gray-200 font-mono tracking-wide">
                                {globalMarketDate || 'Select Date'}
                            </span>
                        </div>
                        <input 
                            ref={dateInputRef}
                            type="date"
                            value={globalMarketDate}
                            onChange={(e) => updateGlobalDate(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                     </div>
                 )}

                 {/* Status & Sync */}
                 <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <div className="text-left md:ml-2">
                        <p className="text-[10px] md:text-xs text-gray-400 font-medium">Market Data</p>
                        <p className={`text-xs font-bold ${metrics.hasLiveData ? 'text-success' : 'text-warning'}`}>
                            {metrics.hasLiveData ? 'LIVE' : 'OFFLINE'}
                        </p>
                    </div>
                    <button onClick={() => handleGoogleSheetFetch(false)} className="p-2.5 bg-surface hover:bg-white/10 rounded-xl border border-white/10 transition-colors shadow-sm" title="Sync Market Data">
                        <RefreshCw size={18} className={`text-primary ${isFetchingSheet ? 'animate-spin' : ''}`} />
                    </button>
                 </div>
            </div>
        </div>

        {currentView === ViewState.DASHBOARD && <DashboardView metrics={metrics} currencySymbol={currencySymbol} context={context} onAddSalary={addSalary} />}
        {currentView === ViewState.HOLDINGS && <HoldingsView metrics={metrics} currencySymbol={currencySymbol} context={context} onUpdateHolding={updateCashHolding} onDeleteHolding={deleteCashHolding} />}
        
        {/* Render restricted views only if not Mutual Funds/Gold ETF/Cash (just extra safety, sidebar handles nav) */}
        {context !== 'MUTUAL_FUNDS' && context !== 'GOLD_ETF' && context !== 'CASH_EQUIVALENTS' && currentView === ViewState.TRANSACTIONS && <TransactionsView trades={trades} metrics={metrics} currencySymbol={currencySymbol} />}
        {context !== 'MUTUAL_FUNDS' && context !== 'GOLD_ETF' && context !== 'CASH_EQUIVALENTS' && currentView === ViewState.WATCHLIST && (
            <WatchlistView 
                watchlist={watchlist} 
                priceData={priceData} 
                currencySymbol={currencySymbol} 
                onAdd={addToWatchlist}
                onRemove={removeFromWatchlist}
                onUpdate={updateWatchlistItem}
            />
        )}
        {/* AI Insights relies on trades, so hidden for MF/Gold/Cash */}
        {context !== 'MUTUAL_FUNDS' && context !== 'GOLD_ETF' && context !== 'CASH_EQUIVALENTS' && currentView === ViewState.AI_INSIGHTS && <AIInsightsView trades={trades} />}
        {context !== 'MUTUAL_FUNDS' && context !== 'GOLD_ETF' && context !== 'CASH_EQUIVALENTS' && currentView === ViewState.UPLOAD && (
            <UploadView 
                context={context} 
                uploadMeta={uploadMeta} 
                marketDate={globalMarketDate} 
                setMarketDate={updateGlobalDate}
                sheetId={sheetId}
                setSheetId={saveSheetId}
                onFileUpload={handleFileUpload}
                onSync={() => handleGoogleSheetFetch(false)}
                isSyncing={isFetchingSheet}
            />
        )}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [context, setContext] = useState<AssetContext>('INDIAN_EQUITY');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Determine Theme Class
  const themeClass = useMemo(() => {
      switch (context) {
          case 'MUTUAL_FUNDS': return 'theme-corporate';
          case 'GOLD_ETF': return 'theme-gold';
          case 'INTERNATIONAL_EQUITY': return 'theme-intl';
          case 'CASH_EQUIVALENTS': return 'theme-cash';
          case 'INDIAN_EQUITY': 
          default: return ''; // Default theme (defined in root)
      }
  }, [context]);

  // Check if current view triggers sidebar auto-hide (Desktop Only)
  const autoHideViews = [ViewState.HOLDINGS, ViewState.WATCHLIST, ViewState.TRANSACTIONS, ViewState.AI_INSIGHTS];
  const isAutoHide = autoHideViews.includes(view);

  return (
    <div className={`flex h-screen bg-background text-white font-sans selection:bg-primary/30 ${themeClass}`}>
        <Sidebar 
            currentView={view} 
            setView={setView} 
            currentContext={context} 
            setContext={setContext}
            mobileOpen={isMobileMenuOpen}
            setMobileOpen={setIsMobileMenuOpen}
        />

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 w-full z-40 bg-background/90 backdrop-blur-md border-b border-border p-4 flex justify-between items-center h-16 shadow-lg">
             <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-1.5 rounded-lg"><WalletCards className="w-5 h-5 text-primary" /></div>
                <span className="font-bold text-lg text-white tracking-wide">Fin<span className="text-primary">Folio</span></span>
             </div>
             <button 
                onClick={() => setIsMobileMenuOpen(true)} 
                className="p-2 text-gray-300 hover:text-white bg-surface rounded-lg active:scale-95 transition-all"
             >
                <Menu size={24} />
             </button>
        </div>

        {/* Main Content Area */}
        <main className={`flex-1 relative transition-all duration-500 ease-in-out 
            ${isAutoHide ? 'md:ml-6' : 'md:ml-64'} 
            ml-0 pt-16 md:pt-0 h-screen overflow-hidden
        `}>
            {/* Fixed Background Layer to prevent disappearing on scroll */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-blob"></div>
                <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] bg-accent-cyan/5 rounded-full blur-[100px]"></div>
            </div>

            <div className="relative z-10 h-full">
                <PortfolioDashboard key={context} context={context} currentView={view} setView={setView} />
            </div>
        </main>
    </div>
  );
};

export default App;
