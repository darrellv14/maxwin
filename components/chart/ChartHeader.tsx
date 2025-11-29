import React from "react";

interface ChartHeaderProps {
  ticker: string;
  price?: number;
  change?: number;
  changePercent?: number;
  time?: string;
}

const ChartHeader: React.FC<ChartHeaderProps> = ({
  ticker,
  price,
  change,
  changePercent,
  time,
}) => {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono">
      <div className="text-sm sm:text-lg font-bold text-white">{ticker}</div>

      {price !== undefined && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-base sm:text-xl font-bold text-white">
            {price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>

          {change !== undefined && (
            <span className={`text-xs sm:text-sm ${isPositive ? "text-profit-green" : "text-loss-red"}`}>
              {isPositive ? "+" : ""}
              {change.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}

          {changePercent !== undefined && (
            <span
              className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded ${
                isPositive ? "bg-profit-green/20 text-profit-green" : "bg-loss-red/20 text-loss-red"
              }`}
            >
              {isPositive ? "+" : ""}
              {changePercent.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      {time && <span className="text-[10px] sm:text-xs text-gray-500 ml-auto hidden sm:inline">{time}</span>}
    </div>
  );
};

export default ChartHeader;
