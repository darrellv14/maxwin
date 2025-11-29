import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  UserPlus,
  Loader2,
  CheckCircle,
  BarChart3,
  Zap,
  TrendingUp,
  Shield,
  Clock,
} from "lucide-react";
import { register } from "../services/authService";
import { useToast } from "../components/ToastProvider";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast("Password tidak cocok", "error");
      return;
    }

    if (password.length < 6) {
      showToast("Password minimal 6 karakter", "error");
      return;
    }

    setIsLoading(true);

    try {
      const result = await register({ email, password, name });

      if (result.success) {
        setIsSuccess(true);
        showToast("Registrasi berhasil! 🎉", "success");
      } else {
        showToast(result.message || "Registrasi gagal", "error");
      }
    } catch {
      showToast("Terjadi kesalahan. Coba lagi.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center p-4">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-profit-green/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center relative"
        >
          <div className="bg-terminal-gray border border-gray-800 rounded-xl p-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 bg-profit-green/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-profit-green/30"
            >
              <CheckCircle className="w-10 h-10 text-profit-green" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white font-mono mb-2">
              REGISTRASI <span className="text-profit-green">BERHASIL!</span>
            </h2>

            <div className="bg-black border border-gray-800 rounded-lg p-4 my-6 text-left font-mono text-sm">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <Clock className="w-4 h-4" />
                <span>Status: PENDING APPROVAL</span>
              </div>
              <p className="text-gray-400 text-xs">
                Akun Anda sedang menunggu persetujuan admin. Kami akan mengaktifkan akun Anda
                segera.
              </p>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-profit-green text-black font-bold font-mono uppercase
                rounded-lg hover:bg-profit-green/90 transition-colors shadow-lg shadow-profit-green/20"
            >
              KEMBALI KE LOGIN
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-black flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-terminal-dark border-r border-gray-800 flex-col p-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-profit-green rounded-full shadow-[0_0_10px_#00ff9d]"></div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
              MOO<span className="text-profit-green">CUAN</span>
            </h1>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-4xl font-bold text-white mb-4 font-mono">
              Join the
              <br />
              <span className="text-profit-green">Smart Traders</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              Bergabung dengan trader cerdas yang menggunakan AI untuk analisis saham.
            </p>
          </motion.div>

          {/* Features */}
          <div className="space-y-4 mt-12">
            {[
              { icon: BarChart3, text: "TradingView-style Charts", color: "text-blue-400" },
              { icon: Zap, text: "AI Stock Screener", color: "text-yellow-400" },
              { icon: TrendingUp, text: "Technical Indicators", color: "text-profit-green" },
              { icon: Shield, text: "Real-time Analysis", color: "text-purple-400" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <span className="text-gray-300 font-mono">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Terminal Effect */}
        <div className="bg-black border border-gray-800 rounded-lg p-4 font-mono text-sm mt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="text-gray-500">
            <span className="text-profit-green">$</span> user.create --premium
            <br />
            <span className="text-profit-green">$</span> Unlocking{" "}
            <span className="text-yellow-400">AI features</span>...
            <br />
            <span className="text-profit-green">$</span> Status:{" "}
            <span className="text-profit-green animate-pulse">READY</span>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none lg:left-1/2">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-profit-green/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative"
        >
          {/* Mobile Logo */}
          <div className="text-center mb-6 lg:hidden">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-profit-green rounded-full shadow-[0_0_10px_#00ff9d]"></div>
              <span className="text-2xl font-bold text-white font-mono">
                MOO<span className="text-profit-green">CUAN</span>
              </span>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white font-mono mb-2">Create Account</h2>
            <p className="text-gray-500 font-mono text-sm">Buat akun baru untuk mulai trading</p>
          </div>

          {/* Form Card */}
          <div className="bg-terminal-gray border border-gray-800 rounded-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-2 uppercase">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white 
                    placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono
                    transition-colors"
                  placeholder="John Doe"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-2 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white 
                    placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono
                    transition-colors"
                  placeholder="email@example.com"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-2 uppercase">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 bg-black border border-gray-700 rounded-lg text-white 
                      placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono
                      transition-colors"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-gray-600 text-xs mt-1 font-mono">Minimal 6 karakter</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-mono text-gray-500 mb-2 uppercase">
                  Konfirmasi Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-3 bg-black border rounded-lg text-white 
                    placeholder-gray-600 focus:outline-none font-mono transition-colors ${
                      confirmPassword && password !== confirmPassword
                        ? "border-red-500 focus:border-red-500"
                        : confirmPassword && password === confirmPassword
                          ? "border-profit-green focus:border-profit-green"
                          : "border-gray-700 focus:border-profit-green"
                    }`}
                  placeholder="••••••••"
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-red-400 text-xs mt-1 font-mono">Password tidak cocok</p>
                )}
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isLoading || !!(confirmPassword && password !== confirmPassword)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 bg-profit-green text-black font-bold font-mono uppercase
                  rounded-lg shadow-lg shadow-profit-green/20 hover:shadow-profit-green/40 
                  transition-all flex items-center justify-center gap-2 disabled:opacity-50
                  hover:bg-profit-green/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>LOADING...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>DAFTAR</span>
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-800"></div>
              <span className="text-gray-600 text-xs font-mono">OR</span>
              <div className="flex-1 h-px bg-gray-800"></div>
            </div>

            {/* Login Link */}
            <div className="text-center">
              <p className="text-gray-500 font-mono text-sm">
                Sudah punya akun?{" "}
                <Link to="/login" className="text-profit-green hover:underline font-bold">
                  LOGIN
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-600 text-xs mt-6 font-mono">
            © 2024 MooCuan by Darrell. AI-Powered Stock Analysis.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
