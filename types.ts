export interface StockData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorData extends StockData {
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  bbMiddle: number | null;
  sma20: number | null;
  sma50: number | null;
  technicalConfidence?: number;
}

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
  WAIT = 'WAITING'
}

export interface AIAnalysisResult {
  signal: SignalType;
  confidence: number;
  reasoning: string;
  entryArea: string;
  stopLoss: string;
  takeProfit1: string;
  takeProfit2: string;
  predictionTime: string;
}

export type TimeFrame = '1M' | '3M' | '6M' | '1Y';
