import React, { useState, useEffect, useMemo } from "react";
import { fetchStockData, calculateIndicators } from "../services/stockService";
import { analyzeStockWithGemini } from "../services/geminiService";
import { saveAnalysis } from "../services/analysisService";
import { StockData, IndicatorData, TimeFrame, AIAnalysisResult } from "../types";
import FinancialChart from "../components/FinancialChart";
import StatCard from "../components/StatCard";
import OraclePanel from "../components/OraclePanel";
import ConfidenceChart from "../components/ConfidenceChart";
import { Link } from "react-router-dom";

const Dashboard: React.FC = () => {
  const [ticker, setTicker] = useState<string>("BTC-USD");
  const [searchInput, setSearchInput] = useState<string>("BTC-USD");
  const [timeframe, setTimeframe] = useState<TimeFrame>("3M");
  const [data, setData] = useState<IndicatorData[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>("");

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch real historical data
        const rawData = await fetchStockData(ticker, timeframe);
        const enrichedData = calculateIndicators(rawData);
        setData(enrichedData);
        setAnalysis(null);
      } catch (err) {
        console.error("Failed to fetch stock data:", err);
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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || apiKeyInput;
    if (!apiKey) {
      alert("Please check API Key configuration.");
      return;
    }

    setLoadingAI(true);
    await new Promise((r) => setTimeout(r, 1500));

    try {
      const result = await analyzeStockWithGemini(ticker, data);
      setAnalysis(result);
      // Save to DB
      await saveAnalysis(result, ticker);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAI(false);
    }
  };

  const getPriceChange = () => {
    if (!current || !prev)
      return { val: "0.00", percent: "0.00", trend: "neutral" as const };
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

  return (
    <div className="min-h-screen bg-terminal-black text-gray-200 font-sans selection:bg-green-900 selection:text-white pb-10">
      {/* Header */}
      <header className="border-b border-gray-800 bg-terminal-dark/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-profit-green rounded-full shadow-[0_0_10px_#00ff9d]"></div>
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">
              MOO<span className="text-profit-green">CUAN</span>
              <span className="text-gray-600 text-sm ml-1">v1.0</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/history" className="text-xs font-mono bg-gray-900 px-3 py-1 rounded-full border border-gray-800 hover:bg-gray-800 text-gray-300 transition-colors">
              VIEW HISTORY
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6">
        {/* Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
          {/* Sidebar / Input Area */}
          <div className="col-span-12 md:col-span-3 space-y-4 flex flex-col">
            <div className="bg-terminal-gray border border-gray-800 p-4 rounded-lg">
              <label className="block text-xs font-mono text-gray-500 mb-1">
                ASSET TICKER (Gunakan .JK untuk saham IHSG)
              </label>
              <div className="relative flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-black border border-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:border-profit-green font-mono font-bold uppercase"
                />
                <button 
                  onClick={handleSearch}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 rounded border border-gray-700"
                >
                  GO
                </button>
              </div>
            </div>

            <div className="bg-terminal-gray border border-gray-800 p-4 rounded-lg">
              <label className="block text-xs font-mono text-gray-500 mb-2">
                TIMEFRAME
              </label>
              <div className="flex gap-2">
                {(["1M", "3M", "6M", "1Y"] as TimeFrame[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`flex-1 py-1 text-xs font-mono rounded border ${
                      timeframe === tf
                        ? "bg-gray-800 border-profit-green text-profit-green"
                        : "bg-black border-gray-800 text-gray-500 hover:bg-gray-800"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Technical Summary */}
            <div className="bg-terminal-gray border border-gray-800 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-mono">
                  RSI (14)
                </span>
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
                    (current?.macdHistogram || 0) > 0
                      ? "text-profit-green"
                      : "text-loss-red"
                  }`}
                >
                  {current?.macdHistogram?.toFixed(4)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-400 font-mono">
                  SMA Trend
                </span>
                <span
                  className={`text-sm font-bold font-mono ${
                    (current?.close || 0) > (current?.sma50 || 0)
                      ? "text-profit-green"
                      : "text-loss-red"
                  }`}
                >
                  {(current?.close || 0) > (current?.sma50 || 0)
                    ? "BULLISH"
                    : "BEARISH"}
                </span>
              </div>
            </div>

            {/* New Confidence Chart in Sidebar */}
            <div className="flex-1 flex flex-col">
               <ConfidenceChart data={data} />
            </div>
          </div>

          {/* Main Chart Area */}
          <div className="col-span-12 md:col-span-9 space-y-4 flex flex-col">
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Last Price"
                value={
                  current?.close
                    .toLocaleString("id-ID", {
                      style: "currency",
                      currency: "IDR",
                    })
                    .replace("Rp", "") || "0"
                }
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
                value={Math.abs(
                  (current?.bbUpper || 0) - (current?.bbLower || 0)
                ).toFixed(0)}
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

            <FinancialChart data={data} />
          </div>
        </div>

        {/* Bottom Section: AI & Tables */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <OraclePanel
            analysis={analysis}
            loading={loadingAI}
            onAnalyze={handleAnalyze}
          />

          <div className="bg-terminal-gray border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-bold font-mono text-white mb-4 flex justify-between items-center">
              <span>MARKET DEPTH LOG</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
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
                        <td className="py-2 font-bold">{d.close.toFixed(0)}</td>
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
                          {d.volume.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
