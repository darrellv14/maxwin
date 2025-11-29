import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, Loader2, TrendingUp, BarChart3, Zap, Shield } from "lucide-react";
import { login } from "../services/authService";
import { useToast } from "../components/ToastProvider";

const MOOCUAN_LOGO = "https://res.cloudinary.com/drvu0dpry/image/upload/v1764410228/moocuan-logo_ya5ous.png";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login({ email, password });

      if (result.success) {
        showToast("Login berhasil! Selamat datang 🎉", "success");
        navigate("/");
      } else {
        showToast(result.message || "Login gagal", "error");
      }
    } catch {
      showToast("Terjadi kesalahan. Coba lagi.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-terminal-black flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-terminal-dark border-r border-gray-800 flex-col justify-between p-6 xl:p-12 space-y-4">
        <div>
          <div className="flex items-center gap-3 mb-8 xl:mb-12">
            <img src={MOOCUAN_LOGO} alt="MooCuan" className="w-10 h-10 xl:w-14 xl:h-14 object-contain" />
            <h1 className="text-xl xl:text-2xl font-bold tracking-tight text-white font-mono">
              MOO<span className="text-profit-green">CUAN</span>
            </h1>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl xl:text-4xl font-bold text-white mb-3 xl:mb-4 font-mono">
              AI-Powered
              <br />
              Stock Analysis
            </h2>
            <p className="text-gray-400 text-sm xl:text-lg mb-6 xl:mb-8">
              Analisis saham dengan kekuatan AI. Dapatkan insight trading yang akurat dan real-time.
            </p>
          </motion.div>

          {/* Features */}
          <div className="space-y-3 xl:space-y-4 mt-8 xl:mt-12">
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
                className="flex items-center gap-2 xl:gap-3"
              >
                <div className="w-8 h-8 xl:w-10 xl:h-10 bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
                  <feature.icon className={`w-4 h-4 xl:w-5 xl:h-5 ${feature.color}`} />
                </div>
                <span className="text-gray-300 font-mono text-sm xl:text-base">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Terminal Effect */}
        <div className="bg-black border border-gray-800 rounded-lg p-3 xl:p-4 font-mono text-xs xl:text-sm">
          <div className="flex items-center gap-1.5 xl:gap-2 mb-2">
            <div className="w-2 h-2 xl:w-3 xl:h-3 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 xl:w-3 xl:h-3 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 xl:w-3 xl:h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="text-gray-500">
            <span className="text-profit-green">$</span> analyzing BBCA.JK...
            <br />
            <span className="text-profit-green">$</span> RSI:{" "}
            <span className="text-blue-400">45.23</span> | MACD:{" "}
            <span className="text-profit-green">+0.0042</span>
            <br />
            <span className="text-profit-green">$</span> Signal:{" "}
            <span className="text-profit-green animate-pulse">BUY</span>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none lg:left-1/2">
          <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-profit-green/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative"
        >
          {/* Mobile Logo */}
          <div className="text-center mb-6 sm:mb-8 lg:hidden">
            <div className="flex flex-col items-center gap-2 mb-3 sm:mb-4">
              <img src={MOOCUAN_LOGO} alt="MooCuan" className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
              <span className="text-xl sm:text-2xl font-bold text-white font-mono">
                MOO<span className="text-profit-green">CUAN</span>
              </span>
            </div>
          </div>

          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-mono mb-1 sm:mb-2">Welcome Back</h2>
            <p className="text-gray-500 font-mono text-xs sm:text-sm">Masuk ke akun Anda</p>
          </div>

          {/* Form Card */}
          <div className="bg-terminal-gray border border-gray-800 rounded-xl p-5 sm:p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Email */}
              <div>
                <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 sm:mb-2 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-black border border-gray-700 rounded-lg text-white text-sm sm:text-base
                    placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono
                    transition-colors"
                  placeholder="email@example.com"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 sm:mb-2 uppercase">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 bg-black border border-gray-700 rounded-lg text-white text-sm sm:text-base
                      placeholder-gray-600 focus:outline-none focus:border-profit-green font-mono
                      transition-colors"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2.5 sm:py-3 bg-profit-green text-black font-bold font-mono uppercase text-sm sm:text-base
                  rounded-lg shadow-lg shadow-profit-green/20 hover:shadow-profit-green/40 
                  transition-all flex items-center justify-center gap-2 disabled:opacity-50
                  hover:bg-profit-green/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span>LOADING...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>LOGIN</span>
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 sm:gap-4 my-4 sm:my-6">
              <div className="flex-1 h-px bg-gray-800"></div>
              <span className="text-gray-600 text-[10px] sm:text-xs font-mono">OR</span>
              <div className="flex-1 h-px bg-gray-800"></div>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <p className="text-gray-500 font-mono text-xs sm:text-sm">
                Belum punya akun?{" "}
                <Link to="/register" className="text-profit-green hover:underline font-bold">
                  DAFTAR
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-gray-600 text-[10px] sm:text-xs mt-4 sm:mt-6 font-mono">
            © 2024 MooCuan by Darrell. AI-Powered Stock Analysis.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
