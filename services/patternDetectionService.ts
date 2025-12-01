/**
 * AI Pattern Detection Service
 * Detects chart patterns and generates drawing instructions
 * Integrated with Gemini 2.5 Flash for enhanced analysis
 */

import { IndicatorData } from "../types";

export type PatternType =
  | "cup-and-handle"
  | "head-and-shoulders"
  | "inverse-head-and-shoulders"
  | "bull-flag"
  | "bear-flag"
  | "ascending-triangle"
  | "descending-triangle"
  | "double-top"
  | "double-bottom"
  | "rising-wedge"
  | "falling-wedge"
  | "channel-up"
  | "channel-down"
  | "support-resistance";

export interface PatternPoint {
  index: number;
  x: number; // will be calculated based on canvas width
  y: number; // will be calculated based on canvas height
  price: number;
  date: string;
}

export interface DetectedPattern {
  type: PatternType;
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-100
  points: PatternPoint[];
  targetPrice: number;
  targetDirection: "up" | "down";
  stopLoss: number;
  description: string;
  drawInstructions: DrawInstruction[];
  // AI-enhanced fields
  aiValidated?: boolean;
  aiConfidence?: number;
  aiReasoning?: string;
  tradeRecommendation?: string;
  riskRewardRatio?: string;
}

export interface AIPatternAnalysis {
  validatedPatterns: {
    name: string;
    isValid: boolean;
    adjustedConfidence: number;
    reasoning: string;
    tradeRecommendation: string;
    entryZone?: string;
    targetPrice: number;
    stopLoss: number;
    riskRewardRatio?: string;
  }[];
  overallAnalysis: string;
  primarySignal: "BUY" | "SELL" | "HOLD";
  primaryConfidence: number;
  warnings: string[];
  bestPattern: string;
}

export interface DrawInstruction {
  type: "line" | "dashed-line" | "arrow" | "zone" | "arc" | "text" | "target-line";
  color: string;
  points: { x: number; y: number }[];
  label?: string;
  fill?: boolean;
}

// Helper: Find local peaks and troughs
function findPeaksAndTroughs(data: IndicatorData[], windowSize: number = 5) {
  const peaks: { index: number; price: number; date: string }[] = [];
  const troughs: { index: number; price: number; date: string }[] = [];

  for (let i = windowSize; i < data.length - windowSize; i++) {
    const current = data[i];
    let isPeak = true;
    let isTrough = true;

    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      if (data[j].high >= current.high) isPeak = false;
      if (data[j].low <= current.low) isTrough = false;
    }

    if (isPeak) peaks.push({ index: i, price: current.high, date: current.date });
    if (isTrough) troughs.push({ index: i, price: current.low, date: current.date });
  }

  return { peaks, troughs };
}

// Helper: Calculate trend line slope
function calculateSlope(points: { index: number; price: number }[]) {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  return (last.price - first.price) / (last.index - first.index);
}

// Helper: Check if values are approximately equal
function approxEqual(a: number, b: number, tolerance: number = 0.03) {
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}

// Detect Cup and Handle pattern
function detectCupAndHandle(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 30) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data, 3);
  if (troughs.length < 1 || peaks.length < 2) return null;

  // Look for U-shaped pattern: peak -> trough -> peak at similar level
  for (let i = 0; i < peaks.length - 1; i++) {
    const leftPeak = peaks[i];
    const rightPeaks = peaks.filter(p => p.index > leftPeak.index + 10);
    
    for (const rightPeak of rightPeaks) {
      // Check if peaks are at similar level (within 5%)
      if (!approxEqual(leftPeak.price, rightPeak.price, 0.05)) continue;

      // Find the lowest trough between peaks
      const middleTroughs = troughs.filter(
        t => t.index > leftPeak.index && t.index < rightPeak.index
      );
      if (middleTroughs.length === 0) continue;

      const cupBottom = middleTroughs.reduce((min, t) => 
        t.price < min.price ? t : min, middleTroughs[0]
      );

      // Cup should be at least 10% deep
      const cupDepth = (leftPeak.price - cupBottom.price) / leftPeak.price;
      if (cupDepth < 0.1 || cupDepth > 0.5) continue;

      // Look for handle (small pullback after right peak)
      const handleData = data.slice(rightPeak.index);
      if (handleData.length < 5) continue;

      const handleLow = Math.min(...handleData.slice(0, 10).map(d => d.low));
      const handlePullback = (rightPeak.price - handleLow) / rightPeak.price;

      // Handle should be shallow (less than 1/3 of cup depth)
      if (handlePullback > cupDepth * 0.5) continue;

      // Calculate target (cup height projected from breakout)
      const cupHeight = leftPeak.price - cupBottom.price;
      const targetPrice = rightPeak.price + cupHeight;

      return {
        type: "cup-and-handle",
        name: "Cup & Handle",
        direction: "bullish",
        confidence: 75 + Math.min(cupDepth * 50, 20),
        points: [
          { index: leftPeak.index, x: 0, y: 0, price: leftPeak.price, date: leftPeak.date },
          { index: cupBottom.index, x: 0, y: 0, price: cupBottom.price, date: cupBottom.date },
          { index: rightPeak.index, x: 0, y: 0, price: rightPeak.price, date: rightPeak.date },
        ],
        targetPrice,
        targetDirection: "up",
        stopLoss: cupBottom.price,
        description: `Cup & Handle pattern detected. Cup depth: ${(cupDepth * 100).toFixed(1)}%. Bullish breakout expected.`,
        drawInstructions: [],
      };
    }
  }

  return null;
}

// Detect Head and Shoulders pattern
function detectHeadAndShoulders(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 30) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data, 3);
  if (peaks.length < 3 || troughs.length < 2) return null;

  // Look for 3 peaks with middle one highest
  for (let i = 0; i < peaks.length - 2; i++) {
    const leftShoulder = peaks[i];
    const head = peaks[i + 1];
    const rightShoulder = peaks[i + 2];

    // Head should be higher than shoulders
    if (head.price <= leftShoulder.price || head.price <= rightShoulder.price) continue;

    // Shoulders should be at similar level (within 5%)
    if (!approxEqual(leftShoulder.price, rightShoulder.price, 0.05)) continue;

    // Find neckline troughs
    const leftNeck = troughs.find(t => t.index > leftShoulder.index && t.index < head.index);
    const rightNeck = troughs.find(t => t.index > head.index && t.index < rightShoulder.index);

    if (!leftNeck || !rightNeck) continue;

    // Calculate neckline level
    const necklinePrice = (leftNeck.price + rightNeck.price) / 2;
    const patternHeight = head.price - necklinePrice;
    const targetPrice = necklinePrice - patternHeight;

    return {
      type: "head-and-shoulders",
      name: "Head & Shoulders",
      direction: "bearish",
      confidence: 80,
      points: [
        { index: leftShoulder.index, x: 0, y: 0, price: leftShoulder.price, date: leftShoulder.date },
        { index: leftNeck.index, x: 0, y: 0, price: leftNeck.price, date: leftNeck.date },
        { index: head.index, x: 0, y: 0, price: head.price, date: head.date },
        { index: rightNeck.index, x: 0, y: 0, price: rightNeck.price, date: rightNeck.date },
        { index: rightShoulder.index, x: 0, y: 0, price: rightShoulder.price, date: rightShoulder.date },
      ],
      targetPrice,
      targetDirection: "down",
      stopLoss: head.price,
      description: `Head & Shoulders pattern detected. Bearish reversal signal. Target: ${targetPrice.toFixed(2)}`,
      drawInstructions: [],
    };
  }

  return null;
}

// Detect Inverse Head and Shoulders
function detectInverseHeadAndShoulders(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 30) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data, 3);
  if (troughs.length < 3 || peaks.length < 2) return null;

  for (let i = 0; i < troughs.length - 2; i++) {
    const leftShoulder = troughs[i];
    const head = troughs[i + 1];
    const rightShoulder = troughs[i + 2];

    // Head should be lower than shoulders
    if (head.price >= leftShoulder.price || head.price >= rightShoulder.price) continue;

    // Shoulders should be at similar level
    if (!approxEqual(leftShoulder.price, rightShoulder.price, 0.05)) continue;

    const leftNeck = peaks.find(p => p.index > leftShoulder.index && p.index < head.index);
    const rightNeck = peaks.find(p => p.index > head.index && p.index < rightShoulder.index);

    if (!leftNeck || !rightNeck) continue;

    const necklinePrice = (leftNeck.price + rightNeck.price) / 2;
    const patternHeight = necklinePrice - head.price;
    const targetPrice = necklinePrice + patternHeight;

    return {
      type: "inverse-head-and-shoulders",
      name: "Inverse Head & Shoulders",
      direction: "bullish",
      confidence: 80,
      points: [
        { index: leftShoulder.index, x: 0, y: 0, price: leftShoulder.price, date: leftShoulder.date },
        { index: leftNeck.index, x: 0, y: 0, price: leftNeck.price, date: leftNeck.date },
        { index: head.index, x: 0, y: 0, price: head.price, date: head.date },
        { index: rightNeck.index, x: 0, y: 0, price: rightNeck.price, date: rightNeck.date },
        { index: rightShoulder.index, x: 0, y: 0, price: rightShoulder.price, date: rightShoulder.date },
      ],
      targetPrice,
      targetDirection: "up",
      stopLoss: head.price,
      description: `Inverse Head & Shoulders detected. Bullish reversal signal. Target: ${targetPrice.toFixed(2)}`,
      drawInstructions: [],
    };
  }

  return null;
}

// Detect Bull Flag
function detectBullFlag(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  // Look for strong upward move (pole) followed by consolidation (flag)
  const recentData = data.slice(-30);
  
  // Find the pole - strong upward move
  let poleStart = 0;
  let poleEnd = 0;
  let maxGain = 0;

  for (let i = 0; i < recentData.length - 10; i++) {
    for (let j = i + 3; j < Math.min(i + 15, recentData.length - 5); j++) {
      const gain = (recentData[j].high - recentData[i].low) / recentData[i].low;
      if (gain > maxGain && gain > 0.08) {
        maxGain = gain;
        poleStart = i;
        poleEnd = j;
      }
    }
  }

  if (maxGain < 0.08) return null;

  // Check for flag (consolidation with slight downward slope)
  const flagData = recentData.slice(poleEnd);
  if (flagData.length < 5) return null;

  const flagHighs = flagData.map((d, i) => ({ index: poleEnd + i, price: d.high }));
  const flagLows = flagData.map((d, i) => ({ index: poleEnd + i, price: d.low }));

  const highSlope = calculateSlope(flagHighs);
  const lowSlope = calculateSlope(flagLows);

  // Flag should have slightly negative or neutral slope
  if (highSlope > 0.02 || lowSlope > 0.02) return null;
  if (highSlope < -0.05 || lowSlope < -0.05) return null;

  // Calculate target (pole height projected from breakout)
  const poleHeight = recentData[poleEnd].high - recentData[poleStart].low;
  const currentPrice = recentData[recentData.length - 1].close;
  const targetPrice = currentPrice + poleHeight;

  const dataOffset = data.length - 30;

  return {
    type: "bull-flag",
    name: "Bull Flag",
    direction: "bullish",
    confidence: 70 + Math.min(maxGain * 100, 20),
    points: [
      { index: dataOffset + poleStart, x: 0, y: 0, price: recentData[poleStart].low, date: recentData[poleStart].date },
      { index: dataOffset + poleEnd, x: 0, y: 0, price: recentData[poleEnd].high, date: recentData[poleEnd].date },
      { index: data.length - 1, x: 0, y: 0, price: currentPrice, date: data[data.length - 1].date },
    ],
    targetPrice,
    targetDirection: "up",
    stopLoss: Math.min(...flagData.map(d => d.low)),
    description: `Bull Flag pattern. Pole gain: ${(maxGain * 100).toFixed(1)}%. Expecting continuation upward.`,
    drawInstructions: [],
  };
}

// Detect Bear Flag
function detectBearFlag(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  const recentData = data.slice(-30);
  
  let poleStart = 0;
  let poleEnd = 0;
  let maxDrop = 0;

  for (let i = 0; i < recentData.length - 10; i++) {
    for (let j = i + 3; j < Math.min(i + 15, recentData.length - 5); j++) {
      const drop = (recentData[i].high - recentData[j].low) / recentData[i].high;
      if (drop > maxDrop && drop > 0.08) {
        maxDrop = drop;
        poleStart = i;
        poleEnd = j;
      }
    }
  }

  if (maxDrop < 0.08) return null;

  const flagData = recentData.slice(poleEnd);
  if (flagData.length < 5) return null;

  const flagHighs = flagData.map((d, i) => ({ index: poleEnd + i, price: d.high }));
  const flagLows = flagData.map((d, i) => ({ index: poleEnd + i, price: d.low }));

  const highSlope = calculateSlope(flagHighs);
  const lowSlope = calculateSlope(flagLows);

  // Flag should have slightly positive or neutral slope
  if (highSlope < -0.02 || lowSlope < -0.02) return null;
  if (highSlope > 0.05 || lowSlope > 0.05) return null;

  const poleHeight = recentData[poleStart].high - recentData[poleEnd].low;
  const currentPrice = recentData[recentData.length - 1].close;
  const targetPrice = currentPrice - poleHeight;

  const dataOffset = data.length - 30;

  return {
    type: "bear-flag",
    name: "Bear Flag",
    direction: "bearish",
    confidence: 70 + Math.min(maxDrop * 100, 20),
    points: [
      { index: dataOffset + poleStart, x: 0, y: 0, price: recentData[poleStart].high, date: recentData[poleStart].date },
      { index: dataOffset + poleEnd, x: 0, y: 0, price: recentData[poleEnd].low, date: recentData[poleEnd].date },
      { index: data.length - 1, x: 0, y: 0, price: currentPrice, date: data[data.length - 1].date },
    ],
    targetPrice: Math.max(targetPrice, 0),
    targetDirection: "down",
    stopLoss: Math.max(...flagData.map(d => d.high)),
    description: `Bear Flag pattern. Pole drop: ${(maxDrop * 100).toFixed(1)}%. Expecting continuation downward.`,
    drawInstructions: [],
  };
}

// Detect Double Top
function detectDoubleTop(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data, 3);
  if (peaks.length < 2) return null;

  // Look for two peaks at similar levels with trough between
  for (let i = 0; i < peaks.length - 1; i++) {
    const firstTop = peaks[i];
    const secondTop = peaks[i + 1];

    // Tops should be at similar level
    if (!approxEqual(firstTop.price, secondTop.price, 0.03)) continue;

    // Should be at least 5 bars apart
    if (secondTop.index - firstTop.index < 5) continue;

    // Find trough between
    const middleTrough = troughs.find(
      t => t.index > firstTop.index && t.index < secondTop.index
    );
    if (!middleTrough) continue;

    // Second top should be recent
    if (data.length - secondTop.index > 10) continue;

    const neckline = middleTrough.price;
    const patternHeight = firstTop.price - neckline;
    const targetPrice = neckline - patternHeight;

    return {
      type: "double-top",
      name: "Double Top",
      direction: "bearish",
      confidence: 75,
      points: [
        { index: firstTop.index, x: 0, y: 0, price: firstTop.price, date: firstTop.date },
        { index: middleTrough.index, x: 0, y: 0, price: middleTrough.price, date: middleTrough.date },
        { index: secondTop.index, x: 0, y: 0, price: secondTop.price, date: secondTop.date },
      ],
      targetPrice: Math.max(targetPrice, 0),
      targetDirection: "down",
      stopLoss: Math.max(firstTop.price, secondTop.price) * 1.02,
      description: `Double Top pattern detected. Bearish reversal expected below neckline at ${neckline.toFixed(2)}.`,
      drawInstructions: [],
    };
  }

  return null;
}

// Detect Double Bottom
function detectDoubleBottom(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data, 3);
  if (troughs.length < 2) return null;

  for (let i = 0; i < troughs.length - 1; i++) {
    const firstBottom = troughs[i];
    const secondBottom = troughs[i + 1];

    if (!approxEqual(firstBottom.price, secondBottom.price, 0.03)) continue;
    if (secondBottom.index - firstBottom.index < 5) continue;

    const middlePeak = peaks.find(
      p => p.index > firstBottom.index && p.index < secondBottom.index
    );
    if (!middlePeak) continue;

    if (data.length - secondBottom.index > 10) continue;

    const neckline = middlePeak.price;
    const patternHeight = neckline - firstBottom.price;
    const targetPrice = neckline + patternHeight;

    return {
      type: "double-bottom",
      name: "Double Bottom",
      direction: "bullish",
      confidence: 75,
      points: [
        { index: firstBottom.index, x: 0, y: 0, price: firstBottom.price, date: firstBottom.date },
        { index: middlePeak.index, x: 0, y: 0, price: middlePeak.price, date: middlePeak.date },
        { index: secondBottom.index, x: 0, y: 0, price: secondBottom.price, date: secondBottom.date },
      ],
      targetPrice,
      targetDirection: "up",
      stopLoss: Math.min(firstBottom.price, secondBottom.price) * 0.98,
      description: `Double Bottom pattern detected. Bullish reversal expected above neckline at ${neckline.toFixed(2)}.`,
      drawInstructions: [],
    };
  }

  return null;
}

// Detect Support & Resistance levels
function detectSupportResistance(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data, 3);
  
  // Find clusters of peaks/troughs at similar levels
  const resistanceLevels: number[] = [];
  const supportLevels: number[] = [];

  // Group peaks into resistance levels
  peaks.forEach(peak => {
    const existing = resistanceLevels.find(r => approxEqual(r, peak.price, 0.02));
    if (!existing) {
      const nearby = peaks.filter(p => approxEqual(p.price, peak.price, 0.02));
      if (nearby.length >= 2) {
        resistanceLevels.push(nearby.reduce((sum, p) => sum + p.price, 0) / nearby.length);
      }
    }
  });

  // Group troughs into support levels
  troughs.forEach(trough => {
    const existing = supportLevels.find(s => approxEqual(s, trough.price, 0.02));
    if (!existing) {
      const nearby = troughs.filter(t => approxEqual(t.price, trough.price, 0.02));
      if (nearby.length >= 2) {
        supportLevels.push(nearby.reduce((sum, t) => sum + t.price, 0) / nearby.length);
      }
    }
  });

  if (resistanceLevels.length === 0 && supportLevels.length === 0) return null;

  const currentPrice = data[data.length - 1].close;
  const nearestResistance = resistanceLevels.filter(r => r > currentPrice).sort((a, b) => a - b)[0];
  const nearestSupport = supportLevels.filter(s => s < currentPrice).sort((a, b) => b - a)[0];

  const points: PatternPoint[] = [];
  
  if (nearestSupport) {
    const supportTouch = troughs.find(t => approxEqual(t.price, nearestSupport, 0.02));
    if (supportTouch) {
      points.push({ index: supportTouch.index, x: 0, y: 0, price: nearestSupport, date: supportTouch.date });
    }
  }
  
  if (nearestResistance) {
    const resistanceTouch = peaks.find(p => approxEqual(p.price, nearestResistance, 0.02));
    if (resistanceTouch) {
      points.push({ index: resistanceTouch.index, x: 0, y: 0, price: nearestResistance, date: resistanceTouch.date });
    }
  }

  const distanceToResistance = nearestResistance ? (nearestResistance - currentPrice) / currentPrice : 1;
  const distanceToSupport = nearestSupport ? (currentPrice - nearestSupport) / currentPrice : 1;

  return {
    type: "support-resistance",
    name: "Support & Resistance",
    direction: distanceToSupport < distanceToResistance ? "bullish" : "bearish",
    confidence: 65,
    points,
    targetPrice: nearestResistance || currentPrice * 1.1,
    targetDirection: distanceToSupport < distanceToResistance ? "up" : "down",
    stopLoss: nearestSupport || currentPrice * 0.95,
    description: `Key levels: Support at ${nearestSupport?.toFixed(2) || "N/A"}, Resistance at ${nearestResistance?.toFixed(2) || "N/A"}.`,
    drawInstructions: [],
  };
}

// Detect Ascending Triangle
function detectAscendingTriangle(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data.slice(-30), 2);
  if (peaks.length < 2 || troughs.length < 2) return null;

  // Flat resistance (peaks at similar level)
  const peakPrices = peaks.map(p => p.price);
  const avgPeakPrice = peakPrices.reduce((a, b) => a + b, 0) / peakPrices.length;
  const peaksFlat = peakPrices.every(p => approxEqual(p, avgPeakPrice, 0.02));

  // Rising support (troughs making higher lows)
  const troughSlope = calculateSlope(troughs.map((t, i) => ({ index: i, price: t.price })));

  if (!peaksFlat || troughSlope <= 0) return null;

  const offset = data.length - 30;
  const targetPrice = avgPeakPrice + (avgPeakPrice - troughs[0].price);

  return {
    type: "ascending-triangle",
    name: "Ascending Triangle",
    direction: "bullish",
    confidence: 72,
    points: [
      ...peaks.map(p => ({ index: offset + p.index, x: 0, y: 0, price: p.price, date: data[offset + p.index]?.date || "" })),
      ...troughs.map(t => ({ index: offset + t.index, x: 0, y: 0, price: t.price, date: data[offset + t.index]?.date || "" })),
    ],
    targetPrice,
    targetDirection: "up",
    stopLoss: troughs[troughs.length - 1].price,
    description: `Ascending Triangle pattern. Flat resistance at ${avgPeakPrice.toFixed(2)} with rising support.`,
    drawInstructions: [],
  };
}

// Detect Descending Triangle
function detectDescendingTriangle(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data.slice(-30), 2);
  if (peaks.length < 2 || troughs.length < 2) return null;

  // Flat support (troughs at similar level)
  const troughPrices = troughs.map(t => t.price);
  const avgTroughPrice = troughPrices.reduce((a, b) => a + b, 0) / troughPrices.length;
  const troughsFlat = troughPrices.every(t => approxEqual(t, avgTroughPrice, 0.02));

  // Falling resistance (peaks making lower highs)
  const peakSlope = calculateSlope(peaks.map((p, i) => ({ index: i, price: p.price })));

  if (!troughsFlat || peakSlope >= 0) return null;

  const offset = data.length - 30;
  const targetPrice = avgTroughPrice - (peaks[0].price - avgTroughPrice);

  return {
    type: "descending-triangle",
    name: "Descending Triangle",
    direction: "bearish",
    confidence: 72,
    points: [
      ...peaks.map(p => ({ index: offset + p.index, x: 0, y: 0, price: p.price, date: data[offset + p.index]?.date || "" })),
      ...troughs.map(t => ({ index: offset + t.index, x: 0, y: 0, price: t.price, date: data[offset + t.index]?.date || "" })),
    ],
    targetPrice: Math.max(targetPrice, 0),
    targetDirection: "down",
    stopLoss: peaks[peaks.length - 1].price,
    description: `Descending Triangle pattern. Flat support at ${avgTroughPrice.toFixed(2)} with falling resistance.`,
    drawInstructions: [],
  };
}

/**
 * Main function to detect all patterns
 */
export function detectPatterns(data: IndicatorData[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Run all detection algorithms
  const detectors = [
    detectCupAndHandle,
    detectHeadAndShoulders,
    detectInverseHeadAndShoulders,
    detectBullFlag,
    detectBearFlag,
    detectDoubleTop,
    detectDoubleBottom,
    detectAscendingTriangle,
    detectDescendingTriangle,
    detectSupportResistance,
  ];

  for (const detector of detectors) {
    try {
      const pattern = detector(data);
      if (pattern) {
        patterns.push(pattern);
      }
    } catch (e) {
      console.error("Pattern detection error:", e);
    }
  }

  // Sort by confidence
  patterns.sort((a, b) => b.confidence - a.confidence);

  return patterns;
}

/**
 * Generate drawing instructions for a pattern
 */
export function generateDrawInstructions(
  pattern: DetectedPattern,
  data: IndicatorData[],
  canvasWidth: number,
  canvasHeight: number,
  priceRange: { min: number; max: number }
): DrawInstruction[] {
  const instructions: DrawInstruction[] = [];

  // Helper to convert data index and price to canvas coordinates
  const toCanvasX = (index: number) => (index / (data.length - 1)) * canvasWidth;
  const toCanvasY = (price: number) => {
    const range = priceRange.max - priceRange.min;
    return canvasHeight - ((price - priceRange.min) / range) * canvasHeight * 0.85 - canvasHeight * 0.075;
  };

  // Update point coordinates
  pattern.points.forEach(point => {
    point.x = toCanvasX(point.index);
    point.y = toCanvasY(point.price);
  });

  const bullishColor = "#00ff9d";
  const bearishColor = "#ff0055";
  const neutralColor = "#fbbf24";
  const patternColor = pattern.direction === "bullish" ? bullishColor : pattern.direction === "bearish" ? bearishColor : neutralColor;

  switch (pattern.type) {
    case "cup-and-handle":
      // Draw cup curve
      if (pattern.points.length >= 3) {
        const [left, bottom, right] = pattern.points;
        
        // Left side of cup
        instructions.push({
          type: "line",
          color: patternColor,
          points: [{ x: left.x, y: left.y }, { x: bottom.x, y: bottom.y }],
        });
        // Right side of cup
        instructions.push({
          type: "line",
          color: patternColor,
          points: [{ x: bottom.x, y: bottom.y }, { x: right.x, y: right.y }],
        });
        // Resistance line
        instructions.push({
          type: "dashed-line",
          color: patternColor,
          points: [{ x: left.x, y: left.y }, { x: canvasWidth, y: left.y }],
        });
        // Target arrow
        instructions.push({
          type: "target-line",
          color: bullishColor,
          points: [{ x: canvasWidth - 50, y: right.y }, { x: canvasWidth - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "head-and-shoulders":
    case "inverse-head-and-shoulders":
      if (pattern.points.length >= 5) {
        const [ls, ln, head, rn, rs] = pattern.points;
        
        // Draw pattern outline
        instructions.push({
          type: "line",
          color: patternColor,
          points: [
            { x: ls.x, y: ls.y },
            { x: ln.x, y: ln.y },
            { x: head.x, y: head.y },
            { x: rn.x, y: rn.y },
            { x: rs.x, y: rs.y },
          ],
        });
        // Neckline
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: ln.x, y: ln.y }, { x: canvasWidth, y: rn.y }],
          label: "Neckline",
        });
        // Target
        instructions.push({
          type: "target-line",
          color: patternColor,
          points: [{ x: canvasWidth - 50, y: rn.y }, { x: canvasWidth - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "bull-flag":
    case "bear-flag":
      if (pattern.points.length >= 3) {
        const [poleStart, poleEnd, current] = pattern.points;
        
        // Pole
        instructions.push({
          type: "line",
          color: patternColor,
          points: [{ x: poleStart.x, y: poleStart.y }, { x: poleEnd.x, y: poleEnd.y }],
          label: "Pole",
        });
        // Flag zone
        instructions.push({
          type: "zone",
          color: patternColor,
          points: [
            { x: poleEnd.x, y: poleEnd.y - 10 },
            { x: current.x, y: current.y - 10 },
            { x: current.x, y: current.y + 10 },
            { x: poleEnd.x, y: poleEnd.y + 10 },
          ],
          fill: true,
        });
        // Target
        instructions.push({
          type: "target-line",
          color: patternColor,
          points: [{ x: canvasWidth - 50, y: current.y }, { x: canvasWidth - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "double-top":
    case "double-bottom":
      if (pattern.points.length >= 3) {
        const [first, middle, second] = pattern.points;
        
        // Connect peaks/troughs
        instructions.push({
          type: "line",
          color: patternColor,
          points: [
            { x: first.x, y: first.y },
            { x: middle.x, y: middle.y },
            { x: second.x, y: second.y },
          ],
        });
        // Horizontal line at top/bottom
        instructions.push({
          type: "dashed-line",
          color: patternColor,
          points: [{ x: first.x, y: first.y }, { x: canvasWidth, y: first.y }],
        });
        // Neckline
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: 0, y: middle.y }, { x: canvasWidth, y: middle.y }],
          label: "Neckline",
        });
        // Target
        instructions.push({
          type: "target-line",
          color: patternColor,
          points: [{ x: canvasWidth - 50, y: middle.y }, { x: canvasWidth - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "ascending-triangle":
    case "descending-triangle":
      // Draw resistance/support lines through points
      const peaks = pattern.points.filter((_, i) => i < pattern.points.length / 2);
      const troughs = pattern.points.filter((_, i) => i >= pattern.points.length / 2);

      if (peaks.length >= 2) {
        instructions.push({
          type: pattern.type === "ascending-triangle" ? "dashed-line" : "line",
          color: bearishColor,
          points: peaks.map(p => ({ x: p.x, y: p.y })),
          label: "Resistance",
        });
      }
      if (troughs.length >= 2) {
        instructions.push({
          type: pattern.type === "descending-triangle" ? "dashed-line" : "line",
          color: bullishColor,
          points: troughs.map(p => ({ x: p.x, y: p.y })),
          label: "Support",
        });
      }
      // Target
      instructions.push({
        type: "target-line",
        color: patternColor,
        points: [
          { x: canvasWidth - 50, y: toCanvasY(data[data.length - 1].close) },
          { x: canvasWidth - 50, y: toCanvasY(pattern.targetPrice) },
        ],
        label: `Target: ${pattern.targetPrice.toFixed(0)}`,
      });
      break;

    case "support-resistance":
      // Draw horizontal support/resistance lines
      pattern.points.forEach((point, i) => {
        const isResistance = point.price > data[data.length - 1].close;
        instructions.push({
          type: "dashed-line",
          color: isResistance ? bearishColor : bullishColor,
          points: [{ x: 0, y: point.y }, { x: canvasWidth, y: point.y }],
          label: isResistance ? `R: ${point.price.toFixed(0)}` : `S: ${point.price.toFixed(0)}`,
        });
      });
      break;
  }

  // Add pattern label with AI validation indicator
  if (pattern.points.length > 0) {
    const labelPoint = pattern.points[Math.floor(pattern.points.length / 2)];
    const aiIndicator = pattern.aiValidated ? "🤖 " : "";
    const confidence = pattern.aiConfidence || pattern.confidence;
    instructions.push({
      type: "text",
      color: patternColor,
      points: [{ x: labelPoint.x, y: labelPoint.y - 20 }],
      label: `${aiIndicator}${pattern.name} (${confidence}%)`,
    });
  }

  return instructions;
}

/**
 * Infer timeframe from date intervals in data
 */
function inferTimeframe(data: IndicatorData[]): { interval: string; description: string; optimalPeriods: number } {
  if (data.length < 2) {
    return { interval: "1d", description: "Daily", optimalPeriods: 60 };
  }

  // Calculate average interval between data points
  const date1 = new Date(data[data.length - 1].date);
  const date2 = new Date(data[data.length - 2].date);
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  // Infer timeframe based on interval
  if (diffHours <= 1) {
    return { interval: "1h", description: "Hourly", optimalPeriods: 100 };
  } else if (diffHours <= 4) {
    return { interval: "4h", description: "4-Hour", optimalPeriods: 80 };
  } else if (diffDays <= 1) {
    return { interval: "1d", description: "Daily", optimalPeriods: 60 };
  } else if (diffDays <= 7) {
    return { interval: "1w", description: "Weekly", optimalPeriods: 52 };
  } else {
    return { interval: "1M", description: "Monthly", optimalPeriods: 36 };
  }
}

/**
 * Calculate key technical levels for pattern analysis
 */
function calculateKeyLevels(data: IndicatorData[]): {
  support: number[];
  resistance: number[];
  pivotPoints: { pivot: number; r1: number; r2: number; s1: number; s2: number };
  trendDirection: string;
  volatility: number;
} {
  const recentData = data.slice(-60);
  const prices = recentData.map(d => d.close);
  const highs = recentData.map(d => d.high);
  const lows = recentData.map(d => d.low);

  // Find support/resistance levels using price clustering
  const support: number[] = [];
  const resistance: number[] = [];
  const priceRange = Math.max(...highs) - Math.min(...lows);
  const tolerance = priceRange * 0.02; // 2% tolerance

  // Find local lows for support
  for (let i = 5; i < recentData.length - 5; i++) {
    const current = recentData[i].low;
    const isLocalMin = recentData.slice(i - 5, i).every(d => d.low >= current) &&
                       recentData.slice(i + 1, i + 6).every(d => d.low >= current);
    if (isLocalMin && !support.some(s => Math.abs(s - current) < tolerance)) {
      support.push(current);
    }
  }

  // Find local highs for resistance
  for (let i = 5; i < recentData.length - 5; i++) {
    const current = recentData[i].high;
    const isLocalMax = recentData.slice(i - 5, i).every(d => d.high <= current) &&
                       recentData.slice(i + 1, i + 6).every(d => d.high <= current);
    if (isLocalMax && !resistance.some(r => Math.abs(r - current) < tolerance)) {
      resistance.push(current);
    }
  }

  // Calculate pivot points
  const lastCandle = recentData[recentData.length - 1];
  const pivot = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;
  const r1 = 2 * pivot - lastCandle.low;
  const r2 = pivot + (lastCandle.high - lastCandle.low);
  const s1 = 2 * pivot - lastCandle.high;
  const s2 = pivot - (lastCandle.high - lastCandle.low);

  // Calculate trend direction using SMA
  const sma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, prices.length);
  const currentPrice = prices[prices.length - 1];
  
  let trendDirection = "sideways";
  if (currentPrice > sma20 && sma20 > sma50) {
    trendDirection = "uptrend";
  } else if (currentPrice < sma20 && sma20 < sma50) {
    trendDirection = "downtrend";
  }

  // Calculate volatility (ATR-like)
  let atrSum = 0;
  for (let i = 1; i < recentData.length; i++) {
    const tr = Math.max(
      recentData[i].high - recentData[i].low,
      Math.abs(recentData[i].high - recentData[i - 1].close),
      Math.abs(recentData[i].low - recentData[i - 1].close)
    );
    atrSum += tr;
  }
  const atr = atrSum / (recentData.length - 1);
  const volatility = (atr / currentPrice) * 100;

  return {
    support: support.sort((a, b) => b - a).slice(0, 3),
    resistance: resistance.sort((a, b) => a - b).slice(0, 3),
    pivotPoints: { pivot, r1, r2, s1, s2 },
    trendDirection,
    volatility,
  };
}

/**
 * Call Gemini API to validate and enhance pattern detection
 */
export async function validatePatternsWithAI(
  ticker: string,
  patterns: DetectedPattern[],
  priceData: IndicatorData[]
): Promise<AIPatternAnalysis | null> {
  try {
    // Infer timeframe from data
    const timeframe = inferTimeframe(priceData);
    
    // Calculate key technical levels
    const keyLevels = calculateKeyLevels(priceData);
    
    // Get optimal amount of data based on timeframe
    const optimalData = priceData.slice(-timeframe.optimalPeriods);
    
    // Create OHLC summary for pattern context
    const ohlcSummary = {
      periodHigh: Math.max(...optimalData.map(d => d.high)),
      periodLow: Math.min(...optimalData.map(d => d.low)),
      periodOpen: optimalData[0]?.open || 0,
      periodClose: optimalData[optimalData.length - 1]?.close || 0,
      avgVolume: optimalData.reduce((sum, d) => sum + d.volume, 0) / optimalData.length,
    };

    const response = await fetch("/api/ai?action=patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        timeframe: timeframe.description,
        timeframeInterval: timeframe.interval,
        trendDirection: keyLevels.trendDirection,
        volatility: keyLevels.volatility.toFixed(2),
        keyLevels: {
          support: keyLevels.support,
          resistance: keyLevels.resistance,
          pivot: keyLevels.pivotPoints,
        },
        ohlcSummary,
        patterns: patterns.map(p => ({
          name: p.name,
          type: p.type,
          direction: p.direction,
          confidence: p.confidence,
          targetPrice: p.targetPrice,
          stopLoss: p.stopLoss,
          description: p.description,
          points: p.points.map(pt => ({ price: pt.price, date: pt.date })),
        })),
        // Send more data with key OHLC points
        priceData: optimalData.map((d, idx) => ({
          date: d.date,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
          rsi: d.rsi,
          sma20: d.sma20,
          sma50: d.sma50,
          bbUpper: d.bbUpper,
          bbLower: d.bbLower,
          // Mark significant candles
          isSignificant: idx % 5 === 0 || d.high === ohlcSummary.periodHigh || d.low === ohlcSummary.periodLow,
        })),
      }),
    });

    if (!response.ok) {
      console.error("AI pattern validation failed:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.analysis) {
      return null;
    }

    return data.analysis as AIPatternAnalysis;
  } catch (error) {
    console.error("Error validating patterns with AI:", error);
    return null;
  }
}

/**
 * Detect patterns and optionally validate with Gemini AI
 */
export async function detectPatternsWithAI(
  data: IndicatorData[],
  ticker: string = "UNKNOWN",
  useAI: boolean = true
): Promise<{ patterns: DetectedPattern[]; aiAnalysis: AIPatternAnalysis | null }> {
  // First, detect patterns using algorithmic detection
  const patterns = detectPatterns(data);

  if (patterns.length === 0) {
    return { patterns: [], aiAnalysis: null };
  }

  // If AI validation is enabled, validate with Gemini
  let aiAnalysis: AIPatternAnalysis | null = null;
  
  if (useAI) {
    aiAnalysis = await validatePatternsWithAI(ticker, patterns, data);

    // Enhance patterns with AI validation results
    if (aiAnalysis?.validatedPatterns) {
      patterns.forEach(pattern => {
        const aiValidation = aiAnalysis!.validatedPatterns.find(
          v => v.name.toLowerCase() === pattern.name.toLowerCase()
        );
        
        if (aiValidation) {
          pattern.aiValidated = aiValidation.isValid;
          pattern.aiConfidence = aiValidation.adjustedConfidence;
          pattern.aiReasoning = aiValidation.reasoning;
          pattern.tradeRecommendation = aiValidation.tradeRecommendation;
          pattern.riskRewardRatio = aiValidation.riskRewardRatio;
          
          // Update target and stop loss if AI provides better values
          if (aiValidation.targetPrice) {
            pattern.targetPrice = aiValidation.targetPrice;
          }
          if (aiValidation.stopLoss) {
            pattern.stopLoss = aiValidation.stopLoss;
          }
          
          // Update description with AI reasoning
          if (aiValidation.reasoning) {
            pattern.description = `${pattern.description} | AI: ${aiValidation.reasoning}`;
          }
        }
      });

      // Re-sort by AI confidence
      patterns.sort((a, b) => (b.aiConfidence || b.confidence) - (a.aiConfidence || a.confidence));
    }
  }

  return { patterns, aiAnalysis };
}
