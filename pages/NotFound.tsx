import React from "react";
import { Link } from "react-router-dom";
import { Home, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

const MOOCUAN_LOGO = "https://res.cloudinary.com/drvu0dpry/image/upload/v1764410228/moocuan-logo_ya5ous.png";

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-terminal-black text-gray-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-profit-green/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-red-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,157,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,157,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 sm:space-y-6 max-w-lg relative z-10"
      >
        {/* Logo with glow */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="relative"
          >
            <div className="absolute -inset-3 sm:-inset-4 bg-profit-green/20 rounded-full blur-2xl animate-pulse" />
            <img
              src={MOOCUAN_LOGO}
              alt="MooCuan Logo"
              className="w-20 h-20 sm:w-32 sm:h-32 object-contain relative z-10 grayscale opacity-50"
            />
            <TrendingDown className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-6 h-6 sm:w-10 sm:h-10 text-red-500" />
          </motion.div>
        </div>

        {/* 404 Text */}
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold text-white tracking-tighter font-mono">
            4<span className="text-red-500">0</span>4
          </h1>
        </motion.div>

        <h2 className="text-sm sm:text-lg md:text-xl font-semibold text-gray-300 font-mono">
          HALAMAN TIDAK <span className="text-red-500">DITEMUKAN</span>
        </h2>

        {/* Terminal-style message */}
        <div className="bg-terminal-gray border border-gray-800 rounded-lg p-3 sm:p-4 font-mono text-[10px] sm:text-xs md:text-sm text-left">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="text-gray-500">
            <span className="text-profit-green">$</span> route.find(path)
            <br />
            <span className="text-red-400">Error:</span> Route not found in trading system
            <br />
            <span className="text-profit-green">$</span> Redirecting to dashboard...
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-3 sm:pt-4"
        >
          <Link
            to="/"
            className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 bg-profit-green text-black font-bold font-mono uppercase text-sm sm:text-base
              rounded-lg shadow-lg shadow-profit-green/20 hover:shadow-profit-green/40 
              transition-all hover:bg-profit-green/90 gap-2"
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">KEMBALI KE</span> DASHBOARD
          </Link>
        </motion.div>

        {/* Footer */}
        <p className="text-gray-600 text-[10px] sm:text-xs font-mono pt-3 sm:pt-4">
          © 2024 MooCuan by Darrell. AI-Powered Stock Analysis.
        </p>
      </motion.div>
    </div>
  );
};

export default NotFound;
