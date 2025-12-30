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
  const [showAccounts, setShowAccounts] = useState(true);

  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: ViewState.HOLDINGS, label: 'Holdings', icon: <PieChart size={20} /> },
    { id: ViewState.WATCHLIST, label: 'Watchlist', icon: <ListChecks size={20} /> },
    { id: ViewState.TRANSACTIONS, label: 'Transactions', icon: <Table2 size={20} /> },
    { id: ViewState.AI_INSIGHTS, label: 'AI Analyst', icon: <BrainCircuit size={20} /> },
    { id: ViewState.UPLOAD, label: 'Import CSV', icon: <UploadCloud size={20} /> },
  ];

  const renderAssetButton = (label: string, context: AssetContext) => {
      const isActive = currentContext === context;
      return (
        <button 
            onClick={() => setContext(context)}
            className={`w-full flex items-center justify-between group cursor-pointer transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
        >
            <span className={`text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                {label}
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              {isActive && (
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isActive ? 'bg-success' : 'bg-gray-700'}`}></span>
            </span>
        </button>
      );
  };

  return (
    <aside className="w-64 glass-panel border-r border-border flex flex-col h-screen fixed left-0 top-0 z-50">
      {/* Glow Effect Top Left */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none"></div>

      <div className="p-6 border-b border-white/5 flex items-center gap-3 relative z-10">
        <div className="bg-gradient-to-tr from-primary to-accent-cyan p-2.5 rounded-xl shadow-[0_0_15px_rgba(112,66,248,0.4)]">
            <WalletCards className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-bold text-white tracking-wide font-sans">
          Trade<span className="text-primary-glow">View</span>
        </span>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 relative z-10">
        {menuItems.map((item) => (
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

      <div className="p-4 border-t border-white/5 relative z-10">
        <div className="bg-gradient-to-br from-white/5 to-transparent rounded-xl p-4 border border-white/5">
            
            <div className="space-y-4">
                {renderAssetButton('Indian Equity', 'INDIAN_EQUITY')}

                {showAccounts && (
                    <div className="space-y-4 pt-2 animate-fade-in border-t border-white/5">
                         {renderAssetButton('International Equity', 'INTERNATIONAL_EQUITY')}
                         {renderAssetButton('Gold ETF', 'GOLD_ETF')}
                         {renderAssetButton('Cash Equivalents', 'CASH_EQUIVALENTS')}
                    </div>
                )}
            </div>

            <button 
                onClick={() => setShowAccounts(!showAccounts)}
                className="w-full mt-4 pt-2 border-t border-white/10 text-[11px] font-bold text-primary-glow hover:text-white transition-colors flex items-center justify-center gap-1 uppercase tracking-wider"
            >
                {showAccounts ? 'Show Less' : 'More Assets'}
                {showAccounts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
        </div>
      </div>
    </aside>
  );
};