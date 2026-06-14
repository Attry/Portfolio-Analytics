
import React, { useState, useEffect, useMemo } from 'react';
import { Crosshair, Plus, X, ExternalLink, Save, Target, AlertCircle, TrendingUp, AlertTriangle, Lock, Swords } from 'lucide-react';
import { WatchlistItem, AssetContext } from '../../types';
import { CartoonBackground } from '../CartoonBackground';

interface DecisionArenaViewProps {
  metrics: any;
  watchlist: WatchlistItem[];
  priceData: Record<string, number>;
  currencySymbol: string;
  context: AssetContext;
  onUpdateWatchlist: (id: string, field: keyof WatchlistItem, value: any) => void;
  onAddToWatchlist: (ticker: string, initialData?: Partial<WatchlistItem>) => void;
}

interface ArenaItem {
    ticker: string;
    source: 'HOLDING' | 'WATCHLIST' | 'BOTH';
}

export const DecisionArenaView: React.FC<DecisionArenaViewProps> = ({ 
    metrics, watchlist, priceData, currencySymbol, context, onUpdateWatchlist, onAddToWatchlist 
}) => {
    
    // --- State ---
    const [arenaTickers, setArenaTickers] = useState<string[]>([]);
    const [manualSearch, setManualSearch] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [externalCash, setExternalCash] = useState(0);
    
    // Modal State
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ 
        desiredEntry: number, 
        intrinsic: number, 
        link: string, 
        s1: number, 
        s2: number, 
        s3: number 
    }>({ 
        desiredEntry: 0, 
        intrinsic: 0, 
        link: '',
        s1: 0, s2: 0, s3: 0
    });

    // --- Fetch External Cash (Savings) for Indian Equity ---
    useEffect(() => {
        if (context === 'INDIAN_EQUITY') {
            try {
                const savedCash = localStorage.getItem('cash_holdings');
                if (savedCash) {
                    const holdings = JSON.parse(savedCash);
                    if (Array.isArray(holdings)) {
                        const totalSavings = holdings.reduce((acc: number, curr: any) => acc + (curr.value || 0), 0);
                        setExternalCash(totalSavings);
                        return;
                    }
                }
            } catch (e) {
                console.error("Failed to load external cash", e);
            }
        }
        setExternalCash(0);
    }, [context]);

    // --- Derived Metrics ---
    // For Indian Equity: Deployable = Trading Cash + External Savings (Cash Equivalents)
    // For International: Deployable = Trading Cash only
    const deployableCash = metrics.cashBalance + externalCash;
    
    // Total Capital used for Weight Calculation
    const totalCapital = metrics.totalInvested + deployableCash; 

    // --- Initialization Logic ---
    // Runs once on mount to populate the arena
    useEffect(() => {
        const initialSet = new Set<string>();
        
        // 1. Add All Holdings
        metrics.holdings.forEach((h: any) => {
            if (h.ticker !== 'CASH BALANCE') initialSet.add(h.ticker);
        });

        // 2. Add Watchlist items with Call Ratio > 0.95
        watchlist.forEach(w => {
            const price = priceData[w.ticker.toUpperCase()] || 0;
            // Recalculate dynamic ratio for inclusion
            const supports = [w.s1, w.s2, w.s3].filter(s => s && s > 0) as number[];
            let target = w.desiredEntryPrice;
            if (supports.length > 0 && price > 0) {
                 target = supports.reduce((prev, curr) => Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev);
            }

            if (price > 0 && target > 0) {
                const ratio = target / price;
                if (ratio > 0.95) initialSet.add(w.ticker);
            }
        });

        setArenaTickers(Array.from(initialSet).sort());
    }, []); // Empty dependency array ensures this only runs on mount (auto-import)

    // --- Helper Logic per Stock ---
    const getStockData = (ticker: string) => {
        const holding = metrics.holdings.find((h: any) => h.ticker === ticker);
        const watchItem = watchlist.find(w => w.ticker === ticker);
        const price = priceData[ticker.toUpperCase()] || 0; // Fix: Uppercase Key Lookup

        const intrinsic = watchItem?.intrinsicValue || 0;
        
        // Dynamic Target Logic
        let desiredEntry = watchItem?.desiredEntryPrice || 0;
        const s1 = watchItem?.s1 || 0;
        const s2 = watchItem?.s2 || 0;
        const s3 = watchItem?.s3 || 0;
        const supports = [s1, s2, s3].filter(s => s > 0);

        if (supports.length > 0) {
            if (price > 0) {
                 desiredEntry = supports.reduce((prev, curr) => Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev);
            } else {
                 desiredEntry = supports[0];
            }
        }
        
        // Logic:
        // 1. MoS = (Intrinsic - Price) / Intrinsic
        const mos = (intrinsic > 0 && price > 0) ? ((intrinsic - price) / intrinsic) * 100 : 0;
        
        // 2. Call Ratio = Target / Price
        const callRatio = (desiredEntry > 0 && price > 0) ? desiredEntry / price : 0;

        // 3. Weight = Current Value / Total Capital (Equity + Deployable Cash)
        const marketValue = holding ? holding.marketValue : 0;
        const weight = totalCapital > 0 ? (marketValue / totalCapital) * 100 : 0;

        // 4. Status Hierarchy
        let status = 'Hold';
        let statusColor = 'text-gray-600 border-gray-400 bg-gray-200';

        if (intrinsic > 0 && price > intrinsic) {
            status = 'Trim / Overvalued';
            statusColor = 'text-danger border-danger bg-danger/10';
        } else if (callRatio > 0.95) {
            status = 'Accumulate';
            statusColor = 'text-success border-success bg-success/10 animate-pulse';
        } else if (callRatio >= 0.88) {
            status = 'Monitor';
            statusColor = 'text-orange-600 border-orange-500 bg-orange-100';
        }

        return {
            ticker,
            price,
            daysHeld: holding ? holding.daysHeld : '-',
            latestBuyPrice: holding ? holding.latestBuyPrice : 0, // Get last buy price
            latestBuyDate: holding ? holding.latestBuyDate : '-',
            mos,
            status,
            statusColor,
            weight,
            watchItem, // Return entire item for modal
            holding, // Return holding for modal
            effectiveTarget: desiredEntry,
            hasSupports: supports.length > 0
        };
    };

    // --- Handlers ---
    const handleRemove = (ticker: string) => {
        setArenaTickers(prev => prev.filter(t => t !== ticker));
    };

    const handleAddManual = (ticker: string) => {
        if (!arenaTickers.includes(ticker)) {
            setArenaTickers(prev => [...prev, ticker].sort());
        }
        setIsAdding(false);
        setManualSearch('');
    };

    const openModal = (ticker: string) => {
        const data = getStockData(ticker);
        setEditForm({
            desiredEntry: data.watchItem?.desiredEntryPrice || 0,
            intrinsic: data.watchItem?.intrinsicValue || 0,
            link: data.watchItem?.researchLink || '',
            s1: data.watchItem?.s1 || 0,
            s2: data.watchItem?.s2 || 0,
            s3: data.watchItem?.s3 || 0
        });
        setSelectedTicker(ticker);
    };

    const handleSaveModal = () => {
        if (!selectedTicker) return;
        
        const watchItem = watchlist.find(w => w.ticker === selectedTicker);
        
        if (watchItem) {
            // Update existing individually to ensure persistence
            if (watchItem.desiredEntryPrice !== editForm.desiredEntry) onUpdateWatchlist(watchItem.id, 'desiredEntryPrice', editForm.desiredEntry);
            if (watchItem.intrinsicValue !== editForm.intrinsic) onUpdateWatchlist(watchItem.id, 'intrinsicValue', editForm.intrinsic);
            if (watchItem.researchLink !== editForm.link) onUpdateWatchlist(watchItem.id, 'researchLink', editForm.link);
            if (watchItem.s1 !== editForm.s1) onUpdateWatchlist(watchItem.id, 's1', editForm.s1);
            if (watchItem.s2 !== editForm.s2) onUpdateWatchlist(watchItem.id, 's2', editForm.s2);
            if (watchItem.s3 !== editForm.s3) onUpdateWatchlist(watchItem.id, 's3', editForm.s3);
        } else {
            // New Item: Use the updated hook signature to save all data at creation
            onAddToWatchlist(selectedTicker, {
                desiredEntryPrice: editForm.desiredEntry,
                intrinsicValue: editForm.intrinsic,
                researchLink: editForm.link,
                s1: editForm.s1,
                s2: editForm.s2,
                s3: editForm.s3
            });
        }
        setSelectedTicker(null);
    };

    // Dynamic calc for Modal UI to show effective target while editing
    const getModalEffectiveTarget = () => {
        const supports = [editForm.s1, editForm.s2, editForm.s3].filter(s => s > 0);
        const price = selectedTicker ? priceData[selectedTicker.toUpperCase()] : 0;
        
        if (supports.length > 0) {
            if (price > 0) {
                return supports.reduce((prev, curr) => Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev);
            }
            return supports[0];
        }
        return editForm.desiredEntry;
    };
    
    const modalEffectiveTarget = getModalEffectiveTarget();
    const modalHasSupports = [editForm.s1, editForm.s2, editForm.s3].some(s => s > 0);

    const availableToAdd = useMemo(() => {
        const all = new Set([...Object.keys(priceData), ...watchlist.map(w => w.ticker)]);
        return Array.from(all).filter(t => !arenaTickers.includes(t)).sort();
    }, [priceData, watchlist, arenaTickers]);

    const filteredAddList = availableToAdd.filter(t => t.toLowerCase().includes(manualSearch.toLowerCase()));

    return (
        <div className="h-full flex flex-col animate-fade-in pb-10 relative">
            <CartoonBackground icon={Swords} pattern="dots" color="text-accent-cyan" opacity="opacity-[0.03]" />
            {/* --- TOP COMMAND BAR --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 relative z-10">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Crosshair className="text-accent-cyan w-6 h-6" />
                        <h2 className="text-2xl font-bold text-gray-900">Decision Arena</h2>
                    </div>
                    <p className="text-gray-600 text-sm">Active workspace for Trim, Accumulate, and Monitoring decisions.</p>
                </div>
                
                <div className="glass-card px-6 py-3 border border-gray-200 bg-success/10 rounded-xl flex flex-col items-end shadow-md">
                    <span className="text-xs font-bold text-success uppercase tracking-wider mb-1">Deployable Cash</span>
                    <span className="text-4xl font-bold text-gray-900 font-sans tracking-tight">{currencySymbol}{deployableCash.toLocaleString()}</span>
                    {externalCash > 0 && (
                        <span className="text-[10px] text-gray-600 mt-1 flex items-center gap-1">
                            (Incl. {currencySymbol}{externalCash.toLocaleString()} Savings)
                        </span>
                    )}
                </div>
            </div>

            {/* --- ARENA TABLE --- */}
            <div className="glass-card rounded-2xl overflow-hidden border border-gray-200 flex-1 flex flex-col relative min-h-[500px] shadow-md z-10">
                {/* Table Header */}
                <div className="p-4 border-b-2 border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex gap-2">
                        <span className="text-xs font-bold text-gray-600 uppercase">Arena Items: {arenaTickers.length}</span>
                    </div>
                    <div className="relative">
                        {!isAdding ? (
                            <button 
                                onClick={() => setIsAdding(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary-glow text-white border border-gray-200 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-lg"
                            >
                                <Plus size={14} /> Add Stock
                            </button>
                        ) : (
                            <div className="absolute right-0 top-[-10px] w-64 z-50">
                                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                                    <div className="flex items-center p-2 border-b-2 border-gray-200">
                                        <input 
                                            autoFocus
                                            type="text" 
                                            placeholder="Search..."
                                            value={manualSearch}
                                            onChange={(e) => setManualSearch(e.target.value)}
                                            className="bg-transparent text-sm text-gray-900 outline-none flex-1 px-2"
                                        />
                                        <button onClick={() => setIsAdding(false)}><X size={14} className="text-gray-500 hover:text-gray-900"/></button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {filteredAddList.map(t => (
                                            <button 
                                                key={t} 
                                                onClick={() => handleAddManual(t)}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-md border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4">Stock Name</th>
                                <th className="px-6 py-4 text-center">Days Since Buy</th>
                                <th className="px-6 py-4 text-right">MoS %</th>
                                <th className="px-6 py-4 text-center">Action</th>
                                <th className="px-6 py-4 text-right">Weight %</th>
                                <th className="px-6 py-4 text-center w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {arenaTickers.map(ticker => {
                                const data = getStockData(ticker);
                                return (
                                    <tr 
                                        key={ticker} 
                                        onClick={() => openModal(ticker)}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-gray-900 text-base group-hover:text-primary transition-colors">{ticker}</span>
                                            {data.price === 0 && <span className="text-[10px] text-red-500 ml-2">(No Price)</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600 font-sans tracking-tight font-medium">
                                            {data.daysHeld}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-sans tracking-tight text-[15px] font-bold ${data.mos > 0 ? 'text-success' : 'text-danger'}`}>
                                            {data.watchItem?.intrinsicValue ? `${data.mos.toFixed(1)}%` : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${data.statusColor}`}>
                                                {data.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-900 font-sans tracking-tight font-medium">
                                            {data.weight.toFixed(2)}%
                                        </td>
                                        <td className="px-6 py-4 text-center" onClick={(e) => { e.stopPropagation(); handleRemove(ticker); }}>
                                            <X size={16} className="text-gray-400 hover:text-danger transition-colors opacity-0 group-hover:opacity-100" />
                                        </td>
                                    </tr>
                                );
                            })}
                            {arenaTickers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-20 text-gray-500">
                                        The Arena is empty. Add stocks or sync Holdings.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- THE WAR ROOM (MODAL) --- */}
            {selectedTicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in p-4">
                    <div className="glass-card border border-gray-200 rounded-2xl w-full max-w-2xl shadow-xl relative overflow-hidden flex flex-col max-h-[90vh] bg-white">
                        {/* Modal Header */}
                        <div className="p-6 border-b-2 border-gray-200 flex justify-between items-start bg-gray-50">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {selectedTicker}
                                    <span className="text-sm font-normal text-gray-600 px-2 py-0.5 rounded border border-gray-200 bg-white">
                                        {currencySymbol}{priceData[selectedTicker.toUpperCase()]?.toLocaleString() || 'N/A'}
                                    </span>
                                </h3>
                                <p className="text-xs text-primary mt-1 font-bold uppercase tracking-wider">War Room Strategy</p>
                            </div>
                            <button onClick={() => setSelectedTicker(null)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors"><X size={20} className="text-gray-600 hover:text-gray-900" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                            
                            {/* Hidden Data Display */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 bg-gray-100 rounded-xl border border-gray-200 shadow-sm">
                                    <p className="text-[10px] text-gray-600 uppercase font-bold mb-1">Avg Buy Price</p>
                                    <p className="text-[19px] text-gray-900 font-sans tracking-tight font-medium">
                                        {metrics.holdings.find((h:any) => h.ticker === selectedTicker) 
                                            ? `${currencySymbol}${(metrics.holdings.find((h:any) => h.ticker === selectedTicker).invested / metrics.holdings.find((h:any) => h.ticker === selectedTicker).qty).toFixed(2)}` 
                                            : '-'}
                                    </p>
                                </div>
                                <div className="p-4 bg-gray-100 rounded-xl border border-gray-200 shadow-sm">
                                    <p className="text-[10px] text-gray-600 uppercase font-bold mb-1">Last Buy Price</p>
                                    <div className="flex flex-col">
                                        <p className="text-[19px] text-gray-900 font-sans tracking-tight font-medium">
                                            {getStockData(selectedTicker).latestBuyPrice ? `${currencySymbol}${getStockData(selectedTicker).latestBuyPrice.toFixed(2)}` : '-'}
                                        </p>
                                        <p className="text-[10px] text-gray-500">
                                            {getStockData(selectedTicker).latestBuyDate || '-'}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-100 rounded-xl border border-gray-200 shadow-sm">
                                    <p className="text-[10px] text-gray-600 uppercase font-bold mb-1">Portfolio Weight</p>
                                    <p className="text-[19px] text-gray-900 font-sans tracking-tight font-medium">
                                        {getStockData(selectedTicker).weight.toFixed(2)}%
                                    </p>
                                </div>
                            </div>

                            {/* Strategy Inputs */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b-2 border-gray-200 pb-2">
                                    <Target size={16} className="text-accent-cyan" /> Strategic Levels
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">Intrinsic Value (Fair Price)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-500 text-sm">{currencySymbol}</span>
                                            <input 
                                                type="number" 
                                                value={editForm.intrinsic}
                                                onChange={(e) => setEditForm({...editForm, intrinsic: parseFloat(e.target.value)})}
                                                className="w-full bg-white border border-gray-200 focus:border-accent-cyan rounded-xl py-2.5 pl-8 pr-4 text-gray-900 outline-none transition-colors shadow-sm focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] font-sans tracking-tight font-medium text-[15px]"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-1">
                                            Current MoS: <span className={getStockData(selectedTicker).mos > 0 ? "text-success" : "text-danger"}>{getStockData(selectedTicker).mos.toFixed(1)}%</span>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">Desired Buy Price (Target)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-gray-500 text-sm">{currencySymbol}</span>
                                            <input 
                                                type="number" 
                                                value={modalEffectiveTarget}
                                                readOnly={modalHasSupports}
                                                onChange={(e) => !modalHasSupports && setEditForm({...editForm, desiredEntry: parseFloat(e.target.value)})}
                                                className={`w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-8 pr-4 font-sans tracking-tight text-[15px] outline-none transition-colors shadow-sm border border-gray-200 focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] ${modalHasSupports ? 'text-accent-cyan cursor-not-allowed opacity-80' : 'text-gray-900 focus:border-accent-cyan'}`}
                                            />
                                            {modalHasSupports && <Lock size={12} className="absolute right-3 top-3.5 text-gray-500" />}
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-1">
                                            {modalHasSupports ? 'Auto-selected from S(x)' : 'Manual Entry'} • Call Ratio: <span className={modalEffectiveTarget / (priceData[selectedTicker.toUpperCase()] || 1) > 0.95 ? "text-success" : "text-gray-400"}>
                                                {((modalEffectiveTarget / (priceData[selectedTicker.toUpperCase()] || 1)).toFixed(2))}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                     <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">S1 (Support 1)</label>
                                        <input type="number" value={editForm.s1 || ''} onChange={(e) => setEditForm({...editForm, s1: parseFloat(e.target.value)})} placeholder="0" className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl p-2.5 text-gray-900 outline-none shadow-sm focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] font-sans tracking-tight font-medium text-[15px]" />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">S2 (Support 2)</label>
                                        <input type="number" value={editForm.s2 || ''} onChange={(e) => setEditForm({...editForm, s2: parseFloat(e.target.value)})} placeholder="0" className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl p-2.5 text-gray-900 outline-none shadow-sm focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] font-sans tracking-tight font-medium text-[15px]" />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">S3 (Support 3)</label>
                                        <input type="number" value={editForm.s3 || ''} onChange={(e) => setEditForm({...editForm, s3: parseFloat(e.target.value)})} placeholder="0" className="w-full bg-white border border-gray-200 focus:border-primary rounded-xl p-2.5 text-gray-900 outline-none shadow-sm focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] font-sans tracking-tight font-medium text-[15px]" />
                                     </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">Research / Docs Link</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={editForm.link}
                                            onChange={(e) => setEditForm({...editForm, link: e.target.value})}
                                            placeholder="https://docs.google.com/..."
                                            className="flex-1 bg-white border border-gray-200 focus:border-accent-cyan rounded-xl py-2.5 px-4 text-sm text-gray-900 outline-none transition-colors shadow-sm focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px]"
                                        />
                                        {editForm.link && (
                                            <a 
                                                href={editForm.link} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="p-2.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-accent-cyan transition-colors shadow-sm hover:shadow-lg transition-all"
                                            >
                                                <ExternalLink size={20} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t-2 border-gray-200 bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setSelectedTicker(null)}
                                className="px-6 py-2 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveModal}
                                className="px-6 py-2 bg-primary hover:bg-primary-glow text-white rounded-xl text-sm font-bold shadow-md border border-gray-200 hover:shadow-lg transition-all flex items-center gap-2"
                            >
                                <Save size={16} /> Save Strategy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
