
import React, { useState, useMemo } from 'react';
import { Receipt, Search, History, ArrowUpRight, ArrowDownRight, Plus, X } from 'lucide-react';
import { TradeType, Trade } from '../../types';

interface TransactionsViewProps {
  trades: any[];
  metrics: any;
  currencySymbol: string;
  onAddTrade: (trade: Trade) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ trades, metrics, currencySymbol, onAddTrade }) => {
    const [tradeSearch, setTradeSearch] = useState('');
    const [tradeFilterType, setTradeFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'SPLIT' | 'BONUS'>('ALL');
    
    // Add Trade State
    const [isAdding, setIsAdding] = useState(false);
    const [newTrade, setNewTrade] = useState<Partial<Trade>>({
        date: new Date().toISOString().split('T')[0],
        type: TradeType.SPLIT,
        quantity: 0,
        price: 0,
        ticker: ''
    });

    const handleAddTrade = () => {
        if (!newTrade.ticker || !newTrade.date || !newTrade.quantity) {
            alert("Please fill all fields");
            return;
        }
        
        const trade: Trade = {
            id: Math.random().toString(36).substr(2, 9),
            date: newTrade.date!,
            ticker: newTrade.ticker.toUpperCase(),
            type: newTrade.type as TradeType,
            quantity: Number(newTrade.quantity),
            price: 0, // Split/Bonus usually 0 price impact on cash
            netAmount: 0,
            status: 'COMPLETED'
        };
        
        onAddTrade(trade);
        setIsAdding(false);
        setNewTrade({
            date: new Date().toISOString().split('T')[0],
            type: TradeType.SPLIT,
            quantity: 0,
            price: 0,
            ticker: ''
        });
    };

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
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in flex flex-col h-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="p-4 md:p-6 border-b-2 border-black flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Receipt className="w-5 h-5 text-accent-pink" />
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Trade History</h2>
                        <p className="text-xs text-gray-600 mt-1">
                            {filteredTrades.length} trades 
                            {Math.abs(displayedPnL) > 0 && (
                                <span className={`ml-2 font-bold ${displayedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                    (P&L: {displayedPnL > 0 ? '+' : '-'}{currencySymbol}{Math.abs(displayedPnL).toLocaleString()})
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="Search Ticker..."
                            value={tradeSearch}
                            onChange={(e) => setTradeSearch(e.target.value)}
                            className="bg-white border-2 border-black text-gray-900 text-sm rounded-lg py-2 pl-9 pr-4 focus:ring-1 focus:ring-primary outline-none w-full md:w-48 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                        />
                        </div>
                        <div className="flex items-center justify-between md:justify-start bg-gray-100 rounded-lg p-1 border-2 border-black">
                        {['ALL', 'BUY', 'SELL', 'SPLIT', 'BONUS'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setTradeFilterType(type as any)}
                                className={`flex-1 md:flex-none px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                                    tradeFilterType === type 
                                    ? 'bg-primary text-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                        </div>
                        <button 
                            onClick={() => setIsAdding(!isAdding)}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-black font-bold text-sm transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] ${isAdding ? 'bg-gray-200 text-gray-900' : 'bg-accent-pink text-white'}`}
                        >
                            {isAdding ? <X size={16} /> : <Plus size={16} />}
                            <span className="hidden md:inline">{isAdding ? 'Cancel' : 'Add Action'}</span>
                        </button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-gray-50 p-4 border-b-2 border-black grid grid-cols-1 md:grid-cols-5 gap-4 items-end animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                        <input 
                            type="date" 
                            value={newTrade.date}
                            onChange={(e) => setNewTrade({...newTrade, date: e.target.value})}
                            className="w-full p-2 border-2 border-black rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Ticker</label>
                        <input 
                            type="text" 
                            placeholder="e.g. RELIANCE"
                            value={newTrade.ticker}
                            onChange={(e) => setNewTrade({...newTrade, ticker: e.target.value.toUpperCase()})}
                            className="w-full p-2 border-2 border-black rounded-lg text-sm font-mono uppercase"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
                        <select 
                            value={newTrade.type}
                            onChange={(e) => setNewTrade({...newTrade, type: e.target.value as TradeType})}
                            className="w-full p-2 border-2 border-black rounded-lg text-sm"
                        >
                            <option value={TradeType.SPLIT}>Split</option>
                            <option value={TradeType.BONUS}>Bonus</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                            {newTrade.type === TradeType.SPLIT ? 'Split Factor (e.g. 2 for 1:2)' : 'Bonus Shares Qty'}
                        </label>
                        <input 
                            type="number" 
                            placeholder="0"
                            value={newTrade.quantity || ''}
                            onChange={(e) => setNewTrade({...newTrade, quantity: parseFloat(e.target.value)})}
                            className="w-full p-2 border-2 border-black rounded-lg text-sm font-mono"
                        />
                    </div>
                    <button 
                        onClick={handleAddTrade}
                        className="w-full p-2 bg-success text-white font-bold rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                        Save Action
                    </button>
                </div>
            )}
            
            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                {filteredTrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10">
                            <History className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-sm">No trades found.</p>
                    </div>
                ) : (
                    <table className="w-full text-left min-w-[800px] md:min-w-full">
                        <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-md border-b-2 border-black">
                            <tr>
                                <th className="px-4 md:px-6 py-4">Date</th>
                                <th className="px-4 md:px-6 py-4">Ticker</th>
                                <th className="px-4 md:px-6 py-4">Type</th>
                                <th className="px-4 md:px-6 py-4 text-right">Qty</th>
                                <th className="px-4 md:px-6 py-4 text-right">Price</th>
                                <th className="px-4 md:px-6 py-4 text-right">Net Amount</th>
                                <th className="px-4 md:px-6 py-4 text-right">Realized P&L</th>
                                <th className="px-4 md:px-6 py-4 text-right">% Return</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black">
                            {filteredTrades.map((trade) => {
                                const perf = metrics.tradePerformance[trade.id];
                                const hasPerf = trade.type === TradeType.SELL && perf;
                                
                                const roi = hasPerf && perf.investAmount > 0 
                                    ? (perf.realizedPnL / perf.investAmount) * 100 
                                    : 0;

                                return (
                                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-700 group">
                                        <td className="px-4 md:px-6 py-4 font-mono text-gray-600 whitespace-nowrap">{trade.date}</td>
                                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">{trade.ticker}</td>
                                        <td className="px-4 md:px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border-2 ${
                                                trade.type === TradeType.BUY 
                                                ? 'bg-blue-100 text-blue-700 border-blue-500' 
                                                : trade.type === TradeType.SELL
                                                ? 'bg-orange-100 text-orange-700 border-orange-500'
                                                : 'bg-purple-100 text-purple-700 border-purple-500'
                                            }`}>
                                                {trade.type}
                                            </span>
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-right font-mono">
                                            {trade.type === TradeType.SPLIT ? `x${trade.quantity}` : trade.quantity}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-right font-mono">
                                            {trade.price > 0 ? `${currencySymbol}${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className={`px-4 md:px-6 py-4 text-right font-mono font-medium ${trade.netAmount > 0 ? 'text-success' : trade.netAmount < 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                                            {trade.netAmount !== 0 ? `${trade.netAmount > 0 ? '+' : ''}${currencySymbol}${Math.abs(trade.netAmount).toLocaleString()}` : '-'}
                                        </td>
                                        
                                        <td className="px-4 md:px-6 py-4 text-right font-mono font-bold">
                                            {hasPerf ? (
                                                <span className={`flex items-center justify-end gap-1 ${perf.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {perf.realizedPnL > 0 ? '+' : '-'}{currencySymbol}{Math.abs(perf.realizedPnL).toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        
                                        <td className="px-4 md:px-6 py-4 text-right font-mono font-bold">
                                                {hasPerf ? (
                                                <span className={`flex items-center justify-end gap-1 ${roi >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {roi >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                    {Math.abs(roi).toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
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
