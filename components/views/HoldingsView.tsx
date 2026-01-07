
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
                    <table className="w-full text-left border-collapse min-w-[350px] md:min-w-full">
                        <thead className="bg-surface text-gray-400 text-[10px] md:text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-2 py-3 md:px-6 md:py-4">Account</th>
                                <th className="px-2 py-3 md:px-6 md:py-4 text-right">Value ({currencySymbol})</th>
                                <th className="px-2 py-3 md:px-6 md:py-4 text-center w-12 md:w-16">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {metrics.holdings.map((h: any) => (
                                <tr key={h.id} className="hover:bg-white/5 transition-colors text-xs md:text-sm group">
                                    <td className="px-2 py-2 md:px-6 md:py-4">
                                        <input 
                                            type="text" 
                                            value={h.account}
                                            onChange={(e) => onUpdateHolding && onUpdateHolding(h.id, 'account', e.target.value)}
                                            className="bg-transparent border-b border-transparent focus:border-primary/50 outline-none text-white font-bold w-full transition-colors"
                                        />
                                    </td>
                                    <td className="px-2 py-2 md:px-6 md:py-4 text-right">
                                        <input 
                                            type="number" 
                                            value={h.value}
                                            onChange={(e) => onUpdateHolding && onUpdateHolding(h.id, 'value', parseFloat(e.target.value))}
                                            className="bg-transparent border-b border-transparent focus:border-primary/50 outline-none text-success font-mono font-bold text-right w-full transition-colors"
                                        />
                                    </td>
                                    <td className="px-2 py-2 md:px-6 md:py-4 text-center">
                                        <button 
                                            onClick={() => onDeleteHolding && onDeleteHolding(h.id)}
                                            className="p-1.5 md:p-2 text-gray-500 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                            title="Delete Account"
                                        >
                                            <Trash2 size={14} className="md:w-4 md:h-4" />
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
                <table className="w-full text-left border-collapse min-w-[600px] md:min-w-full">
                    <thead className="bg-surface text-gray-400 text-[10px] md:text-xs uppercase font-bold tracking-wider sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="px-2 py-3 md:px-6 md:py-4 min-w-[100px]">
                                {(context === 'MUTUAL_FUNDS' || context === 'GOLD_ETF') ? 'Fund' : 'Stock'}
                            </th>
                            <th className="px-2 py-3 md:px-6 md:py-4 text-right">Qty</th>
                            <th className="px-2 py-3 md:px-6 md:py-4 text-right">Avg / Cur</th>
                            <th className="px-2 py-3 md:px-6 md:py-4 text-right">Inv</th>
                            <th className="px-2 py-3 md:px-6 md:py-4 text-right">Cur Val</th>
                            <th className="px-2 py-3 md:px-6 md:py-4 text-right">% Port</th>
                            <th className="px-2 py-3 md:px-6 md:py-4 text-right">Days</th>
                            {showRealized && <th className="px-2 py-3 md:px-6 md:py-4 text-right">R. P&L</th>}
                            <th className="px-2 py-3 md:px-6 md:py-4 text-right">Unr. P&L</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {metrics.holdings.map((h: any, i: number) => {
                            const isCash = h.ticker === 'CASH BALANCE';
                            const avgPrice = h.qty > 0 ? h.invested / h.qty : 0;
                            const curPrice = h.qty > 0 ? h.marketValue / h.qty : 0;
                            
                            return (
                            <tr key={i} className={`hover:bg-white/5 transition-colors text-xs md:text-sm group ${isCash ? 'bg-white/5' : ''}`}>
                                <td className="px-2 py-2 md:px-6 md:py-4 font-bold text-white group-hover:text-primary-glow transition-colors whitespace-nowrap">
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                        {isCash && <Wallet className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />}
                                        <span className="truncate max-w-[120px] md:max-w-none block" title={h.ticker}>{h.ticker}</span>
                                    </div>
                                </td>
                                <td className="px-2 py-2 md:px-6 md:py-4 text-gray-300 text-right font-mono">{isCash ? '-' : h.qty}</td>
                                <td className="px-2 py-2 md:px-6 md:py-4 text-right font-mono">
                                    {isCash ? '-' : (
                                        <>
                                            <span className="text-gray-300">{currencySymbol}{avgPrice.toFixed(0)}</span>
                                            <span className="text-gray-600 mx-1">/</span>
                                            <span className="text-white font-medium">{currencySymbol}{curPrice.toFixed(0)}</span>
                                        </>
                                    )}
                                </td>
                                <td className="px-2 py-2 md:px-6 md:py-4 text-gray-300 text-right font-mono">{currencySymbol}{h.invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                <td className="px-2 py-2 md:px-6 md:py-4 text-white font-medium text-right font-mono">{currencySymbol}{h.marketValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                <td className="px-2 py-2 md:px-6 md:py-4 text-gray-300 text-right font-mono">{h.portfolioPct.toFixed(1)}%</td>
                                <td className="px-2 py-2 md:px-6 md:py-4 text-gray-300 text-right font-mono">{isCash || h.daysHeld === 0 ? '-' : `${h.daysHeld}d`}</td>
                                {showRealized && (
                                    <td className={`px-2 py-2 md:px-6 md:py-4 text-right font-mono font-bold ${h.realized === 0 ? 'text-gray-400' : (h.realized > 0 ? 'text-success' : 'text-danger')}`}>
                                        {(isCash || h.realized === 0) ? '-' : `${h.realized > 0 ? '+' : '-'}${Math.abs(h.realized).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                    </td>
                                )}
                                <td className={`px-2 py-2 md:px-6 md:py-4 text-right font-mono font-bold ${h.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {isCash ? '-' : (
                                        <div className="flex flex-col items-end">
                                            <span>
                                                {h.unrealized >= 0 ? '+' : '-'}{Math.abs(h.unrealized).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </span>
                                            <span className="text-[9px] md:text-xs opacity-80 mt-0.5">
                                                ({h.netReturnPct >= 0 ? '+' : ''}{h.netReturnPct.toFixed(1)}%)
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
