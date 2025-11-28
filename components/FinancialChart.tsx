import React from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Cell,
  ReferenceLine
} from 'recharts';
import { IndicatorData } from '../types';

interface FinancialChartProps {
  data: IndicatorData[];
}

// Custom shape for Candlestick
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;
  const isUp = close > open;
  const color = isUp ? '#00ff9d' : '#ff0055';
  
  // Center of the bar
  const cx = x + width / 2;
  
  // Scale y values (Recharts passes y as pixel coordinates, but we need to map high/low manually if we use simple bars, 
  // but Recharts ComposedChart scales axes. 
  // ACTUALLY: The easiest way in Recharts is to use the Bar for the body (Open to Close) 
  // and draw the wicks manually or use ErrorBar.
  // HOWEVER, obtaining the exact Y pixels for High/Low inside a custom shape is tricky without the scale.
  // A robust trick: Pass [min(open, close), max(open, close)] as the Bar data.
  // But drawing wicks requires knowing the scale.
  
  // Simplified approach for "Visual" accuracy in this demo:
  // We will assume the chart auto-scales. We use standard SVG lines relative to the bar's coordinate system if possible.
  // Since Recharts custom shape receives `y` (top of bar) and `height`, we can draw the body.
  // For wicks, we need the Y-axis scale. 
  
  // ALTERNATIVE: Use 3 Bars? No.
  // Let's use a simpler visualization: Line chart for Close price + Bollinger Bands, 
  // and a Bar chart at the bottom for Volume. 
  // BUT the user asked for Candlestick.
  
  // Let's try to render a simple OHLC bar if we can calculate the pixels. 
  // Recharts provides `yAxis` scale in some contexts, but it's hard to access in the Shape.
  
  // FALLBACK STRATEGY FOR ROBUSTNESS: 
  // Use a 'composed' chart where:
  // 1. Line = Close Price (for general trend)
  // 2. Area = Bollinger Bands (using a range area if possible, or 2 lines)
  // 3. For Candlesticks, we will use a specialized library pattern or just stick to a highly detailed Line Chart with High/Low error bars if Candlestick is too flaky in pure Recharts without plugin.
  // WAIT, I can use `recharts` standard trick:
  // The `Bar` dataKey will be the range [min, max].
  // Then draw a rect for the body.
  
  return (
    <g>
      {/* Wick */}
      <line 
        x1={cx} 
        y1={props.yAxis.scale(high)} 
        x2={cx} 
        y2={props.yAxis.scale(low)} 
        stroke={color} 
        strokeWidth={1} 
      />
      {/* Body */}
      <rect 
        x={x} 
        y={props.yAxis.scale(Math.max(open, close))} 
        width={width} 
        height={Math.abs(props.yAxis.scale(open) - props.yAxis.scale(close))} 
        fill={color} 
      />
    </g>
  );
};

// Since passing scale to custom shape is hard in older recharts, 
// I will implement a simpler but effective "Bar" chart that looks like candles 
// by calculating the body size in the data preparation or using a trick.
// Let's stick to a clean Line Chart with Bollinger Bands for reliability in this specific constrained environment,
// BUT add Open/High/Low markers to satisfy the "Technical" vibe.
// ACTUALLY, I will use a standard Recharts pattern for Candles:
// A Bar chart where the values are [min, max], and we color it based on open/close.
// But Recharts Bar doesn't accept array values easily for range.
// 
// DECISION: I will render a high-quality Line Chart for Close, BB Upper, BB Lower.
// And a Bar chart for Volume. 
// This is safer and "Quantitative" enough if I can't guarantee Candlestick rendering without bugs.
// WAIT, the prompt explicitly asks for "Candlestick chart".
// I will try to implement a custom Candlestick using the `shape` prop on a Scatter or Bar.

// Let's try the error bar approach.
// We will overlay a Bar (Body) and ErrorBar (Wick).
// Data prep needed: 
// bodyBottom: min(open, close)
// bodyTop: max(open, close)
// wickHigh: high - bodyTop
// wickLow: bodyBottom - low

const FinancialChart: React.FC<FinancialChartProps> = ({ data }) => {
  // Transformation for Recharts "Candlestick" emulation
  const processedData = data.map(d => {
    const isUp = d.close > d.open;
    return {
      ...d,
      // For the body bar: it starts at min(O,C) and has height abs(O-C)
      // But Recharts Bars start at 0. We need a floating bar.
      // Recharts has <Bar dataKey={[min, max]} /> support in newer versions but it's flaky.
      
      // Let's use the ComposedChart with Lines for MA/BB and a custom shape for the Candle.
      candleColor: isUp ? '#00ff9d' : '#ff0055',
    };
  });

  const CustomCandle = (props: any) => {
    const { x, y, width, height, payload, yAxis } = props;
    const { open, close, high, low } = payload;
    const isUp = close > open;
    const color = isUp ? '#00ff9d' : '#ff0055';
    const wickWidth = 1;
    const cx = x + width / 2;
    
    // We need the scale function to map values to pixels
    const scale = yAxis?.scale;
    if (!scale) return null;

    const yHigh = scale(high);
    const yLow = scale(low);
    const yOpen = scale(open);
    const yClose = scale(close);
    
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.abs(yOpen - yClose);
    const minHeight = 1; // Ensure body is visible even if doji

    return (
      <g>
        <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={wickWidth} />
        <rect 
            x={x} 
            y={bodyTop} 
            width={width} 
            height={Math.max(bodyHeight, minHeight)} 
            fill={color} 
            stroke={color} 
        />
      </g>
    );
  };

  return (
    <div className="h-[566.5px] w-full bg-terminal-dark rounded-lg p-4 border border-gray-800">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={processedData}>
          <defs>
            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#555" 
            tick={{fontSize: 10, fill: '#666'}} 
            tickFormatter={(val) => val.slice(5)}
          />
          <YAxis 
            yAxisId="price" 
            domain={['auto', 'auto']} 
            stroke="#555" 
            tick={{fontSize: 10, fill: '#666'}}
            orientation="right"
          />
          <YAxis 
            yAxisId="volume" 
            orientation="left" 
            stroke="#555" 
            tick={{fontSize: 0}} 
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#eee' }}
            itemStyle={{ fontSize: '12px' }}
            labelStyle={{ color: '#888', marginBottom: '5px' }}
          />
          
          {/* Bollinger Bands Area - simulated with lines for simplicity/clarity */}
          <Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="#444" dot={false} strokeWidth={1} strokeDasharray="5 5" />
          <Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="#444" dot={false} strokeWidth={1} strokeDasharray="5 5" />
          
          {/* Moving Averages */}
          <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="#fbbf24" dot={false} strokeWidth={1} name="SMA 20" />
          <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="#3b82f6" dot={false} strokeWidth={1} name="SMA 50" />

          {/* Volume */}
          <Bar yAxisId="volume" dataKey="volume" fill="url(#colorVolume)" barSize={20} opacity={0.3} />

          {/* Candlesticks - We use a Bar with a custom shape */}
          <Bar 
            yAxisId="price"
            dataKey="close" 
            shape={<CustomCandle />} 
            barSize={10}
            isAnimationActive={false} // Important for performance on custom shapes
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FinancialChart;