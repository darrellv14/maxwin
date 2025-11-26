import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, trend, color }) => {
  return (
    <div className="bg-terminal-gray border border-gray-800 p-4 rounded-lg shadow-lg">
      <div className="text-gray-400 text-xs font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color ? color : 'text-white'}`}>
        {value}
      </div>
      {subValue && (
        <div className={`text-sm mt-1 flex items-center ${
          trend === 'up' ? 'text-profit-green' : 
          trend === 'down' ? 'text-loss-red' : 'text-gray-500'
        }`}>
          {trend === 'up' && '▲'}
          {trend === 'down' && '▼'}
          <span className="ml-1">{subValue}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;