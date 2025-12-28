import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, isPositive, icon }) => {
  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
      {/* Hover Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-white mt-1.5 tracking-tight">{value}</h3>
        </div>
        <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 group-hover:border-primary/30 group-hover:bg-primary/10 transition-colors">
          {React.isValidElement(icon) 
            ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5 text-gray-300 group-hover:text-primary-glow transition-colors" })
            : icon
          }
        </div>
      </div>
      
      {change && (
        <div className="mt-4 flex items-center relative z-10">
          <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full border ${isPositive ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {change}
          </span>
          <span className="text-gray-500 text-xs ml-2 font-medium">vs last month</span>
        </div>
      )}
    </div>
  );
};