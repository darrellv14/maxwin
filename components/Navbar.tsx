import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Keyboard, LogOut, Shield, User, Wallet } from "lucide-react";
import { logout, isAdmin, getUser } from "../services/authService";
import { LOGO_SIZES } from "../constants/logo";

const Navbar: React.FC = () => {
  const user = getUser();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const getLinkClass = (path: string, baseColor: string = "text-gray-300") => {
    const active = isActive(path);
    return `text-xs font-mono bg-gray-900 px-3 py-1 rounded-full border transition-colors flex items-center gap-2 ${
      active
        ? "border-profit-green bg-gray-800 " + baseColor
        : "border-gray-800 hover:bg-gray-800 " + baseColor
    }`;
  };

  return (
    <header className="border-b border-gray-800 bg-terminal-dark/50 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex justify-between items-center 2xl:max-w-none">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 sm:gap-3">
          <img
            src={LOGO_SIZES.sm}
            srcSet={`${LOGO_SIZES.sm} 1x, ${LOGO_SIZES.smRetina} 2x`}
            alt="MooCuan Logo"
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
            width="40"
            height="40"
          />
          <h1 className="text-base sm:text-xl font-bold tracking-tight text-white font-mono">
            MOO<span className="text-profit-green">CUAN</span>
          </h1>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-3 lg:gap-4">
          <button
            onClick={() => {
              const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
              document.dispatchEvent(event);
            }}
            className="hidden lg:flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-gray-200 bg-gray-900 px-3 py-1.5 rounded border border-gray-800"
            aria-label="Open command palette (Cmd+K)"
          >
            <Keyboard className="w-3 h-3" />
            <span>Cmd+K</span>
          </button>

          <Link to="/screener" className={getLinkClass("/screener", "text-profit-green")}>
            <span className="w-2 h-2 bg-profit-green rounded-full animate-pulse"></span>
            <span className="hidden lg:inline">AI SCREENER</span>
            <span className="lg:hidden">AI</span>
          </Link>

          <Link to="/history" className={getLinkClass("/history")}>
            <span className="hidden lg:inline">VIEW HISTORY</span>
            <span className="lg:hidden">HISTORY</span>
          </Link>

          <Link to="/portfolio" className={getLinkClass("/portfolio", "text-blue-400")}>
            <Wallet className="w-3 h-3" />
            <span className="hidden lg:inline">PORTFOLIO</span>
            <span className="lg:hidden">PORT</span>
          </Link>

          {isAdmin() && (
            <Link
              to="/admin"
              className={`text-xs font-mono px-3 py-1 rounded-full border transition-colors flex items-center gap-2 ${
                isActive("/admin")
                  ? "bg-purple-800 border-purple-500 text-purple-200"
                  : "bg-purple-900/50 border-purple-700 hover:bg-purple-800 text-purple-300"
              }`}
            >
              <Shield className="w-3 h-3" />
              <span className="hidden lg:inline">ADMIN</span>
            </Link>
          )}

          <Link to="/account" className={getLinkClass("/account")}>
            <User className="w-3 h-3" />
            <span className="hidden lg:inline">ACCOUNT</span>
            <span className="lg:hidden">ACC</span>
          </Link>

          <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
            <span className="text-xs text-gray-400 hidden lg:block">{user?.name}</span>
            <button
              onClick={logout}
              className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </nav>

        {/* Mobile Nav */}
        <nav className="flex md:hidden items-center gap-2">
          <Link
            to="/account"
            className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
              isActive("/account") ? "bg-gray-800 border-profit-green" : "bg-gray-900 border-gray-800"
            } text-gray-300`}
          >
            👤
          </Link>
          <Link
            to="/screener"
            className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
              isActive("/screener") ? "bg-gray-800 border-profit-green" : "bg-gray-900 border-gray-800"
            } text-profit-green`}
          >
            AI
          </Link>
          <Link
            to="/history"
            className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
              isActive("/history") ? "bg-gray-800 border-profit-green" : "bg-gray-900 border-gray-800"
            } text-gray-300`}
          >
            📊
          </Link>
          <Link
            to="/portfolio"
            className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
              isActive("/portfolio") ? "bg-gray-800 border-profit-green" : "bg-gray-900 border-gray-800"
            } text-blue-400`}
          >
            💼
          </Link>
          {isAdmin() && (
            <Link
              to="/admin"
              className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
                isActive("/admin") ? "bg-purple-800 border-purple-500" : "bg-purple-900/50 border-purple-700"
              } text-purple-300`}
            >
              <Shield className="w-3 h-3" />
            </Link>
          )}
          <button
            onClick={logout}
            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
