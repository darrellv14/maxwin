import { StockData, IndicatorData, TimeFrame } from "../types";

// Real data dari Node.js backend (yahoo-finance2)
export const fetchStockData = async (
  ticker: string,
  timeframe: TimeFrame
): Promise<StockData[]> => {
  try {
    const response = await fetch(
      `/api/market?ticker=${encodeURIComponent(ticker)}&period=${timeframe}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: StockData[] = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching stock data:", error);
    throw error;
  }
};

// --- Core Math Helpers ---

// SMA berbasis harga penutupan
const calculateSMA = (closes: number[], period: number): (number | null)[] => {
  const n = closes.length;
  const out: (number | null)[] = Array(n).fill(null);
  if (n < period) return out;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += closes[i];
    if (i >= period) {
      sum -= closes[i - period];
    }
    if (i >= period - 1) {
      out[i] = sum / period;
    }
  }

  return out;
};

// EMA dengan seed SMA (ta-lib style)
const calculateEMA = (closes: number[], period: number): (number | null)[] => {
  const n = closes.length;
  const out: (number | null)[] = Array(n).fill(null);
  if (n < period) return out;

  const k = 2 / (period + 1);

  // initial SMA untuk seed
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  let ema = sum / period;
  out[period - 1] = ema;

  for (let i = period; i < n; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out[i] = ema;
  }

  return out;
};

// Wilder’s RSI 14
const calculateRSI = (
  closes: number[],
  period: number = 14
): (number | null)[] => {
  const n = closes.length;
  const rsi: (number | null)[] = Array(n).fill(null);
  if (n <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;

  // hitung gain/loss awal (1..period)
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum -= diff; // bikin positif
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  // bar ke-period (index = period) → first RSI
  let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  // Wilder smoothing untuk bar berikutnya
  for (let i = period + 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      rs = avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsi;
};

// Bollinger Bands 20, 2σ (population)
const calculateBollingerBands = (
  closes: number[],
  period: number = 20,
  k: number = 2
): {
  upper: (number | null)[];
  lower: (number | null)[];
  middle: (number | null)[];
} => {
  const n = closes.length;
  const upper: (number | null)[] = Array(n).fill(null);
  const lower: (number | null)[] = Array(n).fill(null);
  const middle = calculateSMA(closes, period); // middle band = SMA

  if (n < period) {
    return { upper, lower, middle };
  }

  for (let i = period - 1; i < n; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i] as number;

    let varianceSum = 0;
    for (let j = 0; j < slice.length; j++) {
      const diff = slice[j] - mean;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / period; // population
    const stdDev = Math.sqrt(variance);

    upper[i] = mean + k * stdDev;
    lower[i] = mean - k * stdDev;
  }

  return { upper, lower, middle };
};

// --- Main Indicator Calculation ---

export const calculateIndicators = (data: StockData[]): IndicatorData[] => {
  const n = data.length;
  if (n === 0) return [];

  const closes = data.map((d) => d.close);

  // Moving averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);

  // RSI (Wilder 14)
  const rsiArray = calculateRSI(closes, 14);

  // MACD (12, 26, 9)
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine: (number | null)[] = Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (ema12[i] != null && ema26[i] != null) {
      macdLine[i] = (ema12[i] as number) - (ema26[i] as number);
    }
  }

  // Signal line: EMA 9 dari MACD; treat null as "no value" sampai ada bar yang cukup
  const macdValuesForEma = macdLine.map((v) => (v == null ? 0 : v)); // seed from 0, EMA will mostly track once non-null
  const macdSignalRaw = calculateEMA(macdValuesForEma, 9);

  // Align signal: kalau MACD-nya null, anggap signal juga null
  const macdSignal: (number | null)[] = macdSignalRaw.map((val, i) =>
    macdLine[i] == null ? null : val
  );

  const macdHistogram: (number | null)[] = Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (macdLine[i] != null && macdSignal[i] != null) {
      macdHistogram[i] = (macdLine[i] as number) - (macdSignal[i] as number);
    }
  }

  // Bollinger Bands (20, 2)
  const { upper: bbUpper, lower: bbLower, middle: bbMiddle } =
    calculateBollingerBands(closes, 20, 2);

  // Merge ke output
  return data.map((d, i) => {
    let techScore = 50;

    const close = d.close;
    const rsiVal = rsiArray[i] ?? 50;
    const macdHist = macdHistogram[i] ?? 0;
    const sma50Val = sma50[i];
    const upper = bbUpper[i];
    const lower = bbLower[i];

    // === Trend component (MA50) ===
    if (sma50Val != null) {
      if (close > sma50Val) techScore += 10; // bullish trend
      else techScore -= 10; // bearish trend
    }

    // === Momentum component (MACD histogram) ===
    if (macdHist > 0) techScore += 5;
    else if (macdHist < 0) techScore -= 5;

    // === RSI component (over/under 50) ===
    if (rsiVal > 55) techScore += 5;
    else if (rsiVal < 45) techScore -= 5;

    // === Volatility / breakout component (Bollinger) ===
    if (upper != null && close > upper) {
      techScore += 5; // strong upside breakout
    }
    if (lower != null && close < lower) {
      techScore -= 5; // strong downside breakdown
    }

    // Clamp 0–100
    const technicalConfidence = Math.max(0, Math.min(100, techScore));

    return {
      ...d,
      rsi: rsiArray[i],
      macd: macdLine[i],
      macdSignal: macdSignal[i],
      macdHistogram: macdHistogram[i],
      bbUpper: bbUpper[i],
      bbLower: bbLower[i],
      bbMiddle: bbMiddle[i],
      sma20: sma20[i],
      sma50: sma50[i],
      technicalConfidence,
    };
  });
};// Technical Analysis Calculations

