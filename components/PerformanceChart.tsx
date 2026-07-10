import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  LineChart as LineChartIcon, TrendingUp, Sparkles, 
  Trash2, RefreshCw, Check, Info, Award, Calendar
} from 'lucide-react';
import { PortfolioSnapshot } from '../types';

interface PerformanceChartProps {
  snapshots: PortfolioSnapshot[];
  onTakeSnapshot: () => void;
  onSeedDemo: () => void;
  onClearSnapshots: () => void;
  netAssetValue: number;
  currencySymbol?: string;
  contextName?: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  snapshots,
  onTakeSnapshot,
  onSeedDemo,
  onClearSnapshots,
  netAssetValue,
  currencySymbol = '₹',
  contextName = 'Consolidated'
}) => {
  const [activeMetric, setActiveMetric] = useState<'both' | 'xirr' | 'twr'>('both');
  const [activeTimeframe, setActiveTimeframe] = useState<'1w' | '1m' | '3m' | '1y' | 'all'>('all');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const formatCurrency = (val: number) => {
    const locale = currencySymbol === '€' ? 'en-US' : 'en-IN';
    return `${currencySymbol}${val.toLocaleString(locale, { maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleTakeSnapshot = () => {
    try {
      // In the parent, we made sure this always runs
      onTakeSnapshot();
      
      if (netAssetValue === 0) {
        setFeedback({
          message: `Saved snapshot successfully, but ${contextName === 'Consolidated' ? 'portfolio' : contextName} currently has a value of ${currencySymbol}0. Add data or seed demo history to see performance trends.`,
          type: 'info'
        });
      } else {
        const valType = contextName === 'Consolidated' ? 'Net Worth' : `${contextName} Valuation`;
        setFeedback({
          message: `Snapshot taken successfully! Logged today's point: ${valType} of ${formatCurrency(netAssetValue)}`,
          type: 'success'
        });
      }
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({
        message: "Failed to capture snapshot.",
        type: 'error'
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleSeedDemo = () => {
    try {
      onSeedDemo();
      setFeedback({
        message: "Successfully seeded 12-week demo performance history!",
        type: 'success'
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        message: "Failed to seed demo history.",
        type: 'error'
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleClearSnapshots = () => {
    try {
      onClearSnapshots();
      setFeedback({
        message: "Cleared all performance history snapshots.",
        type: 'info'
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({
        message: "Failed to clear snapshots.",
        type: 'error'
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Filter snapshots based on selected timeframe scale
  const { filteredSnapshots, isFallback } = useMemo(() => {
    if (snapshots.length === 0) return { filteredSnapshots: [], isFallback: false };
    
    const now = new Date();
    const cutoffDate = new Date();
    
    if (activeTimeframe === '1w') {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (activeTimeframe === '1m') {
      cutoffDate.setDate(now.getDate() - 30);
    } else if (activeTimeframe === '3m') {
      cutoffDate.setDate(now.getDate() - 90);
    } else if (activeTimeframe === '1y') {
      cutoffDate.setDate(now.getDate() - 365);
    } else {
      return { filteredSnapshots: snapshots, isFallback: false };
    }
    
    const filtered = snapshots.filter(s => new Date(s.date) >= cutoffDate);
    // If we have less than 2 points in selected timeframe, fallback to all so chart renders
    if (filtered.length < 2 && snapshots.length >= 2) {
      return { filteredSnapshots: snapshots, isFallback: true };
    }
    return { filteredSnapshots: filtered, isFallback: false };
  }, [snapshots, activeTimeframe]);

  // Map TWR to index value (starting at 100)
  const chartData = useMemo(() => {
    return filteredSnapshots.map(s => ({
      ...s,
      twrDisplay: parseFloat(s.twr.toFixed(2)),
      xirrDisplay: parseFloat(s.xirr.toFixed(2))
    }));
  }, [filteredSnapshots]);

  const hasEnoughData = snapshots.length >= 2;

  return (
    <div className="space-y-6">
      {/* Snapshot Actions Panel */}
      <div className="glass-card rounded-2xl p-5 border border-gray-200 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-primary rounded-xl">
            <Award className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm md:text-base">Institutional Performance Tracking</h4>
            <p className="text-xs text-gray-500">Separating stock-picking skill from raw salary deposits</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTakeSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Take Snapshot Now
          </button>
          
          <button
            onClick={handleSeedDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition-all border border-amber-200"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Seed Demo History
          </button>
          
          {snapshots.length > 0 && (
            <button
              onClick={handleClearSnapshots}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold transition-all border border-rose-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Snapshots
            </button>
          )}
        </div>
      </div>

      {/* Snapshot feedback alerts */}
      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between border shadow-sm transition-all animate-fade-in ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : feedback.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-indigo-50 border-indigo-150 text-indigo-850'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
            <span>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-xs hover:opacity-75 font-bold px-2 py-1 bg-white rounded-md border border-gray-100 shadow-sm text-gray-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Timeframe selector header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-bold text-gray-700">Display Scale Horizon:</span>
          </div>
          {isFallback && (
            <span className="text-[10px] font-semibold text-amber-600 animate-pulse">
              Showing All-Time (selected range has insufficient data points)
            </span>
          )}
        </div>
        
        {/* 1W, 1M, 3M, 1Y, All range toggles */}
        <div className="flex bg-gray-200 p-1 rounded-xl self-start sm:self-center">
          <button
            onClick={() => setActiveTimeframe('1w')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTimeframe === '1w' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            1 Week
          </button>
          <button
            onClick={() => setActiveTimeframe('1m')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTimeframe === '1m' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            1 Month
          </button>
          <button
            onClick={() => setActiveTimeframe('3m')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTimeframe === '3m' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            3 Months
          </button>
          <button
            onClick={() => setActiveTimeframe('1y')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTimeframe === '1y' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            1 Year
          </button>
          <button
            onClick={() => setActiveTimeframe('all')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              activeTimeframe === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All-Time
          </button>
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="glass-card rounded-2xl p-10 border border-gray-200 shadow-md text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4">
            <LineChartIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Build Your Performance History</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
            We track your true return using institutional methodologies (TWR & XIRR) to isolate your actual market returns from periodic deposits. Click <strong className="text-indigo-600">Seed Demo History</strong> above to see immediate visualizations or click <strong className="text-indigo-600">Take Snapshot Now</strong> to log today's initial point.
          </p>
          
          {snapshots.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 text-amber-900 text-xs font-semibold rounded-2xl border border-amber-200 flex items-center gap-2.5 max-w-md mx-auto text-left">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span>
                <strong>{snapshots.length} snapshot(s) successfully recorded!</strong> We need at least 2 separate data points to draw a line graph of your performance. Add another snapshot later or click <strong className="text-indigo-600">Seed Demo History</strong> to view sample trend charts right away.
              </span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleSeedDemo}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              Seed Demo History
            </button>
            <button
              onClick={handleTakeSnapshot}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Take Snapshot Now
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Absolute Wealth Generation */}
          <div className="glass-card rounded-2xl p-6 border border-gray-200 shadow-md flex flex-col">
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Absolute Wealth Generation
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Visualizing the spread of total asset value over deposits
              </p>
            </div>
            
            <div className="flex-1 min-h-[300px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={filteredSnapshots}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7042f8" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#7042f8" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ffa3" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#00ffa3" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={formatCurrency}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value)), 
                      name === 'totalInvested' ? 'Deposits/Invested' : (contextName === 'Consolidated' ? 'Current Net Worth' : 'Current Value')
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.96)', 
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs font-semibold text-gray-700">
                        {value === 'totalInvested' ? 'Total Deposits' : 'Portfolio Value'}
                      </span>
                    )}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalInvested" 
                    stroke="#7042f8" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorInvested)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="currentValue" 
                    stroke="#00ffa3" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: True Performance (Unified Percentage-Scale) */}
          <div className="glass-card rounded-2xl p-6 border border-gray-200 shadow-md flex flex-col">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <LineChartIcon className="w-4 h-4 text-indigo-500" />
                  True Skill Performance
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Time-Weighted Return (TWR %) vs Annualized Rate of Return (XIRR %)
                </p>
              </div>
              
              {/* Metric Toggle Buttons */}
              <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-center">
                <button
                  onClick={() => setActiveMetric('both')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    activeMetric === 'both' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Both
                </button>
                <button
                  onClick={() => setActiveMetric('xirr')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    activeMetric === 'xirr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  XIRR
                </button>
                <button
                  onClick={() => setActiveMetric('twr')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    activeMetric === 'twr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  TWR
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  
                  {/* Left Y-Axis for TWR Index (Base 100) */}
                  <YAxis 
                    yAxisId="left"
                    stroke="#3b82f6"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Number(val).toFixed(0)}`}
                    domain={['auto', 'auto']}
                  />

                  {/* Right Y-Axis for XIRR (%) */}
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#ef4444"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${Number(val).toFixed(1)}%`}
                    domain={['auto', 'auto']}
                  />

                  <Tooltip 
                    labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
                    formatter={(value: any, name: any) => {
                      if (name === 'twr') {
                        return [`${Number(value).toFixed(2)}`, 'TWR Index (Base 100)'];
                      }
                      if (name === 'xirr') {
                        return [`${Number(value).toFixed(2)}%`, 'XIRR (Annualized Return)'];
                      }
                      return [value, name];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.96)', 
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs font-semibold text-gray-700">
                        {value === 'xirr' ? 'XIRR (Annualized %)' : 'TWR Index (Base 100)'}
                      </span>
                    )}
                  />
                  {(activeMetric === 'both' || activeMetric === 'xirr') && (
                    <Line 
                      yAxisId="right"
                      name="xirr"
                      type="monotone" 
                      dataKey="xirrDisplay" 
                      stroke="#ef4444" 
                      strokeWidth={2.5}
                      dot={{ r: 3, stroke: '#ef4444', strokeWidth: 1, fill: '#fff' }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {(activeMetric === 'both' || activeMetric === 'twr') && (
                    <Line 
                      yAxisId="left"
                      name="twr"
                      type="monotone" 
                      dataKey="twrDisplay" 
                      stroke="#3b82f6" 
                      strokeWidth={2.5}
                      dot={{ r: 3, stroke: '#3b82f6', strokeWidth: 1, fill: '#fff' }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Informational Footer */}
            <div className="mt-2 p-2.5 bg-indigo-50/50 rounded-xl flex items-start gap-2 border border-indigo-50">
              <Info className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-indigo-800 leading-normal">
                Performance indicators are displayed using dual Y-axes for precision. <strong>Time-Weighted Return (TWR Index)</strong> isolates your stock-picking skill and starts at a baseline of <strong>100</strong> (showing growth relative to your initial value, neutralizing cashflow noise). <strong>XIRR %</strong> (right axis) tracks your true annualized rate of return factoring in exact cashflow amounts and dates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
