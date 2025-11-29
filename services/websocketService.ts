import { StockData } from "../types";

type Subscriber = (data: StockData) => void;

class MockWebSocketService {
  private subscribers: Subscriber[] = [];
  private intervalId: any;
  private currentPrice: number = 100;
  private lastDate: Date = new Date();
  private ticker: string = "";

  connect(ticker: string, initialPrice: number, lastDateStr: string) {
    this.ticker = ticker;
    this.currentPrice = initialPrice;
    this.lastDate = new Date(lastDateStr);

    if (this.intervalId) clearInterval(this.intervalId);

    // Poll real data every 10 seconds
    this.intervalId = setInterval(async () => {
      await this.pollRealData();
    }, 10000);
  }

  private async pollRealData() {
    try {
      const response = await fetch(`/api/live?ticker=${this.ticker}`);
      const result = await response.json();

      if (result && result.price) {
        // Construct a candle from the current quote
        // Note: Real-time APIs often just give "price", not full OHLC for the current incomplete candle.
        // We approximate for the visualizer.
        const newData: StockData = {
          date: new Date().toISOString().split("T")[0],
          open: result.open || result.price,
          high: result.price, // Approximation
          low: result.price, // Approximation
          close: result.price,
          volume: 0, // Volume often not available in simple quote
        };

        this.subscribers.forEach((cb) => cb(newData));
      }
    } catch (e) {
      console.error("Polling error", e);
    }
  }

  subscribe(callback: Subscriber) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  disconnect() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.subscribers = [];
  }
}

export const socketService = new MockWebSocketService();
