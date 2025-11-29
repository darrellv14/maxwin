import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PortfolioPosition {
  id: string;
  ticker: string;
  name?: string;
  shares: number;
  avgPrice: number;
  currentPrice?: number;
  addedAt: number;
}

export interface Transaction {
  id: string;
  ticker: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  date: number;
  notes?: string;
}

interface PortfolioStore {
  positions: PortfolioPosition[];
  transactions: Transaction[];

  // Position actions
  addPosition: (position: Omit<PortfolioPosition, "id" | "addedAt">) => void;
  updatePosition: (id: string, data: Partial<PortfolioPosition>) => void;
  removePosition: (id: string) => void;

  // Transaction actions
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  removeTransaction: (id: string) => void;

  // Calculations
  getTotalValue: () => number;
  getTotalCost: () => number;
  getTotalPnL: () => number;
  getTotalPnLPercent: () => number;
}

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      positions: [],
      transactions: [],

      addPosition: (position) => {
        set((state) => ({
          positions: [
            ...state.positions,
            {
              ...position,
              id: Date.now().toString(),
              addedAt: Date.now(),
            },
          ],
        }));
      },

      updatePosition: (id, data) => {
        set((state) => ({
          positions: state.positions.map((p) => (p.id === id ? { ...p, ...data } : p)),
        }));
      },

      removePosition: (id) => {
        set((state) => ({
          positions: state.positions.filter((p) => p.id !== id),
        }));
      },

      addTransaction: (transaction) => {
        set((state) => ({
          transactions: [
            ...state.transactions,
            {
              ...transaction,
              id: Date.now().toString(),
            },
          ],
        }));
      },

      removeTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        }));
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
    }),
    {
      name: "moocuan-portfolio",
    }
  )
);
