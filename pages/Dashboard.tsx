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
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Star, Keyboard, LogOut, Shield, User, Wallet } from "lucide-react";
import { useWatchlistStore } from "../stores/watchlistStore";
import { logout, isAdmin, getUser } from "../services/authService";
import AIChatAssistant from "@/components/AIChatAssistant";
import { ChartSkeleton, StatCardSkeleton } from "../components/Skeleton";
import { LOGO_SIZES, getOptimizedLogoUrl } from "../constants/logo";

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
  const user = getUser();

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
      alert("Please check API Key configuration.");
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
      {/* Header */}
      <header className="border-b border-gray-800 bg-terminal-dark/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex justify-between items-center 2xl:max-w-none">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src={LOGO_SIZES.sm}
              srcSet={`${LOGO_SIZES.sm} 1x, ${LOGO_SIZES.smRetina} 2x`}
              alt="MooCuan Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
              width="40"
              height="40"
            />
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-white font-mono">
              MOO<span className="text-profit-green">CUAN</span>
            </h1>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-3 lg:gap-4">
            <button
              onClick={() => {
                const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                document.dispatchEvent(event);
              }}
              className="hidden lg:flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-gray-200 bg-gray-900 px-3 py-1.5 rounded border border-gray-800"
              aria-label="Open command palette (Cmd+K)"
            >
              <Keyboard className="w-3 h-3" />
              <span>Cmd+K</span>
            </button>

            <Link
              to="/screener"
              className="text-xs font-mono bg-gray-900 px-3 py-1 rounded-full border border-gray-800 hover:bg-gray-800 text-profit-green transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 bg-profit-green rounded-full animate-pulse"></span>
              <span className="hidden lg:inline">AI SCREENER</span>
              <span className="lg:hidden">AI</span>
            </Link>
            <Link
              to="/history"
              className="text-xs font-mono bg-gray-900 px-3 py-1 rounded-full border border-gray-800 hover:bg-gray-800 text-gray-300 transition-colors"
            >
              <span className="hidden lg:inline">VIEW HISTORY</span>
              <span className="lg:hidden">HISTORY</span>
            </Link>
            <Link
              to="/portfolio"
              className="text-xs font-mono bg-gray-900 px-3 py-1 rounded-full border border-gray-800 hover:bg-gray-800 text-blue-400 transition-colors flex items-center gap-2"
            >
              <Wallet className="w-3 h-3" />
              <span className="hidden lg:inline">PORTFOLIO</span>
              <span className="lg:hidden">PORT</span>
            </Link>

            {isAdmin() && (
              <Link
                to="/admin"
                className="text-xs font-mono bg-purple-900/50 px-3 py-1 rounded-full border border-purple-700 hover:bg-purple-800 text-purple-300 transition-colors flex items-center gap-2"
              >
                <Shield className="w-3 h-3" />
                <span className="hidden lg:inline">ADMIN</span>
              </Link>
            )}
            <Link
              to="/account"
              className="text-xs font-mono bg-gray-900 px-3 py-1 rounded-full border border-gray-800 hover:bg-gray-800 text-gray-300 transition-colors flex items-center gap-2"
            >
              <User className="w-3 h-3" />
              <span className="hidden lg:inline">ACCOUNT</span>
              <span className="lg:hidden">ACC</span>
            </Link>
            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
              <span className="text-xs text-gray-400 hidden lg:block">{user?.name}</span>
              <button
                onClick={logout}
                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Nav */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              to="/account"
              className="text-[10px] font-mono bg-gray-900 px-2 py-1 rounded-full border border-gray-800 text-gray-300"
            >
              👤
            </Link>
            <Link
              to="/screener"
              className="text-[10px] font-mono bg-gray-900 px-2 py-1 rounded-full border border-gray-800 text-profit-green"
            >
              AI
            </Link>
            <Link
              to="/history"
              className="text-[10px] font-mono bg-gray-900 px-2 py-1 rounded-full border border-gray-800 text-gray-300"
            >
              📊
            </Link>
            <Link
              to="/portfolio"
              className="text-[10px] font-mono bg-gray-900 px-2 py-1 rounded-full border border-gray-800 text-blue-400"
            >
              💼
            </Link>
            {isAdmin() && (
              <Link
                to="/admin"
                className="text-[10px] font-mono bg-purple-900/50 px-2 py-1 rounded-full border border-purple-700 text-purple-300"
              >
                <Shield className="w-3 h-3" />
              </Link>
            )}
            <button
              onClick={logout}
              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 mt-4 sm:mt-6 2xl:max-w-none">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-3 space-y-4 flex flex-col md:max-h-[calc(100vh-120px)] md:overflow-y-auto md:overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
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

            <div className="flex flex-col">
              <ConfidenceChart data={data} />
            </div>

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

                {/* 🔽 Oracle + Market Depth dipindah ke sini, tepat di bawah chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <OraclePanel analysis={analysis} loading={loadingAI} onAnalyze={handleAnalyze} />

                  <div className="bg-terminal-gray border border-gray-800 rounded-lg p-4 sm:p-6">
                    <h2 className="text-sm sm:text-lg font-bold font-mono text-white mb-3 sm:mb-4">
                      MARKET DEPTH LOG
                    </h2>
                    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                      <table className="w-full text-left text-[10px] sm:text-xs font-mono min-w-[300px]">
                        <thead className="border-b border-gray-700 text-gray-500">
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
                            .slice(0, 8)
                            .map((d, i) => (
                              <tr
                                key={i}
                                className="border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors"
                              >
                                <td className="py-2 text-gray-500">{d.date}</td>
                                <td className="py-2 font-bold">{d.close?.toFixed(0) ?? "-"}</td>
                                <td
                                  className={`py-2 ${
                                    (d.rsi || 50) > 70
                                      ? "text-red-400"
                                      : (d.rsi || 50) < 30
                                        ? "text-green-400"
                                        : ""
                                  }`}
                                >
                                  {d.rsi?.toFixed(1)}
                                </td>
                                <td className="py-2 text-right text-gray-400">
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
      </main>
    </div>
  );
};

export default Dashboard;
