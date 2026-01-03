
import React, { useState, useMemo } from 'react';
import { ListChecks, Plus, Search, X, ExternalLink, Trash2 } from 'lucide-react';
import { WatchlistItem } from '../../types';

interface WatchlistViewProps {
  watchlist: WatchlistItem[];
  priceData: Record<string, number>;
  currencySymbol: string;
  onAdd: (ticker: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof WatchlistItem, value: any) => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({ watchlist, priceData, currencySymbol, onAdd, onRemove, onUpdate }) => {
    const [watchlistSearch, setWatchlistSearch] = useState('');
    const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);

    const availableTickers = useMemo(() => Object.keys(priceData).sort(), [priceData]);
    const filteredWatchlistSearch = useMemo(() => availableTickers.filter(t => t.toLowerCase().includes(watchlistSearch.toLowerCase())), [availableTickers, watchlistSearch]);

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
                                        {filteredWatchlistSearch.length > 0 ? (
                                            filteredWatchlistSearch.map(ticker => (
                                                <button
                                                    key={ticker}
                                                    onClick={() => { onAdd(ticker); setIsAddingWatchlist(false); setWatchlistSearch(''); }}
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
                                                onChange={(e) => onUpdate(item.id, 'desiredEntryPrice', parseFloat(e.target.value))}
                                                placeholder="0"
                                                className="w-24 bg-transparent border-b border-white/10 focus:border-accent-pink text-right outline-none text-white font-mono"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <input 
                                                type="number" 
                                                value={item.intrinsicValue || ''}
                                                onChange={(e) => onUpdate(item.id, 'intrinsicValue', parseFloat(e.target.value))}
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
                                                    onChange={(e) => onUpdate(item.id, 'researchLink', e.target.value)}
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
        </div>
    );
};
