import React, { useEffect, useState } from "react";
import { getAIPicks, AnalysisRecord } from "../services/analysisService";
import { useNavigate } from "react-router-dom";
import { Loader2, Bot, TrendingUp, Grid, List, Filter, SortAsc, RefreshCw, Calendar, ChevronDown, ChevronRight, Zap, Target, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ScreenerCard from "../components/ScreenerCard";
import Navbar from "../components/Navbar";

type ViewMode = "grid" | "table";
type SortOption = "date" | "confidence" | "ticker";
type SignalFilter = "ALL" | "STRONG BUY" | "BUY" | "SPECULATIVE BUY";

interface DateGroup {
  date: string;
  displayDate: string;
  picks: AnalysisRecord[];
  isExpanded: boolean;
}

const AIPicksPage: React.FC = () => {
  const navigate = useNavigate();
  const [picks, setPicks] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("confidence");
  const [filterSignal, setFilterSignal] = useState<SignalFilter>("ALL");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const handleViewChart = (ticker: string) => {
    navigate(`/?ticker=${encodeURIComponent(ticker)}`);
  };

  const fetchPicks = async () => {
    setLoading(true);
    try {
      const data = await getAIPicks();
      setPicks(data);
      // Auto-expand today's picks
      const today = new Date().toISOString().split('T')[0];
      setExpandedDates(new Set([today]));
    } catch (error) {
      console.error("Failed to load AI picks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
  }, []);

  // Group picks by date
  const groupedByDate = React.useMemo(() => {
    let filtered = picks;

    // Filter by signal
    if (filterSignal !== "ALL") {
      filtered = filtered.filter((p) => p.signal?.toUpperCase() === filterSignal);
    }

    // Group by date
    const groups: Map<string, AnalysisRecord[]> = new Map();
    filtered.forEach((pick) => {
      const dateKey = new Date(pick.date_created).toISOString().split('T')[0];
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(pick);
    });

    // Sort picks within each group
    groups.forEach((groupPicks, key) => {
      groups.set(key, groupPicks.sort((a, b) => {
        switch (sortBy) {
          case "confidence":
            return (b.confidence || 0) - (a.confidence || 0);
          case "ticker":
            return a.ticker.localeCompare(b.ticker);
          case "date":
          default:
            return new Date(b.date_created).getTime() - new Date(a.date_created).getTime();
        }
      }));
    });

    // Sort groups by date (newest first) and convert to array
    const sortedGroups: DateGroup[] = Array.from(groups.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, picks]) => {
        const dateObj = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let displayDate: string;
        if (dateObj.toDateString() === today.toDateString()) {
          displayDate = "📅 TODAY'S PICKS";
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
          displayDate = "📆 YESTERDAY";
        } else {
          displayDate = `📆 ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;
        }

        return {
          date,
          displayDate,
          picks,
          isExpanded: expandedDates.has(date)
        };
      });

    return sortedGroups;
  }, [picks, sortBy, filterSignal, expandedDates]);

  const totalPicks = groupedByDate.reduce((sum, g) => sum + g.picks.length, 0);

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedDates(new Set(groupedByDate.map(g => g.date)));
  };

  const collapseAll = () => {
    setExpandedDates(new Set());
  };

  // Get signal badge style
  const getSignalBadge = (signal: string) => {
    const upperSignal = signal?.toUpperCase() || "BUY";
    if (upperSignal.includes("STRONG")) {
      return { icon: Zap, color: "text-green-400 bg-green-900/40 border-green-700", label: "STRONG BUY" };
    } else if (upperSignal.includes("SPECULATIVE")) {
      return { icon: Sparkles, color: "text-yellow-400 bg-yellow-900/40 border-yellow-700", label: "SPECULATIVE" };
    }
    return { icon: Target, color: "text-emerald-400 bg-emerald-900/40 border-emerald-700", label: "BUY" };
  };

  return (
    <div className="min-h-screen bg-terminal-black text-gray-300 font-sans selection:bg-profit-green selection:text-black">
      <Navbar />
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 2xl:max-w-none">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 border-b border-gray-800 pb-4 sm:pb-6">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-2 sm:gap-3"
            >
              <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-profit-green" />
              <span className="hidden xs:inline">AI STOCK SCREENER</span>
              <span className="xs:hidden">AI SCREENER</span>
              <span className="text-gray-500 text-xs sm:text-sm lg:text-lg font-normal hidden md:inline">(IDX MARKET)</span>
            </motion.h1>
            <p className="text-gray-400 mt-1 sm:mt-2 font-mono text-xs sm:text-sm">
              <span className="hidden sm:inline">Automated market scan & AI selection based on technical indicators.</span>
              <span className="sm:hidden">AI-powered stock screening.</span>
            </p>
          </div>
        </div>

        {/* Controls Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 bg-terminal-gray border border-gray-800 rounded-lg p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-black rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 sm:p-2 rounded ${viewMode === "grid" ? "bg-gray-800 text-profit-green" : "text-gray-500 hover:text-gray-300"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 sm:p-2 rounded ${viewMode === "table" ? "bg-gray-800 text-profit-green" : "text-gray-500 hover:text-gray-300"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Filter className="w-4 h-4 text-gray-500 hidden sm:block" />
              <select
                value={filterSignal}
                onChange={(e) => setFilterSignal(e.target.value as SignalFilter)}
                className="bg-black border border-gray-700 text-gray-300 text-xs sm:text-sm rounded px-2 sm:px-3 py-1 sm:py-1.5 focus:outline-none focus:border-profit-green"
              >
                <option value="ALL">All Signals</option>
                <option value="STRONG BUY">🟢 Strong Buy</option>
                <option value="BUY">🟡 Buy</option>
                <option value="SPECULATIVE BUY">🔵 Speculative</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1 sm:gap-2">
              <SortAsc className="w-4 h-4 text-gray-500 hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-black border border-gray-700 text-gray-300 text-xs sm:text-sm rounded px-2 sm:px-3 py-1 sm:py-1.5 focus:outline-none focus:border-profit-green"
              >
                <option value="date">Latest</option>
                <option value="confidence">Confidence</option>
                <option value="ticker">A-Z</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
            <span className="text-[10px] sm:text-xs font-mono text-gray-500">
              {totalPicks} picks in {groupedByDate.length} days
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-gray-500 hover:text-gray-300 font-mono"
              >
                Expand
              </button>
              <span className="text-gray-700">|</span>
              <button
                onClick={collapseAll}
                className="text-xs text-gray-500 hover:text-gray-300 font-mono"
              >
                Collapse
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchPicks}
              disabled={loading}
              className="flex items-center gap-1.5 sm:gap-2 bg-gray-800 hover:bg-gray-700 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-gray-700 text-xs sm:text-sm font-mono disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline">Refresh</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="p-8 sm:p-12 flex justify-center items-center text-gray-500 font-mono bg-terminal-gray border border-gray-800 rounded-lg text-xs sm:text-sm">
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mr-2" />
            <span className="hidden sm:inline">SCANNING MARKET DATA...</span>
            <span className="sm:hidden">SCANNING...</span>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View with Date Groups */
          <div className="space-y-6">
            <AnimatePresence>
              {groupedByDate.map((group, groupIndex) => (
                <motion.div
                  key={group.date}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: groupIndex * 0.1 }}
                  className="bg-terminal-darker border border-gray-800 rounded-xl overflow-hidden"
                >
                  {/* Date Header */}
                  <button
                    onClick={() => toggleDateExpansion(group.date)}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-terminal-darker hover:from-gray-800 hover:to-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-profit-green" />
                      <span className="font-mono font-bold text-white text-lg">
                        {group.displayDate}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                        {group.picks.length} picks
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Signal summary badges */}
                      <div className="hidden sm:flex items-center gap-1">
                        {group.picks.filter(p => p.signal?.toUpperCase().includes("STRONG")).length > 0 && (
                          <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full border border-green-700">
                            {group.picks.filter(p => p.signal?.toUpperCase().includes("STRONG")).length} Strong
                          </span>
                        )}
                        {group.picks.filter(p => p.signal?.toUpperCase() === "BUY").length > 0 && (
                          <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-700">
                            {group.picks.filter(p => p.signal?.toUpperCase() === "BUY").length} Buy
                          </span>
                        )}
                        {group.picks.filter(p => p.signal?.toUpperCase().includes("SPECULATIVE")).length > 0 && (
                          <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-700">
                            {group.picks.filter(p => p.signal?.toUpperCase().includes("SPECULATIVE")).length} Spec
                          </span>
                        )}
                      </div>
                      {expandedDates.has(group.date) ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Picks Grid */}
                  <AnimatePresence>
                    {expandedDates.has(group.date) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-terminal-black/50">
                          {group.picks.map((record, index) => (
                            <motion.div
                              key={record.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
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
                                reasoning={record.reasoning?.replace("[AI-SCREENER] ", "") || ""}
                                date={new Date(record.date_created)}
                                onViewChart={handleViewChart}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>

            {groupedByDate.length === 0 && (
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
          </div>
        ) : (
          /* Table View - Flat list for table */
          <div className="bg-terminal-gray border border-gray-800 rounded-lg overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="bg-gray-900 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="p-4">DATE</th>
                    <th className="p-4">TICKER</th>
                    <th className="p-4">SIGNAL</th>
                    <th className="p-4">RRR</th>
                    <th className="p-4">ENTRY AREA</th>
                    <th className="p-4">TARGETS (TP)</th>
                    <th className="p-4">STOP LOSS</th>
                    <th className="p-4 w-1/4">AI REASONING</th>
                    <th className="p-4">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {groupedByDate.flatMap(group => group.picks).map((record) => {
                    const signalBadge = getSignalBadge(record.signal);
                    // Extract RRR from reasoning if available
                    const rrrMatch = record.reasoning?.match(/RRR:\s*([\d.:]+)/);
                    const rrr = rrrMatch ? rrrMatch[1] : "N/A";
                    
                    return (
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
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${signalBadge.color}`}
                          >
                            {React.createElement(signalBadge.icon, { className: "w-3 h-3" })}
                            {signalBadge.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-cyan-400 font-mono text-sm bg-cyan-900/20 px-2 py-0.5 rounded">
                            {rrr}
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
                            {record.reasoning?.replace(/\[AI-SCREENER\].*?\|/g, "").trim() || ""}
                          </div>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleViewChart(record.ticker)}
                            className="px-3 py-1.5 bg-terminal-green/20 hover:bg-terminal-green/30 text-terminal-green 
                              border border-terminal-green/50 rounded text-xs font-mono transition-colors"
                          >
                            View Chart
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {totalPicks === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-gray-500">
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
