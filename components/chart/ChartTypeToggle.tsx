import React from "react";
import { BarChart3, CandlestickChart } from "lucide-react";

type ChartType = "candlestick" | "line";

interface ChartTypeToggleProps {
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

const ChartTypeToggle: React.FC<ChartTypeToggleProps> = ({ chartType, onChartTypeChange }) => {
  return (
    <div className="inline-flex rounded border border-gray-700 overflow-hidden text-xs font-mono">
      <button
        type="button"
        onClick={() => onChartTypeChange("line")}
        title="Line Chart"
        className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
          chartType === "line"
            ? "bg-profit-green text-black"
            : "bg-terminal-dark text-gray-400 hover:bg-gray-800"
        }`}
      >
        <BarChart3 size={14} />
        <span>Line</span>
      </button>
      <button
        type="button"
        onClick={() => onChartTypeChange("candlestick")}
        title="Candlestick Chart"
        className={`px-3 py-1.5 flex items-center gap-1.5 border-l border-gray-700 transition-colors ${
          chartType === "candlestick"
            ? "bg-profit-green text-black"
            : "bg-terminal-dark text-gray-400 hover:bg-gray-800"
        }`}
      >
        <CandlestickChart size={14} />
        <span>Candle</span>
      </button>
    </div>
  );
};

export default ChartTypeToggle;
