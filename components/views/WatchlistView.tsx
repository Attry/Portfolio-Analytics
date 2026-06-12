
import React, { useState, useMemo } from 'react';
import { ListChecks, Plus, Search, X, ExternalLink, Trash2, Lock, Code, Copy, Check, Telescope } from 'lucide-react';
import { WatchlistItem } from '../../types';
import { generateGoogleAppsScript } from '../../utils/scriptGenerator';
import { CartoonBackground } from '../CartoonBackground';

interface WatchlistViewProps {
  watchlist: WatchlistItem[];
  priceData: Record<string, number>;
  currencySymbol: string;
  context: string;
  onAdd: (ticker: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof WatchlistItem, value: any) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ watchlist, priceData, currencySymbol, context, onAdd, onRemove, onUpdate }) => {
    const [watchlistSearch, setWatchlistSearch] = useState('');
    const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);
    const [showScriptModal, setShowScriptModal] = useState(false);
    const [generatedScript, setGeneratedScript] = useState('');
    const [copied, setCopied] = useState(false);

    const availableTickers = useMemo(() => Object.keys(priceData).sort(), [priceData]);
    const filteredWatchlistSearch = useMemo(() => availableTickers.filter(t => t.toLowerCase().includes(watchlistSearch.toLowerCase())), [availableTickers, watchlistSearch]);

    const handleGenerateScript = () => {
        const script = generateGoogleAppsScript(watchlist, '', context);
        setGeneratedScript(script);
        setShowScriptModal(true);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedScript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in relative min-h-[500px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <CartoonBackground icon={Telescope} pattern="dots" color="text-accent-pink" opacity="opacity-[0.03]" />
            {/* Header with z-30 to ensure dropdown appears over table */}
            <div className="p-4 md:p-6 border-b-2 border-black flex flex-col md:flex-row gap-4 items-start md:items-center justify-between relative z-30">
                <div className="flex items-center gap-4">
                    <ListChecks className="w-5 h-5 text-accent-pink" />
                    <h2 className="text-lg font-bold text-gray-900">Watchlist</h2>
                </div>
                
                <div className="relative w-full md:w-auto flex gap-2">
                    <button 
                        onClick={handleGenerateScript}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 border-2 border-black rounded-lg text-sm font-bold transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                        title="Generate Google Apps Script for Email Alerts"
                    >
                        <Code size={16} /> <span className="hidden md:inline">Alert Script</span>
                    </button>

                    {!isAddingWatchlist ? (
                        <button 
                            onClick={() => setIsAddingWatchlist(true)}
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-glow text-white border-2 border-black rounded-lg text-sm font-bold transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                        >
                            <Plus size={16} /> Add Stock
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 animate-fade-in w-full md:w-auto">
                            <div className="relative flex-1 md:flex-none">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Search Market Data..."
                                    value={watchlistSearch}
                                    onChange={(e) => setWatchlistSearch(e.target.value)}
                                    className="bg-white border-2 border-black text-gray-900 text-sm rounded-lg py-2 pl-9 pr-4 focus:ring-1 focus:ring-primary outline-none w-full md:w-64 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                                />
                                {watchlistSearch && (
                                    <div className="absolute top-full mt-2 left-0 w-full bg-white border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-60 overflow-y-auto z-50">
                                        {filteredWatchlistSearch.length > 0 ? (
                                            filteredWatchlistSearch.map(ticker => (
                                                <button
                                                    key={ticker}
                                                    onClick={() => { onAdd(ticker); setIsAddingWatchlist(false); setWatchlistSearch(''); }}
                                                    className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm text-gray-700 hover:text-gray-900 border-b border-gray-200 last:border-0"
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
                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto relative z-10">
                {watchlist.length === 0 ? (
                    <div className="text-center py-20">
                        <ListChecks className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 text-sm">Your watchlist is empty.</p>
                        {Object.keys(priceData).length === 0 && (
                            <p className="text-xs text-orange-600 mt-2">Note: You need to sync Market Data first to add stocks.</p>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-left min-w-[900px] md:min-w-full">
                        <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-md border-b-2 border-black">
                            <tr>
                                <th className="px-4 md:px-6 py-4">Name</th>
                                <th className="px-4 md:px-6 py-4 text-right">Current Price</th>
                                <th className="px-4 md:px-6 py-4 text-right">Desired Entry</th>
                                <th className="px-4 md:px-6 py-4 text-right">Intrinsic Value</th>
                                <th className="px-4 md:px-6 py-4 text-right">Margin of Safety</th>
                                <th className="px-4 md:px-6 py-4 text-right">Call Ratio</th>
                                <th className="px-2 py-4 text-center">S1</th>
                                <th className="px-2 py-4 text-center">S2</th>
                                <th className="px-2 py-4 text-center">S3</th>
                                <th className="px-4 md:px-6 py-4 text-center">Call</th>
                                <th className="px-4 md:px-6 py-4 text-center">Report</th>
                                <th className="px-4 md:px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black">
                            {watchlist.map(item => {
                                // Fix: Ensure uppercase key lookup for price
                                const currentPrice = priceData[item.ticker.toUpperCase()] || 0;
                                
                                // Determine Effective Desired Entry (Closest S level)
                                const supports = [item.s1, item.s2, item.s3].filter(s => s && s > 0) as number[];
                                let effectiveDesiredEntry = item.desiredEntryPrice || 0;
                                const hasSupports = supports.length > 0;

                                if (hasSupports) {
                                    if (currentPrice > 0) {
                                        // Find support closest to current price
                                        effectiveDesiredEntry = supports.reduce((prev, curr) => 
                                            Math.abs(curr - currentPrice) < Math.abs(prev - currentPrice) ? curr : prev
                                        );
                                    } else {
                                        effectiveDesiredEntry = supports[0];
                                    }
                                }

                                const mos = item.intrinsicValue > 0 
                                    ? (1 - (currentPrice / item.intrinsicValue)) * 100 
                                    : 0;
                                
                                const callRatio = currentPrice > 0 
                                    ? effectiveDesiredEntry / currentPrice 
                                    : 0;

                                let callStatus = 'Expensive';
                                let callColor = 'text-danger bg-danger/10 border-danger';
                                
                                // Logic:
                                // Accumulate: Ratio > 0.95
                                // Monitor: 0.88 < Ratio <= 0.95
                                // Expensive: Ratio <= 0.88 OR Intrinsic Value <= 0
                                
                                if (item.intrinsicValue > 0) {
                                    if (callRatio > 0.95) {
                                        callStatus = 'Accumulate';
                                        callColor = 'text-success bg-success/10 border-success';
                                    } else if (callRatio > 0.88) {
                                        callStatus = 'Monitor';
                                        callColor = 'text-orange-600 bg-orange-100 border-orange-500';
                                    } else {
                                        callStatus = 'Expensive';
                                        callColor = 'text-danger bg-danger/10 border-danger';
                                    }
                                } else {
                                    callStatus = 'Expensive';
                                    callColor = 'text-danger bg-danger/10 border-danger';
                                }

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-sm group">
                                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{item.ticker}</td>
                                        <td className="px-4 md:px-6 py-4 text-right font-mono text-gray-700">
                                            {currentPrice > 0 ? `${currencySymbol}${currentPrice.toLocaleString()}` : <span className="text-gray-400">N/A</span>}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-right relative">
                                            <input 
                                                type="number" 
                                                value={hasSupports ? effectiveDesiredEntry : (item.desiredEntryPrice || '')}
                                                onChange={(e) => !hasSupports && onUpdate(item.id, 'desiredEntryPrice', parseFloat(e.target.value))}
                                                placeholder="0"
                                                readOnly={hasSupports}
                                                className={`w-20 md:w-24 bg-transparent border-b-2 text-right outline-none font-mono ${hasSupports ? 'text-accent-cyan border-transparent cursor-not-allowed opacity-80' : 'text-gray-900 border-black focus:border-primary'}`}
                                                title={hasSupports ? "Auto-selected from Support Levels" : "Manual Entry"}
                                            />
                                            {hasSupports && (
                                                <Lock size={10} className="absolute top-1/2 -translate-y-1/2 right-2 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-right">
                                            <input 
                                                type="number" 
                                                value={item.intrinsicValue || ''}
                                                onChange={(e) => onUpdate(item.id, 'intrinsicValue', parseFloat(e.target.value))}
                                                placeholder="0"
                                                className="w-20 md:w-24 bg-transparent border-b-2 border-black focus:border-primary text-right outline-none text-gray-900 font-mono"
                                            />
                                        </td>
                                        <td className={`px-4 md:px-6 py-4 text-right font-mono font-bold ${mos > 0 ? 'text-success' : 'text-danger'}`}>
                                            {item.intrinsicValue > 0 ? `${mos.toFixed(2)}%` : '-'}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-right font-mono text-gray-700">
                                            {callRatio.toFixed(2)}
                                        </td>
                                        
                                        {/* Support Levels */}
                                        <td className="px-2 py-4 text-center">
                                            <input type="number" value={item.s1 || ''} onChange={(e) => onUpdate(item.id, 's1', parseFloat(e.target.value))} placeholder="S1" className="w-12 bg-transparent border-b-2 border-black focus:border-primary text-center outline-none text-gray-600 text-xs font-mono" />
                                        </td>
                                        <td className="px-2 py-4 text-center">
                                            <input type="number" value={item.s2 || ''} onChange={(e) => onUpdate(item.id, 's2', parseFloat(e.target.value))} placeholder="S2" className="w-12 bg-transparent border-b-2 border-black focus:border-primary text-center outline-none text-gray-600 text-xs font-mono" />
                                        </td>
                                        <td className="px-2 py-4 text-center">
                                            <input type="number" value={item.s3 || ''} onChange={(e) => onUpdate(item.id, 's3', parseFloat(e.target.value))} placeholder="S3" className="w-12 bg-transparent border-b-2 border-black focus:border-primary text-center outline-none text-gray-600 text-xs font-mono" />
                                        </td>

                                        <td className="px-4 md:px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border-2 ${callColor}`}>
                                                {callStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <input 
                                                    type="text"
                                                    value={item.researchLink || ''}
                                                    onChange={(e) => onUpdate(item.id, 'researchLink', e.target.value)}
                                                    placeholder="Link"
                                                    className="w-16 md:w-24 bg-transparent border-b-2 border-black focus:border-primary text-xs outline-none text-gray-600"
                                                />
                                                {item.researchLink && (
                                                    <a href={item.researchLink} target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:text-primary">
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-center">
                                            <button 
                                                onClick={() => onRemove(item.id)}
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
            {/* Script Modal */}
            {showScriptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="glass-card border-2 border-black rounded-2xl w-full max-w-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col max-h-[85vh] bg-white">
                        <div className="p-6 border-b-2 border-black flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <Code size={20} className="text-primary" /> Email Alert Script
                                </h3>
                                <p className="text-xs text-gray-600 mt-1">Copy this code to your Google Sheet's Apps Script editor.</p>
                            </div>
                            <button onClick={() => setShowScriptModal(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors"><X size={20} className="text-gray-600 hover:text-gray-900" /></button>
                        </div>
                        
                        <div className="p-0 overflow-hidden flex-1 relative bg-gray-900">
                            <textarea 
                                readOnly
                                value={generatedScript}
                                className="w-full h-full bg-gray-900 text-gray-300 font-mono text-xs p-6 outline-none resize-none custom-scrollbar"
                            />
                            <button 
                                onClick={copyToClipboard}
                                className="absolute top-4 right-4 px-4 py-2 bg-primary hover:bg-primary-glow text-white rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 transition-all border-2 border-black"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copied!' : 'Copy Code'}
                            </button>
                        </div>

                        <div className="p-4 border-t-2 border-black bg-gray-50 text-xs text-gray-600">
                            <strong>Instructions:</strong>
                            <ol className="list-decimal list-inside mt-1 space-y-1">
                                <li>Open your Google Sheet linked to this app.</li>
                                <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
                                <li>Paste the code above (replace existing content).</li>
                                <li>Save and run the <code>setupTrigger</code> function once.</li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
