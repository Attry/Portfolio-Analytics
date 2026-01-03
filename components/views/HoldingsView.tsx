
import React from 'react';
import { Wallet } from 'lucide-react';

interface HoldingsViewProps {
  metrics: any;
  currencySymbol: string;
}

export const HoldingsView: React.FC<HoldingsViewProps> = ({ metrics, currencySymbol }) => {
    return (
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-in flex flex-col h-full">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-gray-400 text-xs uppercase font-bold tracking-wider sticky top-0 z-10 backdrop-blur-xl">
                        <tr>
                            <th className="px-6 py-4">Stock</th>
                            <th className="px-6 py-4 text-right">Qty</th>
                            <th className="px-6 py-4 text-right">Avg Price</th>
                            <th className="px-6 py-4 text-right">Invested</th>
                            <th className="px-6 py-4 text-right">Current Value</th>
                            <th className="px-6 py-4 text-right">Position</th>
                            <th className="px-6 py-4 text-right">Holding Days</th>
                            <th className="px-6 py-4 text-right">Realized P&L</th>
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
                                <td className="px-6 py-4 text-gray-300 text-right font-mono">{isCash ? '-' : `${h.daysHeld} Days`}</td>
                                <td className={`px-6 py-4 text-right font-mono font-bold ${h.realized >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {isCash ? '-' : `${h.realized >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(h.realized).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                </td>
                                <td className={`px-6 py-4 text-right font-mono font-bold ${h.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {isCash ? '-' : (
                                        <span>
                                            {h.unrealized >= 0 ? '+' : '-'}{currencySymbol}{Math.abs(h.unrealized).toLocaleString('en-IN', { maximumFractionDigits: 0 })} 
                                            <span className="ml-1 text-xs opacity-80">
                                                ({h.netReturnPct >= 0 ? '+' : ''}{h.netReturnPct.toFixed(2)}%)
                                            </span>
                                        </span>
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
