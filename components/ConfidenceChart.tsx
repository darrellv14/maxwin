import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { IndicatorData } from '../types';

interface ConfidenceChartProps {
  data: IndicatorData[];
}

const ConfidenceChart: React.FC<ConfidenceChartProps> = ({ data }) => {
  return (
    <div className="h-full min-h-[300px] w-full bg-terminal-dark rounded-lg p-4 border border-gray-800 flex flex-col">
      <h3 className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">
        AI Confidence / Win Rate History
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data}>
          <defs>
            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#555" 
            tick={{fontSize: 10, fill: '#666'}} 
            tickFormatter={(val) => val.slice(5)}
            minTickGap={30}
          />
          <YAxis 
            domain={[0, 100]} 
            stroke="#555" 
            tick={{fontSize: 10, fill: '#666'}}
            orientation="right"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#eee' }}
            itemStyle={{ fontSize: '12px' }}
            labelStyle={{ color: '#888', marginBottom: '5px' }}
            formatter={(value: number) => [
              `${value?.toFixed ? value.toFixed(1) : '0.0'}%`,
              'Win Rate'
            ]}
          />
          <Area 
            type="monotone" 
            dataKey="technicalConfidence" 
            stroke="#8b5cf6" 
            fillOpacity={1} 
            fill="url(#colorConfidence)" 
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ConfidenceChart;
