import { StockData, IndicatorData, TimeFrame } from "../types";
import { SMA, EMA, RSI, MACD, BollingerBands } from "technicalindicators";

// Fetch real stock data from Node.js Backend (yahoo-finance2)
export const fetchStockData = async (
  ticker: string,
  timeframe: TimeFrame
): Promise<StockData[]> => {
  try {
    // Use the new Node.js endpoint
    const response = await fetch(`/api/market?ticker=${ticker}&period=${timeframe}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching stock data:", error);
    throw error;
  }
};

// Technical Analysis Calculations (Powered by Library)
export const calculateIndicators = (data: StockData[]): IndicatorData[] => {
  if (data.length === 0) return [];

  const closes = data.map((d) => d.close);

  // 1. SMA
  const sma20Raw = SMA.calculate({ period: 20, values: closes });
  const sma50Raw = SMA.calculate({ period: 50, values: closes });

  // 2. RSI
  const rsiRaw = RSI.calculate({ period: 14, values: closes });

  // 3. MACD
  const macdRaw = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  // 4. Bollinger Bands
  const bbRaw = BollingerBands.calculate({
    period: 20,
    stdDev: 2,
    values: closes,
  });

  // Helper to align data (prepend nulls)
  // TI usually returns result starting from where calculation is possible.
  const align = (result: any[], originalLen: number) => {
    const diff = originalLen - result.length;
    const nulls = Array(diff).fill(null);
    return [...nulls, ...result];
  };

  const sma20 = align(sma20Raw, data.length);
  const sma50 = align(sma50Raw, data.length);
  const rsi = align(rsiRaw, data.length);
  const macd = align(macdRaw, data.length); // Returns objects {MACD, signal, histogram}
  const bb = align(bbRaw, data.length); // Returns objects {middle, upper, lower}

  return data.map((d, i) => {
    // Extract values
    const rsiVal = rsi[i];
    const macdVal = macd[i];
    const bbVal = bb[i];
    const sma20Val = sma20[i];
    const sma50Val = sma50[i];

    // Calculate Technical Score (0-100)
    let techScore = 50;
    const close = d.close;

    // Trend Strength
    if (sma50Val !== null) {
      if (close > sma50Val) techScore += 10;
      else techScore -= 10;
    }

    // Momentum
    if (macdVal && macdVal.histogram) {
      if (macdVal.histogram > 0) techScore += 5;
      else techScore -= 5;
    }

    // RSI Strength
    if (rsiVal !== null) {
      if (rsiVal > 50) techScore += 5;
      else techScore -= 5;
    }

    // Volatility / Bands
    if (bbVal) {
      if (close > bbVal.upper) techScore += 5; // Strong breakout
      if (close < bbVal.lower) techScore -= 5; // Strong breakdown
    }

    return {
      ...d,
      rsi: rsiVal ?? 50,
      macd: macdVal ? macdVal.MACD : null,
      macdSignal: macdVal ? macdVal.signal : null,
      macdHistogram: macdVal ? macdVal.histogram : null,
      bbUpper: bbVal ? bbVal.upper : null,
      bbLower: bbVal ? bbVal.lower : null,
      bbMiddle: bbVal ? bbVal.middle : null,
      sma20: sma20Val,
      sma50: sma50Val,
      technicalConfidence: Math.min(Math.max(techScore, 0), 100),
    };
  });
};
