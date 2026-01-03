
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

// New Imports
import { usePortfolioData } from './hooks/usePortfolioData';
import { DashboardView } from './components/views/DashboardView';
import { HoldingsView } from './components/views/HoldingsView';
import { TransactionsView } from './components/views/TransactionsView';
import { WatchlistView } from './components/views/WatchlistView';
import { AIInsightsView } from './components/views/AIInsightsView';
import { UploadView } from './components/views/UploadView';

const PortfolioDashboard: React.FC<{ context: AssetContext, currentView: ViewState, setView: (view: ViewState) => void }> = ({ context, currentView, setView }) => {
  const currencySymbol = context === 'INTERNATIONAL_EQUITY' ? '€' : '₹';
  
  const {
      trades, metrics, watchlist, priceData, uploadMeta, sheetId, MUTUAL_FUND_SHEET_URL,
      processFile, addToWatchlist, removeFromWatchlist, updateWatchlistItem, updateMeta, saveSheetId
  } = usePortfolioData(context);

  const [marketDate, setMarketDate] = useState<string>(uploadMeta.marketDate || '');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

  // -- Google Sheet Sync --
  const handleGoogleSheetFetch = async () => {
    setIsFetchingSheet(true);
    try {
        let url = '';
        if (context === 'MUTUAL_FUNDS') {
             url = MUTUAL_FUND_SHEET_URL;
        } else {
            if (!sheetId || !marketDate) { alert("Please provide both Sheet ID and Date."); setIsFetchingSheet(false); return; }
            url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
        const csvText = await response.text();
        if (csvText.toLowerCase().includes('<!doctype html>')) throw new Error("Access denied. Publish sheet to web.");
        
        // Use the hook's processor
        // For MF, marketDate isn't strictly needed for parsing but we pass it for meta
        processFile(csvText, 'MARKET_DATA', marketDate || new Date().toISOString().split('T')[0]);
    } catch (error: any) {
        console.error(error);
        alert(`Failed to fetch data: ${error.message}`);
    } finally {
        setIsFetchingSheet(false);
    }
  };

  // Auto-sync effect
  useEffect(() => {
    const timer = setTimeout(() => {
        if (context === 'MUTUAL_FUNDS' || (sheetId && marketDate && Object.keys(priceData).length === 0)) {
             handleGoogleSheetFetch();
        }
    }, 5000);
    return () => clearTimeout(timer);
  }, [sheetId, context]); 

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (type === 'MARKET_DATA' && !marketDate && context !== 'MUTUAL_FUNDS') {
        alert("Please select the Date of Market Data before uploading.");
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) processFile(content, type, marketDate);
    };
    reader.readAsText(file);
    event.target.value = '';
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
            </div>
        </div>

        {currentView === ViewState.DASHBOARD && <DashboardView metrics={metrics} currencySymbol={currencySymbol} context={context} />}
        {currentView === ViewState.HOLDINGS && <HoldingsView metrics={metrics} currencySymbol={currencySymbol} context={context} />}
        
        {/* Render restricted views only if not Mutual Funds (just extra safety, sidebar handles nav) */}
        {context !== 'MUTUAL_FUNDS' && currentView === ViewState.TRANSACTIONS && <TransactionsView trades={trades} metrics={metrics} currencySymbol={currencySymbol} />}
        {context !== 'MUTUAL_FUNDS' && currentView === ViewState.WATCHLIST && (
            <WatchlistView 
                watchlist={watchlist} 
                priceData={priceData} 
                currencySymbol={currencySymbol} 
                onAdd={addToWatchlist}
                onRemove={removeFromWatchlist}
                onUpdate={updateWatchlistItem}
            />
        )}
        {/* AI Insights relies on trades, so hidden for MF */}
        {context !== 'MUTUAL_FUNDS' && currentView === ViewState.AI_INSIGHTS && <AIInsightsView trades={trades} />}
        {context !== 'MUTUAL_FUNDS' && currentView === ViewState.UPLOAD && (
            <UploadView 
                context={context} 
                uploadMeta={uploadMeta} 
                marketDate={marketDate} 
                setMarketDate={(d) => { setMarketDate(d); updateMeta({ marketDate: d }); }}
                sheetId={sheetId}
                setSheetId={saveSheetId}
                onFileUpload={handleFileUpload}
                onSync={handleGoogleSheetFetch}
                isSyncing={isFetchingSheet}
            />
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
