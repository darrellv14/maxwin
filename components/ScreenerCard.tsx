import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Shield,
  Zap,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  Star,
  ChevronDown,
  X,
  BarChart3,
} from "lucide-react";
import { AIAnalysisResult, SignalType } from "../types";
import { useWatchlistStore } from "../stores";
import { toast } from "sonner";

interface ScreenerCardProps {
  analysis?: AIAnalysisResult;
  // Alternative individual props for compatibility
  ticker?: string;
  signal?: "BUY" | "SELL" | SignalType;
  confidence?: number;
  entryPrice?: number;
  tp1?: number;
  tp2?: number;
  stopLoss?: number;
  reasoning?: string;
  date?: Date;
  onViewChart?: (ticker: string) => void;
}

// Confidence meter component
const ConfidenceMeter: React.FC<{ value: number }> = ({ value }) => {
  const getColor = () => {
    if (value >= 80) return "from-green-500 to-emerald-500";
    if (value >= 60) return "from-yellow-500 to-amber-500";
    return "from-red-500 to-orange-500";
  };

  return (
    <div className="relative w-16 h-16">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-gray-800"
        />
        <circle
          cx="18"
          cy="18"
          r="15"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="3"
          strokeDasharray={`${value * 0.94} 100`}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              className="stop-green-500"
              style={{ stopColor: value >= 60 ? "#22c55e" : "#ef4444" }}
            />
            <stop
              offset="100%"
              className="stop-emerald-500"
              style={{ stopColor: value >= 80 ? "#10b981" : "#f97316" }}
            />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-mono font-bold text-sm">{value}%</span>
      </div>
    </div>
  );
};

// Signal badge
const SignalBadge: React.FC<{ signal: SignalType }> = ({ signal }) => {
  const config = {
    [SignalType.BUY]: {
      bg: "bg-green-500/20",
      border: "border-green-500/50",
      text: "text-green-400",
      icon: TrendingUp,
    },
    [SignalType.SELL]: {
      bg: "bg-red-500/20",
      border: "border-red-500/50",
      text: "text-red-400",
      icon: TrendingDown,
    },
    [SignalType.HOLD]: {
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/50",
      text: "text-yellow-400",
      icon: Clock,
    },
  };

  const { bg, border, text, icon: Icon } = config[signal];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${bg} border ${border}`}
    >
      <Icon className={`w-3.5 h-3.5 ${text}`} />
      <span className={`font-mono font-bold text-xs ${text}`}>{signal}</span>
    </div>
  );
};

const ScreenerCard: React.FC<ScreenerCardProps> = ({
  analysis: analysisProp,
  ticker: tickerProp,
  signal: signalProp,
  confidence: confidenceProp,
  entryPrice,
  tp1,
  tp2,
  stopLoss: stopLossProp,
  reasoning: reasoningProp,
  date,
  onViewChart,
}) => {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

  // Normalize props - support both analysis object and individual props
  const analysis: AIAnalysisResult = analysisProp || {
    ticker: tickerProp,
    signal: (signalProp as SignalType) || SignalType.HOLD,
    confidence: confidenceProp || 75,
    reasoning: reasoningProp || "",
    entryArea: entryPrice ? entryPrice.toLocaleString("id-ID") : "-",
    stopLoss: stopLossProp ? stopLossProp.toLocaleString("id-ID") : "-",
    takeProfit1: tp1 ? tp1.toLocaleString("id-ID") : "-",
    takeProfit2: tp2 ? tp2.toLocaleString("id-ID") : "-",
    predictionTime: date
      ? date.toLocaleDateString("id-ID")
      : new Date().toLocaleDateString("id-ID"),
  };

  const isWatched = isInWatchlist(analysis.ticker || "");

  const toggleWatchlist = () => {
    if (!analysis.ticker) return;
    if (isWatched) {
      removeFromWatchlist(analysis.ticker);
      toast.success(`${analysis.ticker} removed from watchlist`);
    } else {
      addToWatchlist(analysis.ticker);
      toast.success(`${analysis.ticker} added to watchlist`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -2 }}
      className="bg-terminal-darker border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-mono font-bold text-xl text-white">
              {analysis.ticker?.replace(".JK", "") || "STOCK"}
            </h3>
            <button
              onClick={toggleWatchlist}
              className={`p-1 rounded transition-colors ${
                isWatched ? "text-yellow-500" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              <Star className="w-4 h-4" fill={isWatched ? "currentColor" : "none"} />
            </button>
          </div>
          <SignalBadge signal={analysis.signal} />
        </div>
        <ConfidenceMeter value={analysis.confidence} />
      </div>

      {/* Reasoning */}
      <div className="mb-4">
        <p className={`text-gray-400 text-sm font-mono ${!isReasoningExpanded ? 'line-clamp-2' : ''}`}>
          "{analysis.reasoning}"
        </p>
        {analysis.reasoning && analysis.reasoning.length > 100 && (
          <button
            onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
            className="text-terminal-green hover:text-terminal-green/80 text-xs font-mono mt-1 flex items-center gap-1 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isReasoningExpanded ? 'rotate-180' : ''}`} />
            {isReasoningExpanded ? 'Show Less' : 'Read More'}
          </button>
        )}
      </div>

      {/* Trade Plan */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
            <Target className="w-3 h-3" />
            Entry
          </div>
          <div className="font-mono text-sm text-white">{analysis.entryArea}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
            <Shield className="w-3 h-3" />
            SL
          </div>
          <div className="font-mono text-sm text-red-400">{analysis.stopLoss}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2.5 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
            <Zap className="w-3 h-3" />
            TP
          </div>
          <div className="font-mono text-sm text-green-400">{analysis.takeProfit1}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{analysis.predictionTime}</span>
        </div>
        <button
          onClick={() => onViewChart?.(analysis.ticker || "")}
          className="flex items-center gap-1.5 text-xs text-terminal-green hover:text-terminal-green/80 
            font-mono transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View Chart
        </button>
      </div>
    </motion.div>
  );
};

// Filter & Sort controls
interface FilterSortControlsProps {
  filter: string;
  sort: string;
  onFilterChange: (f: string) => void;
  onSortChange: (s: string) => void;
}

const FilterSortControls: React.FC<FilterSortControlsProps> = ({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Signal Filter */}
      <div className="flex items-center gap-1">
        <Filter className="w-4 h-4 text-gray-500" />
        {["all", "BUY", "SELL", "HOLD"].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1 text-xs font-mono rounded-full transition-colors ${
              filter === f
                ? "bg-terminal-green/20 text-terminal-green border border-terminal-green/50"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs text-gray-500 mr-1">Sort:</span>
        {[
          { key: "confidence", label: "Confidence" },
          { key: "ticker", label: "Ticker" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => onSortChange(sort === s.key ? `-${s.key}` : s.key)}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-mono rounded-full transition-colors ${
              sort.replace("-", "") === s.key
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
            }`}
          >
            {s.label}
            {sort === s.key && <SortAsc className="w-3 h-3" />}
            {sort === `-${s.key}` && <SortDesc className="w-3 h-3" />}
          </button>
        ))}
      </div>
    </div>
  );
};

// Main Screener Grid
interface ScreenerGridProps {
  results: AIAnalysisResult[];
  onViewChart?: (ticker: string) => void;
  loading?: boolean;
}

export const ScreenerGrid: React.FC<ScreenerGridProps> = ({ results, onViewChart, loading }) => {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("-confidence");

  const filteredAndSorted = useMemo(() => {
    let data = [...results];

    // Filter
    if (filter !== "all") {
      data = data.filter((r) => r.signal === filter);
    }

    // Sort
    const isDesc = sort.startsWith("-");
    const sortKey = sort.replace("-", "") as keyof AIAnalysisResult;

    data.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return isDesc ? bVal - aVal : aVal - bVal;
      }

      return isDesc
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });

    return data;
  }, [results, filter, sort]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-terminal-darker border border-gray-800 rounded-xl p-5 animate-pulse"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <div className="w-20 h-7 bg-gray-800 rounded" />
                <div className="w-16 h-6 bg-gray-800 rounded-full" />
              </div>
              <div className="w-16 h-16 bg-gray-800 rounded-full" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="w-full h-3 bg-gray-800 rounded" />
              <div className="w-4/5 h-3 bg-gray-800 rounded" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-14 bg-gray-800 rounded-lg" />
              <div className="h-14 bg-gray-800 rounded-lg" />
              <div className="h-14 bg-gray-800 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="w-16 h-16 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-mono text-gray-400 mb-2">No Screener Results</h3>
        <p className="text-gray-600 text-sm">Run the AI Screener to get stock recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterSortControls
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredAndSorted.map((analysis, index) => (
            <motion.div
              key={analysis.ticker || index}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
            >
              <ScreenerCard analysis={analysis} onViewChart={onViewChart} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredAndSorted.length === 0 && results.length > 0 && (
        <div className="text-center py-8">
          <Filter className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No results match your filter</p>
        </div>
      )}
    </div>
  );
};

export default ScreenerCard;
