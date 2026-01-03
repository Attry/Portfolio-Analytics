
import React from 'react';
import { Wallet, Trash2 } from 'lucide-react';
import { AssetContext } from '../../types';

interface HoldingsViewProps {
  metrics: any;
  currencySymbol: string;
  context: AssetContext;
  onUpdateHolding?: (id: string, field: string, value: any) => void;
  onDeleteHolding?: (id: string) => void;
}

export const HoldingsView: React.FC<HoldingsViewProps> = ({ metrics, currencySymbol, context, onUpdateHolding, onDeleteHolding }) => {
    
    if (context === 'CASH_EQUIVALENTS') {
        return (
            <div className="glass-card rounded-2xl overflow-hidden animate-fade-in flex flex-col h-full">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 backdrop-blur-xl">
                            <tr>
                                <th className="px-6 py-4">Account</th>
                                <th className="px-6 py-4 text-right">Value ({currencySymbol})</th>
                                <th className="px-6 py-4 text-center w-16">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {metrics.holdings.map((h: any) => (
                                <tr key={h.id} className="hover:bg-white/5 transition-colors text-sm group">
                                    <td className="px-6 py-4">
                                        <input 
                                            type="text" 
                                            value={h.account}
                                            onChange={(e) => onUpdateHolding && onUpdateHolding(h.id, 'account', e.target.value)}
                                            className="bg-transparent border-b border-transparent focus:border-primary/50 outline-none text-white font-bold w-full transition-colors"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <input 
                                            type="number" 
                                            value={h.value}
                                            onChange={(e) => onUpdateHolding && onUpdateHolding(h.id, 'value', parseFloat(e.target.value))}
                                            className="bg-transparent border-b border-transparent focus:border-primary/50 outline-none text-success font-mono font-bold text-right w-full transition-colors"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => onDeleteHolding && onDeleteHolding(h.id)}
                                            className="p-2 text-gray-500 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Account"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {metrics.holdings.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="text-center py-10 text-gray-500">
                                        No cash accounts found. Use "Add Salary" on Dashboard to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const showRealized = context !== 'MUTUAL_FUNDS' && context !== 'GOLD_ETF';

    return (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in flex flex-col h-full">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 backdrop-blur-xl">
                        <tr>
                            <th className="px-6 py-4">{(context === 'MUTUAL_FUNDS' || context === 'GOLD_ETF') ? 'Fund' : 'Stock'}</th>
                            <th className="px-6 py-4 text-right">Qty</th>
                            <th className="px-6 py-4 text-right">{(context === 'MUTUAL_FUNDS' || context === 'GOLD_ETF') ? 'Avg Price' : 'Avg Price'}</th>
                            <th className="px-6 py-4 text-right">Invested</th>
                            <th className="px-6 py-4 text-right">Current Value</th>
                            <th className="px-6 py-4 text-right">Position</th>
                            <th className="px-6 py-4 text-right">Holding Days</th>
                            {showRealized && <th className="px-6 py-4 text-right">Realized P&L</th>}
                            <th className="px-6 py-4 text-right">Unrealized P&L (%)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {metrics.holdings.map((h: any, i: number) => {
                            const isCash = h.ticker === 'CASH BALANCE';
                            return (
                            <tr key={i} className={`hover:bg-white/5 transition-colors text-sm group ${isCash ? 'bg-white/5' : ''}`}>
                                <td className="px-6 py-4 font-bold text-white group-hover:text-primary-glow transition-colors whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {isCash && <Wallet className="w-4 h-4 text-gray-400" />}
                                        {h.ticker}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-300 text-right font-mono">{isCash ? '-' : h.qty}</td>
                                <td className="px-6 py-4 text-gray-300 text-right font-mono">{isCash ? '-' : `${currencySymbol}${(h.invested / h.qty).toFixed(2)}`}</td>
                                <td className="px-6 py-4 text-gray-300 text-right font-mono">{currencySymbol}{h.invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                <td className="px-6 py-4 text-white font-medium text-right font-mono">{currencySymbol}{h.marketValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                <td className="px-6 py-4 text-gray-300 text-right font-mono">{h.portfolioPct.toFixed(2)}%</td>
                                <td className="px-6 py-4 text-gray-300 text-right font-mono">{isCash || h.daysHeld === 0 ? '-' : `${h.daysHeld} Days`}</td>
                                {showRealized && (
                                    <td className={`px-6 py-4 text-right font-mono font-bold ${h.realized === 0 ? 'text-gray-400' : (h.realized > 0 ? 'text-success' : 'text-danger')}`}>
                                        {(isCash || h.realized === 0) ? '-' : `${h.realized > 0 ? '+' : '-'}${currencySymbol}${Math.abs(h.realized).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                    </td>
                                )}
                                <td className={`px-6 py-4 text-right font-mono font-bold ${h.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {isCash ? '-' : (
                                        <div className="flex flex-col items-end">
                                            <span>
                                                {h.unrealized >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(h.unrealized).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </span>
                                            <span className="text-xs opacity-80 mt-1">
                                                ({h.netReturnPct >= 0 ? '+' : ''}{h.netReturnPct.toFixed(2)}%)
                                            </span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
