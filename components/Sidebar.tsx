
import React, { useState } from 'react';
import { LayoutDashboard, Table2, UploadCloud, BrainCircuit, WalletCards, PieChart, ListChecks, ChevronDown, ChevronUp, X, Crosshair } from 'lucide-react';
import { ViewState, AssetContext } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  currentContext: AssetContext;
  setContext: (context: AssetContext) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, currentContext, setContext, mobileOpen, setMobileOpen }) => {
  const [showAssetsMenu, setShowAssetsMenu] = useState(false);

  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: ViewState.DECISION_ARENA, label: 'Decision Arena', icon: <Crosshair size={20} /> },
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

  const handleViewChange = (id: ViewState) => {
      setView(id);
      setMobileOpen(false);
  }

  const renderAssetButton = (label: string, context: AssetContext, isMain = false) => {
      const isActive = currentContext === context && currentView !== ViewState.NET_WORTH;
      return (
        <button 
            key={context}
            onClick={() => {
                setContext(context);
                setShowAssetsMenu(false); // Auto-hide menu on selection
                setMobileOpen(false);
                
                // Reset to Dashboard if current view is not available in new context
                if (currentView === ViewState.NET_WORTH) {
                    setView(ViewState.DASHBOARD);
                }
                else if ((context === 'MUTUAL_FUNDS' || context === 'GOLD_ETF' || context === 'CASH_EQUIVALENTS') && ![ViewState.DASHBOARD, ViewState.HOLDINGS].includes(currentView)) {
                    setView(ViewState.DASHBOARD);
                }
            }}
            className={`w-full flex items-center justify-between group cursor-pointer transition-all duration-200 mb-1 px-3 py-2.5 rounded-xl ${isActive && !isMain ? 'bg-white/10' : 'hover:bg-white/5'}`}
        >
            <span className={`text-sm font-semibold transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
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

  // Auto-hide logic for Desktop
  const autoHideViews = [ViewState.HOLDINGS, ViewState.WATCHLIST, ViewState.TRANSACTIONS, ViewState.AI_INSIGHTS, ViewState.DECISION_ARENA];
  const isAutoHide = autoHideViews.includes(currentView);

  return (
    <>
        {/* Mobile Backdrop */}
        {mobileOpen && (
            <div 
                className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
                onClick={() => setMobileOpen(false)}
            />
        )}

        <aside 
            className={`w-64 glass-panel border-r border-border flex flex-col h-[100dvh] fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out group/sidebar
                ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                md:translate-x-0
                ${isAutoHide ? 'md:-translate-x-[calc(100%-20px)] md:hover:translate-x-0 md:shadow-none md:hover:shadow-[0_0_40px_rgba(var(--primary-color),0.2)]' : ''}
            `}
        >
        {/* Glow Effect Top Left */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none"></div>

        {/* Autohide Handle Visual (Desktop Only) */}
        {isAutoHide && (
            <div className="hidden md:flex absolute right-0 top-0 bottom-0 w-[20px] items-center justify-center cursor-e-resize opacity-100 group-hover/sidebar:opacity-0 transition-opacity duration-300">
                <div className="h-24 w-1 bg-primary/40 rounded-full shadow-[0_0_10px_rgba(var(--primary-color),0.5)]"></div>
            </div>
        )}

        {/* Mobile Close Button */}
        <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-white z-20"
        >
            <X size={20} />
        </button>

        {/* TradeView Button -> Navigates to Net Worth Overview */}
        <div className="p-6 border-b border-white/5 relative z-10 shrink-0">
            <button 
                onClick={() => { setView(ViewState.NET_WORTH); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full group hover:bg-white/5 p-2 -ml-2 rounded-xl transition-all"
                title="Go to Net Worth Overview"
            >
                <div className="bg-gradient-to-tr from-primary to-accent-cyan p-2.5 rounded-xl shadow-[0_0_15px_rgba(var(--primary-color),0.4)] group-hover:shadow-[0_0_20px_rgba(var(--primary-color),0.6)] transition-all">
                    <WalletCards className="text-white w-6 h-6" />
                </div>
                <div className="text-left">
                    <span className="text-2xl font-extrabold text-white tracking-wide font-sans block leading-none">
                    Fin<span className="text-primary-glow">Folio</span>
                    </span>
                </div>
            </button>
        </div>
        
        {/* Scrollable Nav Area */}
        <nav className="flex-1 p-4 space-y-2 relative z-10 animate-fade-in overflow-y-auto custom-scrollbar">
            
            {/* Asset Context Switcher */}
            <div className="mb-6 pb-4 border-b border-white/5">
                <div className="glass-card rounded-xl p-3 border border-white/5 shadow-md">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2 ml-1">Asset Class</p>
                        {/* Current Asset */}
                        {renderAssetButton(currentAssetItem.label, currentAssetItem.context, true)}

                        {/* Dropdown for other assets */}
                        {showAssetsMenu && (
                            <div className="pt-2 animate-fade-in border-t border-white/5 mt-2">
                                {otherAssets.map(asset => renderAssetButton(asset.label, asset.context))}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => setShowAssetsMenu(!showAssetsMenu)}
                        className="w-full mt-2 pt-2 border-t border-white/10 text-[11px] font-bold text-primary-glow hover:text-white transition-colors flex items-center justify-center gap-1 uppercase tracking-wider"
                    >
                        {showAssetsMenu ? 'Show Less' : 'Switch Asset'}
                        {showAssetsMenu ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                </div>
            </div>

            {/* Standard Menu Items */}
            <div>
                <p className="px-4 text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-2">Views</p>
                {filteredMenuItems.map((item) => (
                <button
                    key={item.id}
                    onClick={() => handleViewChange(item.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 group mb-2 ${
                    currentView === item.id
                        ? 'bg-primary/10 text-white border border-primary/30 shadow-[0_0_10px_rgba(var(--primary-color),0.2)]'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                >
                    <span className={`transition-colors duration-300 ${currentView === item.id ? 'text-primary-glow' : 'text-gray-500 group-hover:text-white'}`}>
                        {item.icon}
                    </span>
                    <span className="font-semibold tracking-wide text-sm">{item.label}</span>
                    {currentView === item.id && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-cyan shadow-[0_0_5px_var(--accent-cyan)]"></div>
                    )}
                </button>
                ))}
            </div>
        </nav>

        </aside>
    </>
  );
};
