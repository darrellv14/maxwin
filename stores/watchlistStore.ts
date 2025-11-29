import { create } from "zustand";
import { persist } from "zustand/middleware";
import { watchlistApi, alertsApi } from "../services/apiService";
import { getToken, onLogout } from "../services/authService";

export interface WatchlistItem {
  ticker: string;
  name?: string;
  addedAt: number;
  lastPrice?: number;
  change?: number;
  changePercent?: number;
  sparklineData?: number[];
}

export interface PriceAlert {
  id: string;
  ticker: string;
  condition: "above" | "below" | "crosses";
  price: number;
  triggered: boolean;
  createdAt: number;
}

interface WatchlistStore {
  watchlist: WatchlistItem[];
  alerts: PriceAlert[];
  recentSearches: string[];
  isSyncing: boolean;

  // Watchlist actions
  addToWatchlist: (ticker: string, name?: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  isInWatchlist: (ticker: string) => boolean;
  updateWatchlistItem: (ticker: string, data: Partial<WatchlistItem>) => void;
  syncWatchlistFromServer: () => Promise<void>;
  clearWatchlist: () => void;

  // Recent searches
  addRecentSearch: (ticker: string) => void;
  clearRecentSearches: () => void;

  // Alerts
  addAlert: (alert: Omit<PriceAlert, "id" | "triggered" | "createdAt">) => void;
  removeAlert: (id: string) => void;
  triggerAlert: (id: string) => void;
  syncAlertsFromServer: () => Promise<void>;
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      watchlist: [],
      alerts: [],
      recentSearches: [],
      isSyncing: false,

      addToWatchlist: async (ticker: string, name?: string) => {
        const normalized = ticker.toUpperCase();
        if (get().isInWatchlist(normalized)) return;

        // Add locally first for instant UI update
        set((state) => ({
          watchlist: [
            ...state.watchlist,
            {
              ticker: normalized,
              name,
              addedAt: Date.now(),
            },
          ],
        }));

        // Sync to server if logged in
        if (getToken()) {
          try {
            await watchlistApi.add(normalized, name);
          } catch (error) {
            console.error("Failed to sync watchlist to server:", error);
          }
        }
      },

      removeFromWatchlist: async (ticker: string) => {
        const normalized = ticker.toUpperCase();

        // Remove locally first
        set((state) => ({
          watchlist: state.watchlist.filter((item) => item.ticker !== normalized),
        }));

        // Sync to server if logged in
        if (getToken()) {
          try {
            await watchlistApi.remove(normalized);
          } catch (error) {
            console.error("Failed to remove from server watchlist:", error);
          }
        }
      },

      isInWatchlist: (ticker: string) => {
        const normalized = ticker.toUpperCase();
        return get().watchlist.some((item) => item.ticker === normalized);
      },

      updateWatchlistItem: (ticker: string, data: Partial<WatchlistItem>) => {
        const normalized = ticker.toUpperCase();
        set((state) => ({
          watchlist: state.watchlist.map((item) =>
            item.ticker === normalized ? { ...item, ...data } : item
          ),
        }));
      },

      syncWatchlistFromServer: async () => {
        if (!getToken()) return;

        set({ isSyncing: true });
        try {
          const serverWatchlist = await watchlistApi.getAll();
          
          // Replace local with server data (don't merge, just use server data)
          set({ 
            watchlist: serverWatchlist.map((w) => ({
              ticker: w.ticker,
              name: w.name,
              addedAt: new Date(w.addedAt).getTime(),
            }))
          });
        } catch (error) {
          console.error("Failed to sync watchlist from server:", error);
        } finally {
          set({ isSyncing: false });
        }
      },

      clearWatchlist: () => {
        set({ watchlist: [], alerts: [], recentSearches: [] });
      },

      addRecentSearch: (ticker: string) => {
        const normalized = ticker.toUpperCase();
        set((state) => {
          const filtered = state.recentSearches.filter((t) => t !== normalized);
          return {
            recentSearches: [normalized, ...filtered].slice(0, 10),
          };
        });
      },

      clearRecentSearches: () => {
        set({ recentSearches: [] });
      },

      addAlert: async (alert) => {
        const newAlert = {
          ...alert,
          id: Date.now().toString(),
          triggered: false,
          createdAt: Date.now(),
        };

        // Add locally first
        set((state) => ({
          alerts: [...state.alerts, newAlert],
        }));

        // Sync to server if logged in
        if (getToken()) {
          try {
            const serverAlert = await alertsApi.create({
              ticker: alert.ticker,
              condition: alert.condition,
              targetPrice: alert.price,
            });
            // Update with server ID
            set((state) => ({
              alerts: state.alerts.map((a) =>
                a.id === newAlert.id ? { ...a, id: serverAlert.id.toString() } : a
              ),
            }));
          } catch (error) {
            console.error("Failed to sync alert to server:", error);
          }
        }
      },

      removeAlert: async (id: string) => {
        // Remove locally first
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        }));

        // Sync to server if logged in
        if (getToken()) {
          try {
            await alertsApi.remove(parseInt(id));
          } catch (error) {
            console.error("Failed to remove alert from server:", error);
          }
        }
      },

      triggerAlert: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, triggered: true } : a)),
        }));
      },

      syncAlertsFromServer: async () => {
        if (!getToken()) return;

        try {
          const serverAlerts = await alertsApi.getAll();
          set({
            alerts: serverAlerts.map((a) => ({
              id: a.id.toString(),
              ticker: a.ticker,
              condition: a.condition,
              price: a.targetPrice,
              triggered: a.triggered,
              createdAt: new Date(a.createdAt).getTime(),
            })),
          });
        } catch (error) {
          console.error("Failed to sync alerts from server:", error);
        }
      },
    }),
    {
      name: "moocuan-watchlist",
    }
  )
);

// Register logout callback to clear watchlist when user logs out
onLogout(() => {
  useWatchlistStore.getState().clearWatchlist();
});
