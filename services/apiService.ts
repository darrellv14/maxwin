import { getToken } from "./authService";

const API_BASE = "/api";

// Helper for authenticated requests
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
};

// ============ WATCHLIST API ============

export interface WatchlistItem {
  id: number;
  ticker: string;
  name?: string;
  addedAt: string;
}

export const watchlistApi = {
  getAll: async (): Promise<WatchlistItem[]> => {
    const data = await authFetch("/watchlist");
    return data.watchlist;
  },

  add: async (ticker: string, name?: string): Promise<WatchlistItem> => {
    const data = await authFetch("/watchlist", {
      method: "POST",
      body: JSON.stringify({ ticker, name }),
    });
    return data.item;
  },

  remove: async (ticker: string): Promise<void> => {
    await authFetch(`/watchlist?ticker=${ticker}`, {
      method: "DELETE",
    });
  },
};

// ============ PORTFOLIO API ============

export interface PortfolioPosition {
  id: number;
  ticker: string;
  name?: string;
  shares: number;
  avgPrice: number;
  addedAt: string;
  updatedAt: string;
}

export interface PortfolioTransaction {
  id: number;
  ticker: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  totalValue: number;
  notes?: string;
  date: string;
}

export interface PortfolioSummary {
  totalPositions: number;
  totalCost: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
}

export const portfolioApi = {
  getPositions: async (): Promise<PortfolioPosition[]> => {
    const data = await authFetch("/portfolio/positions");
    return data.positions;
  },

  getTransactions: async (
    limit = 50,
    offset = 0
  ): Promise<PortfolioTransaction[]> => {
    const data = await authFetch(
      `/portfolio/transactions?limit=${limit}&offset=${offset}`
    );
    return data.transactions;
  },

  getSummary: async (): Promise<PortfolioSummary> => {
    const data = await authFetch("/portfolio/summary");
    return data.summary;
  },

  addTransaction: async (transaction: {
    ticker: string;
    type: "buy" | "sell";
    shares: number;
    price: number;
    notes?: string;
  }): Promise<void> => {
    await authFetch("/portfolio/transaction", {
      method: "POST",
      body: JSON.stringify(transaction),
    });
  },

  removePosition: async (ticker: string): Promise<void> => {
    await authFetch(`/portfolio/position/${ticker}`, {
      method: "DELETE",
    });
  },
};

// ============ ALERTS API ============

export interface PriceAlert {
  id: number;
  ticker: string;
  condition: "above" | "below" | "crosses";
  targetPrice: number;
  triggered: boolean;
  triggeredAt?: string;
  triggeredPrice?: number;
  active: boolean;
  createdAt: string;
}

export const alertsApi = {
  getAll: async (activeOnly = false): Promise<PriceAlert[]> => {
    const data = await authFetch(`/alerts?active=${activeOnly}`);
    return data.alerts;
  },

  create: async (alert: {
    ticker: string;
    condition: "above" | "below" | "crosses";
    targetPrice: number;
  }): Promise<PriceAlert> => {
    const data = await authFetch("/alerts", {
      method: "POST",
      body: JSON.stringify(alert),
    });
    return data.alert;
  },

  remove: async (id: number): Promise<void> => {
    await authFetch(`/alerts/${id}`, {
      method: "DELETE",
    });
  },

  deactivate: async (id: number): Promise<void> => {
    await authFetch(`/alerts/${id}/deactivate`, {
      method: "PUT",
    });
  },
};

// ============ CHAT API ============

export interface ChatResponse {
  success: boolean;
  response: string;
  type: string;
}

export const chatApi = {
  send: async (
    prompt: string,
    type: "chat" | "analysis" | "education" = "chat",
    context?: string
  ): Promise<string> => {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, type, context }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Chat request failed");
    }

    return data.response;
  },
};
