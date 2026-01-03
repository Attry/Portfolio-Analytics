
import React, { useState, useMemo } from 'react';
import { Receipt, Search, History, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TradeType } from '../../types';

interface TransactionsViewProps {
  trades: any[];
  metrics: any;
  currencySymbol: string;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ trades, metrics, currencySymbol }) => {
    const [tradeSearch, setTradeSearch] = useState('');
    const [tradeFilterType, setTradeFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');

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

    return (
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
    );
};
