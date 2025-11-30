import { create } from "zustand";

const API_URL = import.meta.env.VITE_API_URL || "https://moocuan.darrellvalentino.com";

export interface PortfolioPosition {
  id: number;
  ticker: string;
  name?: string;
  shares: number;
  avgPrice: number;
  currentPrice?: number;
  addedAt: Date;
  updatedAt?: Date;
}

export interface Transaction {
  id: number;
  ticker: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  totalValue: number;
  notes?: string;
  date: Date;
}

interface PortfolioStore {
  positions: PortfolioPosition[];
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  // Fetch data from backend
  fetchPositions: () => Promise<void>;
  fetchTransactions: () => Promise<void>;

  // Position actions (via backend API)
  addTransaction: (data: {
    ticker: string;
    type: "buy" | "sell";
    shares: number;
    price: number;
    notes?: string;
  }) => Promise<void>;
  removePosition: (ticker: string) => Promise<void>;

  // Calculations
  getTotalValue: () => number;
  getTotalCost: () => number;
  getTotalPnL: () => number;
  getTotalPnLPercent: () => number;
}

export const usePortfolioStore = create<PortfolioStore>()((set, get) => ({
  positions: [],
  transactions: [],
  isLoading: false,
  error: null,

  fetchPositions: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/portfolio/positions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch positions");

      const data = await response.json();
      set({
        positions: data.positions.map((p: any) => ({
          ...p,
          addedAt: new Date(p.addedAt),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
        })),
        isLoading: false,
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchTransactions: async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/portfolio/transactions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data = await response.json();
      set({
        transactions: data.transactions.map((t: any) => ({
          ...t,
          date: new Date(t.date),
        })),
      });
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    }
  },

  addTransaction: async (transactionData) => {
    set({ isLoading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/portfolio/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to add transaction");
      }

      // Refresh positions after transaction
      await get().fetchPositions();
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  removePosition: async (ticker) => {
    set({ isLoading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/portfolio/position/${ticker}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to remove position");

      // Refresh positions
      await get().fetchPositions();
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  getTotalValue: () => {
    const { positions } = get();
    return positions.reduce((total, p) => {
      return total + (p.currentPrice || p.avgPrice) * p.shares;
    }, 0);
  },

  getTotalCost: () => {
    const { positions } = get();
    return positions.reduce((total, p) => {
      return total + p.avgPrice * p.shares;
    }, 0);
  },

  getTotalPnL: () => {
    return get().getTotalValue() - get().getTotalCost();
  },

  getTotalPnLPercent: () => {
    const cost = get().getTotalCost();
    if (cost === 0) return 0;
    return (get().getTotalPnL() / cost) * 100;
  },
}));
