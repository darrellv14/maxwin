import React from "react";
import { BarChart3, CandlestickChart } from "lucide-react";

type ChartType = "candlestick" | "line";

interface ChartTypeToggleProps {
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
}

const ChartTypeToggle: React.FC<ChartTypeToggleProps> = ({ chartType, onChartTypeChange }) => {
  return (
    <div className="inline-flex rounded border border-gray-700 overflow-hidden text-[10px] sm:text-xs font-mono">
      <button
        type="button"
        onClick={() => onChartTypeChange("line")}
        title="Line Chart"
        className={`px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-1.5 transition-colors ${
          chartType === "line"
            ? "bg-profit-green text-black"
            : "bg-terminal-dark text-gray-400 hover:bg-gray-800"
        }`}
      >
        <BarChart3 size={12} className="sm:w-[14px] sm:h-[14px]" />
        <span className="hidden xs:inline">Line</span>
      </button>
      <button
        type="button"
        onClick={() => onChartTypeChange("candlestick")}
        title="Candlestick Chart"
        className={`px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-1.5 border-l border-gray-700 transition-colors ${
          chartType === "candlestick"
            ? "bg-profit-green text-black"
            : "bg-terminal-dark text-gray-400 hover:bg-gray-800"
        }`}
      >
        <CandlestickChart size={12} className="sm:w-[14px] sm:h-[14px]" />
        <span className="hidden xs:inline">Candle</span>
      </button>
    </div>
  );
};

export default ChartTypeToggle;
