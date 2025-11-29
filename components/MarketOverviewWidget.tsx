import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";

interface MarketIndex {
  name: string;
  ticker: string;
  value: number;
  change: number;
  changePercent: number;
}

const MarketOverviewWidget: React.FC = () => {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMarketData = async () => {
    setLoading(true);

    // Market indices to track
    const indexTickers = [
      { ticker: "^JKSE", name: "IHSG" },
      { ticker: "^JKLQ45", name: "LQ45" },
    ];

    try {
      const results: MarketIndex[] = [];

      for (const index of indexTickers) {
        try {
          const response = await fetch(`/api/market?ticker=${index.ticker}&period=2d`);
          if (response.ok) {
            const data = await response.json();
            if (data.length >= 2) {
              const latest = data[data.length - 1];
              const prev = data[data.length - 2];
              results.push({
                name: index.name,
                ticker: index.ticker,
                value: latest.close,
                change: latest.close - prev.close,
                changePercent: ((latest.close - prev.close) / prev.close) * 100,
              });
            }
          }
        } catch (e) {
          console.error(`Error fetching ${index.ticker}:`, e);
        }
      }

      // Add mock sectors if needed (can be replaced with real data)
      const sectors = [
        { name: "Banking", change: Math.random() * 4 - 2 },
        { name: "Mining", change: Math.random() * 4 - 2 },
        { name: "Consumer", change: Math.random() * 4 - 2 },
      ];

      setIndices(results);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching market data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-terminal-darker rounded-xl border border-gray-800 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-terminal-green" />
          <h3 className="text-sm font-mono text-gray-400">Market Overview</h3>
        </div>
        <button
          onClick={fetchMarketData}
          disabled={loading}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Indices */}
      <div className="p-4 space-y-3">
        {loading && indices.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="space-y-1">
                  <div className="w-16 h-4 bg-gray-800 rounded" />
                  <div className="w-24 h-3 bg-gray-800 rounded" />
                </div>
                <div className="w-16 h-5 bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        ) : (
          indices.map((index, i) => (
            <motion.div
              key={index.ticker}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center justify-between"
            >
              <div>
                <div className="font-mono font-bold text-white text-sm">{index.name}</div>
                <div className="font-mono text-xs text-gray-500">
                  {index.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-mono ${
                  index.changePercent >= 0 ? "text-terminal-green" : "text-terminal-red"
                }`}
              >
                {index.changePercent >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>
                  {index.changePercent >= 0 ? "+" : ""}
                  {index.changePercent.toFixed(2)}%
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Footer */}
      {lastUpdate && (
        <div className="px-4 py-2 border-t border-gray-800">
          <p className="text-xs text-gray-600 font-mono">
            Updated:{" "}
            {lastUpdate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default MarketOverviewWidget;
