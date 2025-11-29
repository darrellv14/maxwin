import YahooFinance from "yahoo-finance2";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "./db.js";
import TI from "technicalindicators"; // Library indikator profesional

// =======================
//  Helper: TECHNICALS (Powered by Library)
// =======================

const calculateAdvancedIndicators = (stockData) => {
  // Extract arrays for library
  const opens = stockData.map((d) => d.open);
  const highs = stockData.map((d) => d.high);
  const lows = stockData.map((d) => d.low);
  const closes = stockData.map((d) => d.close);
  const volumes = stockData.map((d) => d.volume);

  // 1. Moving Averages (Trend)
  const sma20 = TI.SMA.calculate({ period: 20, values: closes });
  const sma50 = TI.SMA.calculate({ period: 50, values: closes });
  const ema200 = TI.EMA.calculate({ period: 200, values: closes }); // Major trend filter

  // 2. Momentum (RSI & MACD)
  const rsi = TI.RSI.calculate({ period: 14, values: closes });
  const macd = TI.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  // 3. Volatility (Bollinger Bands & ATR)
  const bb = TI.BollingerBands.calculate({
    period: 20,
    stdDev: 2,
    values: closes,
  });

  // ATR sangat penting untuk Stop Loss yang logis
  const atr = TI.ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });

  // 4. Volume Flow (OBV - Deteksi Akumulasi)
  const obv = TI.OBV.calculate({
    close: closes,
    volume: volumes,
  });

  // Align arrays to the original data length (Library outputs are shorter)
  // Kita ambil data terakhir yang valid
  const lastIndex = stockData.length - 1;
  const tiIndex = (arr) => arr[arr.length - 1]; // Helper ambil data paling ujung

  // Validasi panjang data
  if (closes.length < 55) return null;

  const lastRSI = tiIndex(rsi);
  const lastMACD = tiIndex(macd);
  const lastBB = tiIndex(bb);
  const lastSMA50 = tiIndex(sma50);
  const lastEMA200 = tiIndex(ema200);
  const lastATR = tiIndex(atr);
  const lastOBV = tiIndex(obv);
  const prevOBV = obv[obv.length - 2]; // Untuk cek slope OBV

  // --- SCORING SYSTEM (Quantitative Filter) ---
  let techScore = 50;
  const currentClose = closes[lastIndex];

  // Trend Filter
  if (currentClose > lastSMA50) techScore += 10;
  if (lastEMA200 && currentClose > lastEMA200) techScore += 10; // Bullish major

  // Momentum
  if (lastMACD.histogram > 0) techScore += 5;
  if (lastRSI > 50 && lastRSI < 70) techScore += 5; // Sweet spot momentum

  // Volume Flow
  if (lastOBV > prevOBV) techScore += 5; // Akumulasi

  // Volatility Breakout
  if (currentClose > lastBB.upper) techScore += 10; // Breakout upper band

  const technicalConfidence = Math.min(100, Math.max(0, techScore));

  return {
    technicalConfidence,
    indicators: {
      rsi: lastRSI,
      macdHist: lastMACD.histogram,
      sma50: lastSMA50,
      ema200: lastEMA200,
      bbUpper: lastBB.upper,
      bbLower: lastBB.lower,
      atr: lastATR, // Kunci untuk Stop Loss
      obvSlope: lastOBV > prevOBV ? "UP" : "DOWN",
    },
    // Ambil 5 candle terakhir untuk AI "melihat" Price Action
    recentCandles: stockData.slice(-5).map((d) => ({
      date: d.date,
      o: d.open,
      h: d.high,
      l: d.low,
      c: d.close,
      v: d.volume,
    })),
  };
};

// =======================
//  Helper: Gemini client
// =======================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// =======================
//  IDX UNIVERSE (Dipertahankan)
// =======================
const IDX_UNIVERSE = [
  "BBCA.JK",
  "BBRI.JK",
  "BMRI.JK",
  "BBNI.JK",
  "BNGA.JK",
  "ARTO.JK",
  "BBHI.JK",
  "BBYB.JK",
  "BANK.JK",
  "BREN.JK",
  "BRPT.JK",
  "TPIA.JK",
  "CUAN.JK",
  "PTRO.JK",
  "BRMS.JK",
  "BUMI.JK",
  "AMMN.JK",
  "DEWA.JK",
  "ENRG.JK",
  "PSAB.JK",
  "PANI.JK",
  "BSDE.JK",
  "SMRA.JK",
  "CTRA.JK",
  "ASRI.JK",
  "ADRO.JK",
  "PTBA.JK",
  "ITMG.JK",
  "HRUM.JK",
  "ICBP.JK",
  "MYOR.JK",
  "AMRT.JK",
  "CPIN.JK",
  "JPFA.JK",
  "DAAZ.JK",
  "MLPT.JK",
  "AWAN.JK",
  "PYFA.JK",
  "GOTO.JK",
  "TLKM.JK",
  "ISAT.JK",
  "EXCL.JK",
  "MEDC.JK",
  "PGAS.JK",
  "ANTM.JK",
  "MDKA.JK",
  "INKP.JK",
  "TKIM.JK",
];

// =======================
//  MAIN HANDLER
// =======================
export default async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const authHeader = req.headers["authorization"] || req.headers["Authorization"];
      if (authHeader !== secret) return res.status(401).json({ error: "Unauthorized" });
    }

    const yf = new YahooFinance();
    const symbols = IDX_UNIVERSE;
    console.log(`[AI-ORACLE] Analyzing ${symbols.length} stocks...`);

    const processedData = [];

    // --- BATCH PROCESSING (Agar lebih cepat tapi aman) ---
    // Yahoo Finance terkadang timeout jika single thread loop panjang
    // Kita jalankan per batch isi 5 request paralel
    const BATCH_SIZE = 5;
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (symbol) => {
        try {
          // Ambil data agak panjang untuk EMA200
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 365); // 1 tahun ke belakang

          const chartRes = await yf.chart(symbol, {
            period1: startDate,
            interval: "1d",
          });

          const q = chartRes?.quotes ?? [];
          if (!q.length) return null;

          // Cleaning Data
          const stockData = q
            .map((row) => ({
              date:
                row.date instanceof Date
                  ? row.date.toISOString().split("T")[0]
                  : new Date(row.date).toISOString().split("T")[0],
              open: row.open,
              high: row.high,
              low: row.low,
              close: row.close,
              volume: row.volume,
            }))
            .filter((d) => d.close != null && d.volume != null);

          if (stockData.length < 200) return null; // Butuh data cukup untuk EMA200

          const analysis = calculateAdvancedIndicators(stockData);
          if (!analysis) return null;

          // Filter Awal: Hanya yang Confidence > 60 yang dikirim ke AI
          // Ini menghemat token Gemini dan membuang saham sampah
          if (analysis.technicalConfidence < 60) return null;

          return {
            ticker: symbol,
            lastClose: stockData[stockData.length - 1].close,
            ...analysis,
          };
        } catch (err) {
          console.error(`Error processing ${symbol}:`, err.message);
          return null;
        }
      });

      const results = await Promise.all(batchPromises);
      results.forEach((r) => {
        if (r) processedData.push(r);
      });
    }

    // Sort by Confidence Score
    const topCandidates = processedData
      .sort((a, b) => b.technicalConfidence - a.technicalConfidence)
      .slice(0, 15); // Ambil Top 15 kandidat terbaik

    if (topCandidates.length === 0) {
      return res.status(200).json({ message: "Market bearish. No candidates passed filter." });
    }

    // --- AI PROMPT ENGINEERING (POWERFUL) ---
    // Kita berikan data ATR untuk perhitungan Stop Loss yang presisi
    // Kita berikan 5 candle terakhir agar AI bisa baca Pola Candle
    const prompt = `
      Anda adalah "The Oracle", algoritma hedge fund elit khusus IHSG (Indonesia).
      
      Tugas: Analisis kandidat berikut dan pilih TOP 3-5 saham untuk posisi SWING TRADE.
      
      DATA YANG DIBERIKAN UNTUK SETIAP SAHAM:
      1. Indicators: RSI, MACD, Bollinger Bands, OBV Slope (Volume Flow).
      2. ATR (Average True Range): Gunakan ini untuk menghitung Stop Loss yang aman dari noise pasar.
      3. Recent Candles (Last 5 days): Analisis pola candlestick (Open, High, Low, Close, Volume).

      ATURAN TRADING (STRATEGY):
      1. **Price Action King**: Utamakan saham yang membentuk pola bullish (Hammer, Engulfing, Breakout) di 5 hari terakhir.
      2. **Trend Follower**: Harga harus di atas SMA50 atau EMA200.
      3. **Risk Management (WAJIB)**: 
         - Stop Loss (SL) HARUS dihitung sebagai: Entry Price - (2 x ATR).
         - Take Profit (TP1) minimal Risk:Reward 1:1.5.
         - Take Profit (TP2) minimal Risk:Reward 1:3.
         - Jangan set SL terlalu ketat jika ATR tinggi (saham volatile).

      INPUT DATA:
      ${JSON.stringify(topCandidates)}

      OUTPUT JSON FORMAT (ARRAY):
      [
        {
          "ticker": "KODE.JK",
          "signal": "BUY",
          "confidence": 85, (Scale 0-100)
          "entry": 1000, (Harga close terakhir atau saran entry pullback)
          "tp1": 1100,
          "tp2": 1250,
          "stopLoss": 920, (Ingat: Entry - 2x ATR)
          "reasoning": "Breakout resistance dengan volume tinggi + Bullish Engulfing. ATR support di level xxx."
        }
      ]
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(prompt);
    const responseAI = await result.response;
    const picks = JSON.parse(responseAI.text());

    // --- SAVING TO DB ---
    let savedCount = 0;
    const cleanPicks = Array.isArray(picks) ? picks : picks.picks || [];

    for (const p of cleanPicks) {
      if (p.signal === "BUY" && p.confidence >= 75) {
        // Double check ticker format
        if (!p.ticker.includes(".JK")) continue;

        const reasoning = `[AI V2] Conf=${p.confidence}% | ATR Based Risk | ${p.reasoning}`;

        // Rounding harga sesuai fraksi Indonesia (simplifikasi: round to nearest integer)
        const entry = Math.round(p.entry);
        const tp1 = Math.round(p.tp1);
        const tp2 = Math.round(p.tp2);
        const sl = Math.round(p.stopLoss);

        await pool.query(
          `INSERT INTO analysis_history 
          (ticker, signal, entry_price, tp1, tp2, stop_loss, highest_price, lowest_price, status, reasoning, date_created)
          VALUES ($1, $2, $3, $4, $5, $6, $3, $3, 'ACTIVE', $7, NOW())`,
          [p.ticker, "BUY", entry, tp1, tp2, sl, reasoning]
        );
        savedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      analyzed: processedData.length,
      candidates_sent_to_ai: topCandidates.length,
      signals_saved: savedCount,
      ai_response: cleanPicks,
    });
  } catch (error) {
    console.error("Critical Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
