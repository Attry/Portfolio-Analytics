import React from 'react';
import { LayoutDashboard, Table2, UploadCloud, BrainCircuit, WalletCards, PieChart } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: ViewState.PORTFOLIO, label: 'Portfolio', icon: <PieChart size={20} /> },
    { id: ViewState.TRANSACTIONS, label: 'Transactions', icon: <Table2 size={20} /> },
    { id: ViewState.AI_INSIGHTS, label: 'AI Analyst', icon: <BrainCircuit size={20} /> },
    { id: ViewState.UPLOAD, label: 'Import CSV', icon: <UploadCloud size={20} /> },
  ];

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
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Connection Status</p>
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-200 font-medium">Dhan Account</span>
                <span className="flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                </span>
            </div>
        </div>
      </div>
    </aside>
  );
};