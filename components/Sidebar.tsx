
import React, { useState } from 'react';
import { LayoutDashboard, Table2, UploadCloud, BrainCircuit, WalletCards, PieChart, ListChecks, ChevronDown, ChevronUp } from 'lucide-react';
import { ViewState, AssetContext } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  currentContext: AssetContext;
  setContext: (context: AssetContext) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentContext, setContext }) => {
  const [showAssetsMenu, setShowAssetsMenu] = useState(false);

  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: ViewState.HOLDINGS, label: 'Holdings', icon: <PieChart size={20} /> },
    { id: ViewState.WATCHLIST, label: 'Watchlist', icon: <ListChecks size={20} /> },
    { id: ViewState.TRANSACTIONS, label: 'Transactions', icon: <Table2 size={20} /> },
    { id: ViewState.AI_INSIGHTS, label: 'AI Analyst', icon: <BrainCircuit size={20} /> },
    { id: ViewState.UPLOAD, label: 'Import CSV', icon: <UploadCloud size={20} /> },
  ];

  // Filter menu items based on context
  const filteredMenuItems = menuItems.filter(item => {
      if (currentContext === 'MUTUAL_FUNDS' || currentContext === 'GOLD_ETF' || currentContext === 'CASH_EQUIVALENTS') {
          return [ViewState.DASHBOARD, ViewState.HOLDINGS].includes(item.id);
      }
      return true;
  });

  const renderAssetButton = (label: string, context: AssetContext, isMain = false) => {
      const isActive = currentContext === context && currentView !== ViewState.NET_WORTH;
      return (
        <button 
            key={context}
            onClick={() => {
                setContext(context);
                setShowAssetsMenu(false); // Auto-hide menu on selection
                
                // Reset to Dashboard if current view is not available in new context
                if (currentView === ViewState.NET_WORTH) {
                    setView(ViewState.DASHBOARD);
                }
                else if ((context === 'MUTUAL_FUNDS' || context === 'GOLD_ETF' || context === 'CASH_EQUIVALENTS') && ![ViewState.DASHBOARD, ViewState.HOLDINGS].includes(currentView)) {
                    setView(ViewState.DASHBOARD);
                }
            }}
            className={`w-full flex items-center justify-between group cursor-pointer transition-all duration-200 mb-1 px-2 py-2 rounded-lg ${isActive && !isMain ? 'bg-white/10' : 'hover:bg-white/5'}`}
        >
            <span className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                {label}
            </span>
            {isActive && (
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
            )}
        </button>
      );
  };

  const allAssets: { label: string; context: AssetContext }[] = [
      { label: 'Indian Equity', context: 'INDIAN_EQUITY' },
      { label: 'Mutual Funds', context: 'MUTUAL_FUNDS' },
      { label: 'Gold ETF', context: 'GOLD_ETF' },
      { label: 'International Equity', context: 'INTERNATIONAL_EQUITY' },
      { label: 'Cash Equivalents', context: 'CASH_EQUIVALENTS' }
  ];

  const currentAssetItem = allAssets.find(a => a.context === currentContext) || allAssets[0];
  const otherAssets = allAssets.filter(a => a.context !== currentContext);

  return (
    <aside className="w-64 glass-panel border-r border-border flex flex-col h-screen fixed left-0 top-0 z-50">
      {/* Glow Effect Top Left */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none"></div>

      {/* TradeView Button -> Navigates to Net Worth Overview */}
      <div className="p-6 border-b border-white/5 relative z-10">
          <button 
            onClick={() => setView(ViewState.NET_WORTH)}
            className="flex items-center gap-3 w-full group hover:bg-white/5 p-2 -ml-2 rounded-xl transition-all"
          >
            <div className="bg-gradient-to-tr from-primary to-accent-cyan p-2.5 rounded-xl shadow-[0_0_15px_rgba(112,66,248,0.4)] group-hover:shadow-[0_0_20px_rgba(112,66,248,0.6)] transition-all">
                <WalletCards className="text-white w-5 h-5" />
            </div>
            <div className="text-left">
                <span className="text-xl font-bold text-white tracking-wide font-sans block leading-none">
                Trade<span className="text-primary-glow">View</span>
                </span>
                <span className="text-[10px] text-accent-cyan uppercase tracking-wider font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    Net Worth Overview
                </span>
            </div>
          </button>
      </div>
      
      {/* Standard Menu */}
      {currentView !== ViewState.NET_WORTH && (
          <nav className="flex-1 p-4 space-y-2 relative z-10 animate-fade-in">
            {filteredMenuItems.map((item) => (
            <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 group ${
                currentView === item.id
                    ? 'bg-primary/10 text-white border border-primary/30 shadow-[0_0_10px_rgba(112,66,248,0.2)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
            >
                <span className={`transition-colors duration-300 ${currentView === item.id ? 'text-accent-cyan' : 'text-gray-500 group-hover:text-white'}`}>
                    {item.icon}
                </span>
                <span className="font-medium tracking-wide text-sm">{item.label}</span>
                {currentView === item.id && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-cyan shadow-[0_0_5px_#00e5ff]"></div>
                )}
            </button>
            ))}
        </nav>
      )}

      {/* Asset Context Switcher */}
      <div className={`p-4 ${currentView !== ViewState.NET_WORTH ? 'border-t' : 'mt-auto'} border-white/5 relative z-10`}>
        <div className="bg-gradient-to-br from-white/5 to-transparent rounded-xl p-4 border border-white/5 shadow-lg">
            
            <div className="space-y-1">
                {/* 1. Current Asset (Always Visible) */}
                 <div className="mb-2">
                    <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2 ml-1">Current Asset</p>
                    {renderAssetButton(currentAssetItem.label, currentAssetItem.context, true)}
                 </div>

                {/* 2. Other Assets Toggle */}
                {showAssetsMenu && (
                    <div className="pt-2 animate-fade-in border-t border-white/5 mt-2 max-h-40 overflow-y-auto custom-scrollbar">
                         <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2 ml-1">Switch To</p>
                        {otherAssets.map(asset => renderAssetButton(asset.label, asset.context))}
                    </div>
                )}
            </div>

            <button 
                onClick={() => setShowAssetsMenu(!showAssetsMenu)}
                className="w-full mt-2 pt-2 border-t border-white/10 text-[11px] font-bold text-primary-glow hover:text-white transition-colors flex items-center justify-center gap-1 uppercase tracking-wider"
            >
                {showAssetsMenu ? 'Close List' : 'Change Asset'}
                {showAssetsMenu ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
        </div>
      </div>
    </aside>
  );
};
