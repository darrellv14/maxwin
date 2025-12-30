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
  // Volume-related fields
  volumeConfirmation?: "CONFIRMED" | "WEAK" | "DIVERGENCE";
  breakoutLikelihood?: "HIGH" | "MEDIUM" | "LOW";
}

export interface AIPatternAnalysis {
  validatedPatterns: {
    name: string;
    isValid: boolean;
    adjustedConfidence: number;
    reasoning: string;
    volumeConfirmation?: "CONFIRMED" | "WEAK" | "DIVERGENCE";
    tradeRecommendation: string;
    entryZone?: string;
    targetPrice: number;
    stopLoss: number;
    riskRewardRatio?: string;
    breakoutLikelihood?: "HIGH" | "MEDIUM" | "LOW";
    timeframeNote?: string;
  }[];
  overallAnalysis: string;
  volumeVerdict?: string;
  primarySignal: "BUY" | "SELL" | "HOLD";
  primaryConfidence: number;
  warnings: string[];
  bestPattern: string;
  timeframeSuitability?: "HIGH" | "MEDIUM" | "LOW";
}

export interface DrawInstruction {
  type: "line" | "dashed-line" | "arrow" | "zone" | "arc" | "text" | "target-line" | "bezier-curve" | "smooth-curve" | "circle-marker";
  color: string;
  points: { x: number; y: number }[];
  label?: string;
  fill?: boolean;
  controlPoints?: { x: number; y: number }[]; // For bezier curves
  radius?: number; // For circle markers
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

  // ALWAYS add support/resistance levels (even if other patterns found)
  // This ensures we always show key levels to the user
  try {
    const srPattern = detectSupportResistanceEnhanced(data);
    if (srPattern) {
      // Add SR pattern but with lower priority if we have other patterns
      if (patterns.length > 0) {
        srPattern.confidence = 60; // Lower confidence to appear after main patterns
      }
      patterns.push(srPattern);
    }
  } catch (e) {
    console.error("S/R detection error:", e);
  }

  return patterns;
}

// Enhanced Support/Resistance detection with strong levels
function detectSupportResistanceEnhanced(data: IndicatorData[]): DetectedPattern | null {
  if (data.length < 20) return null;

  const { peaks, troughs } = findPeaksAndTroughs(data, 3);
  const currentPrice = data[data.length - 1].close;
  
  // Find strong resistance levels (multiple touches)
  const resistanceClusters: { price: number; touches: number; indices: number[] }[] = [];
  const supportClusters: { price: number; touches: number; indices: number[] }[] = [];
  
  // Group peaks into resistance clusters
  peaks.forEach(peak => {
    const existingCluster = resistanceClusters.find(r => approxEqual(r.price, peak.price, 0.025));
    if (existingCluster) {
      existingCluster.touches++;
      existingCluster.indices.push(peak.index);
      existingCluster.price = (existingCluster.price * (existingCluster.touches - 1) + peak.price) / existingCluster.touches;
    } else {
      resistanceClusters.push({ price: peak.price, touches: 1, indices: [peak.index] });
    }
  });

  // Group troughs into support clusters
  troughs.forEach(trough => {
    const existingCluster = supportClusters.find(s => approxEqual(s.price, trough.price, 0.025));
    if (existingCluster) {
      existingCluster.touches++;
      existingCluster.indices.push(trough.index);
      existingCluster.price = (existingCluster.price * (existingCluster.touches - 1) + trough.price) / existingCluster.touches;
    } else {
      supportClusters.push({ price: trough.price, touches: 1, indices: [trough.index] });
    }
  });

  // Filter for strong levels (at least 2 touches) and sort by strength
  const strongResistance = resistanceClusters
    .filter(r => r.touches >= 2 && r.price > currentPrice)
    .sort((a, b) => b.touches - a.touches || a.price - b.price);
  
  const strongSupport = supportClusters
    .filter(s => s.touches >= 2 && s.price < currentPrice)
    .sort((a, b) => b.touches - a.touches || b.price - a.price);

  // If no strong levels, find the nearest single-touch levels
  let nearestResistance = strongResistance[0];
  let nearestSupport = strongSupport[0];
  
  if (!nearestResistance) {
    const singleResistance = resistanceClusters
      .filter(r => r.price > currentPrice)
      .sort((a, b) => a.price - b.price)[0];
    if (singleResistance) nearestResistance = singleResistance;
  }
  
  if (!nearestSupport) {
    const singleSupport = supportClusters
      .filter(s => s.price < currentPrice)
      .sort((a, b) => b.price - a.price)[0];
    if (singleSupport) nearestSupport = singleSupport;
  }

  // Also find second level (strong) support/resistance
  const strongResistance2 = strongResistance[1];
  const strongSupport2 = strongSupport[1];

  if (!nearestResistance && !nearestSupport) return null;

  const points: PatternPoint[] = [];
  
  // Add strong support first
  if (strongSupport2) {
    points.push({
      index: strongSupport2.indices[0],
      x: 0, y: 0,
      price: strongSupport2.price,
      date: data[strongSupport2.indices[0]]?.date || "",
    });
  }
  
  // Current support
  if (nearestSupport) {
    points.push({
      index: nearestSupport.indices[0],
      x: 0, y: 0,
      price: nearestSupport.price,
      date: data[nearestSupport.indices[0]]?.date || "",
    });
  }
  
  // Current resistance
  if (nearestResistance) {
    points.push({
      index: nearestResistance.indices[0],
      x: 0, y: 0,
      price: nearestResistance.price,
      date: data[nearestResistance.indices[0]]?.date || "",
    });
  }
  
  // Strong resistance
  if (strongResistance2) {
    points.push({
      index: strongResistance2.indices[0],
      x: 0, y: 0,
      price: strongResistance2.price,
      date: data[strongResistance2.indices[0]]?.date || "",
    });
  }

  const distanceToResistance = nearestResistance ? (nearestResistance.price - currentPrice) / currentPrice : 1;
  const distanceToSupport = nearestSupport ? (currentPrice - nearestSupport.price) / currentPrice : 1;

  // Build description
  let description = "Key Levels: ";
  if (strongSupport2) description += `Strong S: ${strongSupport2.price.toFixed(0)} (${strongSupport2.touches}x) | `;
  if (nearestSupport) description += `Support: ${nearestSupport.price.toFixed(0)} (${nearestSupport.touches}x) | `;
  if (nearestResistance) description += `Resistance: ${nearestResistance.price.toFixed(0)} (${nearestResistance.touches}x) | `;
  if (strongResistance2) description += `Strong R: ${strongResistance2.price.toFixed(0)} (${strongResistance2.touches}x)`;

  return {
    type: "support-resistance",
    name: "Support & Resistance",
    direction: distanceToSupport < distanceToResistance ? "bullish" : "bearish",
    confidence: 70 + Math.min((nearestSupport?.touches || 0) + (nearestResistance?.touches || 0), 20),
    points,
    targetPrice: nearestResistance?.price || currentPrice * 1.05,
    targetDirection: distanceToSupport < distanceToResistance ? "up" : "down",
    stopLoss: nearestSupport?.price || currentPrice * 0.95,
    description,
    drawInstructions: [],
  };
}

/**
 * Generate drawing instructions for a pattern
 * Enhanced version with IDEALIZED pattern shapes (not jagged candle-following lines)
 */
export function generateDrawInstructions(
  pattern: DetectedPattern,
  data: IndicatorData[],
  canvasWidth: number,
  canvasHeight: number,
  priceRange: { min: number; max: number }
): DrawInstruction[] {
  const instructions: DrawInstruction[] = [];

  // Chart scale margins from TradingViewChart.tsx
  // Price scale: scaleMargins: { top: 0.1, bottom: 0.2 }
  // Volume: scaleMargins: { top: 0.85, bottom: 0 }
  // This means price area is from 10% to 80% of canvas height (70% usable area)
  const CHART_TOP_MARGIN = 0.1;    // 10% top margin
  const CHART_BOTTOM_MARGIN = 0.2; // 20% bottom margin (for volume)
  
  // Right price scale takes approximately 70-80 pixels
  // We estimate it based on canvas width or use fixed value
  const PRICE_SCALE_WIDTH = 75; // Approximate width of right price scale
  const USABLE_CHART_WIDTH = canvasWidth - PRICE_SCALE_WIDTH;

  // Helper to convert data index and price to canvas coordinates
  // X coordinate: data points are distributed across the usable chart width (excluding price scale)
  const toCanvasX = (index: number) => {
    if (data.length <= 1) return USABLE_CHART_WIDTH / 2;
    // Map index to the visible chart area (left side, excluding price scale on right)
    return (index / (data.length - 1)) * USABLE_CHART_WIDTH;
  };
  
  // Y coordinate: map price to the usable chart area (between top and bottom margins)
  const toCanvasY = (price: number) => {
    const range = priceRange.max - priceRange.min;
    if (range === 0) return canvasHeight * 0.5;
    
    // Normalize price to 0-1 range
    const normalizedPrice = (price - priceRange.min) / range;
    
    // Map to canvas: high prices at top (smaller Y), low prices at bottom (larger Y)
    // Top of usable area = canvasHeight * CHART_TOP_MARGIN
    // Bottom of usable area = canvasHeight * (1 - CHART_BOTTOM_MARGIN)
    const topY = canvasHeight * CHART_TOP_MARGIN;
    const bottomY = canvasHeight * (1 - CHART_BOTTOM_MARGIN);
    
    // Invert because canvas Y increases downward but price increases upward
    return bottomY - normalizedPrice * (bottomY - topY);
  };

  // Helper to get precise candlestick coordinates
  const getCandleHigh = (index: number) => {
    if (index >= 0 && index < data.length) {
      return { x: toCanvasX(index), y: toCanvasY(data[index].high), price: data[index].high };
    }
    return null;
  };

  const getCandleLow = (index: number) => {
    if (index >= 0 && index < data.length) {
      return { x: toCanvasX(index), y: toCanvasY(data[index].low), price: data[index].low };
    }
    return null;
  };

  const getCandleClose = (index: number) => {
    if (index >= 0 && index < data.length) {
      return { x: toCanvasX(index), y: toCanvasY(data[index].close), price: data[index].close };
    }
    return null;
  };

  // Update point coordinates with precise snapping
  pattern.points.forEach(point => {
    point.x = toCanvasX(point.index);
    point.y = toCanvasY(point.price);
  });

  const bullishColor = "#00ff9d";
  const bearishColor = "#ff0055";
  const neutralColor = "#fbbf24";
  const patternColor = pattern.direction === "bullish" ? bullishColor : pattern.direction === "bearish" ? bearishColor : neutralColor;

  // Helper to generate smooth curve points through multiple points
  const generateSmoothCurvePoints = (keyPoints: { x: number; y: number }[], resolution: number = 20): { x: number; y: number }[] => {
    if (keyPoints.length < 2) return keyPoints;
    
    const curvePoints: { x: number; y: number }[] = [];
    
    for (let i = 0; i < keyPoints.length - 1; i++) {
      const p0 = keyPoints[Math.max(0, i - 1)];
      const p1 = keyPoints[i];
      const p2 = keyPoints[i + 1];
      const p3 = keyPoints[Math.min(keyPoints.length - 1, i + 2)];
      
      for (let t = 0; t <= 1; t += 1 / resolution) {
        // Catmull-Rom spline interpolation
        const t2 = t * t;
        const t3 = t2 * t;
        
        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        
        curvePoints.push({ x, y });
      }
    }
    
    return curvePoints;
  };

  // Helper to generate cup-shaped curve
  const generateCupCurve = (
    leftPeak: { x: number; y: number },
    bottom: { x: number; y: number },
    rightPeak: { x: number; y: number },
    resolution: number = 30
  ): { x: number; y: number }[] => {
    const curvePoints: { x: number; y: number }[] = [];
    
    // Generate U-shaped curve using quadratic bezier approximation
    for (let t = 0; t <= 1; t += 1 / resolution) {
      // Use a parabolic curve that passes through all three points
      const x = leftPeak.x + t * (rightPeak.x - leftPeak.x);
      
      // Parabolic interpolation
      const a = (t - 0.5) * 2; // Range from -1 to 1
      const curveFactor = 1 - a * a; // Parabola peaking at t=0.5
      
      // Interpolate y between peaks and bottom
      const peakY = leftPeak.y + t * (rightPeak.y - leftPeak.y);
      const y = peakY + curveFactor * (bottom.y - peakY);
      
      curvePoints.push({ x, y });
    }
    
    return curvePoints;
  };

  switch (pattern.type) {
    case "cup-and-handle":
      if (pattern.points.length >= 3) {
        const [left, bottom, right] = pattern.points;
        
        // Draw IDEALIZED cup shape (smooth U curve) - not following jagged candles
        const cupCurve = generateCupCurve(left, bottom, right, 40);
        instructions.push({
          type: "smooth-curve",
          color: patternColor,
          points: cupCurve,
        });
        
        // Mark key points with circles
        instructions.push({
          type: "circle-marker",
          color: patternColor,
          points: [left, bottom, right],
          radius: 5,
        });
        
        // Handle (small pullback after right peak) - draw as small flag
        const handleStartX = right.x;
        const handleEndX = right.x + (right.x - left.x) * 0.15;
        const handlePullbackY = right.y + (bottom.y - right.y) * 0.2;
        
        instructions.push({
          type: "line",
          color: patternColor,
          points: [
            { x: handleStartX, y: right.y },
            { x: (handleStartX + handleEndX) / 2, y: handlePullbackY },
            { x: handleEndX, y: right.y - 5 },
          ],
        });
        
        // Resistance/Breakout line at cup rim
        const rimPrice = Math.max(left.price, right.price);
        const rimY = toCanvasY(rimPrice);
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: left.x, y: rimY }, { x: USABLE_CHART_WIDTH, y: rimY }],
          label: `Breakout: ${rimPrice.toFixed(0)}`,
        });
        
        // Target projection
        instructions.push({
          type: "target-line",
          color: bullishColor,
          points: [{ x: USABLE_CHART_WIDTH - 50, y: rimY }, { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "head-and-shoulders":
      if (pattern.points.length >= 5) {
        const [ls, ln, head, rn, rs] = pattern.points;
        
        // Draw IDEALIZED Head & Shoulders shape with smooth curves
        // This creates the classic H&S silhouette instead of jagged lines
        
        // Helper to create smooth shoulder curve
        const createShoulderCurve = (
          start: { x: number; y: number },
          peak: { x: number; y: number },
          end: { x: number; y: number }
        ): { x: number; y: number }[] => {
          const points: { x: number; y: number }[] = [];
          for (let t = 0; t <= 1; t += 0.05) {
            // Quadratic bezier through the three points
            const oneMinusT = 1 - t;
            const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * peak.x + t * t * end.x;
            const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * peak.y + t * t * end.y;
            points.push({ x, y });
          }
          return points;
        };
        
        // Create left shoulder curve (from before LS, up to LS, down to LN)
        const leftShoulderCurve = createShoulderCurve(
          { x: ls.x - (ln.x - ls.x) * 0.3, y: ln.y },
          ls,
          ln
        );
        
        // Create head curve (from LN, up to Head, down to RN)
        const headCurve = createShoulderCurve(ln, head, rn);
        
        // Create right shoulder curve (from RN, up to RS, down to after RS)
        const rightShoulderCurve = createShoulderCurve(
          rn,
          rs,
          { x: rs.x + (rs.x - rn.x) * 0.3, y: rn.y }
        );
        
        // Combine all curves
        const fullPattern = [...leftShoulderCurve, ...headCurve, ...rightShoulderCurve];
        
        instructions.push({
          type: "smooth-curve",
          color: patternColor,
          points: fullPattern,
        });
        
        // Mark key points with labels
        instructions.push({
          type: "circle-marker",
          color: patternColor,
          points: [ls, head, rs],
          radius: 5,
        });
        
        // Add text labels for shoulders and head
        instructions.push({
          type: "text",
          color: patternColor,
          points: [{ x: ls.x, y: ls.y - 15 }],
          label: "LS",
        });
        instructions.push({
          type: "text",
          color: patternColor,
          points: [{ x: head.x, y: head.y - 15 }],
          label: "Head",
        });
        instructions.push({
          type: "text",
          color: patternColor,
          points: [{ x: rs.x, y: rs.y - 15 }],
          label: "RS",
        });
        
        // Neckline - extended
        const necklineSlope = (rn.y - ln.y) / (rn.x - ln.x);
        const extendedNecklineEndY = ln.y + necklineSlope * (USABLE_CHART_WIDTH - ln.x);
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: ln.x, y: ln.y }, { x: USABLE_CHART_WIDTH, y: extendedNecklineEndY }],
          label: "Neckline",
        });
        
        // Target
        instructions.push({
          type: "target-line",
          color: patternColor,
          points: [{ x: USABLE_CHART_WIDTH - 50, y: rn.y }, { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "inverse-head-and-shoulders":
      if (pattern.points.length >= 5) {
        const [ls, ln, head, rn, rs] = pattern.points;
        
        // Draw IDEALIZED Inverse Head & Shoulders shape with smooth curves
        // This creates the classic inverted H&S silhouette
        
        // Helper to create smooth inverted shoulder curve
        const createInvShoulderCurve = (
          start: { x: number; y: number },
          trough: { x: number; y: number },
          end: { x: number; y: number }
        ): { x: number; y: number }[] => {
          const points: { x: number; y: number }[] = [];
          for (let t = 0; t <= 1; t += 0.05) {
            // Quadratic bezier through the three points
            const oneMinusT = 1 - t;
            const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * trough.x + t * t * end.x;
            const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * trough.y + t * t * end.y;
            points.push({ x, y });
          }
          return points;
        };
        
        // Create left shoulder curve
        const leftShoulderCurve = createInvShoulderCurve(
          { x: ls.x - (ln.x - ls.x) * 0.3, y: ln.y },
          ls,
          ln
        );
        
        // Create head curve (inverted - going down)
        const headCurve = createInvShoulderCurve(ln, head, rn);
        
        // Create right shoulder curve
        const rightShoulderCurve = createInvShoulderCurve(
          rn,
          rs,
          { x: rs.x + (rs.x - rn.x) * 0.3, y: rn.y }
        );
        
        // Combine all curves
        const fullPattern = [...leftShoulderCurve, ...headCurve, ...rightShoulderCurve];
        
        instructions.push({
          type: "smooth-curve",
          color: patternColor,
          points: fullPattern,
        });
        
        // Mark key points with labels
        instructions.push({
          type: "circle-marker",
          color: patternColor,
          points: [ls, head, rs],
          radius: 5,
        });
        
        // Add text labels
        instructions.push({
          type: "text",
          color: patternColor,
          points: [{ x: ls.x, y: ls.y + 20 }],
          label: "LS",
        });
        instructions.push({
          type: "text",
          color: patternColor,
          points: [{ x: head.x, y: head.y + 20 }],
          label: "Head",
        });
        instructions.push({
          type: "text",
          color: patternColor,
          points: [{ x: rs.x, y: rs.y + 20 }],
          label: "RS",
        });
        
        // Neckline
        const necklineSlope = (rn.y - ln.y) / (rn.x - ln.x);
        const extendedNecklineEndY = ln.y + necklineSlope * (USABLE_CHART_WIDTH - ln.x);
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: ln.x, y: ln.y }, { x: USABLE_CHART_WIDTH, y: extendedNecklineEndY }],
          label: "Neckline",
        });
        
        // Target
        instructions.push({
          type: "target-line",
          color: bullishColor,
          points: [{ x: USABLE_CHART_WIDTH - 50, y: rn.y }, { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "bull-flag":
    case "bear-flag":
      if (pattern.points.length >= 3) {
        const [poleStart, poleEnd, current] = pattern.points;
        const isBullish = pattern.type === "bull-flag";
        
        // Draw IDEALIZED flag pattern
        // 1. Draw pole (thick line)
        instructions.push({
          type: "line",
          color: patternColor,
          points: [{ x: poleStart.x, y: poleStart.y }, { x: poleEnd.x, y: poleEnd.y }],
        });
        
        // Mark pole start and end
        instructions.push({
          type: "circle-marker",
          color: patternColor,
          points: [poleStart, poleEnd],
          radius: 4,
        });
        
        // 2. Draw idealized flag (parallelogram with slight slope)
        const poleHeight = Math.abs(poleEnd.y - poleStart.y);
        const flagWidth = (current.x - poleEnd.x);
        const flagHeight = poleHeight * 0.2; // Flag is 20% of pole height
        const slopeDirection = isBullish ? 0.1 : -0.1; // Slight downward slope for bull flag
        
        const flagTopStart = { x: poleEnd.x, y: poleEnd.y - flagHeight };
        const flagTopEnd = { x: current.x, y: poleEnd.y - flagHeight * 0.5 + (flagWidth * slopeDirection) };
        const flagBottomStart = { x: poleEnd.x, y: poleEnd.y + flagHeight };
        const flagBottomEnd = { x: current.x, y: poleEnd.y + flagHeight * 0.5 + (flagWidth * slopeDirection) };
        
        // Draw flag boundary lines
        instructions.push({
          type: "line",
          color: patternColor,
          points: [flagTopStart, flagTopEnd],
        });
        instructions.push({
          type: "line",
          color: patternColor,
          points: [flagBottomStart, flagBottomEnd],
        });
        
        // Fill the flag zone
        instructions.push({
          type: "zone",
          color: patternColor,
          points: [flagTopStart, flagTopEnd, flagBottomEnd, flagBottomStart],
          fill: true,
        });
        
        // Breakout level
        const breakoutY = poleEnd.y;
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: poleEnd.x, y: breakoutY }, { x: USABLE_CHART_WIDTH, y: breakoutY }],
          label: "Breakout",
        });
        
        // Target projection arrow
        instructions.push({
          type: "target-line",
          color: patternColor,
          points: [{ x: USABLE_CHART_WIDTH - 50, y: current.y }, { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "double-top":
      if (pattern.points.length >= 3) {
        const [first, middle, second] = pattern.points;
        
        // Draw IDEALIZED Double Top (M shape) with smooth curves
        // First peak curve
        const firstPeakCurve: { x: number; y: number }[] = [];
        const startX = first.x - (middle.x - first.x) * 0.3;
        for (let t = 0; t <= 1; t += 0.05) {
          const oneMinusT = 1 - t;
          const x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * first.x + t * t * middle.x;
          const y = oneMinusT * oneMinusT * middle.y + 2 * oneMinusT * t * first.y + t * t * middle.y;
          firstPeakCurve.push({ x, y });
        }
        
        // Second peak curve
        const secondPeakCurve: { x: number; y: number }[] = [];
        const endX = second.x + (second.x - middle.x) * 0.3;
        for (let t = 0; t <= 1; t += 0.05) {
          const oneMinusT = 1 - t;
          const x = oneMinusT * oneMinusT * middle.x + 2 * oneMinusT * t * second.x + t * t * endX;
          const y = oneMinusT * oneMinusT * middle.y + 2 * oneMinusT * t * second.y + t * t * middle.y;
          secondPeakCurve.push({ x, y });
        }
        
        instructions.push({
          type: "smooth-curve",
          color: patternColor,
          points: [...firstPeakCurve, ...secondPeakCurve],
        });
        
        // Mark the two tops
        instructions.push({
          type: "circle-marker",
          color: bearishColor,
          points: [first, second],
          radius: 6,
        });
        
        // Labels
        instructions.push({
          type: "text",
          color: bearishColor,
          points: [{ x: first.x, y: first.y - 15 }],
          label: "Top 1",
        });
        instructions.push({
          type: "text",
          color: bearishColor,
          points: [{ x: second.x, y: second.y - 15 }],
          label: "Top 2",
        });
        
        // Horizontal resistance at tops
        const resistanceY = Math.min(first.y, second.y);
        instructions.push({
          type: "dashed-line",
          color: bearishColor,
          points: [{ x: first.x - 20, y: resistanceY }, { x: USABLE_CHART_WIDTH, y: resistanceY }],
          label: "Resistance",
        });
        
        // Neckline at middle trough
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: 0, y: middle.y }, { x: USABLE_CHART_WIDTH, y: middle.y }],
          label: "Neckline",
        });
        
        // Target
        instructions.push({
          type: "target-line",
          color: bearishColor,
          points: [{ x: USABLE_CHART_WIDTH - 50, y: middle.y }, { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "double-bottom":
      if (pattern.points.length >= 3) {
        const [first, middle, second] = pattern.points;
        
        // Draw IDEALIZED Double Bottom (W shape) with smooth curves
        // First trough curve
        const firstTroughCurve: { x: number; y: number }[] = [];
        const startXDb = first.x - (middle.x - first.x) * 0.3;
        for (let t = 0; t <= 1; t += 0.05) {
          const oneMinusT = 1 - t;
          const x = oneMinusT * oneMinusT * startXDb + 2 * oneMinusT * t * first.x + t * t * middle.x;
          const y = oneMinusT * oneMinusT * middle.y + 2 * oneMinusT * t * first.y + t * t * middle.y;
          firstTroughCurve.push({ x, y });
        }
        
        // Second trough curve
        const secondTroughCurve: { x: number; y: number }[] = [];
        const endXDb = second.x + (second.x - middle.x) * 0.3;
        for (let t = 0; t <= 1; t += 0.05) {
          const oneMinusT = 1 - t;
          const x = oneMinusT * oneMinusT * middle.x + 2 * oneMinusT * t * second.x + t * t * endXDb;
          const y = oneMinusT * oneMinusT * middle.y + 2 * oneMinusT * t * second.y + t * t * middle.y;
          secondTroughCurve.push({ x, y });
        }
        
        instructions.push({
          type: "smooth-curve",
          color: patternColor,
          points: [...firstTroughCurve, ...secondTroughCurve],
        });
        
        // Mark the two bottoms
        instructions.push({
          type: "circle-marker",
          color: bullishColor,
          points: [first, second],
          radius: 6,
        });
        
        // Labels
        instructions.push({
          type: "text",
          color: bullishColor,
          points: [{ x: first.x, y: first.y + 20 }],
          label: "Bottom 1",
        });
        instructions.push({
          type: "text",
          color: bullishColor,
          points: [{ x: second.x, y: second.y + 20 }],
          label: "Bottom 2",
        });
        
        // Horizontal support at bottoms
        const supportY = Math.max(first.y, second.y);
        instructions.push({
          type: "dashed-line",
          color: bullishColor,
          points: [{ x: first.x - 20, y: supportY }, { x: USABLE_CHART_WIDTH, y: supportY }],
          label: "Support",
        });
        
        // Neckline at middle peak
        instructions.push({
          type: "dashed-line",
          color: neutralColor,
          points: [{ x: 0, y: middle.y }, { x: USABLE_CHART_WIDTH, y: middle.y }],
          label: "Neckline",
        });
        
        // Target
        instructions.push({
          type: "target-line",
          color: bullishColor,
          points: [{ x: USABLE_CHART_WIDTH - 50, y: middle.y }, { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(pattern.targetPrice) }],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "ascending-triangle":
    case "descending-triangle":
      {
        // Collect actual highs and lows from data for triangle lines
        const patternStart = pattern.points.length > 0 ? pattern.points[0].index : Math.max(0, data.length - 30);
        const patternEnd = data.length - 1;
        
        const highs: { x: number; y: number; price: number }[] = [];
        const lows: { x: number; y: number; price: number }[] = [];
        
        // Use findPeaksAndTroughs-like logic for the pattern range
        for (let i = patternStart + 2; i < patternEnd - 2; i++) {
          const curr = data[i];
          let isPeak = true;
          let isTrough = true;
          
          for (let j = i - 2; j <= i + 2; j++) {
            if (j === i) continue;
            if (data[j].high >= curr.high) isPeak = false;
            if (data[j].low <= curr.low) isTrough = false;
          }
          
          if (isPeak) {
            const candle = getCandleHigh(i);
            if (candle) highs.push({ x: candle.x, y: candle.y, price: data[i].high });
          }
          if (isTrough) {
            const candle = getCandleLow(i);
            if (candle) lows.push({ x: candle.x, y: candle.y, price: data[i].low });
          }
        }
        
        if (pattern.type === "ascending-triangle") {
          // Flat resistance line at highest highs
          if (highs.length >= 2) {
            const avgHighY = highs.reduce((sum, h) => sum + h.y, 0) / highs.length;
            instructions.push({
              type: "dashed-line",
              color: bearishColor,
              points: [{ x: highs[0].x, y: avgHighY }, { x: USABLE_CHART_WIDTH, y: avgHighY }],
              label: "Resistance",
            });
            
            // Mark resistance touches
            instructions.push({
              type: "circle-marker",
              color: bearishColor,
              points: highs.map(h => ({ x: h.x, y: h.y })),
              radius: 3,
            });
          }
          
          // Rising support line
          if (lows.length >= 2) {
            const firstLow = lows[0];
            const lastLow = lows[lows.length - 1];
            const slope = (lastLow.y - firstLow.y) / (lastLow.x - firstLow.x);
            const extendedX = USABLE_CHART_WIDTH;
            const extendedY = firstLow.y + slope * (extendedX - firstLow.x);
            
            instructions.push({
              type: "line",
              color: bullishColor,
              points: [{ x: firstLow.x, y: firstLow.y }, { x: extendedX, y: extendedY }],
              label: "Rising Support",
            });
            
            // Mark support touches
            instructions.push({
              type: "circle-marker",
              color: bullishColor,
              points: lows.map(l => ({ x: l.x, y: l.y })),
              radius: 3,
            });
          }
        } else {
          // Descending triangle - flat support, falling resistance
          if (lows.length >= 2) {
            const avgLowY = lows.reduce((sum, l) => sum + l.y, 0) / lows.length;
            instructions.push({
              type: "dashed-line",
              color: bullishColor,
              points: [{ x: lows[0].x, y: avgLowY }, { x: USABLE_CHART_WIDTH, y: avgLowY }],
              label: "Support",
            });
            
            instructions.push({
              type: "circle-marker",
              color: bullishColor,
              points: lows.map(l => ({ x: l.x, y: l.y })),
              radius: 3,
            });
          }
          
          if (highs.length >= 2) {
            const firstHigh = highs[0];
            const lastHigh = highs[highs.length - 1];
            const slope = (lastHigh.y - firstHigh.y) / (lastHigh.x - firstHigh.x);
            const extendedX = USABLE_CHART_WIDTH;
            const extendedY = firstHigh.y + slope * (extendedX - firstHigh.x);
            
            instructions.push({
              type: "line",
              color: bearishColor,
              points: [{ x: firstHigh.x, y: firstHigh.y }, { x: extendedX, y: extendedY }],
              label: "Falling Resistance",
            });
            
            instructions.push({
              type: "circle-marker",
              color: bearishColor,
              points: highs.map(h => ({ x: h.x, y: h.y })),
              radius: 3,
            });
          }
        }
        
        // Target
        instructions.push({
          type: "target-line",
          color: patternColor,
          points: [
            { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(data[data.length - 1].close) },
            { x: USABLE_CHART_WIDTH - 50, y: toCanvasY(pattern.targetPrice) },
          ],
          label: `Target: ${pattern.targetPrice.toFixed(0)}`,
        });
      }
      break;

    case "support-resistance":
      {
        // Draw horizontal support/resistance lines with zone shading
        // Sort points by price to identify strong vs current levels
        const currentPrice = data[data.length - 1].close;
        const sortedPoints = [...pattern.points].sort((a, b) => a.price - b.price);
        
        // Categorize levels
        const supportLevels = sortedPoints.filter(p => p.price < currentPrice);
        const resistanceLevels = sortedPoints.filter(p => p.price > currentPrice);
        
        // Draw support levels (green zones)
        supportLevels.forEach((point, idx) => {
          const isStrongLevel = idx === 0 && supportLevels.length > 1; // Lowest = strongest
          const zoneHeight = isStrongLevel ? 12 : 6;
          const lineWidth = isStrongLevel ? 2 : 1;
          const label = isStrongLevel ? `Strong S: ${point.price.toFixed(0)}` : `S: ${point.price.toFixed(0)}`;
          const color = isStrongLevel ? "#00ff9d" : "#22c55e";
          
          // Draw zone
          instructions.push({
            type: "zone",
            color: color,
            points: [
              { x: 0, y: point.y - zoneHeight },
              { x: USABLE_CHART_WIDTH, y: point.y - zoneHeight },
              { x: USABLE_CHART_WIDTH, y: point.y + zoneHeight },
              { x: 0, y: point.y + zoneHeight },
            ],
            fill: true,
          });
          
          // Main line
          instructions.push({
            type: isStrongLevel ? "line" : "dashed-line",
            color: color,
            points: [{ x: 0, y: point.y }, { x: USABLE_CHART_WIDTH, y: point.y }],
            label: label,
          });
        });
        
        // Draw resistance levels (red zones)
        resistanceLevels.forEach((point, idx) => {
          const isStrongLevel = idx === resistanceLevels.length - 1 && resistanceLevels.length > 1; // Highest = strongest
          const zoneHeight = isStrongLevel ? 12 : 6;
          const label = isStrongLevel ? `Strong R: ${point.price.toFixed(0)}` : `R: ${point.price.toFixed(0)}`;
          const color = isStrongLevel ? "#ff0055" : "#ef4444";
          
          // Draw zone
          instructions.push({
            type: "zone",
            color: color,
            points: [
              { x: 0, y: point.y - zoneHeight },
              { x: USABLE_CHART_WIDTH, y: point.y - zoneHeight },
              { x: USABLE_CHART_WIDTH, y: point.y + zoneHeight },
              { x: 0, y: point.y + zoneHeight },
            ],
            fill: true,
          });
          
          // Main line
          instructions.push({
            type: isStrongLevel ? "line" : "dashed-line",
            color: color,
            points: [{ x: 0, y: point.y }, { x: USABLE_CHART_WIDTH, y: point.y }],
            label: label,
          });
        });
        
        // Draw current price line
        const currentPriceY = toCanvasY(currentPrice);
        instructions.push({
          type: "dashed-line",
          color: "#fbbf24",
          points: [{ x: 0, y: currentPriceY }, { x: USABLE_CHART_WIDTH, y: currentPriceY }],
          label: `Current: ${currentPrice.toFixed(0)}`,
        });
      }
      break;

    case "rising-wedge":
    case "falling-wedge":
    case "channel-up":
    case "channel-down":
      // Draw two parallel or converging trendlines
      if (pattern.points.length >= 4) {
        const upperPoints = pattern.points.filter((_, i) => i % 2 === 0);
        const lowerPoints = pattern.points.filter((_, i) => i % 2 === 1);
        
        if (upperPoints.length >= 2) {
          instructions.push({
            type: "line",
            color: bearishColor,
            points: upperPoints.map(p => ({ x: p.x, y: p.y })),
          });
        }
        
        if (lowerPoints.length >= 2) {
          instructions.push({
            type: "line",
            color: bullishColor,
            points: lowerPoints.map(p => ({ x: p.x, y: p.y })),
          });
        }
        
        // Fill zone between lines
        if (upperPoints.length >= 2 && lowerPoints.length >= 2) {
          instructions.push({
            type: "zone",
            color: patternColor,
            points: [
              upperPoints[0],
              upperPoints[upperPoints.length - 1],
              lowerPoints[lowerPoints.length - 1],
              lowerPoints[0],
            ],
            fill: true,
          });
        }
      }
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
      points: [{ x: labelPoint.x, y: labelPoint.y - 25 }],
      label: `${aiIndicator}${pattern.name} (${confidence.toFixed(0)}%)`,
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
 * IHSG (IDX) Trading Hours Configuration
 * Based on official IDX trading schedule
 */
interface MarketSession {
  name: string;
  startTime: string; // HH:MM:SS
  endTime: string;   // HH:MM:SS
  isTrading: boolean;
}

interface MarketStatus {
  isOpen: boolean;
  isIndonesianStock: boolean;
  currentSession: string;
  sessionProgress: number; // 0-100% of trading day completed
  expectedTotalVolume: number; // Estimated based on session progress
  volumeNormalizationFactor: number; // Factor to normalize intraday volume
  nextSession: string;
  marketCloseTime: string;
  note: string;
}

/**
 * Get current IHSG market status based on Indonesian time (WIB)
 */
function getIHSGMarketStatus(ticker: string, currentVolume: number, avgDailyVolume: number): MarketStatus {
  // Check if it's an Indonesian stock
  const isIndonesianStock = ticker.toUpperCase().endsWith('.JK') || 
                            ticker.toUpperCase() === '^JKSE' ||
                            ticker.toUpperCase() === 'IHSG';

  if (!isIndonesianStock) {
    return {
      isOpen: false,
      isIndonesianStock: false,
      currentSession: "N/A",
      sessionProgress: 100,
      expectedTotalVolume: currentVolume,
      volumeNormalizationFactor: 1,
      nextSession: "N/A",
      marketCloseTime: "N/A",
      note: "Non-Indonesian stock - using full volume comparison",
    };
  }

  // Get current time in WIB (UTC+7)
  const now = new Date();
  const wibOffset = 7 * 60; // UTC+7 in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wibTime = new Date(utcTime + (wibOffset * 60000));
  
  const dayOfWeek = wibTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday
  const hours = wibTime.getHours();
  const minutes = wibTime.getMinutes();
  const currentTimeMinutes = hours * 60 + minutes;

  // Check if weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isOpen: false,
      isIndonesianStock: true,
      currentSession: "Weekend",
      sessionProgress: 100,
      expectedTotalVolume: currentVolume,
      volumeNormalizationFactor: 1,
      nextSession: "Pre-opening Monday 08:45 WIB",
      marketCloseTime: "N/A",
      note: "Market closed (weekend) - using last trading day volume",
    };
  }

  const isFriday = dayOfWeek === 5;

  // Define sessions in minutes from midnight
  const sessions = {
    preOpenInput: { start: 8 * 60 + 45, end: 8 * 60 + 58 },    // 08:45 - 08:58
    preOpenMatch: { start: 8 * 60 + 58, end: 9 * 60 },          // 08:58 - 09:00
    session1: { 
      start: 9 * 60,                                             // 09:00
      end: isFriday ? 11 * 60 + 30 : 12 * 60                    // 11:30 (Fri) or 12:00 (Mon-Thu)
    },
    lunchBreak: {
      start: isFriday ? 11 * 60 + 30 : 12 * 60,
      end: isFriday ? 14 * 60 : 13 * 60 + 30                    // 14:00 (Fri) or 13:30 (Mon-Thu)
    },
    session2: {
      start: isFriday ? 14 * 60 : 13 * 60 + 30,                 // 14:00 (Fri) or 13:30 (Mon-Thu)
      end: 15 * 60 + 50                                          // 15:50
    },
    preClose: { start: 15 * 60 + 50, end: 16 * 60 },            // 15:50 - 16:00
    postClose: { start: 16 * 60, end: 16 * 60 + 15 },           // 16:00 - 16:15
  };

  // Calculate total trading minutes (excluding lunch)
  const session1Duration = sessions.session1.end - sessions.session1.start; // 180 or 150 min
  const session2Duration = sessions.session2.end - sessions.session2.start; // 140 or 110 min
  const totalTradingMinutes = session1Duration + session2Duration;

  // Determine current session and progress
  let currentSession = "Closed";
  let tradingMinutesElapsed = 0;
  let isOpen = false;
  let nextSession = "";
  let note = "";

  if (currentTimeMinutes < sessions.preOpenInput.start) {
    currentSession = "Pre-Market";
    nextSession = "Pre-opening 08:45 WIB";
    note = "Market belum buka - volume hari ini belum tersedia";
  } else if (currentTimeMinutes < sessions.preOpenMatch.end) {
    currentSession = "Pre-Opening";
    isOpen = true;
    nextSession = "Session 1 at 09:00 WIB";
    note = "Fase pra-pembukaan - volume masih sangat rendah, tidak bisa dibandingkan";
  } else if (currentTimeMinutes < sessions.session1.end) {
    currentSession = "Session 1";
    isOpen = true;
    tradingMinutesElapsed = currentTimeMinutes - sessions.session1.start;
    nextSession = isFriday ? "Lunch break 11:30 WIB" : "Lunch break 12:00 WIB";
    const pctDone = Math.round((tradingMinutesElapsed / session1Duration) * 100);
    note = `Sesi 1 berjalan ${pctDone}% - volume masih INTRADAY, belum final!`;
  } else if (currentTimeMinutes < sessions.session2.start) {
    currentSession = "Lunch Break";
    isOpen = false;
    tradingMinutesElapsed = session1Duration; // Session 1 complete
    nextSession = isFriday ? "Session 2 at 14:00 WIB" : "Session 2 at 13:30 WIB";
    note = "Istirahat siang - volume = 50% dari estimasi harian";
  } else if (currentTimeMinutes < sessions.session2.end) {
    currentSession = "Session 2";
    isOpen = true;
    tradingMinutesElapsed = session1Duration + (currentTimeMinutes - sessions.session2.start);
    nextSession = "Pre-closing 15:50 WIB";
    const pctDone = Math.round((tradingMinutesElapsed / totalTradingMinutes) * 100);
    note = `Sesi 2 berjalan - total trading ${pctDone}% - volume masih INTRADAY!`;
  } else if (currentTimeMinutes < sessions.preClose.end) {
    currentSession = "Pre-Closing";
    isOpen = true;
    tradingMinutesElapsed = totalTradingMinutes;
    nextSession = "Closing 16:00 WIB";
    note = "Fase pra-penutupan - volume mendekati final";
  } else if (currentTimeMinutes < sessions.postClose.end) {
    currentSession = "Post-Closing";
    isOpen = false;
    tradingMinutesElapsed = totalTradingMinutes;
    nextSession = "Closed until tomorrow 08:45 WIB";
    note = "Pasca-penutupan - volume adalah FINAL untuk hari ini";
  } else {
    currentSession = "Closed";
    isOpen = false;
    tradingMinutesElapsed = totalTradingMinutes;
    nextSession = "Pre-opening tomorrow 08:45 WIB";
    note = "Market tutup - volume adalah FINAL untuk hari ini";
  }

  // Calculate session progress (0-100%)
  const sessionProgress = Math.min(100, Math.round((tradingMinutesElapsed / totalTradingMinutes) * 100));

  // Calculate volume normalization factor
  // If market is 50% done, multiply current volume by 2 to estimate final volume
  const volumeNormalizationFactor = sessionProgress > 0 ? 100 / sessionProgress : 1;

  // Estimate expected total volume based on current volume and progress
  const expectedTotalVolume = sessionProgress > 0 
    ? Math.round(currentVolume * volumeNormalizationFactor)
    : avgDailyVolume;

  const marketCloseTime = isFriday ? "15:50 WIB (Jumat)" : "15:50 WIB";

  return {
    isOpen,
    isIndonesianStock: true,
    currentSession,
    sessionProgress,
    expectedTotalVolume,
    volumeNormalizationFactor,
    nextSession,
    marketCloseTime,
    note,
  };
}

/**
 * Analyze volume for breakout confirmation and pattern validation
 * NOW WITH IHSG MARKET HOURS AWARENESS!
 */
function analyzeVolume(data: IndicatorData[], ticker: string = "UNKNOWN"): {
  avgVolume: number;
  recentAvgVolume: number;
  volumeTrend: "increasing" | "decreasing" | "stable";
  volumeSpikes: { date: string; volume: number; priceChange: number; significance: string }[];
  breakoutPotential: "high" | "medium" | "low";
  accumulationDistribution: "accumulation" | "distribution" | "neutral";
  volumePriceConfirmation: boolean;
  volumeAnalysis: string;
  marketStatus: MarketStatus;
  intradayWarning: string | null;
} {
  if (data.length < 20) {
    const emptyMarketStatus = getIHSGMarketStatus(ticker, 0, 0);
    return {
      avgVolume: 0,
      recentAvgVolume: 0,
      volumeTrend: "stable",
      volumeSpikes: [],
      breakoutPotential: "low",
      accumulationDistribution: "neutral",
      volumePriceConfirmation: false,
      volumeAnalysis: "Insufficient data for volume analysis",
      marketStatus: emptyMarketStatus,
      intradayWarning: null,
    };
  }

  const volumes = data.map(d => d.volume);
  const recentData = data.slice(-20);
  const olderData = data.slice(-60, -20);
  
  // Get the last candle (today's data)
  const todayData = data[data.length - 1];
  const yesterdayData = data[data.length - 2];

  // Calculate average volumes (excluding today for fair comparison)
  const historicalVolumes = data.slice(0, -1).map(d => d.volume);
  const avgVolume = historicalVolumes.reduce((a, b) => a + b, 0) / historicalVolumes.length;
  
  // Recent average (last 20 days, excluding today)
  const recentHistoricalData = data.slice(-21, -1);
  const recentAvgVolume = recentHistoricalData.reduce((a, b) => a + b.volume, 0) / recentHistoricalData.length;
  
  const olderAvgVolume = olderData.length > 0 
    ? olderData.reduce((a, b) => a + b.volume, 0) / olderData.length 
    : avgVolume;

  // Get market status for intraday awareness
  const marketStatus = getIHSGMarketStatus(ticker, todayData.volume, avgVolume);

  // Intraday warning message
  let intradayWarning: string | null = null;
  
  if (marketStatus.isIndonesianStock && marketStatus.sessionProgress < 100) {
    intradayWarning = `⚠️ INTRADAY: ${marketStatus.currentSession} (${marketStatus.sessionProgress}% selesai). ` +
                      `Volume hari ini ${todayData.volume.toLocaleString()} masih ongoing. ` +
                      `Estimasi final: ${marketStatus.expectedTotalVolume.toLocaleString()}. ` +
                      `${marketStatus.note}`;
  }

  // For volume trend comparison:
  // If market is still open, use normalized/estimated volume for today
  const todayVolumeForComparison = marketStatus.isIndonesianStock && marketStatus.sessionProgress < 100
    ? marketStatus.expectedTotalVolume  // Use estimated final volume
    : todayData.volume;

  // Volume trend - SMART comparison
  // Compare estimated today volume vs yesterday's complete volume
  let volumeTrend: "increasing" | "decreasing" | "stable" = "stable";
  
  if (marketStatus.sessionProgress >= 100 || !marketStatus.isIndonesianStock) {
    // Market closed - use normal comparison
    const volumeChangePercent = ((recentAvgVolume - olderAvgVolume) / olderAvgVolume) * 100;
    if (volumeChangePercent > 15) {
      volumeTrend = "increasing";
    } else if (volumeChangePercent < -15) {
      volumeTrend = "decreasing";
    }
  } else {
    // Market STILL OPEN - compare estimated volume with yesterday
    const estimatedVsYesterday = ((todayVolumeForComparison - yesterdayData.volume) / yesterdayData.volume) * 100;
    
    // Be more conservative when market is still open
    if (estimatedVsYesterday > 25) {
      volumeTrend = "increasing";
    } else if (estimatedVsYesterday < -25) {
      volumeTrend = "decreasing";
    }
    // Otherwise stay "stable" - don't make conclusions on incomplete data
  }

  // Find volume spikes (>1.5x average volume) - only from COMPLETED days
  const completedDays = marketStatus.sessionProgress >= 100 ? data : data.slice(0, -1);
  const volumeSpikes: { date: string; volume: number; priceChange: number; significance: string }[] = [];
  
  for (let i = 1; i < completedDays.length; i++) {
    if (completedDays[i].volume > avgVolume * 1.5) {
      const priceChange = ((completedDays[i].close - completedDays[i - 1].close) / completedDays[i - 1].close) * 100;
      const volumeRatio = completedDays[i].volume / avgVolume;
      let significance = "moderate";
      if (volumeRatio > 3) significance = "extreme";
      else if (volumeRatio > 2) significance = "high";
      
      volumeSpikes.push({
        date: completedDays[i].date,
        volume: completedDays[i].volume,
        priceChange,
        significance,
      });
    }
  }

  // Accumulation/Distribution Analysis - using completed days only
  let accumulationScore = 0;
  const analysisData = marketStatus.sessionProgress >= 100 ? recentData : recentData.slice(0, -1);
  
  for (let i = 0; i < analysisData.length; i++) {
    const d = analysisData[i];
    const moneyFlowMultiplier = d.high !== d.low 
      ? ((d.close - d.low) - (d.high - d.close)) / (d.high - d.low)
      : 0;
    const moneyFlowVolume = moneyFlowMultiplier * d.volume;
    accumulationScore += moneyFlowVolume;
  }

  let accumulationDistribution: "accumulation" | "distribution" | "neutral" = "neutral";
  const avgMoneyFlow = accumulationScore / analysisData.length;
  if (avgMoneyFlow > avgVolume * 0.1) {
    accumulationDistribution = "accumulation";
  } else if (avgMoneyFlow < -avgVolume * 0.1) {
    accumulationDistribution = "distribution";
  }

  // Volume-Price Confirmation - using estimated volume if intraday
  const priceUp = todayData.close > (analysisData[0]?.close || todayData.open);
  const volumePriceConfirmation = (priceUp && volumeTrend === "increasing") || 
                                   (!priceUp && volumeTrend === "decreasing");

  // Breakout Potential based on volume buildup
  let breakoutPotential: "high" | "medium" | "low" = "low";
  
  // Use completed days for analysis
  const last5CompletedDays = completedDays.slice(-5);
  const lastFiveVolume = last5CompletedDays.reduce((a, b) => a + b.volume, 0) / last5CompletedDays.length;
  const volumeBuildupRatio = lastFiveVolume / avgVolume;
  
  if (volumeBuildupRatio > 1.3 && volumeTrend === "increasing") {
    breakoutPotential = "high";
  } else if (volumeBuildupRatio > 1.1) {
    breakoutPotential = "medium";
  }

  // Recent volume spikes in last 5 completed days
  const recentSpikes = volumeSpikes.filter(s => {
    const spikeDate = new Date(s.date);
    const lastCompletedDate = new Date(completedDays[completedDays.length - 1].date);
    const diffDays = (lastCompletedDate.getTime() - spikeDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 5;
  });

  if (recentSpikes.length > 0 && recentSpikes.some(s => s.significance === "extreme" || s.significance === "high")) {
    breakoutPotential = "high";
  }

  // Build analysis summary - WITH MARKET AWARENESS
  let volumeAnalysis = "";
  
  if (marketStatus.isIndonesianStock && marketStatus.sessionProgress < 100) {
    // INTRADAY - be careful with conclusions
    volumeAnalysis = `📊 [INTRADAY - ${marketStatus.currentSession}] `;
    volumeAnalysis += `Volume saat ini: ${todayData.volume.toLocaleString()} (${marketStatus.sessionProgress}% sesi). `;
    volumeAnalysis += `Estimasi akhir hari: ~${marketStatus.expectedTotalVolume.toLocaleString()}. `;
    volumeAnalysis += `vs Kemarin: ${yesterdayData.volume.toLocaleString()}. `;
    
    if (marketStatus.sessionProgress < 50) {
      volumeAnalysis += `⚠️ JANGAN simpulkan volume trend - market baru ${marketStatus.sessionProgress}% berjalan! `;
    }
  } else {
    // MARKET CLOSED - normal analysis
    const volumeChangePercent = ((recentAvgVolume - olderAvgVolume) / olderAvgVolume) * 100;
    volumeAnalysis = `Volume ${volumeTrend} (${volumeChangePercent > 0 ? "+" : ""}${volumeChangePercent.toFixed(1)}%). `;
  }
  
  volumeAnalysis += `${accumulationDistribution.charAt(0).toUpperCase() + accumulationDistribution.slice(1)} phase. `;
  volumeAnalysis += `Breakout potential: ${breakoutPotential}. `;
  
  if (volumeSpikes.length > 0) {
    volumeAnalysis += `${volumeSpikes.length} volume spike(s) detected. `;
  }
  
  if (!volumePriceConfirmation && marketStatus.sessionProgress >= 100) {
    volumeAnalysis += "⚠️ Volume-price divergence detected. ";
  }

  return {
    avgVolume,
    recentAvgVolume,
    volumeTrend,
    volumeSpikes: volumeSpikes.slice(-10),
    breakoutPotential,
    accumulationDistribution,
    volumePriceConfirmation,
    volumeAnalysis,
    marketStatus,
    intradayWarning,
  };
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
    
    // Analyze volume for breakout confirmation - WITH MARKET HOURS AWARENESS
    const volumeAnalysis = analyzeVolume(priceData, ticker);
    
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
        volumeAnalysis: {
          avgVolume: volumeAnalysis.avgVolume,
          recentAvgVolume: volumeAnalysis.recentAvgVolume,
          volumeTrend: volumeAnalysis.volumeTrend,
          breakoutPotential: volumeAnalysis.breakoutPotential,
          accumulationDistribution: volumeAnalysis.accumulationDistribution,
          volumePriceConfirmation: volumeAnalysis.volumePriceConfirmation,
          volumeSpikes: volumeAnalysis.volumeSpikes.slice(-5), // Last 5 spikes
          analysis: volumeAnalysis.volumeAnalysis,
          // IHSG Market Hours Awareness
          marketStatus: volumeAnalysis.marketStatus ? {
            isOpen: volumeAnalysis.marketStatus.isOpen,
            currentSession: volumeAnalysis.marketStatus.currentSession,
            sessionProgress: volumeAnalysis.marketStatus.sessionProgress,
            expectedTotalVolume: volumeAnalysis.marketStatus.expectedTotalVolume,
            note: volumeAnalysis.marketStatus.note,
          } : null,
          intradayWarning: volumeAnalysis.intradayWarning,
        },
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
          pattern.volumeConfirmation = aiValidation.volumeConfirmation;
          pattern.breakoutLikelihood = aiValidation.breakoutLikelihood;
          
          // Update target and stop loss if AI provides better values
          if (aiValidation.targetPrice) {
            pattern.targetPrice = aiValidation.targetPrice;
          }
          if (aiValidation.stopLoss) {
            pattern.stopLoss = aiValidation.stopLoss;
          }
          
          // Update description with AI reasoning and volume info
          let volumeInfo = "";
          if (aiValidation.volumeConfirmation) {
            const volumeEmoji = aiValidation.volumeConfirmation === "CONFIRMED" ? "✅" : 
                               aiValidation.volumeConfirmation === "WEAK" ? "⚠️" : "🚨";
            volumeInfo = ` | Volume: ${volumeEmoji} ${aiValidation.volumeConfirmation}`;
          }
          if (aiValidation.breakoutLikelihood) {
            volumeInfo += ` | Breakout: ${aiValidation.breakoutLikelihood}`;
          }
          if (aiValidation.reasoning) {
            pattern.description = `${pattern.description} | AI: ${aiValidation.reasoning}${volumeInfo}`;
          }
        }
      });

      // Re-sort by AI confidence
      patterns.sort((a, b) => (b.aiConfidence || b.confidence) - (a.aiConfidence || a.confidence));
    }
  }

  return { patterns, aiAnalysis };
}
