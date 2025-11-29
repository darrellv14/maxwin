import React, { useEffect, useState } from "react";
import { getAIPicks, AnalysisRecord } from "../services/analysisService";
import { Link } from "react-router-dom";
import { Loader2, Bot, TrendingUp, Grid, List, Filter, SortAsc, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ScreenerCard from "../components/ScreenerCard";

type ViewMode = "grid" | "table";
type SortOption = "date" | "confidence" | "ticker";

const AIPicksPage: React.FC = () => {
  const [picks, setPicks] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [filterSignal, setFilterSignal] = useState<"ALL" | "BUY" | "SELL">("ALL");

  const fetchPicks = async () => {
    setLoading(true);
    try {
      const data = await getAIPicks();
      setPicks(data);
    } catch (error) {
      console.error("Failed to load AI picks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, []);

  const sortedAndFilteredPicks = React.useMemo(() => {
    let filtered = picks;

    // Filter by signal
    if (filterSignal !== "ALL") {
      filtered = filtered.filter((p) => p.signal === filterSignal);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "confidence":
          return (b.confidence || 0) - (a.confidence || 0);
        case "ticker":
          return a.ticker.localeCompare(b.ticker);
        case "date":
        default:
          return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
      }
    });
  }, [picks, sortBy, filterSignal]);

  return (
    <div className="min-h-screen bg-terminal-black text-gray-300 p-8 font-sans selection:bg-profit-green selection:text-black">
      <div className="max-w-7xl mx-auto 2xl:max-w-none">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-6">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-white tracking-tight flex items-center gap-3"
            >
              <Bot className="w-8 h-8 text-profit-green" />
              AI STOCK SCREENER{" "}
              <span className="text-gray-500 text-lg font-normal">(IDX MARKET)</span>
            </motion.h1>
            <p className="text-gray-400 mt-2 font-mono text-sm">
              Automated market scan & AI selection based on technical indicators.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded border border-gray-700 font-mono text-sm transition-colors"
            >
              ← BACK TO TERMINAL
            </Link>
          </div>
        </div>

        {/* Controls Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-terminal-gray border border-gray-800 rounded-lg p-4"
        >
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-black rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded ${viewMode === "grid" ? "bg-gray-800 text-profit-green" : "text-gray-500 hover:text-gray-300"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded ${viewMode === "table" ? "bg-gray-800 text-profit-green" : "text-gray-500 hover:text-gray-300"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterSignal}
                onChange={(e) => setFilterSignal(e.target.value as any)}
                className="bg-black border border-gray-700 text-gray-300 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-profit-green"
              >
                <option value="ALL">All Signals</option>
                <option value="BUY">BUY Only</option>
                <option value="SELL">SELL Only</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-black border border-gray-700 text-gray-300 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-profit-green"
              >
                <option value="date">Latest First</option>
                <option value="confidence">Highest Confidence</option>
                <option value="ticker">Ticker A-Z</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-gray-500">
              {sortedAndFilteredPicks.length} picks found
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchPicks}
              disabled={loading}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded border border-gray-700 text-sm font-mono disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </motion.button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="p-12 flex justify-center items-center text-gray-500 font-mono bg-terminal-gray border border-gray-800 rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            SCANNING MARKET DATA...
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View with ScreenerCards */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence>
              {sortedAndFilteredPicks.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ScreenerCard
                    ticker={record.ticker}
                    signal={record.signal as "BUY" | "SELL"}
                    confidence={record.confidence || 75}
                    entryPrice={record.entry_price}
                    tp1={record.tp1}
                    tp2={record.tp2}
                    stopLoss={record.stop_loss}
                    reasoning={record.reasoning.replace("[AI-SCREENER] ", "")}
                    date={new Date(record.date_created)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {sortedAndFilteredPicks.length === 0 && (
              <div className="col-span-full p-12 text-center text-gray-500 bg-terminal-gray border border-gray-800 rounded-lg">
                <div className="flex flex-col items-center gap-3">
                  <Bot className="w-12 h-12 opacity-20" />
                  <p>NO AI PICKS FOUND</p>
                  <p className="text-xs opacity-50">
                    Try adjusting your filters or check back later.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* Table View (Original) */
          <div className="bg-terminal-gray border border-gray-800 rounded-lg overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="p-4">DATE</th>
                    <th className="p-4">TICKER</th>
                    <th className="p-4">SIGNAL</th>
                    <th className="p-4">ENTRY AREA</th>
                    <th className="p-4">TARGETS (TP)</th>
                    <th className="p-4">STOP LOSS</th>
                    <th className="p-4 w-1/3">AI REASONING</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedAndFilteredPicks.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-800/50 transition-colors group">
                      <td className="p-4 text-gray-500 whitespace-nowrap">
                        {new Date(record.date_created).toLocaleDateString()} <br />
                        <span className="text-xs opacity-70">
                          {new Date(record.date_created).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-white text-lg">{record.ticker}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                            record.signal === "BUY"
                              ? "bg-green-900/30 text-profit-green border border-green-900"
                              : "bg-red-900/30 text-loss-red border border-red-900"
                          }`}
                        >
                          {record.signal === "BUY" && <TrendingUp className="w-3 h-3" />}
                          {record.signal}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-300">
                        {record.entry_price.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-profit-green font-medium">
                            TP1: {record.tp1.toLocaleString()}
                          </span>
                          <span className="text-green-400/70 text-xs">
                            TP2: {record.tp2.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-loss-red font-medium">
                        {record.stop_loss.toLocaleString()}
                      </td>
                      <td className="p-4 text-gray-400 text-xs leading-relaxed">
                        <div className="line-clamp-3 group-hover:line-clamp-none transition-all duration-300">
                          {record.reasoning.replace("[AI-SCREENER] ", "")}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedAndFilteredPicks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                          <Bot className="w-12 h-12 opacity-20" />
                          <p>NO AI PICKS GENERATED YET</p>
                          <p className="text-xs opacity-50">
                            The screener runs automatically. Check back later.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPicksPage;
