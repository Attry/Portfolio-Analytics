
import React from 'react';
import { useConsolidatedData } from '../../hooks/useConsolidatedData';
import { Wallet, TrendingUp, Landmark, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, RefreshCw, Gem } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CartoonBackground } from '../CartoonBackground';

export const NetWorthView: React.FC = () => {
    const { 
        netAssetValue, 
        netCash, 
        netReturnAbs, 
        netReturnPct, 
        allocations, 
        isLoading, 
        conversionRate 
    } = useConsolidatedData();

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-gray-400">Consolidating Assets...</p>
                </div>
            </div>
        );
    }

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    
    // Ensure % is a valid number for display
    const displayPct = isNaN(netReturnPct) ? 0 : netReturnPct;

    return (
        <div className="space-y-8 animate-fade-in pb-20 relative">
             <CartoonBackground icon={Gem} pattern="grid" color="text-accent-pink" opacity="opacity-[0.03]" />
             {/* Header */}
             <div className="flex justify-between items-end border-b-2 border-black pb-4 relative z-10">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <Landmark className="text-accent-cyan" size={32} />
                        Net Worth Overview
                    </h1>
                    <p className="text-gray-600 mt-2">Consolidated view of all asset classes</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">EUR/INR Rate</p>
                    <p className="text-lg font-mono font-bold text-accent-pink">₹{conversionRate.toFixed(2)}</p>
                </div>
             </div>

             {/* Key Metrics Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {/* NAV */}
                 <div className="glass-card rounded-2xl p-6 relative overflow-hidden group border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                     <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50"></div>
                     <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Net Asset Value</p>
                        <h2 className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(netAssetValue)}</h2>
                        <div className="mt-4 flex items-center text-xs text-gray-600 gap-1">
                            <Wallet size={14} /> Total Portfolio Value
                        </div>
                     </div>
                 </div>

                 {/* Net Cash */}
                 <div className="glass-card rounded-2xl p-6 relative overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                     <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Net Cash</p>
                        <h2 className="text-3xl font-bold text-success mt-2">{formatCurrency(netCash)}</h2>
                        <div className="mt-4 flex items-center text-xs text-gray-600 gap-1">
                            <Landmark size={14} /> Available Liquidity
                        </div>
                     </div>
                 </div>

                 {/* Net Returns % */}
                 <div className="glass-card rounded-2xl p-6 relative overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                     <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Net Returns (%)</p>
                        <div className="flex items-end gap-2 mt-2">
                             <h2 className={`text-3xl font-bold ${displayPct >= 0 ? 'text-accent-cyan' : 'text-danger'}`}>
                                 {displayPct >= 0 ? '+' : ''}{displayPct.toFixed(2)}%
                             </h2>
                             {displayPct >= 0 ? <ArrowUpRight className="text-accent-cyan mb-1" /> : <ArrowDownRight className="text-danger mb-1" />}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-4">of Net Invested + Cash</p>
                     </div>
                 </div>

                 {/* Net Returns Abs */}
                 <div className="glass-card rounded-2xl p-6 relative overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                     <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Net Returns (Abs)</p>
                        <h2 className={`text-3xl font-bold mt-2 ${netReturnAbs >= 0 ? 'text-accent-cyan' : 'text-danger'}`}>
                             {netReturnAbs >= 0 ? '+' : ''}{formatCurrency(netReturnAbs)}
                        </h2>
                        <div className="mt-4 flex items-center text-xs text-gray-600 gap-1">
                            <TrendingUp size={14} /> Total P&L
                        </div>
                     </div>
                 </div>
             </div>

             {/* Allocation Section */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Chart */}
                 <div className="glass-card rounded-2xl p-8 lg:col-span-2 border-2 border-black flex flex-col shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-primary" /> Asset Allocation
                    </h3>
                    <div className="flex-1 min-h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={allocations}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="black"
                                    strokeWidth={2}
                                >
                                    {allocations.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#000', borderWidth: '2px', borderRadius: '8px', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
                                    itemStyle={{ color: '#000', fontWeight: 'bold' }}
                                    formatter={(value: number, name: string) => [
                                        `${formatCurrency(value)} (${((value / netAssetValue) * 100).toFixed(2)}%)`, 
                                        name
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Allocation Details */}
                 <div className="glass-card rounded-2xl p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Breakdown</h3>
                    <div className="space-y-4">
                        {allocations.map((item) => {
                            const pct = netAssetValue > 0 ? (item.value / netAssetValue) * 100 : 0;
                            return (
                                <div key={item.name} className="p-4 bg-white rounded-xl border-2 border-black hover:translate-x-[2px] hover:translate-y-[2px] transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full border border-black" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">{pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden border border-black">
                                        <div 
                                            className="h-full rounded-full transition-all duration-1000" 
                                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                                        ></div>
                                    </div>
                                    <p className="text-right text-xs text-gray-600 mt-2 font-mono">
                                        {formatCurrency(item.value)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                 </div>
             </div>
        </div>
    );
};
