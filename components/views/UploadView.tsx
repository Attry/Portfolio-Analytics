
import React from 'react';
import { UploadCloud, RotateCcw, Loader2, RefreshCw, CheckCircle2, History, FileSpreadsheet, FileText, Coins, LineChart as LineChartIcon, Briefcase } from 'lucide-react';
import { AssetContext } from '../../types';
import { formatLastSync } from '../../utils/common';

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
}

export const UploadView: React.FC<UploadViewProps> = ({ 
    context, uploadMeta, marketDate, setMarketDate, sheetId, setSheetId, onFileUpload, onSync, isSyncing 
}) => {
    
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

    return (
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
                                <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1 block">Reference Date (Global)</label>
                                <input 
                                    type="date" 
                                    value={marketDate}
                                    onChange={(e) => setMarketDate(e.target.value)}
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
                                        onClick={() => { setSheetId(''); }}
                                        className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                        title="Reset Fields"
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                    <button 
                                        onClick={onSync}
                                        disabled={isSyncing}
                                        className="px-3 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-lg text-primary-glow text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                        {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
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
                            onChange={(e) => onFileUpload(e, type.id as UploadType)}
                        />
                    </label>
                    
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
    );
};
