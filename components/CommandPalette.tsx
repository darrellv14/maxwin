import React, { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Search,
  History,
  Star,
  BarChart3,
  Zap,
  X,
  LogOut,
  Shield,
  Home,
} from "lucide-react";
import { useWatchlistStore } from "../stores";
import { isAdmin, logout, getToken } from "../services/authService";

interface CommandPaletteProps {
  onSearch?: (ticker: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ onSearch }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { watchlist, recentSearches, addRecentSearch, syncWatchlistFromServer } = useWatchlistStore();
  const isUserAdmin = isAdmin();
  const isLoggedIn = !!getToken();

  // Sync watchlist from server on mount
  useEffect(() => {
    syncWatchlistFromServer();
  }, [syncWatchlistFromServer]);

  // Keyboard shortcut to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      if (value.startsWith("navigate:")) {
        const page = value.replace("navigate:", "");
        switch (page) {
          case "home":
            navigate("/");
            break;
          case "history":
            navigate("/history");
            break;
          case "screener":
            navigate("/screener");
            break;
          case "admin":
            navigate("/admin");
            break;
          case "login":
            navigate("/login");
            break;
          case "logout":
            logout();
            navigate("/login");
            break;
        }
      } else if (value.startsWith("search:")) {
        const ticker = value.replace("search:", "");
        addRecentSearch(ticker);
        onSearch?.(ticker);
      }
      setOpen(false);
      setSearch("");
    },
    [navigate, onSearch, addRecentSearch]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setOpen(false)}
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-2 right-2 top-[15%] sm:left-1/2 sm:right-auto sm:top-[20%] sm:-translate-x-1/2 w-auto sm:w-full sm:max-w-xl z-50"
          >
            <Command
              className="bg-terminal-dark border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
              shouldFilter={true}
            >
              {/* Input */}
              <div className="flex items-center border-b border-gray-800 px-3 sm:px-4">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search stocks..."
                  className="w-full bg-transparent text-white placeholder-gray-500 py-3 sm:py-4 px-2 sm:px-3 outline-none font-mono text-xs sm:text-sm"
                />
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-800 rounded">
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                </button>
              </div>

              {/* Results */}
              <Command.List className="max-h-[50vh] sm:max-h-[400px] overflow-y-auto p-1.5 sm:p-2">
                <Command.Empty className="py-4 sm:py-6 text-center text-gray-500 text-xs sm:text-sm font-mono">
                  No results found.
                </Command.Empty>

                {/* Quick Search - if input looks like a ticker */}
                {search.length >= 2 && (
                  <Command.Group heading="Quick Search">
                    <Command.Item
                      value={`search:${search.toUpperCase()}`}
                      onSelect={handleSelect}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                        data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                    >
                      <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Search "{search.toUpperCase()}"</span>
                    </Command.Item>
                  </Command.Group>
                )}

                {/* Recent Searches */}
                {recentSearches.length > 0 && !search && (
                  <Command.Group heading="Recent Searches">
                    {recentSearches.slice(0, 5).map((ticker) => (
                      <Command.Item
                        key={ticker}
                        value={`search:${ticker}`}
                        onSelect={handleSelect}
                        className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                          data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                      >
                        <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                        <span>{ticker}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Watchlist */}
                {watchlist.length > 0 && (
                  <Command.Group heading="Watchlist">
                    {watchlist.slice(0, 5).map((item) => (
                      <Command.Item
                        key={item.ticker}
                        value={`search:${item.ticker} ${item.name || ""}`}
                        onSelect={() => handleSelect(`search:${item.ticker}`)}
                        className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                          data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                      >
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500" />
                        <span>{item.ticker}</span>
                        {item.name && <span className="text-gray-500 text-[10px] sm:text-xs hidden sm:inline">{item.name}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {/* Navigation */}
                <Command.Group heading="Navigation">
                  <Command.Item
                    value="navigate:home"
                    onSelect={handleSelect}
                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                      data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                  >
                    <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Home / Dashboard</span>
                  </Command.Item>
                  <Command.Item
                    value="navigate:screener"
                    onSelect={handleSelect}
                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                      data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                  >
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>AI Screener</span>
                  </Command.Item>
                  <Command.Item
                    value="navigate:history"
                    onSelect={handleSelect}
                    className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                      data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                  >
                    <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>History</span>
                  </Command.Item>
                  {isUserAdmin && (
                    <Command.Item
                      value="navigate:admin"
                      onSelect={handleSelect}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                        data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                    >
                      <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Admin Panel</span>
                    </Command.Item>
                  )}
                </Command.Group>

                {/* Actions */}
                <Command.Group heading="Actions">
                  {isLoggedIn ? (
                    <Command.Item
                      value="navigate:logout"
                      onSelect={handleSelect}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                        data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                    >
                      <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Logout</span>
                    </Command.Item>
                  ) : (
                    <Command.Item
                      value="navigate:login"
                      onSelect={handleSelect}
                      className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer text-xs sm:text-sm font-mono
                        data-[selected=true]:bg-terminal-green/20 data-[selected=true]:text-terminal-green"
                    >
                      <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Login</span>
                    </Command.Item>
                  )}
                </Command.Group>
              </Command.List>

              {/* Footer */}
              <div className="border-t border-gray-800 px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between text-[10px] sm:text-xs text-gray-500 font-mono">
                <div className="hidden sm:flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↵</kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">esc</kbd>
                    close
                  </span>
                </div>
                <span className="text-terminal-green">⌘K</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
