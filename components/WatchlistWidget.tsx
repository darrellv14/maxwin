import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Star, StarOff, TrendingUp, TrendingDown, Trash2, X } from "lucide-react";
import { useWatchlistStore } from "../stores";
import { toast } from "sonner";

interface WatchlistWidgetProps {
  onSelect?: (ticker: string) => void;
  compact?: boolean;
}

// Mini sparkline component
const Sparkline: React.FC<{ data: number[]; positive: boolean }> = ({ data, positive }) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 60;
  const height = 20;
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#00ff9d" : "#ff0055"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const WatchlistWidget: React.FC<WatchlistWidgetProps> = ({ onSelect, compact = false }) => {
  const { watchlist, removeFromWatchlist, updateWatchlistItem } = useWatchlistStore();
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch prices for watchlist items
  useEffect(() => {
    const fetchPrices = async () => {
      for (const item of watchlist) {
        try {
          const response = await fetch(`/api/market?ticker=${item.ticker}&period=5d`);
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              const latest = data[data.length - 1];
              const prev = data[data.length - 2] || latest;
              const sparklineData = data.slice(-20).map((d: any) => d.close);

              updateWatchlistItem(item.ticker, {
                lastPrice: latest.close,
                change: latest.close - prev.close,
                changePercent: ((latest.close - prev.close) / prev.close) * 100,
                sparklineData,
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching ${item.ticker}:`, error);
        }
      }
    };

    if (watchlist.length > 0) {
      fetchPrices();
      fetchIntervalRef.current = setInterval(fetchPrices, 60000); // Update every minute
    }

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [watchlist.length]);

  const handleRemove = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromWatchlist(ticker);
    toast.success(`${ticker} removed from watchlist`);
  };

  if (watchlist.length === 0) {
    return (
      <div className="bg-terminal-darker rounded-xl border border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-mono text-gray-400">Watchlist</h3>
        </div>
        <div className="text-center py-6">
          <StarOff className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-xs font-mono">No stocks in watchlist</p>
          <p className="text-gray-600 text-xs font-mono mt-1">Click ⭐ on a chart to add</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-terminal-darker rounded-xl border border-gray-800 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-mono text-gray-400">Watchlist</h3>
          <span className="text-xs text-gray-600">({watchlist.length})</span>
        </div>
      </div>

      {/* List */}
      <div
        className={`divide-y divide-gray-800 ${compact ? "max-h-[200px]" : "max-h-[400px]"} overflow-y-auto`}
      >
        {watchlist.map((item, index) => {
          const isPositive = (item.change || 0) >= 0;

          return (
            <motion.div
              key={item.ticker}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect?.(item.ticker)}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 cursor-pointer group transition-colors"
            >
              {/* Ticker & Price */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white text-sm truncate">
                    {item.ticker.replace(".JK", "")}
                  </span>
                  {item.sparklineData && (
                    <Sparkline data={item.sparklineData} positive={isPositive} />
                  )}
                </div>
                {item.lastPrice && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-gray-400">
                      {item.lastPrice.toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
              </div>

              {/* Change */}
              <div className="flex items-center gap-2">
                {item.changePercent !== undefined && (
                  <div
                    className={`flex items-center gap-1 text-xs font-mono ${
                      isPositive ? "text-terminal-green" : "text-terminal-red"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>
                      {isPositive ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </span>
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={(e) => handleRemove(item.ticker, e)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                >
                  <X className="w-3 h-3 text-gray-500 hover:text-red-500" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default WatchlistWidget;
