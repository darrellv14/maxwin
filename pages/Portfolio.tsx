import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Plus,
  Trash2,
  Edit2,
  BarChart3,
  AlertCircle,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { usePortfolioStore, PortfolioPosition } from "../stores";
import { toast } from "sonner";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";

interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  topGainer: PortfolioPosition | null;
  topGainerPercent: number;
  topLoser: PortfolioPosition | null;
  topLoserPercent: number;
}

const Portfolio: React.FC = () => {
  const {
    positions,
    isLoading,
    error,
    fetchPositions,
    updatePosition,
    removePosition,
    getTotalValue,
    getTotalCost,
    getTotalPnL,
    getTotalPnLPercent,
  } = usePortfolioStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ticker: string }>({
    isOpen: false,
    ticker: "",
  });
  const [formData, setFormData] = useState({
    ticker: "",
    shares: "",
    avgPrice: "",
    name: "",
  });

  // Auto-fetch positions on mount and every 60 seconds
  useEffect(() => {
    fetchPositions();

    const interval = setInterval(() => {
      fetchPositions();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [fetchPositions]);

  const stats = useMemo<PortfolioStats>(() => {
    let topGainer: PortfolioPosition | null = null;
    let topLoser: PortfolioPosition | null = null;
    let topGainerPercent = 0;
    let topLoserPercent = 0;

    positions.forEach((pos) => {
      const pnlPercent = (((pos.currentPrice || pos.avgPrice) - pos.avgPrice) / pos.avgPrice) * 100;

      // Only set as top gainer if actually in profit (pnlPercent > 0)
      if (pnlPercent > 0 && pnlPercent > topGainerPercent) {
        topGainerPercent = pnlPercent;
        topGainer = pos;
      }
      // Only set as top loser if actually in loss (pnlPercent < 0)
      if (pnlPercent < 0 && pnlPercent < topLoserPercent) {
        topLoserPercent = pnlPercent;
        topLoser = pos;
      }
    });

    return {
      totalValue: getTotalValue(),
      totalCost: getTotalCost(),
      totalPnL: getTotalPnL(),
      totalPnLPercent: getTotalPnLPercent(),
      topGainer,
      topGainerPercent,
      topLoser,
      topLoserPercent,
    };
  }, [positions, getTotalValue, getTotalCost, getTotalPnL, getTotalPnLPercent]);

  const handleAddPosition = async () => {
    if (!formData.ticker || !formData.shares || !formData.avgPrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const { addTransaction } = usePortfolioStore.getState();
      await addTransaction({
        ticker: formData.ticker.toUpperCase(),
        type: "buy",
        shares: parseFloat(formData.shares),
        price: parseFloat(formData.avgPrice),
        notes: formData.name,
      });
      toast.success(`Added ${formData.ticker.toUpperCase()} to portfolio`);
      setShowAddModal(false);
      setFormData({ ticker: "", shares: "", avgPrice: "", name: "" });
    } catch (err) {
      toast.error((err as Error).message || "Failed to add position");
    }
  };

  const handleUpdatePosition = async () => {
    if (!editingPosition) return;

    try {
      await updatePosition(editingPosition.ticker, {
        shares: parseFloat(formData.shares),
        avgPrice: parseFloat(formData.avgPrice),
        name: formData.name || undefined,
      });
      toast.success(`Updated ${editingPosition.ticker}`);
      setEditingPosition(null);
      setFormData({ ticker: "", shares: "", avgPrice: "", name: "" });
    } catch (err) {
      toast.error((err as Error).message || "Failed to update position");
    }
  };

  const handleDeletePosition = async () => {
    if (!deleteConfirm.ticker) return;

    try {
      await removePosition(deleteConfirm.ticker);
      toast.success(`Removed ${deleteConfirm.ticker} from portfolio`);
      setDeleteConfirm({ isOpen: false, ticker: "" });
    } catch {
      toast.error("Failed to remove position");
    }
  };

  const openEditModal = (pos: PortfolioPosition) => {
    setEditingPosition(pos);
    setFormData({
      ticker: pos.ticker,
      shares: pos.shares.toString(),
      avgPrice: pos.avgPrice.toString(),
      name: pos.name || "",
    });
  };

  const calculatePnL = (pos: PortfolioPosition) => {
    const currentPrice = pos.currentPrice || pos.avgPrice;
    const value = pos.shares * currentPrice;
    const cost = pos.shares * pos.avgPrice;
    const pnl = value - cost;
    const pnlPercent = (pnl / cost) * 100;
    return { value, cost, pnl, pnlPercent };
  };

  return (
    <div className="min-h-screen bg-terminal-black text-gray-200 font-sans selection:bg-green-900 selection:text-white pb-6 md:pb-10">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 mt-4 sm:mt-6 2xl:max-w-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-profit-green" />
              PORTFOLIO OVERVIEW
            </h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              Monitor posisi saham dan crypto yang tersimpan di MooCuan
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-profit-green text-black text-xs sm:text-sm rounded-lg font-mono font-bold hover:bg-profit-green/90 transition-colors"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">ADD POSITION</span>
            <span className="xs:hidden">ADD</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-3 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 font-mono uppercase">
                  Total Value
                </p>
                <p className="text-lg sm:text-2xl font-bold font-mono text-profit-green mt-1">
                  {stats.totalValue.toLocaleString("id-ID")}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  Cost: {stats.totalCost.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-profit-green/10 rounded-lg flex items-center justify-center border border-profit-green/30">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-profit-green" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-3 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 font-mono uppercase">
                  Unrealized P&L
                </p>
                <p
                  className={`text-lg sm:text-2xl font-bold font-mono ${
                    stats.totalPnL >= 0 ? "text-profit-green" : "text-loss-red"
                  } mt-1`}
                >
                  {stats.totalPnL >= 0 ? "+" : ""}
                  {stats.totalPnL.toLocaleString("id-ID")}
                </p>
                <p
                  className={`text-[10px] sm:text-xs mt-1 ${
                    stats.totalPnLPercent >= 0 ? "text-profit-green" : "text-loss-red"
                  }`}
                >
                  {stats.totalPnLPercent >= 0 ? "+" : ""}
                  {stats.totalPnLPercent.toFixed(2)}%
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-900 rounded-lg flex items-center justify-center border border-gray-700">
                {stats.totalPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-profit-green" />
                ) : (
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-loss-red" />
                )}
              </div>
            </div>
          </motion.div>

          {/* Top Gainer - Only show if there is an actual profit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-3 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 font-mono uppercase">
                  Top Gainer
                </p>
                {stats.topGainer ? (
                  <>
                    <p className="text-base sm:text-xl font-bold font-mono text-white mt-1">
                      {stats.topGainer.ticker.replace(".JK", "")}
                    </p>
                    <p className="text-[10px] sm:text-xs text-profit-green mt-1">
                      +{stats.topGainerPercent.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-2">Belum ada profit</p>
                )}
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-profit-green/10 rounded-lg flex items-center justify-center border border-profit-green/30">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-profit-green" />
              </div>
            </div>
          </motion.div>

          {/* Top Loser - Only show if there is an actual loss */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-3 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-gray-500 font-mono uppercase">
                  Top Loser
                </p>
                {stats.topLoser ? (
                  <>
                    <p className="text-base sm:text-xl font-bold font-mono text-white mt-1">
                      {stats.topLoser.ticker.replace(".JK", "")}
                    </p>
                    <p className="text-[10px] sm:text-xs text-loss-red mt-1">
                      {stats.topLoserPercent.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-2">Belum ada rugi</p>
                )}
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-loss-red/10 rounded-lg flex items-center justify-center border border-loss-red/30">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-loss-red" />
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-terminal-gray border border-gray-800 rounded-lg overflow-hidden"
        >
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm sm:text-lg font-semibold text-white font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-profit-green" />
              POSITIONS
              <span className="text-[10px] sm:text-xs text-gray-500">({positions.length})</span>
            </h3>
            {isLoading && (
              <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
            )}
          </div>

          {isLoading && positions.length === 0 ? (
            <div className="py-10 sm:py-12 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto mb-3" />
              <p className="font-mono text-xs sm:text-sm">Loading positions...</p>
            </div>
          ) : error ? (
            <div className="py-10 sm:py-12 text-center text-loss-red">
              <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-3" />
              <p className="font-mono text-xs sm:text-sm">{error}</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="py-10 sm:py-12 text-center">
              <PieChart className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-700" />
              <p className="text-gray-400 font-mono text-xs sm:text-sm mb-3">
                Belum ada posisi di portfolio
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-profit-green text-black rounded-lg font-mono text-xs sm:text-sm font-bold hover:bg-profit-green/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                ADD YOUR FIRST POSITION
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-black/80 border-b border-gray-800">
                  <tr className="text-[10px] sm:text-xs font-mono text-gray-500 uppercase">
                    <th className="px-3 sm:px-4 py-2.5 text-left">Ticker</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">Quantity</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">Avg Price</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">Current</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">Value</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">P&L</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">P&L %</th>
                    <th className="px-3 sm:px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-[11px] sm:text-xs md:text-sm font-mono">
                  <AnimatePresence>
                    {positions.map((pos, idx) => {
                      const { value, pnl, pnlPercent } = calculatePnL(pos);
                      return (
                        <motion.tr
                          key={pos.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: idx * 0.03 }}
                          className="hover:bg-gray-900/60 transition-colors"
                        >
                          <td className="px-3 sm:px-4 py-2.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-profit-green" />
                                <span className="font-bold text-white">
                                  {pos.ticker.replace(".JK", "")}
                                </span>
                              </div>
                              {pos.name && (
                                <span className="text-[10px] text-gray-500 mt-0.5">{pos.name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-gray-300">
                            {pos.shares.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-gray-300">
                            {pos.avgPrice.toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-gray-300">
                            {(pos.currentPrice || pos.avgPrice).toLocaleString("id-ID")}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right text-white font-semibold">
                            {value.toLocaleString("id-ID")}
                          </td>
                          <td
                            className={`px-3 sm:px-4 py-2.5 text-right font-semibold ${
                              pnl >= 0 ? "text-profit-green" : "text-loss-red"
                            }`}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {pnl.toLocaleString("id-ID")}
                          </td>
                          <td
                            className={`px-3 sm:px-4 py-2.5 text-right font-semibold ${
                              pnlPercent >= 0 ? "text-profit-green" : "text-loss-red"
                            }`}
                          >
                            {pnlPercent >= 0 ? "+" : ""}
                            {pnlPercent.toFixed(2)}%
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                              <button
                                onClick={() => openEditModal(pos)}
                                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors"
                                aria-label="Edit position"
                              >
                                <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, ticker: pos.ticker })}
                                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors"
                                aria-label="Delete position"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-loss-red" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-4 sm:mt-6 bg-terminal-gray border border-gray-800 rounded-lg p-4 sm:p-6"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-lg font-bold font-mono text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-profit-green" />
              ALLOCATION (COMING SOON)
            </h3>
            <span className="text-[10px] sm:text-xs text-gray-500 font-mono">
              Visual breakdown of your positions
            </span>
          </div>
          <div className="h-40 sm:h-56 flex items-center justify-center text-gray-500">
            <div className="text-center text-[11px] sm:text-xs font-mono">
              Allocation chart will show sector and asset distribution of your portfolio.
            </div>
          </div>
        </motion.div>
      </main>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editingPosition) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowAddModal(false);
              setEditingPosition(null);
              setFormData({ ticker: "", shares: "", avgPrice: "", name: "" });
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-terminal-gray border border-gray-800 rounded-xl p-4 sm:p-6 max-w-md w-full"
            >
              <h3 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 text-white font-mono">
                {editingPosition ? "Edit Position" : "Add New Position"}
              </h3>

              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5">
                    Ticker *
                  </label>
                  <input
                    type="text"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    placeholder="e.g., BBCA.JK"
                    disabled={!!editingPosition}
                    className="w-full px-3 sm:px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-xs sm:text-sm placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5">
                      Shares *
                    </label>
                    <input
                      type="number"
                      value={formData.shares}
                      onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                      placeholder="100"
                      className="w-full px-3 sm:px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-xs sm:text-sm placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5">
                      Average Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.avgPrice}
                      onChange={(e) => setFormData({ ...formData, avgPrice: e.target.value })}
                      placeholder="10500"
                      className="w-full px-3 sm:px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-xs sm:text-sm placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5">
                    Name / Notes (Optional)
                  </label>
                  <textarea
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Company name or notes..."
                    rows={3}
                    className="w-full px-3 sm:px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-xs sm:text-sm placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPosition(null);
                    setFormData({ ticker: "", shares: "", avgPrice: "", name: "" });
                  }}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs sm:text-sm font-mono text-gray-200 border border-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingPosition ? handleUpdatePosition : handleAddPosition}
                  className="flex-1 px-3 sm:px-4 py-2.5 bg-profit-green hover:bg-profit-green/90 rounded-lg text-xs sm:text-sm font-mono font-bold text-black transition-colors"
                >
                  {editingPosition ? "Update" : "Add Position"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, ticker: "" })}
        onConfirm={handleDeletePosition}
        title="Hapus Posisi"
        message={`Apakah Anda yakin ingin menghapus ${deleteConfirm.ticker.replace(".JK", "")} dari portfolio?`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
      />
    </div>
  );
};

export default Portfolio;
