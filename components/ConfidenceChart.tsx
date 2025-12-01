import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { IndicatorData } from "../types";

interface ConfidenceChartProps {
  data: IndicatorData[];
}

const ConfidenceChart: React.FC<ConfidenceChartProps> = ({ data }) => {
  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#555"
            tick={{ fontSize: 9, fill: "#666" }}
            tickFormatter={(val) => val.slice(5)}
            minTickGap={20}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#555"
            tick={{ fontSize: 9, fill: "#666" }}
            orientation="right"
            width={30}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#111", borderColor: "#333", color: "#eee", fontSize: "11px" }}
            itemStyle={{ fontSize: "11px" }}
            labelStyle={{ color: "#888", marginBottom: "5px", fontSize: "10px" }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Win Rate"]}
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
  );
};

export default ConfidenceChart;
