import { StockData, IndicatorData, TimeFrame } from '../types';

// Fetch real stock data from Python Backend (yfinance)
export const fetchStockData = async (ticker: string, timeframe: TimeFrame): Promise<StockData[]> => {
  try {
    const response = await fetch(`/api/history?ticker=${ticker}&period=${timeframe}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching stock data:", error);
    throw error;
  }
};// Technical Analysis Calculations

const calculateSMA = (data: StockData[], period: number): (number | null)[] => {
  const sma = data.map((_, idx, arr) => {
    if (idx < period - 1) return null;
    const slice = arr.slice(idx - period + 1, idx + 1);
    const sum = slice.reduce((acc, val) => acc + val.close, 0);
    return sum / period;
  });
  return sma;
};

const calculateEMA = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  let ema = data[0];
  
  data.forEach((price, i) => {
    if (i === 0) {
      emaArray.push(price);
    } else {
      ema = price * k + ema * (1 - k);
      emaArray.push(ema);
    }
  });
  return emaArray;
};

export const calculateIndicators = (data: StockData[]): IndicatorData[] => {
  if (data.length === 0) return [];

  const closes = data.map(d => d.close);
  
  // SMA
  const sma20 = calculateSMA(data, 20);
  const sma50 = calculateSMA(data, 50);

  // RSI
  const rsiPeriod = 14;
  const rsiArray: (number | null)[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < data.length; i++) {
    if (i < rsiPeriod) {
        rsiArray.push(null);
        if (i > 0) {
            const diff = data[i].close - data[i-1].close;
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        continue;
    }

    if (i === rsiPeriod) {
        let avgGain = gains / rsiPeriod;
        let avgLoss = losses / rsiPeriod;
        let rs = avgGain / avgLoss;
        rsiArray.push(100 - (100 / (1 + rs)));
    } else {
        // Simplified RSI calculation for demo stability
        // Ideally we use the smoothed average
        const diff = data[i].close - data[i-1].close;
        const currentGain = diff > 0 ? diff : 0;
        const currentLoss = diff < 0 ? -diff : 0;
        
        // For accurate RSI we need the previous avgGain/avgLoss, but here we recalculate on window
        // to be stateless friendly for this simple function.
        // Let's just use a window average for stability in this mocked env
        const slice = data.slice(i - rsiPeriod + 1, i + 1);
        let sGains = 0;
        let sLosses = 0;
        for(let j=1; j<slice.length; j++){
             const d = slice[j].close - slice[j-1].close;
             if(d > 0) sGains += d;
             else sLosses -= d;
        }
        const avgGain = sGains / rsiPeriod;
        const avgLoss = sLosses / rsiPeriod;
        
        if(avgLoss === 0) rsiArray.push(100);
        else {
             const rs = avgGain / avgLoss;
             rsiArray.push(100 - (100 / (1 + rs)));
        }
    }
  }

  // MACD (12, 26, 9)
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12.map((val, i) => val - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  const macdHistogram = macdLine.map((val, i) => val - signalLine[i]);

  // Bollinger Bands (20, 2)
  const bbUpper: (number | null)[] = [];
  const bbLower: (number | null)[] = [];
  
  data.forEach((_, i) => {
    if (i < 19) {
      bbUpper.push(null);
      bbLower.push(null);
      return;
    }
    const slice = data.slice(i - 19, i + 1);
    const mean = slice.reduce((acc, val) => acc + val.close, 0) / 20;
    const squaredDiffs = slice.map(val => Math.pow(val.close - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / 20;
    const stdDev = Math.sqrt(variance);
    
    bbUpper.push(mean + (stdDev * 2));
    bbLower.push(mean - (stdDev * 2));
  });

  return data.map((d, i) => {
    // Calculate Technical Score (0-100)
    let techScore = 50;
    const mHist = macdHistogram[i] || 0;
    const rsiVal = rsiArray[i] || 50;
    const close = d.close;
    const sma50Val = sma50[i];
    
    // Trend Strength
    if (sma50Val) {
        if (close > sma50Val) techScore += 10;
        else techScore -= 10;
    }

    // Momentum
    if (mHist > 0) techScore += 5;
    else techScore -= 5;
    
    // RSI Strength
    if (rsiVal > 50) techScore += 5;
    else techScore -= 5;
    
    // Volatility / Bands
    const upper = bbUpper[i];
    const lower = bbLower[i];
    if (upper && close > upper) techScore += 5; // Strong breakout
    if (lower && close < lower) techScore -= 5; // Strong breakdown
    
    return {
      ...d,
      rsi: rsiArray[i] ?? 50,
      macd: macdLine[i],
      macdSignal: signalLine[i],
      macdHistogram: macdHistogram[i],
      bbUpper: bbUpper[i],
      bbLower: bbLower[i],
      bbMiddle: sma20[i],
      sma20: sma20[i],
      sma50: sma50[i],
      technicalConfidence: Math.min(Math.max(techScore, 0), 100)
    };
  });
};
