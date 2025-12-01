import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Plus, X, DollarSign, PieChart, ChevronDown, ChevronUp } from "lucide-react";
import { usePortfolioStore, PortfolioPosition } from "../stores";
import { toast } from "sonner";
import ConfirmModal from "./ConfirmModal";

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
              w-full max-w-md bg-terminal-gray border border-gray-800 rounded-xl p-5 sm:p-6 z-50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-mono font-bold text-white">ADD POSITION</h3>
              <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 font-mono uppercase">
                  Ticker
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="e.g., BBCA.JK"
                  className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 
                    text-white font-mono text-sm focus:border-terminal-green outline-none placeholder-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 font-mono uppercase">
                    Shares
                  </label>
                  <input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="100"
                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 
                      text-white font-mono text-sm focus:border-terminal-green outline-none placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs text-gray-400 mb-1 font-mono uppercase">
                    Avg Price
                  </label>
                  <input
                    type="number"
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(e.target.value)}
                    placeholder="10000"
                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-2 
                      text-white font-mono text-sm focus:border-terminal-green outline-none placeholder-gray-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-terminal-green hover:bg-terminal-green/80 text-black 
                  font-mono font-bold py-2.5 rounded-lg transition-colors text-sm"
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
    addTransaction,
    removePosition,
    fetchPositions,
    getTotalValue,
    getTotalPnL,
    getTotalPnLPercent,
  } = usePortfolioStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ticker: string }>({
    isOpen: false,
    ticker: "",
  });

  // Auto-fetch positions on mount and every 60 seconds
  useEffect(() => {
    fetchPositions();

    const interval = setInterval(() => {
      fetchPositions();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [fetchPositions]);

  const handleAddPosition = async (
    position: Omit<PortfolioPosition, "id" | "addedAt" | "updatedAt">
  ) => {
    try {
      await addTransaction({
        ticker: position.ticker,
        type: "buy",
        shares: position.shares,
        price: position.avgPrice,
        notes: position.name,
      });
    } catch (error) {
      toast.error("Failed to add position");
    }
  };

  const totalValue = getTotalValue();
  const totalPnL = getTotalPnL();
  const totalPnLPercent = getTotalPnLPercent();
  const isProfit = totalPnL >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-terminal-gray rounded-xl border border-gray-800 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <button
        type="button"
        className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-800 bg-black/40 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black/60 border border-gray-700 rounded-lg flex items-center justify-center">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[10px] sm:text-xs font-mono text-gray-500">PORTFOLIO</span>
            <span className="text-xs sm:text-sm font-mono text-gray-200">
              {positions.length} <span className="text-gray-500">positions</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono ${
              isProfit
                ? "border-terminal-green/60 text-terminal-green bg-terminal-green/10"
                : "border-terminal-red/60 text-terminal-red bg-terminal-red/10"
            }`}
          >
            <span>
              {isProfit ? "+" : ""}
              {totalPnLPercent.toFixed(2)}%
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 p-3 sm:p-4 border-b border-gray-800 bg-black/30">
              <div className="bg-black/60 rounded-lg p-2.5 sm:p-3">
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 mb-1">
                  <DollarSign className="w-3 h-3" />
                  <span className="font-mono">Total Value</span>
                </div>
                <div className="font-mono font-bold text-white text-xs sm:text-sm">
                  {totalValue.toLocaleString("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
              <div className="bg-black/60 rounded-lg p-2.5 sm:p-3">
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 mb-1">
                  <PieChart className="w-3 h-3" />
                  <span className="font-mono">Total P&amp;L</span>
                </div>
                <div
                  className={`font-mono font-bold text-xs sm:text-sm ${
                    isProfit ? "text-terminal-green" : "text-terminal-red"
                  }`}
                >
                  {isProfit ? "+" : ""}
                  {totalPnLPercent.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Positions */}
            {positions.length === 0 ? (
              <div className="text-center py-6 px-4">
                <Briefcase className="w-7 h-7 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-[11px] sm:text-xs font-mono">No positions yet</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-2 text-[11px] sm:text-xs text-terminal-green hover:underline font-mono"
                >
                  Add your first position
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-800 max-h-[280px] overflow-y-auto">
                {positions.map((pos) => {
                  const currentValue = (pos.currentPrice || pos.avgPrice) * pos.shares;
                  const costBasis = pos.avgPrice * pos.shares;
                  const pnl = currentValue - costBasis;
                  const pnlPercent = (pnl / costBasis) * 100;
                  const isPosProfit = pnl >= 0;

                  return (
                    <div
                      key={pos.id}
                      className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-800/40 group transition-colors"
                    >
                      <div>
                        <div className="font-mono font-bold text-white text-xs sm:text-sm">
                          {pos.ticker.replace(".JK", "")}
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 font-mono">
                          {pos.shares} shares @ {pos.avgPrice.toLocaleString("id-ID")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className={`text-[10px] sm:text-xs font-mono ${
                              isPosProfit ? "text-terminal-green" : "text-terminal-red"
                            }`}
                          >
                            {isPosProfit ? "+" : ""}
                            {pnlPercent.toFixed(2)}%
                          </div>
                          <div className="text-[10px] sm:text-xs text-gray-500 font-mono">
                            {currentValue.toLocaleString("id-ID", {
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, ticker: pos.ticker })}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                          aria-label={`Remove ${pos.ticker} from portfolio`}
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
        onAdd={handleAddPosition}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, ticker: "" })}
        onConfirm={async () => {
          try {
            await removePosition(deleteConfirm.ticker);
            toast.success("Position removed");
            setDeleteConfirm({ isOpen: false, ticker: "" });
          } catch {
            toast.error("Failed to remove position");
          }
        }}
        title="Hapus Posisi"
        message={`Apakah Anda yakin ingin menghapus ${deleteConfirm.ticker.replace(".JK", "")} dari portfolio?`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </motion.div>
  );
};

export default PortfolioWidget;
