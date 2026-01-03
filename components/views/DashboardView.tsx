
import React, { useMemo } from 'react';
import { Wallet, Briefcase, TrendingUp, Activity, PieChart as PieChartIcon, BarChart3, Layers } from 'lucide-react';
import { StatsCard } from '../StatsCard';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { AssetContext } from '../../types';

const COLORS = ['#7042f8', '#00e5ff', '#ff2975', '#00ffa3', '#facc15', '#fb923c', '#a855f7'];

interface DashboardViewProps {
  metrics: any;
  currencySymbol: string;
  context: AssetContext;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ metrics, currencySymbol, context }) => {
    const netTotalReturns = metrics.grossRealizedPnL + metrics.unrealizedPnL + metrics.totalDividends - metrics.charges;
    const totalCapitalForReturns = metrics.totalInvested + metrics.cashBalance;
    const netReturnPct = totalCapitalForReturns > 0 ? (netTotalReturns / totalCapitalForReturns) * 100 : 0;
    
    // For Mutual Funds, Return % is just based on Unrealized P&L vs Invested as realized P&L is 0
    const displayReturnPct = context === 'MUTUAL_FUNDS' 
        ? (metrics.totalInvested > 0 ? (metrics.unrealizedPnL / metrics.totalInvested) * 100 : 0)
        : netReturnPct;

    const tickerDistribution = useMemo(() => {
        if (metrics.holdings.length > 0) {
            return metrics.holdings
                .map((h: any) => ({ name: h.ticker, value: h.marketValue || 0 }))
                .sort((a: any, b: any) => b.value - a.value);
        }
        return [];
    }, [metrics.holdings]);

    const diversificationCount = useMemo(() => {
        return metrics.holdings.filter((h: any) => h.ticker !== 'CASH BALANCE').length;
    }, [metrics.holdings]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatsCard 
                    title="Current Value" 
                    value={`${currencySymbol}${metrics.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                    icon={<Wallet />}
                    change={`${displayReturnPct.toFixed(2)}%`}
                    changeLabel="Net Return"
                    isPositive={displayReturnPct >= 0}
                />
                <StatsCard 
                    title="Total Invested" 
                    value={`${currencySymbol}${metrics.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                    icon={<Briefcase />} 
                />
                <StatsCard 
                    title="Unrealized P&L" 
                    value={`${currencySymbol}${metrics.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                    icon={<TrendingUp />} 
                    isPositive={metrics.unrealizedPnL >= 0}
                />
                 {context !== 'MUTUAL_FUNDS' && (
                    <StatsCard 
                        title="XIRR" 
                        value={`${metrics.xirr.toFixed(2)}%`} 
                        icon={<Activity />} 
                        isPositive={metrics.xirr >= 0}
                    />
                 )}
                <StatsCard 
                    title="Diversification" 
                    value={`${diversificationCount}`} 
                    icon={<Layers />} 
                    changeLabel={context === 'MUTUAL_FUNDS' ? "Funds" : "Stocks"}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Allocation Chart */}
                <div className="glass-card rounded-2xl p-6 lg:col-span-1 border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-accent-cyan" /> Allocation
                    </h3>
                    <div className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={tickerDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {tickerDistribution.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1e1e2d', borderColor: '#333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: number, name: any) => {
                                        const percent = metrics.currentValue > 0 ? (value / metrics.currentValue) * 100 : 0;
                                        // The second argument in the return array is the label displayed in the tooltip
                                        return [`${currencySymbol}${value.toLocaleString()} (${percent.toFixed(2)}%)`, name];
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Summary Stats - Only show for Equities */}
                {context !== 'MUTUAL_FUNDS' && (
                    <div className="glass-card rounded-2xl p-6 lg:col-span-2 border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary-glow" /> Performance Summary
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Realized P&L</p>
                                <p className={`text-xl font-bold mt-1 ${metrics.grossRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {currencySymbol}{metrics.grossRealizedPnL.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Dividends</p>
                                <p className="text-xl font-bold mt-1 text-accent-cyan">
                                    {currencySymbol}{metrics.totalDividends.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Charges & Taxes</p>
                                <p className="text-xl font-bold mt-1 text-danger">
                                    {currencySymbol}{metrics.charges.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Cash Balance</p>
                                <p className="text-xl font-bold mt-1 text-accent-cyan">
                                    {currencySymbol}{metrics.cashBalance.toLocaleString()}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Net Realized P&L</p>
                                <p className={`text-xl font-bold mt-1 ${metrics.netRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {currencySymbol}{metrics.netRealizedPnL.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
