import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Plus,
  TrendingUp,
  TrendingDown,
  X,
  DollarSign,
  PieChart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { usePortfolioStore, PortfolioPosition } from "../stores";
import toast from "react-hot-toast";

interface AddPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (position: Omit<PortfolioPosition, "id" | "addedAt">) => void;
}

const AddPositionModal: React.FC<AddPositionModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [avgPrice, setAvgPrice] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker || !shares || !avgPrice) return;

    onAdd({
      ticker: ticker.toUpperCase(),
      shares: parseFloat(shares),
      avgPrice: parseFloat(avgPrice),
    });

    setTicker("");
    setShares("");
    setAvgPrice("");
    onClose();
    toast.success("Position added to portfolio");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
              w-full max-w-md bg-terminal-dark border border-gray-700 rounded-xl p-6 z-50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-mono font-bold text-white">Add Position</h3>
              <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1 font-mono">Ticker</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="e.g., BBCA.JK"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 
                    text-white font-mono text-sm focus:border-terminal-green outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1 font-mono">Shares</label>
                  <input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="100"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 
                      text-white font-mono text-sm focus:border-terminal-green outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1 font-mono">Avg Price</label>
                  <input
                    type="number"
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(e.target.value)}
                    placeholder="10000"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 
                      text-white font-mono text-sm focus:border-terminal-green outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-terminal-green hover:bg-terminal-green/80 text-black 
                  font-mono font-bold py-2.5 rounded-lg transition-colors"
              >
                Add Position
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const PortfolioWidget: React.FC = () => {
  const {
    positions,
    addPosition,
    removePosition,
    getTotalValue,
    getTotalCost,
    getTotalPnL,
    getTotalPnLPercent,
  } = usePortfolioStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const totalValue = getTotalValue();
  const totalCost = getTotalCost();
  const totalPnL = getTotalPnL();
  const totalPnLPercent = getTotalPnLPercent();
  const isProfit = totalPnL >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-terminal-darker rounded-xl border border-gray-800 overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-800 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-mono text-gray-400">Portfolio</h3>
          <span className="text-xs text-gray-600">({positions.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <Plus className="w-4 h-4 text-gray-500" />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-3 p-4 border-b border-gray-800">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <DollarSign className="w-3 h-3" />
                  Total Value
                </div>
                <div className="font-mono font-bold text-white">
                  {totalValue.toLocaleString("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <PieChart className="w-3 h-3" />
                  Total P&L
                </div>
                <div
                  className={`font-mono font-bold ${isProfit ? "text-terminal-green" : "text-terminal-red"}`}
                >
                  {isProfit ? "+" : ""}
                  {totalPnLPercent.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Positions */}
            {positions.length === 0 ? (
              <div className="text-center py-6 px-4">
                <Briefcase className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-xs font-mono">No positions yet</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-2 text-xs text-terminal-green hover:underline font-mono"
                >
                  Add your first position
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 max-h-[300px] overflow-y-auto">
                {positions.map((pos) => {
                  const currentValue = (pos.currentPrice || pos.avgPrice) * pos.shares;
                  const costBasis = pos.avgPrice * pos.shares;
                  const pnl = currentValue - costBasis;
                  const pnlPercent = (pnl / costBasis) * 100;
                  const isPosProfit = pnl >= 0;

                  return (
                    <div
                      key={pos.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 group"
                    >
                      <div>
                        <div className="font-mono font-bold text-white text-sm">
                          {pos.ticker.replace(".JK", "")}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {pos.shares} shares @ {pos.avgPrice.toLocaleString("id-ID")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className={`text-xs font-mono ${isPosProfit ? "text-terminal-green" : "text-terminal-red"}`}
                          >
                            {isPosProfit ? "+" : ""}
                            {pnlPercent.toFixed(2)}%
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {currentValue.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            removePosition(pos.id);
                            toast.success("Position removed");
                          }}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                        >
                          <X className="w-3 h-3 text-gray-500 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AddPositionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addPosition}
      />
    </motion.div>
  );
};

export default PortfolioWidget;
