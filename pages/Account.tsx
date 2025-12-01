import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, User, Mail, Calendar, Lock, Loader2, CheckCircle } from "lucide-react";
import { getUser, changePassword } from "../services/authService";
import { useToast } from "../components/ToastProvider";
import Navbar from "../components/Navbar";

const Account: React.FC = () => {
  const user = getUser();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showToast("Semua field harus diisi", "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast("Password baru minimal 8 karakter", "error");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast("Konfirmasi password baru tidak cocok", "error");
      return;
    }

    if (newPassword === currentPassword) {
      showToast("Password baru tidak boleh sama dengan password lama", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword: confirmNewPassword,
      });

      if (res.success) {
        showToast("Password berhasil diubah ✅", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        showToast(res.message || "Gagal mengubah password", "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan. Coba lagi.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-terminal-black text-gray-200">
      <Navbar />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Grid: Profile + Change Password */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 sm:gap-6">
          {/* Profile summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-2 bg-terminal-gray border border-gray-800 rounded-xl p-4 sm:p-5"
          >
            <h2 className="text-sm sm:text-base font-mono font-bold text-white mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-profit-green" />
              Account Overview
            </h2>

            <div className="space-y-3 text-xs sm:text-sm font-mono">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 uppercase text-[10px] sm:text-xs">Name</p>
                  <p className="text-white">{user?.name}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 uppercase text-[10px] sm:text-xs">Email</p>
                  <p className="text-white break-all">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <p className="text-gray-500 uppercase text-[10px] sm:text-xs">Role</p>
                  <p className="text-white capitalize">{user?.role}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                    Status:{" "}
                    <span
                      className={
                        user?.status === "approved"
                          ? "text-profit-green"
                          : user?.status === "rejected"
                            ? "text-loss-red"
                            : "text-yellow-400"
                      }
                    >
                      {user?.status?.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>

              {user?.createdAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 uppercase text-[10px] sm:text-xs">Joined</p>
                    <p className="text-white">
                      {new Date(user.createdAt).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Change Password */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="md:col-span-3 bg-terminal-gray border border-gray-800 rounded-xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-sm sm:text-base font-mono font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-profit-green" />
                Change Password
              </h2>
              <span className="text-[10px] sm:text-xs text-gray-500 font-mono">
                Minimal 8 karakter
              </span>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 uppercase">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm
                    placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono transition-colors"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 uppercase">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 bg-black border border-gray-700 rounded-lg text-white text-sm
                      placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono transition-colors"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 uppercase">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className={`w-full px-3 sm:px-4 py-2.5 bg-black border rounded-lg text-white text-sm
                      placeholder-gray-600 focus:outline-none font-mono transition-colors ${
                        confirmNewPassword && newPassword !== confirmNewPassword
                          ? "border-loss-red focus:border-loss-red"
                          : "border-gray-700 focus:border-profit-green"
                      }`}
                    placeholder="••••••••"
                    required
                  />
                  {confirmNewPassword && newPassword !== confirmNewPassword && (
                    <p className="text-[10px] sm:text-xs text-loss-red mt-1 font-mono">
                      Password tidak cocok
                    </p>
                  )}
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={
                  isLoading ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmNewPassword ||
                  newPassword !== confirmNewPassword
                }
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2.5 sm:py-3 bg-profit-green text-black font-bold font-mono uppercase text-xs sm:text-sm
                  rounded-lg shadow-lg shadow-profit-green/20 hover:shadow-profit-green/40 
                  transition-all flex items-center justify-center gap-2 disabled:opacity-50
                  hover:bg-profit-green/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>UPDATING...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>UPDATE PASSWORD</span>
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Account;
