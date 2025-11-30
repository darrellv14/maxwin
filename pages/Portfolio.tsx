import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  ArrowLeft,
  BarChart3,
  Activity,
  Wallet,
  Target,
  AlertCircle,
} from "lucide-react";
import { usePortfolioStore, PortfolioPosition } from "../stores";
import { toast } from "sonner";
import { getUser, logout } from "../services/authService";

interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  topGainer: PortfolioPosition | null;
  topLoser: PortfolioPosition | null;
}

const Portfolio: React.FC = () => {
  const {
    positions,
    isLoading,
    error,
    fetchPositions,
    addTransaction,
    removePosition,
    getTotalValue,
    getTotalCost,
    getTotalPnL,
    getTotalPnLPercent,
  } = usePortfolioStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null);
  const [formData, setFormData] = useState({
    ticker: "",
    shares: "",
    avgPrice: "",
    name: "",
  });

  const user = getUser();

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Calculate portfolio statistics
  const stats = useMemo<PortfolioStats>(() => {
    let topGainer: PortfolioPosition | null = null;
    let topLoser: PortfolioPosition | null = null;
    let maxGain = -Infinity;
    let maxLoss = Infinity;

    positions.forEach((pos) => {
      const pnlPercent = ((pos.currentPrice || pos.avgPrice) - pos.avgPrice) / pos.avgPrice * 100;
      
      if (pnlPercent > maxGain) {
        maxGain = pnlPercent;
        topGainer = pos;
      }
      if (pnlPercent < maxLoss) {
        maxLoss = pnlPercent;
        topLoser = pos;
      }
    });

    return {
      totalValue: getTotalValue(),
      totalCost: getTotalCost(),
      totalPnL: getTotalPnL(),
      totalPnLPercent: getTotalPnLPercent(),
      topGainer,
      topLoser,
    };
  }, [positions, getTotalValue, getTotalCost, getTotalPnL, getTotalPnLPercent]);

  const handleAddPosition = async () => {
    if (!formData.ticker || !formData.shares || !formData.avgPrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
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

    const currentShares = editingPosition.shares;
    const newShares = parseFloat(formData.shares);
    const diff = newShares - currentShares;

    if (diff === 0) {
      toast.info("No changes to make");
      setEditingPosition(null);
      setFormData({ ticker: "", shares: "", avgPrice: "", name: "" });
      return;
    }

    try {
      await addTransaction({
        ticker: editingPosition.ticker,
        type: diff > 0 ? "buy" : "sell",
        shares: Math.abs(diff),
        price: parseFloat(formData.avgPrice),
        notes: formData.name,
      });
      toast.success(`Updated ${editingPosition.ticker}`);
      setEditingPosition(null);
      setFormData({ ticker: "", shares: "", avgPrice: "", name: "" });
    } catch (err) {
      toast.error((err as Error).message || "Failed to update position");
    }
  };

  const handleDeletePosition = async (ticker: string) => {
    if (!confirm(`Remove ${ticker} from portfolio?`)) return;

    try {
      await removePosition(ticker);
      toast.success(`Removed ${ticker} from portfolio`);
    } catch (err) {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <Wallet className="w-7 h-7 text-cyan-400" />
                Portfolio
              </h1>
              <p className="text-sm text-gray-400 mt-1">Track your investments</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchPositions()}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg transition-all flex items-center gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Position
            </motion.button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm font-mono">TOTAL VALUE</span>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${stats.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Cost: ${stats.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm font-mono">P&L</span>
              {stats.totalPnL >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
              {stats.totalPnL >= 0 ? "+" : ""}${stats.totalPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-xs mt-1 ${stats.totalPnLPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
              {stats.totalPnLPercent >= 0 ? "+" : ""}{stats.totalPnLPercent.toFixed(2)}%
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm font-mono">TOP GAINER</span>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            {stats.topGainer ? (
              <>
                <div className="text-xl font-bold text-gray-100">{stats.topGainer.ticker}</div>
                <div className="text-xs text-green-400 mt-1">
                  +{(((stats.topGainer.currentPrice || stats.topGainer.avgPrice) - stats.topGainer.avgPrice) / stats.topGainer.avgPrice * 100).toFixed(2)}%
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No positions</div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm font-mono">TOP LOSER</span>
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            {stats.topLoser ? (
              <>
                <div className="text-xl font-bold text-gray-100">{stats.topLoser.ticker}</div>
                <div className="text-xs text-red-400 mt-1">
                  {(((stats.topLoser.currentPrice || stats.topLoser.avgPrice) - stats.topLoser.avgPrice) / stats.topLoser.avgPrice * 100).toFixed(2)}%
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">No positions</div>
            )}
          </motion.div>
        </div>

        {/* Positions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Positions ({positions.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading positions...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              {error}
            </div>
          ) : positions.length === 0 ? (
            <div className="p-12 text-center">
              <PieChart className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-4">No positions yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg transition-all font-semibold"
              >
                Add Your First Position
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-400">
                      Ticker
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-mono uppercase tracking-wider text-gray-400">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-mono uppercase tracking-wider text-gray-400">
                      Avg Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-mono uppercase tracking-wider text-gray-400">
                      Current
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-mono uppercase tracking-wider text-gray-400">
                      Value
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-mono uppercase tracking-wider text-gray-400">
                      P&L
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-mono uppercase tracking-wider text-gray-400">
                      P&L %
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-mono uppercase tracking-wider text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <AnimatePresence>
                    {positions.map((pos, idx) => {
                      const { value, cost, pnl, pnlPercent } = calculatePnL(pos);
                      return (
                        <motion.tr
                          key={pos.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: idx * 0.05 }}
                          className="hover:bg-gray-700/30 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                              <span className="font-mono font-semibold text-gray-100">{pos.ticker}</span>
                            </div>
                            {pos.name && (
                              <div className="text-xs text-gray-500 mt-1">{pos.name}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-300">
                            {pos.shares.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-300">
                            ${pos.avgPrice.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-300">
                            ${(pos.currentPrice || pos.avgPrice).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-100 font-semibold">
                            ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-right font-mono font-semibold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {pnl >= 0 ? "+" : ""}${pnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-right font-mono font-semibold ${pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(pos)}
                                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                aria-label="Edit position"
                              >
                                <Edit2 className="w-4 h-4 text-blue-400" />
                              </button>
                              <button
                                onClick={() => handleDeletePosition(pos.ticker)}
                                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                aria-label="Delete position"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
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

        {/* Allocation Chart Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-cyan-400" />
            Allocation
          </h2>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Allocation chart coming soon</p>
            </div>
          </div>
        </motion.div>
      </div>

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
              className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold mb-4 text-gray-100">
                {editingPosition ? "Edit Position" : "Add New Position"}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2">
                    Ticker *
                  </label>
                  <input
                    type="text"
                    value={formData.ticker}
                    onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                    placeholder="e.g., BBCA.JK"
                    disabled={!!editingPosition}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-100 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2">
                    Shares *
                  </label>
                  <input
                    type="number"
                    value={formData.shares}
                    onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                    placeholder="100"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2">
                    Average Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.avgPrice}
                    onChange={(e) => setFormData({ ...formData, avgPrice: e.target.value })}
                    placeholder="10500.00"
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2">
                    Name (Optional)
                  </label>
                  <textarea
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Company name or notes..."
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-100 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPosition(null);
                    setFormData({ ticker: "", shares: "", avgPrice: "", name: "" });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingPosition ? handleUpdatePosition : handleAddPosition}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg transition-all font-semibold"
                >
                  {editingPosition ? "Update" : "Add Position"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Portfolio;
