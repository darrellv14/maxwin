import YahooFinance from "yahoo-finance2";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "./db.js";

// =======================
//  Helper: TECHNICALS
// =======================

const calculateSMA = (closes, period) => {
  const n = closes.length;
  const out = Array(n).fill(null);
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

const calculateEMA = (closes, period) => {
  const n = closes.length;
  const out = Array(n).fill(null);
  if (n < period) return out;

  const k = 2 / (period + 1);

  // seed EMA dengan SMA
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

// Wilder RSI 14
const calculateRSI = (closes, period = 14) => {
  const n = closes.length;
  const rsi = Array(n).fill(null);
  if (n <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum -= diff;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  let rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

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

const calculateBollingerBands = (closes, period = 20, k = 2) => {
  const n = closes.length;
  const upper = Array(n).fill(null);
  const lower = Array(n).fill(null);
  const middle = calculateSMA(closes, period);

  if (n < period) return { upper, lower, middle };

  for (let i = period - 1; i < n; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];

    let varianceSum = 0;
    for (let j = 0; j < slice.length; j++) {
      const diff = slice[j] - mean;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / period;
    const stdDev = Math.sqrt(variance);

    upper[i] = mean + k * stdDev;
    lower[i] = mean - k * stdDev;
  }

  return { upper, lower, middle };
};

const calculateIndicators = (stockData) => {
  const n = stockData.length;
  if (n === 0) return [];

  const closes = stockData.map((d) => d.close);

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const rsiArray = calculateRSI(closes, 14);

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (ema12[i] != null && ema26[i] != null) {
      macdLine[i] = ema12[i] - ema26[i];
    }
  }

  const macdValuesForEma = macdLine.map((v) => (v == null ? 0 : v));
  const macdSignalRaw = calculateEMA(macdValuesForEma, 9);
  const macdSignal = macdSignalRaw.map((val, i) =>
    macdLine[i] == null ? null : val
  );

  const macdHistogram = Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (macdLine[i] != null && macdSignal[i] != null) {
      macdHistogram[i] = macdLine[i] - macdSignal[i];
    }
  }

  const {
    upper: bbUpper,
    lower: bbLower,
    middle: bbMiddle,
  } = calculateBollingerBands(closes, 20, 2);

  return stockData.map((d, i) => {
    let techScore = 50;

    const close = d.close;
    const rsiVal = rsiArray[i] ?? 50;
    const macdHist = macdHistogram[i] ?? 0;
    const sma50Val = sma50[i];
    const upper = bbUpper[i];
    const lower = bbLower[i];

    // Trend: MA50
    if (sma50Val != null) {
      if (close > sma50Val) techScore += 10;
      else techScore -= 10;
    }

    // Momentum: MACD histogram
    if (macdHist > 0) techScore += 5;
    else if (macdHist < 0) techScore -= 5;

    // RSI
    if (rsiVal > 55) techScore += 5;
    else if (rsiVal < 45) techScore -= 5;

    // Breakout / breakdown
    if (upper != null && close > upper) techScore += 5;
    if (lower != null && close < lower) techScore -= 5;

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
};

// =======================
//  Helper: Gemini client
// =======================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Normalisasi shape screener (quotes kadang di root, kadang di finance.result[0])
const normalizeQuotes = (screenerRes) => {
  if (!screenerRes) return [];
  if (Array.isArray(screenerRes.quotes)) return screenerRes.quotes;
  if (
    screenerRes.finance &&
    screenerRes.finance.result &&
    screenerRes.finance.result[0] &&
    Array.isArray(screenerRes.finance.result[0].quotes)
  ) {
    return screenerRes.finance.result[0].quotes;
  }
  return [];
};

// =======================
//  MAIN HANDLER
// =======================

export default async function handler(req, res) {
  try {
    // =========================
    //  Cron Auth pakai CRON_SECRET (Authorization header)
    // =========================
    const secret = process.env.CRON_SECRET;

    if (secret) {
      const authHeader =
        req.headers["authorization"] || req.headers["Authorization"];

      if (authHeader !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const yf = new YahooFinance();

    // 1) Ambil kandidat dari Yahoo Screener (INDONESIA)
    const screenerRes1 = await yf.screener({
      scrIds: "day_gainers",
      count: 30,
      region: "JK",
      lang: "id-ID",
    });

    const screenerRes2 = await yf.screener({
      scrIds: "most_actives",
      count: 30,
      region: "JK",
      lang: "id-ID",
    });

    const quotes1 = normalizeQuotes(screenerRes1);
    const quotes2 = normalizeQuotes(screenerRes2);

    // Map untuk dedupe symbol
    const uniqueQuotesMap = new Map();
    [...quotes1, ...quotes2].forEach((q) => {
      if (q && q.symbol) uniqueQuotesMap.set(q.symbol, q);
    });

    const quotes = Array.from(uniqueQuotesMap.values());

    // 🔥 HANYA saham IHSG (ticker Yahoo harus berakhiran .JK)
    const symbols = [
      ...new Set(
        quotes
          .map((q) => q.symbol)
          .filter(
            (s) =>
              typeof s === "string" &&
              s.length > 0 &&
              s.toUpperCase().endsWith(".JK")
          )
      ),
    ].slice(0, 40);

    console.log(
      "[AI-SCREENER] total quotes:",
      quotes.length,
      "| symbols(.JK only):",
      symbols.length
    );

    const candidates = [];
    const allLastSnapshots = [];

    // 2) Untuk tiap symbol → ambil OHLC ~6 bulan + hitung indikator
    for (const symbol of symbols) {
      try {
        // 6 bulan ke belakang
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const chartRes = await yf.chart(symbol, {
          period1: sixMonthsAgo,
          interval: "1d",
        });

        const q = chartRes?.quotes ?? [];

        // Kalau kosong / nggak ada OHLC, skip
        if (!Array.isArray(q) || q.length === 0) {
          console.warn("No quotes for", symbol);
          continue;
        }

        // Mapping ke bentuk StockData
        const stockData = q
          .map((row) => {
            if (
              row.open == null ||
              row.high == null ||
              row.low == null ||
              row.close == null ||
              row.volume == null
            ) {
              return null;
            }

            const d =
              row.date instanceof Date
                ? row.date
                : new Date(row.date ?? Date.now());

            return {
              date: d.toISOString().slice(0, 10), // YYYY-MM-DD
              open: row.open,
              high: row.high,
              low: row.low,
              close: row.close,
              volume: row.volume,
            };
          })
          .filter(Boolean);

        // Butuh minimal 60 bar untuk indikator lebih stabil
        if (stockData.length < 60) {
          console.warn(
            "Not enough data for",
            symbol,
            "bars:",
            stockData.length
          );
          continue;
        }

        const indicators = calculateIndicators(stockData);
        const last = indicators[indicators.length - 1];

        if (!last || last.technicalConfidence == null) continue;

        allLastSnapshots.push({ symbol, last });

        // ✅ Filter awal: hanya yang technicalConfidence >= 70
        if (last.technicalConfidence < 55) continue;

        candidates.push({
          ticker: symbol,
          lastClose: last.close,
          rsi: last.rsi,
          macdHistogram: last.macdHistogram,
          sma20: last.sma20,
          sma50: last.sma50,
          bbUpper: last.bbUpper,
          bbLower: last.bbLower,
          technicalConfidence: last.technicalConfidence,
        });
      } catch (err) {
        console.error("Error processing symbol", symbol, err);
      }
    }

    console.log(
      "[AI-SCREENER] allLastSnapshots:",
      allLastSnapshots.length,
      "| candidates (techConf>=55):",
      candidates.length
    );

    // Kalau bener-bener nggak ada yang lolos filter >=70 tapi data ada,
    // fallback: pakai top 10 berdasarkan technicalConfidence.
    let effectiveCandidates = candidates;
    if (!effectiveCandidates.length && allLastSnapshots.length) {
      console.warn(
        "[AI-SCREENER] No candidates with technicalConfidence>=55, falling back to top 10."
      );
      effectiveCandidates = allLastSnapshots
        .map(({ symbol, last }) => ({
          ticker: symbol,
          lastClose: last.close,
          rsi: last.rsi,
          macdHistogram: last.macdHistogram,
          sma20: last.sma20,
          sma50: last.sma50,
          bbUpper: last.bbUpper,
          bbLower: last.bbLower,
          technicalConfidence: last.technicalConfidence ?? 0,
        }))
        .filter((c) => Number.isFinite(c.lastClose))
        .sort(
          (a, b) => (b.technicalConfidence ?? 0) - (a.technicalConfidence ?? 0)
        )
        .slice(0, 10);
    }

    if (!effectiveCandidates.length) {
      // Ini baru bener-bener kosong (nggak dapat data sama sekali)
      return res.status(200).json({
        message: "No candidates found (no usable data from screener/quotes).",
        quotes: quotes.length,
        symbols: symbols.length,
      });
    }

    // Sort lokal lagi by technicalConfidence, ambil top 15 buat AI
    const topCandidates = effectiveCandidates
      .filter((c) => Number.isFinite(c.lastClose))
      .sort(
        (a, b) => (b.technicalConfidence ?? 0) - (a.technicalConfidence ?? 0)
      )
      .slice(0, 15);

    // 3) Panggil Gemini (JSON mode) untuk pilih stockpick & bikin trade plan
    const prompt = `
      Anda adalah "The Oracle", trader saham profesional khusus pasar saham Indonesia (IDX).
      Tugas Anda: Analisis daftar kandidat saham berikut dan pilih maksimal 5 saham terbaik untuk dibeli (LONG ONLY).
      
      Kriteria Pemilihan:
      1. Tren Bullish Kuat (Harga di atas SMA50).
      2. Momentum Positif (MACD Histogram > 0).
      3. Volatilitas Sehat (Tidak sedang tidur/sideways parah).
      4. Hindari saham gorengan yang tidak likuid jika memungkinkan.
      
      SANGAT PENTING:
      - Hanya boleh memilih saham Indonesia yang kodenya di Yahoo Finance berakhiran ".JK".
      - Jangan pernah mengeluarkan ticker luar negeri (seperti AAPL, TSLA, NVDA, dll).
      - Jika ingin memilih BBCA misalnya, gunakan "BBCA.JK" sebagai ticker.
      
      Input Data Kandidat:
      ${JSON.stringify(topCandidates)}

      Output JSON Schema (Array of Objects):
      [
        {
          "ticker": "KODE.JK",
          "signal": "BUY",
          "confidence": number (0-100),
          "entry": number (Harga Entry Ideal),
          "tp1": number (Target Profit 1),
          "tp2": number (Target Profit 2),
          "stopLoss": number (Stop Loss),
          "reasoning": "Alasan singkat padat dalam Bahasa Indonesia, gunakan istilah teknikal."
        }
      ]
      
      PENTING:
      - Hanya berikan output JSON murni.
      - Pastikan harga Entry, TP, SL logis sesuai fraksi harga saham Indonesia.
      - Hanya sertakan saham dengan confidence > 55.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const responseAI = await result.response;
    const text = responseAI.text();

    let picks;
    try {
      picks = JSON.parse(text);
      if (!Array.isArray(picks)) {
        if (picks.picks && Array.isArray(picks.picks)) {
          picks = picks.picks;
        } else {
          throw new Error("AI response is not an array");
        }
      }
    } catch (e) {
      console.error("Failed to parse Gemini JSON", e, text);
      return res
        .status(500)
        .json({ error: "Gemini JSON parse error", raw: text });
    }

    // 4) Simpan ke analysis_history
    let inserted = 0;

    for (const p of picks) {
      try {
        if (
          !p.ticker ||
          !p.signal ||
          typeof p.entry !== "number" ||
          typeof p.tp1 !== "number" ||
          typeof p.tp2 !== "number" ||
          typeof p.stopLoss !== "number"
        ) {
          continue;
        }

        // ✅ Filter: hanya BUY, confidence >= 70
        if (p.signal !== "BUY" || (p.confidence ?? 0) < 55) continue;

        const rawTicker = String(p.ticker || "")
          .toUpperCase()
          .trim();

        // ✅ HARD FILTER: hanya ticker .JK yang kita terima
        if (!rawTicker.endsWith(".JK")) {
          console.warn("[AI-SCREENER] Skip non-JK ticker from AI:", rawTicker);
          continue;
        }

        const ticker = rawTicker;
        const signal = "BUY";
        const entry = p.entry;
        const tp1 = p.tp1;
        const tp2 = p.tp2;
        const stopLoss = p.stopLoss;
        const reasoning = `[AI-SCREENER] Conf=${p.confidence?.toFixed?.(
          0
        )}% | ${p.reasoning}`;

        const query = `
          INSERT INTO analysis_history
            (ticker, signal, entry_price, tp1, tp2, stop_loss,
             highest_price, lowest_price, status, reasoning, date_created)
          VALUES ($1, $2, $3, $4, $5, $6, $3, $3, 'ACTIVE', $7, NOW())
          RETURNING id
        `;

        const values = [ticker, signal, entry, tp1, tp2, stopLoss, reasoning];

        await pool.query(query, values);
        inserted++;
      } catch (e) {
        console.error("Failed inserting pick", p, e);
      }
    }

    return res.status(200).json({
      message: "AI screener run complete",
      inserted,
      totalCandidatesAfterFilter: effectiveCandidates.length,
      totalRawSnapshots: allLastSnapshots.length,
      totalQuotes: quotes.length,
      totalSymbols: symbols.length,
    });
  } catch (error) {
    console.error("cron-ai-screener error:", error);
    return res.status(500).json({ error: error.message });
  }
}
