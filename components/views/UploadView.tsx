import React from 'react';
import { UploadCloud, RotateCcw, Loader2, RefreshCw, CheckCircle2, History, FileSpreadsheet, FileText, Coins, LineChart as LineChartIcon, Briefcase, Download, Save, CloudUpload, ShieldCheck, Trash2 } from 'lucide-react';
import { AssetContext } from '../../types';
import { formatLastSync } from '../../utils/common';
import { CartoonBackground } from '../CartoonBackground';

type UploadType = 'PNL' | 'LEDGER' | 'DIVIDEND' | 'TRADE_HISTORY' | 'MARKET_DATA' | 'PORTFOLIO_SNAPSHOT';

interface UploadViewProps {
    context: AssetContext;
    uploadMeta: any;
    marketDate: string;
    setMarketDate: (date: string) => void;
    sheetId: string;
    setSheetId: (id: string) => void;
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>, type: UploadType) => void;
    onSync: () => void;
    isSyncing: boolean;
    // New optional props for base baseline consolidation
    baseTrades?: any[];
    baseSummary?: { charges: number; realizedPnL: number; dividends: number };
    onConvertToBase?: () => void;
    onClearBase?: () => void;
}

export const UploadView: React.FC<UploadViewProps> = ({ 
    context, 
    uploadMeta, 
    marketDate, 
    setMarketDate, 
    sheetId, 
    setSheetId, 
    onFileUpload, 
    onSync, 
    isSyncing,
    baseTrades = [],
    baseSummary = { charges: 0, realizedPnL: 0, dividends: 0 },
    onConvertToBase,
    onClearBase
}) => {
    
    const handleExport = () => {
        const appData: Record<string, any> = {};
        // Keys prefixes used by the app
        const keysToBackup = [
            'dhan_', 'intl_', 'gold_', 'cash_', 'mf_', 'GLOBAL_MARKET_DATE'
        ];
        
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && keysToBackup.some(k => key.startsWith(k))) {
                 const val = localStorage.getItem(key);
                 if (val) {
                    appData[key] = val;
                    count++;
                 }
            }
        }
        
        if (count === 0) {
            alert("No data found to backup.");
            return;
        }

        const blob = new Blob([JSON.stringify(appData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `FinFolio_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (typeof json !== 'object') throw new Error("Invalid backup file");

                // Basic validation: check if it contains at least one known key prefix
                const keys = Object.keys(json);
                const isValid = keys.some(k => ['dhan_', 'intl_', 'gold_', 'cash_', 'mf_'].some(prefix => k.startsWith(prefix)));
                
                if (!isValid && keys.length > 0 && !confirm("This file doesn't look like a valid FinFolio backup. Restore anyway?")) {
                    return;
                }

                Object.keys(json).forEach(key => {
                     localStorage.setItem(key, json[key]);
                });
                
                alert("Data restored successfully! The app will now reload.");
                window.location.reload();
            } catch (err) {
                alert("Failed to restore data. The file might be corrupted or invalid.");
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    }

    const getUploadOptions = (ctx: AssetContext) => {
        if (ctx === 'INDIAN_EQUITY') {
            return [
               { id: 'TRADE_HISTORY', label: 'Trade History', icon: <History />, desc: 'CSV with Date, Ticker, Qty, Price' },
               { id: 'PNL', label: 'P&L Report', icon: <FileSpreadsheet />, desc: 'Extract Charges & Net P&L' },
               { id: 'LEDGER', label: 'Ledger', icon: <FileText />, desc: 'Extract Cash Balance' },
               { id: 'DIVIDEND', label: 'Dividends', icon: <Coins />, desc: 'Extract Dividend Payouts' },
               { id: 'MARKET_DATA', label: 'Market Prices', icon: <LineChartIcon />, desc: 'CSV or Sheet Sync' },
            ];
        }
        if (ctx === 'INTERNATIONAL_EQUITY') {
            return [
               { id: 'TRADE_HISTORY', label: 'Trade History', icon: <History />, desc: 'Degiro Transactions CSV' },
               { id: 'LEDGER', label: 'Account Statement', icon: <FileText />, desc: 'Degiro Account CSV (Dividends)' },
               { id: 'PORTFOLIO_SNAPSHOT', label: 'Portfolio', icon: <Briefcase />, desc: 'Degiro Portfolio CSV (Prices)' },
               { id: 'MARKET_DATA', label: 'Market Prices', icon: <LineChartIcon />, desc: 'General Market Data CSV' },
            ];
        }
        return [];
    };

    const getDefaultSheetId = (ctx: AssetContext) => {
        if (ctx === 'INTERNATIONAL_EQUITY') return "1zQFW9FHFoyvw4uZR4z3klFeoCIGJPUlq7QuDYwz4lEY";
        if (ctx === 'MUTUAL_FUNDS') return "LINKED_TO_PUB_URL_MF"; 
        if (ctx === 'GOLD_ETF') return "LINKED_TO_PUB_URL_GOLD";
        return "1htAAZP9eWVH0sq1BHbiS-dKJNzcP-uoBEW6GXp4N3HI";
    };

    const currencySymbol = context === 'INTERNATIONAL_EQUITY' ? '€' : '₹';

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10 relative">
            <CartoonBackground icon={CloudUpload} pattern="grid" color="text-primary" opacity="opacity-[0.03]" />
            
            {/* Base Baseline Management Section */}
            {onConvertToBase && (context === 'INDIAN_EQUITY' || context === 'INTERNATIONAL_EQUITY') && (
                <div className="relative z-10">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-success" /> Base Data Baseline Management
                    </h3>
                    
                    <div className="glass-card rounded-2xl p-6 border border-gray-200 bg-success/[0.02] shadow-md shadow-gray-200/50">
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                            <div className="space-y-2">
                                <h4 className="text-lg font-bold text-gray-900">Establish Historical Baseline</h4>
                                <p className="text-xs text-gray-600 max-w-2xl">
                                    Avoid getting re-uploading older FY files repeatedly! Use this option to freeze the current set of uploaded trades, charges, and dividends into a secure <strong>Baseline ("Base Data")</strong>. 
                                    Once saved, you can safely clear your active uploads and only upload subsequent newer transactions. The application automatically aggregates results from both!
                                </p>
                                
                                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[13px] bg-white border border-gray-200 p-3 rounded-lg font-sans tracking-tight font-medium">
                                    <div>
                                        <span className="text-gray-500">Baseline Tickers:</span>{' '}
                                        <span className="font-bold text-gray-900">{baseTrades.length} trades</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Baseline Charges:</span>{' '}
                                        <span className="font-bold text-gray-900">{currencySymbol}{baseSummary.charges.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Baseline Realized P&L:</span>{' '}
                                        <span className="font-bold text-gray-900">{currencySymbol}{baseSummary.realizedPnL.toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Baseline Dividends:</span>{' '}
                                        <span className="font-bold text-gray-900">{currencySymbol}{baseSummary.dividends.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto self-stretch md:self-auto justify-end shrink-0">
                                <button
                                    onClick={onConvertToBase}
                                    className="flex-1 md:flex-none py-3 px-5 bg-primary hover:bg-primary-glow text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-gray-200/50 hover:shadow-lg border border-gray-200"
                                >
                                    Convert to Base Data
                                </button>
                                {baseTrades.length > 0 && (
                                    <button
                                        onClick={onClearBase}
                                        className="flex-1 md:flex-none py-3 px-5 bg-danger/10 hover:bg-danger/20 text-danger rounded-xl font-bold text-sm transition-all shadow-md shadow-gray-200/50 hover:shadow-lg border border-danger/30 flex items-center justify-center gap-1.5"
                                    >
                                        <Trash2 size={15} /> Clear Base Data
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Backup & Restore Section */}
            <div className="relative z-10">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Save className="w-5 h-5 text-accent-cyan" /> Data Sync (Backup & Restore)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Backup Card */}
                    <div className="glass-card rounded-2xl p-6 border border-gray-200 relative overflow-hidden group hover:border-gray-200 transition-all shadow-md">
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Download className="w-5 h-5 text-primary" /> Export Data
                                </h4>
                                <p className="text-xs text-gray-600 mt-2">
                                    Download a single file containing your entire portfolio data across all assets. 
                                    Use this to move your data to your phone or another browser.
                                </p>
                            </div>
                            <button 
                                onClick={handleExport}
                                className="mt-6 w-full py-3 bg-primary hover:bg-primary-glow text-white rounded-xl font-bold text-sm transition-all shadow-sm border border-gray-200 hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                <Download size={16} /> Download Backup
                            </button>
                        </div>
                    </div>

                    {/* Restore Card */}
                    <div className="glass-card rounded-2xl p-6 border border-gray-200 relative overflow-hidden group hover:border-gray-200 transition-all shadow-md">
                        <div className="absolute inset-0 bg-accent-cyan/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <UploadCloud className="w-5 h-5 text-accent-cyan" /> Import Data
                                </h4>
                                <p className="text-xs text-gray-600 mt-2">
                                    Restore your portfolio from a backup file. 
                                    <span className="text-danger block mt-1 font-bold">Warning: This will overwrite data on this device.</span>
                                </p>
                            </div>
                            <label className="mt-6 w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold text-sm transition-all cursor-pointer text-center border border-gray-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-lg">
                                <UploadCloud size={16} /> Select Backup File
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    className="hidden" 
                                    onChange={handleImport}
                                />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSV Import Section */}
            {getUploadOptions(context).length > 0 && (
                <div className="relative z-10">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-accent-cyan" /> Import CSV Data ({context.replace(/_/g, ' ')})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {getUploadOptions(context).map((type) => (
                            <div key={type.id} className="glass-card rounded-2xl p-6 border border-gray-200 hover:border-gray-200 transition-all group relative overflow-hidden shadow-md">
                                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative z-10">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-gray-100 rounded-xl text-primary group-hover:scale-110 transition-transform border border-gray-200">
                                        {type.icon}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-900">{type.label}</h4>
                                        <p className="text-xs text-gray-600">{type.desc}</p>
                                    </div>
                                </div>
                                
                                {type.id === 'MARKET_DATA' && (
                                    <div className="space-y-3 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                        <div>
                                            <label className="text-[10px] uppercase text-gray-600 font-bold tracking-wider mb-1 block">Reference Date (Global)</label>
                                            <input 
                                                type="date" 
                                                value={marketDate}
                                                onChange={(e) => setMarketDate(e.target.value)}
                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-gray-900 text-sm focus:outline-none focus:border-primary transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase text-gray-600 font-bold tracking-wider mb-1 block">Google Sheet ID</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                    type="text" 
                                                    value={sheetId}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
                                                        setSheetId(match ? match[1] : val);
                                                    }}
                                                    placeholder="Sheet ID or URL"
                                                    className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-gray-900 text-[13px] focus:outline-none focus:border-primary transition-colors font-sans tracking-tight font-medium"
                                                />
                                                <button 
                                                    onClick={() => { setSheetId(getDefaultSheetId(context)); }}
                                                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 transition-colors"
                                                    title="Reset to Default"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                                <button 
                                                    onClick={onSync}
                                                    disabled={isSyncing}
                                                    className="px-3 py-1 bg-primary hover:bg-primary-glow border border-gray-200 rounded-lg text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-sm hover:shadow-lg transition-all"
                                                >
                                                    {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                                    Sync
                                                </button>
                                                </div>
                                        </div>
                                    </div>
                                )}

                                <label className="flex items-center justify-center w-full py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-primary hover:text-primary transition-all text-gray-600 text-sm font-medium bg-gray-100 hover:bg-gray-200">
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                    <span>Select CSV</span>
                                    <input 
                                        type="file" 
                                        accept=".csv" 
                                        className="hidden" 
                                        onChange={(e) => onFileUpload(e, type.id as UploadType)}
                                    />
                                </label>
                                
                                {type.id === 'TRADE_HISTORY' && uploadMeta.trades && (
                                    <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full border border-success"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.trades)}</p>
                                )}
                                {type.id === 'PNL' && uploadMeta.pnl && (
                                    <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full border border-success"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.pnl)}</p>
                                )}
                                {type.id === 'LEDGER' && uploadMeta.ledger && (
                                    <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full border border-success"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.ledger)}</p>
                                )}
                                {type.id === 'DIVIDEND' && uploadMeta.dividend && (
                                    <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full border border-success"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.dividend)}</p>
                                )}
                                {type.id === 'PORTFOLIO_SNAPSHOT' && uploadMeta.portfolio && (
                                    <p className="text-[10px] text-success mt-2 flex items-center justify-center bg-success/10 py-1 rounded-full border border-success"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.portfolio)}</p>
                                )}
                                {type.id === 'MARKET_DATA' && uploadMeta.market && (
                                    <p className="text-[10px] text-accent-cyan mt-2 flex items-center justify-center bg-accent-cyan/10 py-1 rounded-full border border-accent-cyan"><CheckCircle2 size={10} className="mr-1"/> Synced: {formatLastSync(uploadMeta.market)}</p>
                                )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
