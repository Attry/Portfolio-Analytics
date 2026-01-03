
import React from 'react';
import { Wallet } from 'lucide-react';

interface HoldingsViewProps {
  metrics: any;
  currencySymbol: string;
}

export const HoldingsView: React.FC<HoldingsViewProps> = ({ metrics, currencySymbol }) => {
    return (
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase">Stock</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Qty</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Avg Price</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Invested</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Current Value</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Position</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">Holding Days</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">P&L</th>
                            <th className="p-4 text-xs font-bold text-gray-400 uppercase text-right">% Return</th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.holdings.map((h: any, i: number) => {
                            const isCash = h.ticker === 'CASH BALANCE';
                            return (
                            <tr key={i} className={`border-b border-white/5 hover:bg-white/5 transition-colors group ${isCash ? 'bg-white/5' : ''}`}>
                                <td className="p-4 font-medium text-white group-hover:text-primary-glow transition-colors flex items-center gap-2">
                                    {isCash && <Wallet className="w-4 h-4 text-gray-400" />}
                                    {h.ticker}
                                </td>
                                <td className="p-4 text-gray-300 text-right">{isCash ? '-' : h.qty}</td>
                                <td className="p-4 text-gray-300 text-right">{isCash ? '-' : `${currencySymbol}${(h.invested / h.qty).toFixed(2)}`}</td>
                                <td className="p-4 text-gray-300 text-right">{currencySymbol}{h.invested.toLocaleString()}</td>
                                <td className="p-4 text-white font-medium text-right">{currencySymbol}{h.marketValue.toLocaleString()}</td>
                                <td className="p-4 text-gray-300 text-right">{h.portfolioPct.toFixed(2)}%</td>
                                <td className="p-4 text-gray-300 text-right">{isCash ? '-' : `${h.daysHeld} Days`}</td>
                                <td className={`p-4 text-right font-bold ${h.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {isCash ? '-' : `${h.unrealized >= 0 ? '+' : ''}${currencySymbol}${h.unrealized.toLocaleString()}`}
                                </td>
                                <td className={`p-4 text-right font-bold ${h.netReturnPct >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {isCash ? '-' : `${h.netReturnPct.toFixed(2)}%`}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
