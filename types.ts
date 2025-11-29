export interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData extends StockData {
  // Core indicators
  rsi: number | null; // Wilder’s RSI 14
  macd: number | null; // EMA(12) - EMA(26)
  macdSignal: number | null; // EMA 9 dari MACD
  macdHistogram: number | null; // MACD - Signal

  // Bollinger Bands (20, 2σ)
  bbUpper: number | null;
  bbLower: number | null;
  bbMiddle: number | null; // middle band = SMA 20

  // Moving averages
  sma20: number | null;
  sma50: number | null;

  // Our custom quant score 0–100
  technicalConfidence: number; // always set in calculateIndicators
}

export enum SignalType {
  BUY = "BUY",
  SELL = "SELL",
  HOLD = "HOLD",
  WAIT = "WAITING",
}

export interface SentimentData {
  type: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
  headline: string | null;
  description: string | null;
  source: string | null;
}

export interface AIAnalysisResult {
  ticker?: string;
  signal: SignalType;
  confidence: number;
  reasoning: string;
  entryArea: string;
  stopLoss: string;
  takeProfit1: string;
  takeProfit2: string;
  predictionTime: string;
  sentiment?: SentimentData | null;
}

// Harus match dengan period di /api/market handler:
export type TimeFrame = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";
