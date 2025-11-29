import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Home,
  RefreshCw,
  LogOut,
  Activity,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  isAdmin,
  isAuthenticated,
  getPendingUsers,
  getAllUsers,
  approveUser,
  rejectUser,
  logout,
  User,
  getUser,
} from "../services/authService";
import { useToast } from "../components/ToastProvider";

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated() || !isAdmin()) {
      navigate("/login");
      return;
    }
    loadUsers();
  }, [activeTab, navigate]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const result = activeTab === "pending" ? await getPendingUsers() : await getAllUsers();
      if (result.success && result.users) {
        setUsers(result.users);
      }
    } catch {
      showToast("Gagal memuat data users", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userId: number) => {
    setActionLoading(userId);
    try {
      const result = await approveUser(userId);
      if (result.success) {
        showToast("User berhasil disetujui! ✅", "success");
        loadUsers();
      } else {
        showToast(result.message || "Gagal menyetujui user", "error");
      }
    } catch {
      showToast("Terjadi kesalahan", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: number) => {
    setActionLoading(userId);
    try {
      const result = await rejectUser(userId);
      if (result.success) {
        showToast("User ditolak", "success");
        loadUsers();
      } else {
        showToast(result.message || "Gagal menolak user", "error");
      }
    } catch {
      showToast("Terjadi kesalahan", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
          <Shield className="w-3 h-3" />
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full">
        <Users className="w-3 h-3" />
        User
      </span>
    );
  };

  const pendingCount = users.filter((u) => u.status === "pending").length;
  const currentUser = getUser();

  return (
    <div className="min-h-screen bg-terminal-black text-gray-200 font-sans selection:bg-green-900 selection:text-white pb-10">
      {/* Header */}
      <header className="border-b border-gray-800 bg-terminal-dark/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-3 h-3 bg-profit-green rounded-full shadow-[0_0_10px_#00ff9d]"></div>
              <h1 className="text-xl font-bold tracking-tight text-white font-mono">
                MOO<span className="text-profit-green">CUAN</span>
              </h1>
            </Link>
            <div className="h-6 w-px bg-gray-700"></div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-mono font-bold text-sm">ADMIN PANEL</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-xs font-mono bg-gray-900 px-3 py-1.5 rounded border border-gray-800 hover:bg-gray-800 text-gray-300 transition-colors flex items-center gap-2"
            >
              <Home className="w-3 h-3" />
              DASHBOARD
            </Link>

            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-xs text-gray-400 font-mono">{currentUser?.name}</span>
              <button
                onClick={logout}
                className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-mono uppercase">Pending</p>
                <p className="text-2xl font-bold text-yellow-400 font-mono">
                  {users.filter((u) => u.status === "pending").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center border border-yellow-500/20">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
            {pendingCount > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Butuh approval</span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-mono uppercase">Approved</p>
                <p className="text-2xl font-bold text-profit-green font-mono">
                  {users.filter((u) => u.status === "approved").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-profit-green/10 rounded-lg flex items-center justify-center border border-profit-green/20">
                <UserCheck className="w-6 h-6 text-profit-green" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-mono uppercase">Rejected</p>
                <p className="text-2xl font-bold text-loss-red font-mono">
                  {users.filter((u) => u.status === "rejected").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20">
                <UserX className="w-6 h-6 text-loss-red" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-terminal-gray border border-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-mono uppercase">Total Users</p>
                <p className="text-2xl font-bold text-blue-400 font-mono">{users.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs & Actions */}
        <div className="bg-terminal-gray border border-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("pending")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
                  activeTab === "pending"
                    ? "bg-profit-green text-black font-bold"
                    : "bg-black border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                <Clock className="w-4 h-4" />
                PENDING
                {pendingCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-loss-red text-white text-xs rounded-full animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
                  activeTab === "all"
                    ? "bg-profit-green text-black font-bold"
                    : "bg-black border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                <Users className="w-4 h-4" />
                ALL USERS
              </button>
            </div>

            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-700 text-gray-400 
                hover:text-white hover:border-gray-600 rounded-lg transition-colors font-mono text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              REFRESH
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-terminal-gray border border-gray-800 rounded-lg overflow-hidden">
          <div className="border-b border-gray-800 px-4 py-3">
            <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-profit-green" />
              USER MANAGEMENT
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-profit-green animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-mono text-sm">Loading users...</p>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-gray-400 font-mono">
                {activeTab === "pending"
                  ? "Tidak ada user yang menunggu persetujuan"
                  : "Belum ada user terdaftar"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-sm">
                <thead className="bg-black border-b border-gray-800 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                            <span className="text-profit-green font-bold">
                              {user.name?.charAt(0).toUpperCase() || "?"}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-white">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{getRoleBadge(user.role)}</td>
                      <td className="px-4 py-4">{getStatusBadge(user.status)}</td>
                      <td className="px-4 py-4 text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === "pending" && (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleApprove(user.id)}
                                disabled={actionLoading === user.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-profit-green/20 
                                  hover:bg-profit-green/30 text-profit-green rounded-lg text-xs font-bold
                                  transition-colors disabled:opacity-50 border border-profit-green/30"
                              >
                                {actionLoading === user.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                                APPROVE
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleReject(user.id)}
                                disabled={actionLoading === user.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-loss-red/20 
                                  hover:bg-loss-red/30 text-loss-red rounded-lg text-xs font-bold
                                  transition-colors disabled:opacity-50 border border-loss-red/30"
                              >
                                <XCircle className="w-3 h-3" />
                                REJECT
                              </motion.button>
                            </>
                          )}
                          {user.status === "rejected" && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleApprove(user.id)}
                              disabled={actionLoading === user.id}
                              className="flex items-center gap-1 px-3 py-1.5 bg-profit-green/20 
                                hover:bg-profit-green/30 text-profit-green rounded-lg text-xs font-bold
                                transition-colors disabled:opacity-50 border border-profit-green/30"
                            >
                              <CheckCircle className="w-3 h-3" />
                              RE-APPROVE
                            </motion.button>
                          )}
                          {user.status === "approved" && user.role !== "admin" && (
                            <span className="text-xs text-gray-600">Active</span>
                          )}
                          {user.role === "admin" && (
                            <span className="text-xs text-purple-400 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-xs font-mono">
            MooCuan Admin Panel • Total {users.length} users registered
          </p>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
