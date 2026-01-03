
import React, { useMemo, useState } from 'react';
import { Wallet, Briefcase, TrendingUp, Activity, PieChart as PieChartIcon, BarChart3, Layers, Plus, Coins, X, Landmark } from 'lucide-react';
import { StatsCard } from '../StatsCard';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { AssetContext } from '../../types';

const COLORS = ['#7042f8', '#00e5ff', '#ff2975', '#00ffa3', '#facc15', '#fb923c', '#a855f7'];

interface DashboardViewProps {
  metrics: any;
  currencySymbol: string;
  context: AssetContext;
  onAddSalary?: (account: string, amount: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ metrics, currencySymbol, context, onAddSalary }) => {
    
    const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
    const [salaryAccount, setSalaryAccount] = useState('');
    const [salaryAmount, setSalaryAmount] = useState('');

    const handleAddSalary = () => {
        if (!salaryAccount || !salaryAmount || !onAddSalary) return;
        onAddSalary(salaryAccount, parseFloat(salaryAmount));
        setIsSalaryModalOpen(false);
        setSalaryAccount('');
        setSalaryAmount('');
    };

    const netTotalReturns = metrics.grossRealizedPnL + metrics.unrealizedPnL + metrics.totalDividends - metrics.charges;
    
    // 1. Net ROI (Return on Investment) -> Denominator: Total Invested
    const netROI = metrics.totalInvested > 0 ? (netTotalReturns / metrics.totalInvested) * 100 : 0;

    // 2. Net Return (Portfolio Return) -> Denominator: Total Invested + Cash
    const totalCapital = metrics.totalInvested + metrics.cashBalance;
    const netReturnPct = totalCapital > 0 ? (netTotalReturns / totalCapital) * 100 : 0;
    
    const displayReturnPct = (context === 'MUTUAL_FUNDS' || context === 'GOLD_ETF')
        ? (metrics.totalInvested > 0 ? (metrics.unrealizedPnL / metrics.totalInvested) * 100 : 0)
        : netReturnPct; // Use Net Return (with Cash) for the main Current Value card
    
    const tickerDistribution = useMemo(() => {
        if (metrics.holdings.length > 0) {
            return metrics.holdings
                .map((h: any) => ({ name: h.ticker || h.account, value: h.marketValue || h.value || 0 }))
                .sort((a: any, b: any) => b.value - a.value);
        }
        return [];
    }, [metrics.holdings]);

    const diversificationCount = useMemo(() => {
        return metrics.holdings.filter((h: any) => h.ticker !== 'CASH BALANCE').length;
    }, [metrics.holdings]);

    // Simplified view for Gold ETF
    if (context === 'GOLD_ETF') {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                     <StatsCard 
                        title="XIRR" 
                        value={`${metrics.xirr.toFixed(2)}%`} 
                        icon={<Activity />} 
                        isPositive={metrics.xirr >= 0}
                    />
                </div>
            </div>
        );
    }

    // Cash Equivalents View
    if (context === 'CASH_EQUIVALENTS') {
        // Collect existing accounts for datalist
        const accounts = Array.from(new Set(metrics.holdings.map((h:any) => h.account)));

        return (
            <div className="space-y-6 animate-fade-in relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="glass-card rounded-2xl p-8 flex items-center justify-between border border-white/5 relative overflow-hidden">
                             <div className="absolute inset-0 bg-gradient-to-r from-success/10 to-transparent pointer-events-none"></div>
                             <div>
                                 <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Total Cash Value</p>
                                 <h1 className="text-5xl font-bold text-white tracking-tight">{currencySymbol}{metrics.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h1>
                             </div>
                             <div className="p-4 bg-success/10 rounded-2xl border border-success/20">
                                 <Coins className="w-10 h-10 text-success" />
                             </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col justify-center">
                        <button 
                            onClick={() => setIsSalaryModalOpen(true)}
                            className="w-full py-6 bg-primary hover:bg-primary-glow text-white rounded-2xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(112,66,248,0.3)] hover:shadow-[0_0_30px_rgba(112,66,248,0.5)] flex items-center justify-center gap-3 border border-primary/50"
                        >
                            <Plus className="w-6 h-6" /> Add Salary
                        </button>
                    </div>
                </div>

                {/* Salary Modal */}
                {isSalaryModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
                        <div className="bg-[#151925] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
                            <button 
                                onClick={() => setIsSalaryModalOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-success" /> Add to Cash
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Account Name</label>
                                    <input 
                                        list="accounts" 
                                        type="text" 
                                        value={salaryAccount}
                                        onChange={(e) => setSalaryAccount(e.target.value)}
                                        placeholder="e.g. HDFC Salary, Savings..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                    <datalist id="accounts">
                                        {accounts.map((acc: any) => <option key={acc} value={acc} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount ({currencySymbol})</label>
                                    <input 
                                        type="number" 
                                        value={salaryAmount}
                                        onChange={(e) => setSalaryAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 transition-colors font-mono text-lg"
                                    />
                                </div>
                                <button 
                                    onClick={handleAddSalary}
                                    className="w-full py-3 bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-xl font-bold mt-2 transition-all"
                                >
                                    Confirm Add
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const isEquityContext = context === 'INDIAN_EQUITY' || context === 'INTERNATIONAL_EQUITY';

    return (
        <div className="space-y-6 animate-fade-in">
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${isEquityContext ? 'xl:grid-cols-6' : 'xl:grid-cols-5'} gap-4`}>
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
                
                {/* Net Absolute Return - Only for Equity Contexts */}
                {isEquityContext && (
                    <StatsCard 
                        title="Net Absolute Return" 
                        value={`${netTotalReturns >= 0 ? '+' : ''}${currencySymbol}${Math.abs(netTotalReturns).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                        icon={<Coins />} 
                        isPositive={netTotalReturns >= 0}
                        change={`${netROI.toFixed(2)}%`}
                        changeLabel="Net ROI"
                    />
                )}

                <StatsCard 
                    title="Unrealized P&L" 
                    value={`${currencySymbol}${metrics.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} 
                    icon={<TrendingUp />} 
                    isPositive={metrics.unrealizedPnL >= 0}
                />
                <StatsCard 
                    title="XIRR" 
                    value={`${metrics.xirr.toFixed(2)}%`} 
                    icon={<Activity />} 
                    isPositive={metrics.xirr >= 0}
                />
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
