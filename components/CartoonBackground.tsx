import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CartoonBackgroundProps {
  icon: LucideIcon;
  pattern?: 'dots' | 'grid';
  color?: string; // Tailwind color class for the icon (e.g., 'text-primary')
  opacity?: string; // Tailwind opacity class (e.g., 'opacity-5')
  className?: string;
}

export const CartoonBackground: React.FC<CartoonBackgroundProps> = ({ 
  icon: Icon, 
  pattern = 'dots', 
  color = 'text-gray-900', 
  opacity = 'opacity-[0.03]',
  className = ''
}) => {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0 ${className}`}>
      {/* Pattern Layer */}
      <div className={`absolute inset-0 ${pattern === 'dots' ? 'bg-pattern-dots' : 'bg-pattern-grid'}`} />
      
      {/* Icon Layer - Large & Rotated */}
      <div className={`absolute -bottom-12 -right-12 transform rotate-[-15deg] ${opacity} ${color}`}>
        <Icon size={400} strokeWidth={1.5} />
      </div>

      {/* Decorative Shapes - Added for more detail */}
      {/* Circle Top Right */}
      <div className={`absolute top-[-10%] right-[10%] w-32 h-32 rounded-full border-[6px] border-current opacity-[0.02] ${color}`} />
      
      {/* Square Bottom Left */}
      <div className={`absolute bottom-[10%] left-[-5%] w-24 h-24 transform rotate-12 border-[6px] border-current opacity-[0.02] ${color}`} />
      
      {/* Solid Dot Middle Left */}
      <div className={`absolute top-[40%] left-[10%] w-4 h-4 rounded-full bg-current opacity-[0.05] ${color}`} />
      
      {/* Triangle-ish (rotated square) Top Left */}
      <div className={`absolute top-[10%] left-[20%] w-8 h-8 transform rotate-45 border-[3px] border-current opacity-[0.03] ${color}`} />
      
      {/* Cross/Plus Middle Right */}
      <div className={`absolute top-[60%] right-[20%] opacity-[0.04] ${color} font-black text-6xl select-none`}>+</div>
    </div>
  );
};
