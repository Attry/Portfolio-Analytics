import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, change, changeLabel, isPositive, icon }) => {
  return (
    <div className="glass-card rounded-2xl p-6 relative overflow-hidden group border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-pattern-dots opacity-[0.4] pointer-events-none" />
        
      {/* Large Background Icon */}
      <div className="absolute -bottom-6 -right-6 opacity-[0.05] transform rotate-[-15deg] group-hover:scale-110 transition-transform duration-500 pointer-events-none text-black">
          {React.isValidElement(icon) 
              ? React.cloneElement(icon as React.ReactElement<any>, { size: 120, strokeWidth: 1 })
              : null
          }
      </div>

      {/* Hover Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1.5 tracking-tight">{value}</h3>
        </div>
        <div className="p-2.5 bg-white rounded-xl border-2 border-black group-hover:border-primary group-hover:bg-primary/10 transition-colors">
          {React.isValidElement(icon) 
            ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5 text-gray-700 group-hover:text-primary transition-colors" })
            : icon
          }
        </div>
      </div>
      
      {change && (
        <div className="mt-4 flex items-center relative z-10">
          <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full border-2 ${isPositive ? 'bg-success/10 text-success border-success' : 'bg-danger/10 text-danger border-danger'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {change}
          </span>
          <span className="text-gray-600 text-xs ml-2 font-bold">{changeLabel || 'vs last month'}</span>
        </div>
      )}
    </div>
  );
};