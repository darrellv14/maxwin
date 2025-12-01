import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAnalysisHistory,
  updateAnalysisStatus,
  AnalysisRecord,
} from "../services/analysisService";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
  ChevronDown,
  Loader2,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  AlertTriangle,
  Calendar,
  Filter,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

// Stats Card Component
const StatsCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, subtitle, icon, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-terminal-darker border border-gray-800 rounded-xl p-3 sm:p-4"
  >
    <div className="flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-xs text-gray-500 font-mono uppercase mb-1 truncate">{title}</p>
        <p className={`text-lg sm:text-2xl font-bold font-mono ${color}`}>{value}</p>
        {subtitle && <p className="text-[10px] sm:text-xs text-gray-600 mt-1 truncate">{subtitle}</p>}
      </div>
      <div className={`p-1.5 sm:p-2 rounded-lg bg-opacity-20 ${color.replace("text-", "bg-")} flex-shrink-0`}>{icon}</div>
    </div>
  </motion.div>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getConfig = () => {
    if (status.includes("TP1"))
      return {
        bg: "bg-green-500/20",
        border: "border-green-500/50",
        text: "text-green-400",
        icon: <CheckCircle className="w-3 h-3" />,
      };
    if (status.includes("TP2"))
      return {
        bg: "bg-emerald-500/20",
        border: "border-emerald-500/50",
        text: "text-emerald-400",
        icon: <Award className="w-3 h-3" />,
      };
    if (status.includes("SL"))
      return {
        bg: "bg-red-500/20",
        border: "border-red-500/50",
        text: "text-red-400",
        icon: <XCircle className="w-3 h-3" />,
      };
    return {
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/50",
      text: "text-yellow-400",
      icon: <Clock className="w-3 h-3" />,
    };
  };

  const config = getConfig();
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} border ${config.border}`}
    >
      {config.icon}
      <span className={`text-xs font-mono font-bold ${config.text}`}>{status}</span>
    </div>
  );
};

// Performance Chart (simple)
const MiniPerformanceChart: React.FC<{
  data: { wins: number; losses: number; active: number };
}> = ({ data }) => {
  const total = data.wins + data.losses + data.active;
  if (total === 0) return null;

  const winPct = (data.wins / total) * 100;
  const lossPct = (data.losses / total) * 100;
  const activePct = (data.active / total) * 100;

  return (
    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
      <div
        className="bg-green-500 h-full transition-all duration-500"
        style={{ width: `${winPct}%` }}
        title={`Wins: ${data.wins}`}
      />
      <div
        className="bg-red-500 h-full transition-all duration-500"
        style={{ width: `${lossPct}%` }}
        title={`Losses: ${data.losses}`}
      />
      <div
        className="bg-yellow-500 h-full transition-all duration-500"
        style={{ width: `${activePct}%` }}
        title={`Active: ${data.active}`}
      />
    </div>
  );
};

const History: React.FC = () => {
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<"all" | "BUY" | "SELL">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "tp" | "sl">("all");

  const fetchHistory = async (currentOffset: number, isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);

      const newRecords = await getAnalysisHistory(ITEMS_PER_PAGE, currentOffset);

      if (newRecords.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      if (isLoadMore) {
        setHistory((prev) => [...prev, ...newRecords]);
      } else {
        setHistory(newRecords);
      }
    } catch (error) {
      console.error("Failed to load history", error);
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHistory(0);
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const wins = history.filter((r) => r.status.includes("TP")).length;
    const losses = history.filter((r) => r.status.includes("SL")).length;
    const active = history.filter((r) => r.status === "ACTIVE").length;
    const total = history.length;
    const winRate = total > 0 ? (wins / (wins + losses)) * 100 || 0 : 0;

    return {
      wins,
      losses,
      active,
      total,
      winRate: winRate.toFixed(1),
    };
  }, [history]);

  // Filtered data
  const filteredHistory = useMemo(() => {
    return history.filter((r) => {
      if (filter !== "all" && r.signal !== filter) return false;
      if (statusFilter === "active" && r.status !== "ACTIVE") return false;
      if (statusFilter === "tp" && !r.status.includes("TP")) return false;
      if (statusFilter === "sl" && !r.status.includes("SL")) return false;
      return true;
    });
  }, [history, filter, statusFilter]);

  const handleLoadMore = () => {
    const newOffset = offset + ITEMS_PER_PAGE;
    setOffset(newOffset);
    fetchHistory(newOffset, true);
  };

  const handleRefreshStatus = async () => {
    setUpdatingStatus(true);
    try {
      await updateAnalysisStatus();
      setOffset(0);
      setHasMore(true);
      await fetchHistory(0, false);
      toast.success("Prices updated successfully");
    } catch (error) {
      console.error("Failed to update status", error);
      toast.error("Failed to update prices");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleExport = () => {
    if (history.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Date",
      "Ticker",
      "Signal",
      "Entry",
      "TP1",
      "TP2",
      "Stop Loss",
      "Highest",
      "Lowest",
      "Status",
    ];
    const rows = history.map((r) => [
      new Date(r.date_created).toLocaleString(),
      r.ticker,
      r.signal,
      r.entry_price,
      r.tp1,
      r.tp2,
      r.stop_loss,
      r.highest_price,
      r.lowest_price,
      r.status,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moocuan-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("History exported to CSV");
  };

  return (
    <div className="min-h-screen bg-terminal-black text-gray-200 font-sans">
      <Navbar />
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-white">
              ANALYSIS <span className="text-profit-green">HISTORY</span>
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Track record of AI Oracle predictions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefreshStatus}
              disabled={updatingStatus || loading}
              className="flex items-center gap-1.5 sm:gap-2 bg-gray-800 hover:bg-gray-700 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-gray-700 font-mono text-xs sm:text-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${updatingStatus ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline">{updatingStatus ? "UPDATING..." : "REFRESH"}</span>
            </button>
            <button
              onClick={handleExport}
              disabled={loading || history.length === 0}
              className="flex items-center gap-1.5 sm:gap-2 bg-gray-800 hover:bg-gray-700 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-gray-700 font-mono text-xs sm:text-sm transition-all disabled:opacity-50"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">EXPORT CSV</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <StatsCard
            title="Total Trades"
            value={stats.total}
            subtitle={`${stats.active} still active`}
            icon={<BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
            color="text-blue-400"
          />
          <StatsCard
            title="Win Rate"
            value={`${stats.winRate}%`}
            subtitle={`${stats.wins}W / ${stats.losses}L`}
            icon={<Target className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />}
            color={parseFloat(stats.winRate) >= 50 ? "text-green-400" : "text-red-400"}
          />
          <StatsCard
            title="Performance"
            value=""
            icon={<Award className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />}
            color="text-white"
          />
        </div>

        {/* Performance Bar */}
        <div className="bg-terminal-darker border border-gray-800 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <span className="text-[10px] sm:text-xs text-gray-500 font-mono">TRADE DISTRIBUTION</span>
            <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs flex-wrap">
              <span className="flex items-center gap-1 text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full" /> Wins ({stats.wins})
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <div className="w-2 h-2 bg-red-500 rounded-full" /> Losses ({stats.losses})
              </span>
              <span className="flex items-center gap-1 text-yellow-400">
                <div className="w-2 h-2 bg-yellow-500 rounded-full" /> Active ({stats.active})
              </span>
            </div>
          </div>
          <MiniPerformanceChart
            data={{ wins: stats.wins, losses: stats.losses, active: stats.active }}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
          <span className="text-[10px] sm:text-xs text-gray-500 mr-1 sm:mr-2">Signal:</span>
          {["all", "BUY", "SELL"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono rounded-full transition-colors ${
                filter === f
                  ? "bg-terminal-green/20 text-terminal-green border border-terminal-green/50"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}

          <span className="text-[10px] sm:text-xs text-gray-500 ml-1 sm:mx-2">Status:</span>
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "tp", label: "TP" },
            { key: "sl", label: "SL" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key as any)}
              className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono rounded-full transition-colors ${
                statusFilter === s.key
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* History Table */}
        <div className="bg-terminal-darker border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 sm:p-12 flex justify-center items-center text-gray-500 font-mono text-xs sm:text-sm">
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mr-2" />
              <span className="hidden sm:inline">LOADING HISTORY DATA...</span>
              <span className="sm:hidden">LOADING...</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px] sm:text-xs md:text-sm font-mono min-w-[700px]">
                  <thead className="bg-gray-900/50 text-gray-500 border-b border-gray-800">
                    <tr>
                      <th className="p-2 sm:p-3 md:p-4">DATE</th>
                      <th className="p-2 sm:p-3 md:p-4">TICKER</th>
                      <th className="p-2 sm:p-3 md:p-4">SIGNAL</th>
                      <th className="p-2 sm:p-3 md:p-4">ENTRY</th>
                      <th className="p-2 sm:p-3 md:p-4">TP1/TP2</th>
                      <th className="p-2 sm:p-3 md:p-4">SL</th>
                      <th className="p-2 sm:p-3 md:p-4">H/L</th>
                      <th className="p-2 sm:p-3 md:p-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    <AnimatePresence mode="popLayout">
                      {filteredHistory.map((record, index) => (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.02 }}
                          className="hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="p-2 sm:p-3 md:p-4">
                            <div className="flex items-center gap-1 sm:gap-2 text-gray-400">
                              <Calendar className="w-3 h-3 hidden sm:block" />
                              <div>
                                <div className="text-[10px] sm:text-xs">{new Date(record.date_created).toLocaleDateString()}</div>
                                <div className="text-[9px] sm:text-[10px] text-gray-600 hidden sm:block">
                                  {new Date(record.date_created).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 md:p-4">
                            <Link
                              to={`/?ticker=${record.ticker}`}
                              className="font-bold text-white hover:text-terminal-green transition-colors text-[10px] sm:text-xs md:text-sm"
                            >
                              {record.ticker.replace(".JK", "")}
                            </Link>
                          </td>
                          <td className="p-2 sm:p-3 md:p-4">
                            <div
                              className={`inline-flex items-center gap-1 text-[10px] sm:text-xs ${
                                record.signal === "BUY" ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {record.signal === "BUY" ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span className="hidden xs:inline">{record.signal}</span>
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 md:p-4 text-white text-[10px] sm:text-xs">{record.entry_price.toLocaleString()}</td>
                          <td className="p-2 sm:p-3 md:p-4">
                            <div className="text-green-400 text-[10px] sm:text-xs">{record.tp1.toLocaleString()}</div>
                            <div className="text-green-300 text-[9px] sm:text-[10px]">
                              {record.tp2.toLocaleString()}
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 md:p-4 text-red-400 text-[10px] sm:text-xs">{record.stop_loss.toLocaleString()}</td>
                          <td className="p-2 sm:p-3 md:p-4">
                            <div className="text-green-400 text-[9px] sm:text-[10px]">
                              H:{record.highest_price.toLocaleString()}
                            </div>
                            <div className="text-red-400 text-[9px] sm:text-[10px]">
                              L:{record.lowest_price.toLocaleString()}
                            </div>
                          </td>
                          <td className="p-2 sm:p-3 md:p-4">
                            <StatusBadge status={record.status} />
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {filteredHistory.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-gray-500">
                          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                          <p>NO RECORDS FOUND</p>
                          {(filter !== "all" || statusFilter !== "all") && (
                            <button
                              onClick={() => {
                                setFilter("all");
                                setStatusFilter("all");
                              }}
                              className="mt-2 text-terminal-green hover:underline text-xs"
                            >
                              Clear filters
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Load More */}
              {hasMore && filteredHistory.length > 0 && (
                <div className="p-4 border-t border-gray-800 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full text-sm font-mono transition-all disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        LOADING...
                      </>
                    ) : (
                      <>
                        LOAD MORE
                        <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
