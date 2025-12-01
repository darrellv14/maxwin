import React, { useState, useEffect, useMemo } from "react";
import { fetchStockData, calculateIndicators } from "../services/stockService";
import { analyzeStockWithGemini } from "../services/geminiService";
import { saveAnalysis } from "../services/analysisService";
import { IndicatorData, TimeFrame, AIAnalysisResult } from "../types";
import FinancialChart from "../components/FinancialChart";
import StatCard from "../components/StatCard";
import OraclePanel from "../components/OraclePanel";
import ConfidenceChart from "../components/ConfidenceChart";
import WatchlistWidget from "../components/WatchlistWidget";
import PortfolioWidget from "@/components/PortfolioWidget";
import Navbar from "../components/Navbar";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { useWatchlistStore } from "../stores/watchlistStore";
import AIChatAssistant from "@/components/AIChatAssistant";
import { ChartSkeleton, StatCardSkeleton } from "../components/Skeleton";

const Dashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTicker = searchParams.get("ticker")?.toUpperCase() || "BTC-USD";

  const [ticker, setTicker] = useState<string>(initialTicker);
  const [searchInput, setSearchInput] = useState<string>(initialTicker);
  const [timeframe, setTimeframe] = useState<TimeFrame>("3M");
  const [data, setData] = useState<IndicatorData[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();

  // Update URL when ticker changes
  useEffect(() => {
    const currentParam = searchParams.get("ticker")?.toUpperCase();
    if (ticker !== "BTC-USD" && ticker !== currentParam) {
      setSearchParams({ ticker: ticker }, { replace: true });
    } else if (ticker === "BTC-USD" && currentParam) {
      // Remove param if back to default
      setSearchParams({}, { replace: true });
    }
  }, [ticker, searchParams, setSearchParams]);

  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        const rawData = await fetchStockData(ticker, timeframe);
        const enrichedData = calculateIndicators(rawData);
        setData(enrichedData);
        setAnalysis(null);
      } catch (err) {
        console.error("Failed to fetch stock data:", err);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [ticker, timeframe]);

  const current = useMemo(() => {
    if (data.length === 0) return null;
    return data[data.length - 1];
  }, [data]);

  const prev = useMemo(() => {
    if (data.length < 2) return null;
    return data[data.length - 2];
  }, [data]);

  const handleAnalyze = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      toast.error("Please check API Key configuration.");
      return;
    }

    setLoadingAI(true);
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const result = await analyzeStockWithGemini(ticker, data);
      setAnalysis(result);
      await saveAnalysis(result, ticker);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAI(false);
    }
  };

  const getPriceChange = () => {
    if (!current || !prev) return { val: "0.00", percent: "0.00%", trend: "neutral" as const };
    const diff = current.close - prev.close;
    const percent = (diff / prev.close) * 100;
    return {
      val: diff.toFixed(2),
      percent: percent.toFixed(2) + "%",
      trend: diff >= 0 ? ("up" as const) : ("down" as const),
    };
  };

  const priceStats = getPriceChange();

  const handleSearch = () => {
    if (searchInput.trim()) {
      setTicker(searchInput.toUpperCase());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleToggleWatchlist = () => {
    if (isInWatchlist(ticker)) {
      removeFromWatchlist(ticker);
      toast.success(`${ticker} removed from watchlist`);
    } else {
      addToWatchlist(ticker);
      toast.success(`${ticker} added to watchlist`);
    }
  };

  const handleSelectFromWatchlist = (selectedTicker: string) => {
    setTicker(selectedTicker);
    setSearchInput(selectedTicker);
  };

  return (
    <div className="min-h-screen bg-terminal-black text-gray-200 font-sans selection:bg-green-900 selection:text-white pb-6 md:pb-10">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 mt-4 sm:mt-6 2xl:max-w-none">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-3 space-y-4 flex flex-col">
            <div className="bg-terminal-gray border border-gray-800 p-4 rounded-lg">
              <label htmlFor="ticker-input" className="block text-xs font-mono text-gray-400 mb-1">
                ASSET TICKER (Gunakan .JK untuk saham IHSG)
              </label>
              <div className="relative flex gap-2">
                <input
                  id="ticker-input"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-profit-green font-mono font-bold uppercase"
                  aria-label="Enter stock ticker symbol"
                />
                <button
                  onClick={handleSearch}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 rounded border border-gray-700"
                  aria-label="Search ticker"
                >
                  GO
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleToggleWatchlist}
                  className={`px-3 rounded border transition-colors ${
                    isInWatchlist(ticker)
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-yellow-500"
                  }`}
                  title={isInWatchlist(ticker) ? "Remove from Watchlist" : "Add to Watchlist"}
                >
                  <Star className={`w-4 h-4 ${isInWatchlist(ticker) ? "fill-current" : ""}`} />
                </motion.button>
              </div>
            </div>

            <div className="bg-terminal-gray border border-gray-800 p-4 rounded-lg">
              <label className="block text-xs font-mono text-gray-400 mb-2">TIMEFRAME</label>
              <div className="grid grid-cols-5 gap-1 sm:gap-2">
                {(["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ALL"] as TimeFrame[]).map(
                  (tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      aria-label={`Set timeframe to ${tf}`}
                      className={`py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-mono rounded border transition-colors ${
                        timeframe === tf
                          ? "bg-gray-800 border-profit-green text-profit-green"
                          : "bg-black border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
                      }`}
                    >
                      {tf}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Technical Summary */}
            <div className="bg-terminal-gray border border-gray-800 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-mono">RSI (14)</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    (current?.rsi || 50) > 70
                      ? "text-loss-red"
                      : (current?.rsi || 50) < 30
                        ? "text-profit-green"
                        : "text-gray-300"
                  }`}
                >
                  {current?.rsi?.toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-black h-1 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${current?.rsi}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-400 font-mono">MACD</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    (current?.macdHistogram || 0) > 0 ? "text-profit-green" : "text-loss-red"
                  }`}
                >
                  {current?.macdHistogram?.toFixed(4)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-400 font-mono">SMA Trend</span>
                <span
                  className={`text-sm font-bold font-mono ${
                    (current?.close || 0) > (current?.sma50 || 0)
                      ? "text-profit-green"
                      : "text-loss-red"
                  }`}
                >
                  {(current?.close || 0) > (current?.sma50 || 0) ? "BULLISH" : "BEARISH"}
                </span>
              </div>
            </div>

            <PortfolioWidget />

            <WatchlistWidget onSelect={handleSelectFromWatchlist} />
          </div>

          {/* Main Chart Area */}
          <div className="col-span-12 md:col-span-9 space-y-4 flex flex-col">
            {loadingData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                  <StatCardSkeleton />
                </div>
                <ChartSkeleton />
              </>
            ) : (
              <>
                {/* Top Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Last Price"
                    value={current?.close?.toLocaleString("id-ID") || "0"}
                    subValue={`${priceStats.val} (${priceStats.percent})`}
                    trend={priceStats.trend}
                  />
                  <StatCard
                    label="Volume"
                    value={(current?.volume || 0).toLocaleString()}
                    color="text-blue-400"
                  />
                  <StatCard
                    label="Volatility"
                    value={Math.abs((current?.bbUpper || 0) - (current?.bbLower || 0)).toFixed(0)}
                    subValue="BB Width"
                    color="text-yellow-400"
                  />
                  <StatCard
                    label="Signal"
                    value={analysis ? analysis.signal : "WAITING"}
                    color={
                      analysis?.signal === "BUY"
                        ? "text-profit-green"
                        : analysis?.signal === "SELL"
                          ? "text-loss-red"
                          : "text-gray-500"
                    }
                  />
                </div>

                {/* Chat Assistant (kalau kamu mau tetap di sini) */}
                <AIChatAssistant />

                {/* Main Financial Chart */}
                <FinancialChart data={data} ticker={ticker} />

                {/* Oracle Panel + Market Depth - Below Chart, Same Width */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Oracle Panel */}
                  <div className="h-[320px]">
                    <OraclePanel analysis={analysis} loading={loadingAI} onAnalyze={handleAnalyze} />
                  </div>

                  {/* Market Depth Log */}
                  <div className="bg-terminal-gray border border-gray-800 rounded-lg p-4 h-[320px] flex flex-col">
                    <h2 className="text-sm font-bold font-mono text-white mb-3">
                      MARKET DEPTH LOG
                    </h2>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-[10px] sm:text-xs font-mono">
                        <thead className="border-b border-gray-700 text-gray-500 sticky top-0 bg-terminal-gray">
                          <tr>
                            <th className="pb-2">DATE</th>
                            <th className="pb-2">CLOSE</th>
                            <th className="pb-2">RSI</th>
                            <th className="pb-2 text-right">VOLUME</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          {[...data]
                            .reverse()
                            .slice(0, 10)
                            .map((d, i) => (
                              <tr
                                key={i}
                                className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                              >
                                <td className="py-1.5 text-gray-500">{d.date}</td>
                                <td className="py-1.5 font-bold">{d.close?.toFixed(0) ?? "-"}</td>
                                <td
                                  className={`py-1.5 ${
                                    (d.rsi || 50) > 70
                                      ? "text-red-400"
                                      : (d.rsi || 50) < 30
                                        ? "text-green-400"
                                        : ""
                                  }`}
                                >
                                  {d.rsi?.toFixed(1)}
                                </td>
                                <td className="py-1.5 text-right text-gray-400">
                                  {d.volume?.toLocaleString() ?? "0"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* AI Confidence Chart - Same Width as Sidebar/Watchlist */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          <div className="col-span-12 md:col-span-3">
            <div className="bg-terminal-dark rounded-lg border border-gray-800 p-4 flex flex-col h-[280px]">
              <h2 className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">
                AI Confidence / Win Rate History
              </h2>
              <div className="flex-1 min-h-0">
                <ConfidenceChart data={data} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
