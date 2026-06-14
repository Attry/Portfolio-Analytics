import React, { useState, useMemo } from 'react';
import { Receipt, Search, History, ArrowUpRight, ArrowDownRight, Plus, X, ShieldAlert, Pencil, Trash2, Save, XCircle } from 'lucide-react';
import { TradeType, Trade } from '../../types';

interface TransactionsViewProps {
  trades: any[];
  baseTrades?: any[];
  baseSummary?: { charges: number; realizedPnL: number; dividends: number };
  metrics: any;
  currencySymbol: string;
  onAddTrade: (trade: Trade, cashStrategy?: any) => void;
  onUpdateTrade: (trade: Trade, cashStrategy?: any) => void;
  onDeleteTrade: (id: string, cashStrategy?: any) => void;
  onConvertToBase?: () => void;
  onClearBase?: () => void;
  priceData?: Record<string, number>;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ 
    trades, 
    baseTrades = [], 
    baseSummary,
    metrics, 
    currencySymbol, 
    onAddTrade,
    onUpdateTrade,
    onDeleteTrade,
    onConvertToBase,
    onClearBase,
    priceData = {}
}) => {
    const [tradeSearch, setTradeSearch] = useState('');
    const [tradeFilterType, setTradeFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'SPLIT' | 'BONUS'>('ALL');
    
    // Add Trade State
    const [isAdding, setIsAdding] = useState(false);
    const [newTrade, setNewTrade] = useState<Partial<Trade>>({
        date: new Date().toISOString().split('T')[0],
        type: TradeType.BUY, // Default to BUY now
        quantity: 0,
        price: 0,
        ticker: ''
    });

    const [showManualInput, setShowManualInput] = useState(false);
    const [manualCashInput, setManualCashInput] = useState('');
    const [cashPrompt, setCashPrompt] = useState<{
        isOpen: boolean;
        netAmountDiff: number;
        callback: (strategy: any) => void;
    } | null>(null);

    const handleAddTrade = () => {
        if (!newTrade.ticker || !newTrade.date || !newTrade.quantity) {
            alert("Please fill all fields");
            return;
        }
        
        const type = newTrade.type as TradeType;
        const qty = Number(newTrade.quantity);
        const price = (type === TradeType.BUY || type === TradeType.SELL) ? Number(newTrade.price || 0) : 0;
        
        if ((type === TradeType.BUY || type === TradeType.SELL) && price <= 0) {
            alert("Please enter a valid price greater than 0");
            return;
        }

        let netAmount = 0;
        if (type === TradeType.BUY) {
            netAmount = -(qty * price);
        } else if (type === TradeType.SELL) {
            netAmount = (qty * price);
        }

        const trade: Trade = {
            id: Math.random().toString(36).substr(2, 9),
            date: newTrade.date!,
            ticker: newTrade.ticker.toUpperCase().trim(),
            type: type,
            quantity: qty,
            price: price,
            netAmount: netAmount,
            status: 'COMPLETED'
        };
        
        let actualNetAmount = netAmount;
        if (type === TradeType.BUY || type === TradeType.SELL) {
            const fee = Math.abs(qty * price) * 0.001;
            actualNetAmount = type === TradeType.BUY ? netAmount - fee : netAmount - fee;
        }
        
        setCashPrompt({
            isOpen: true,
            netAmountDiff: actualNetAmount,
            callback: (strategy) => {
                onAddTrade(trade, strategy);
                setIsAdding(false);
                setNewTrade({
                    date: new Date().toISOString().split('T')[0],
                    type: TradeType.BUY,
                    quantity: 0,
                    price: 0,
                    ticker: ''
                });
                setCashPrompt(null);
            }
        });
    };

    const filteredTrades = useMemo(() => {
        const allTrades = [...(baseTrades || []), ...(trades || [])];
        return allTrades.filter(t => {
            const matchesSearch = t.ticker.toLowerCase().includes(tradeSearch.toLowerCase());
            const matchesType = tradeFilterType === 'ALL' || t.type === tradeFilterType;
            return matchesSearch && matchesType;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [trades, baseTrades, tradeSearch, tradeFilterType]);

    const displayedPnL = useMemo(() => {
        return filteredTrades.reduce((acc, t) => {
            const perf = metrics.tradePerformance[t.id];
            return acc + (perf ? perf.realizedPnL : 0);
        }, 0);
    }, [filteredTrades, metrics.tradePerformance]);

    const allTickers = useMemo(() => {
        const tradeTickers = [...baseTrades, ...trades].map(t => t.ticker);
        const marketTickers = Object.keys(priceData);
        return Array.from(new Set([...tradeTickers, ...marketTickers])).sort();
    }, [baseTrades, trades, priceData]);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Trade>>({});

    const handleStartEdit = (trade: Trade) => {
        setEditingId(trade.id);
        setEditFormData({ ...trade });
    };

    const handleSaveEdit = () => {
        if (!editFormData.id || !editFormData.ticker || !editFormData.date || !editFormData.quantity) {
            alert("Please fill all necessary fields");
            return;
        }

        const type = editFormData.type as TradeType;
        const qty = Number(editFormData.quantity);
        const price = (type === TradeType.BUY || type === TradeType.SELL) ? Number(editFormData.price || 0) : 0;
        
        let netAmount = 0;
        if (type === TradeType.BUY) {
            netAmount = -(qty * price);
        } else if (type === TradeType.SELL) {
            netAmount = (qty * price);
        }

        const updatedTrade: Trade = {
            id: editFormData.id,
            date: editFormData.date,
            ticker: editFormData.ticker.toUpperCase().trim(),
            type: type,
            quantity: qty,
            price: price,
            netAmount: netAmount,
            status: editFormData.status || 'COMPLETED'
        };

        let actualNetAmount = netAmount;
        const oldTrade = trades.find(t => t.id === editFormData.id) || baseTrades.find(t => t.id === editFormData.id);
        let oldActualNetAmount = oldTrade ? oldTrade.netAmount : 0;
        
        if (type === TradeType.BUY || type === TradeType.SELL) {
            const fee = Math.abs(qty * price) * 0.001;
            actualNetAmount = type === TradeType.BUY ? netAmount - fee : netAmount - fee;
        }

        const netAmountDiff = actualNetAmount - oldActualNetAmount;
        
        setCashPrompt({
            isOpen: true,
            netAmountDiff: netAmountDiff,
            callback: (strategy) => {
                onUpdateTrade(updatedTrade, strategy);
                setEditingId(null);
                setCashPrompt(null);
            }
        });
    };

    const handleDeleteTrade = (tradeId: string) => {
        const oldTrade = trades.find(t => t.id === tradeId) || baseTrades.find(t => t.id === tradeId);
        let oldActualNetAmount = oldTrade ? oldTrade.netAmount : 0;
        
        const netAmountDiff = -oldActualNetAmount; // Inverse because we are deleting
        
        setCashPrompt({
            isOpen: true,
            netAmountDiff: netAmountDiff,
            callback: (strategy) => {
                onDeleteTrade(tradeId, strategy);
                setCashPrompt(null);
            }
        });
    };

    return (
        <>
            {cashPrompt?.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-200 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-gray-900 border-b-2 border-primary/20 pb-2">Update Cash Balance?</h3>
                        <p className="mb-6 text-gray-700 font-medium">Apply transaction net change (<span className={`font-bold ${cashPrompt.netAmountDiff < 0 ? 'text-danger' : 'text-success'}`}>{cashPrompt.netAmountDiff < 0 ? 'Deduct' : 'Add'} {currencySymbol}{Math.abs(cashPrompt.netAmountDiff).toLocaleString()}</span>) to your overall cash balance?</p>
                        
                        {!showManualInput ? (
                            <div className="space-y-3">
                                <button className="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-success hover:text-white font-bold transition-all shadow-sm hover:shadow-lg" onClick={() => cashPrompt.callback({ type: 'AUTO' })}>
                                    1. Automatically adjust cash
                                </button>
                                <button className="w-full text-left p-3 border border-gray-200 rounded-xl hover:bg-accent-cyan hover:text-black font-bold transition-all shadow-sm hover:shadow-lg" onClick={() => setShowManualInput(true)}>
                                    2. Manually enter cash balance
                                </button>
                                <button className="w-full text-left p-3 border-2 border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 font-bold transition-all" onClick={() => cashPrompt.callback({ type: 'KEEP' })}>
                                    3. No, keep cash same
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">New Cash Balance</label>
                                    <input 
                                        type="number" 
                                        value={manualCashInput} 
                                        onChange={e => setManualCashInput(e.target.value)} 
                                        className="w-full p-3 border border-gray-200 rounded-xl text-[19px] shadow-sm focus:outline-none focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all font-sans tracking-tight font-medium"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <button className="flex-1 bg-success text-white py-3 rounded-xl font-bold border border-gray-200 shadow-sm hover:shadow-lg transition-all" onClick={() => {
                                        cashPrompt.callback({ type: 'MANUAL', manualValue: Number(manualCashInput) });
                                        setShowManualInput(false);
                                        setManualCashInput('');
                                    }}>Save</button>
                                    <button className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-bold border border-gray-200 shadow-sm hover:shadow-lg transition-all" onClick={() => {
                                        setShowManualInput(false);
                                        setManualCashInput('');
                                    }}>Back</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="glass-card rounded-2xl overflow-hidden animate-fade-in flex flex-col h-full border border-gray-200 shadow-md">
            <div className="p-4 md:p-6 border-b-2 border-gray-200 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shrink-0">
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
                            className="bg-white border border-gray-200 text-gray-900 text-sm rounded-lg py-2 pl-9 pr-4 focus:ring-1 focus:ring-primary outline-none w-full md:w-48 shadow-sm focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                        />
                        </div>
                        <div className="flex items-center justify-between md:justify-start bg-gray-100 rounded-lg p-1 border border-gray-200">
                        {['ALL', 'BUY', 'SELL', 'SPLIT', 'BONUS'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setTradeFilterType(type as any)}
                                className={`flex-1 md:flex-none px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                                    tradeFilterType === type 
                                    ? 'bg-primary text-white border border-gray-200 shadow-sm border border-gray-200' 
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                        </div>
                        <button 
                            onClick={() => setIsAdding(!isAdding)}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 font-bold text-sm transition-all shadow-sm border border-gray-200 hover:shadow-lg transition-all ${isAdding ? 'bg-gray-200 text-gray-900' : 'bg-accent-pink text-white'}`}
                        >
                            {isAdding ? <X size={16} /> : <Plus size={16} />}
                            <span className="hidden md:inline">{isAdding ? 'Cancel' : 'Add Manual Transaction'}</span>
                        </button>
                </div>
            </div>


            {isAdding && (
                <div className="bg-gray-50 p-4 border-b-2 border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                        <input 
                            type="date" 
                            value={newTrade.date}
                            onChange={(e) => setNewTrade({...newTrade, date: e.target.value})}
                            className="w-full p-2 border border-gray-200 rounded-lg text-[15px] bg-white text-gray-900 font-sans tracking-tight font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Ticker</label>
                        <input 
                            type="text" 
                            list="ticker-options"
                            placeholder="e.g. RELIANCE"
                            value={newTrade.ticker}
                            onChange={(e) => setNewTrade({...newTrade, ticker: e.target.value.toUpperCase()})}
                            className="w-full p-2 border border-gray-200 rounded-lg text-[15px] uppercase bg-white text-gray-900 font-sans tracking-tight font-medium"
                        />
                        <datalist id="ticker-options">
                            {allTickers.map(t => <option key={t} value={t} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
                        <select 
                            value={newTrade.type}
                            onChange={(e) => {
                                const val = e.target.value as TradeType;
                                setNewTrade({...newTrade, type: val, price: 0, quantity: 0});
                            }}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 font-bold"
                        >
                            <option value={TradeType.BUY}>BUY</option>
                            <option value={TradeType.SELL}>SELL</option>
                            <option value={TradeType.SPLIT}>SPLIT (Manual conversion)</option>
                            <option value={TradeType.BONUS}>BONUS (Manual shares)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">
                            {newTrade.type === TradeType.SPLIT 
                                ? 'Split Factor (e.g. 2 for 1:2)' 
                                : newTrade.type === TradeType.BONUS 
                                ? 'Bonus Shares Qty' 
                                : 'Quantity'}
                        </label>
                        <input 
                            type="number" 
                            placeholder="0"
                            value={newTrade.quantity || ''}
                            onChange={(e) => setNewTrade({...newTrade, quantity: parseFloat(e.target.value)})}
                            className="w-full p-2 border border-gray-200 rounded-lg text-[15px] bg-white text-gray-900 font-sans tracking-tight font-medium"
                        />
                    </div>
                    {(newTrade.type === TradeType.BUY || newTrade.type === TradeType.SELL) ? (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Price per Share</label>
                            <input 
                                type="number" 
                                placeholder="0.00"
                                value={newTrade.price || ''}
                                onChange={(e) => setNewTrade({...newTrade, price: parseFloat(e.target.value)})}
                                className="w-full p-2 border border-gray-200 rounded-lg text-[15px] bg-white text-gray-900 font-sans tracking-tight font-medium"
                            />
                        </div>
                    ) : (
                        <div className="hidden md:block opacity-0 h-0 w-0"></div>
                    )}
                    <button 
                        onClick={handleAddTrade}
                        className="w-full p-2 bg-success text-white font-bold rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all"
                    >
                        Save Action
                    </button>
                </div>
            )}
            
            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar w-full">
                {filteredTrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10">
                            <History className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-sm">No trades found.</p>
                    </div>
                ) : (
                    <table className="w-full text-left min-w-[900px] md:min-w-full">
                        <thead className="bg-gray-100 text-gray-600 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-md border-b-2 border-gray-200">
                            <tr>
                                <th className="px-4 md:px-6 py-4 w-32">Date</th>
                                <th className="px-4 md:px-6 py-4">Ticker</th>
                                <th className="px-4 md:px-6 py-4">Type</th>
                                <th className="px-4 md:px-6 py-4 text-right">Qty</th>
                                <th className="px-4 md:px-6 py-4 text-right">Price</th>
                                <th className="px-4 md:px-6 py-4 text-right">Net Amount</th>
                                <th className="px-4 md:px-6 py-4 text-right">Realized P&L</th>
                                <th className="px-4 md:px-6 py-4 text-right">% Return</th>
                                <th className="px-4 md:px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200 bg-white">
                            {filteredTrades.map((trade) => {
                                const perf = metrics.tradePerformance[trade.id];
                                const hasPerf = trade.type === TradeType.SELL && perf;
                                
                                const roi = hasPerf && perf.investAmount > 0 
                                    ? (perf.realizedPnL / perf.investAmount) * 100 
                                    : 0;

                                const isBaseTrade = baseTrades.some(bt => bt.id === trade.id);

                                if (editingId === trade.id) {
                                    return (
                                        <tr key={trade.id} className="bg-primary/5 hover:bg-primary/10 transition-colors text-sm group">
                                            <td className="px-2 md:px-4 py-2">
                                                <input 
                                                    type="date" 
                                                    value={editFormData.date || ''}
                                                    onChange={e => setEditFormData({...editFormData, date: e.target.value})}
                                                    className="w-full border border-gray-200 rounded p-1 text-[13px] font-sans tracking-tight font-medium"
                                                />
                                            </td>
                                            <td className="px-2 md:px-4 py-2">
                                                <input 
                                                    type="text" 
                                                    list="ticker-options"
                                                    value={editFormData.ticker || ''}
                                                    onChange={e => setEditFormData({...editFormData, ticker: e.target.value.toUpperCase()})}
                                                    className="w-full border border-gray-200 rounded p-1 text-[13px] uppercase font-sans tracking-tight font-medium"
                                                />
                                            </td>
                                            <td className="px-2 md:px-4 py-2">
                                                <select 
                                                    value={editFormData.type || ''}
                                                    onChange={e => setEditFormData({...editFormData, type: e.target.value as TradeType, price: 0})}
                                                    className="w-full border border-gray-200 rounded p-1 text-xs font-bold"
                                                >
                                                    <option value={TradeType.BUY}>BUY</option>
                                                    <option value={TradeType.SELL}>SELL</option>
                                                    <option value={TradeType.SPLIT}>SPLIT</option>
                                                    <option value={TradeType.BONUS}>BONUS</option>
                                                </select>
                                            </td>
                                            <td className="px-2 md:px-4 py-2 text-right">
                                                <input 
                                                    type="number" 
                                                    value={editFormData.quantity || ''}
                                                    onChange={e => setEditFormData({...editFormData, quantity: parseFloat(e.target.value)})}
                                                    className="w-full border border-gray-200 rounded p-1 text-[13px] text-right font-sans tracking-tight font-medium"
                                                />
                                            </td>
                                            <td className="px-2 md:px-4 py-2 text-right">
                                                {(editFormData.type === TradeType.BUY || editFormData.type === TradeType.SELL) ? (
                                                    <input 
                                                        type="number" 
                                                        value={editFormData.price || ''}
                                                        onChange={e => setEditFormData({...editFormData, price: parseFloat(e.target.value)})}
                                                        className="w-full border border-gray-200 rounded p-1 text-[13px] text-right font-sans tracking-tight font-medium"
                                                    />
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td colSpan={3} className="px-2 md:px-4 py-2 text-right text-xs text-gray-500 italic">
                                                Preview: Will be recalculated automatically.
                                            </td>
                                            <td className="px-2 md:px-4 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={handleSaveEdit} className="p-1.5 bg-success text-white rounded hover:bg-success/80 transition shadow-sm border border-gray-200 hover:shadow-lg transition-all" title="Save Edit">
                                                        <Save size={14} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition shadow-sm border border-gray-200 hover:shadow-lg transition-all" title="Cancel">
                                                        <XCircle size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-700 group">
                                        <td className="px-4 md:px-6 py-4 text-gray-600 whitespace-nowrap font-sans tracking-tight font-medium text-[15px]">{trade.date}</td>
                                        <td className="px-4 md:px-6 py-4 font-bold text-gray-900">
                                            {trade.ticker}
                                        </td>
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
                                        <td className="px-4 md:px-6 py-4 text-right font-sans tracking-tight font-medium">
                                            {trade.type === TradeType.SPLIT ? `x${trade.quantity}` : trade.quantity}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-right font-sans tracking-tight font-medium">
                                            {trade.price > 0 ? `${currencySymbol}${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className={`px-4 md:px-6 py-4 text-right font-sans tracking-tight text-[15px] font-medium ${trade.netAmount < 0 ? 'text-gray-600' : 'text-gray-900'}`}>
                                            {trade.netAmount !== 0 ? `${trade.netAmount < 0 ? '-' : ''}${currencySymbol}${Math.abs(trade.netAmount).toLocaleString()}` : '-'}
                                        </td>
                                        
                                        <td className="px-4 md:px-6 py-4 text-right font-bold font-sans tracking-tight">
                                            {hasPerf ? (
                                                <span className={`flex items-center justify-end gap-1 ${perf.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {perf.realizedPnL > 0 ? '+' : '-'}{currencySymbol}{Math.abs(perf.realizedPnL).toLocaleString()}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        
                                        <td className="px-4 md:px-6 py-4 text-right font-bold font-sans tracking-tight">
                                                {hasPerf ? (
                                                <span className={`flex items-center justify-end gap-1 ${roi >= 0 ? 'text-success' : 'text-danger'}`}>
                                                    {roi >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                    {Math.abs(roi).toFixed(2)}%
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleStartEdit(trade)} className="p-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition shadow-sm border border-gray-200 hover:shadow-lg transition-all" title="Edit Trade">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => handleDeleteTrade(trade.id)} className="p-1.5 bg-danger/10 text-danger rounded hover:bg-danger/20 transition shadow-sm border border-gray-200 hover:shadow-lg transition-all" title="Delete Trade">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
        </>
    );
};
