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

    if (sma50Val != null) {
      if (close > sma50Val) techScore += 10;
      else techScore -= 10;
    }

    if (macdHist > 0) techScore += 5;
    else if (macdHist < 0) techScore -= 5;

    if (rsiVal > 55) techScore += 5;
    else if (rsiVal < 45) techScore -= 5;

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

// =======================
//  MAIN HANDLER
// =======================

export default async function handler(req, res) {
  try {
    // =========================
    //  Cron Auth pakai CRON_SECRET
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
    //    Region: ID, Lang: id-ID
    const screenerRes = await yf.screener({
      scrIds: ["day_gainers", "most_actives"],
      count: 60,
      region: "ID",
      lang: "id-ID",
    });

    // Struktur tergantung versi lib → paksa ke bentuk aman
    const quotes =
      Array.isArray(screenerRes?.quotes) && screenerRes.quotes.length
        ? screenerRes.quotes
        : screenerRes?.finance?.result?.[0]?.quotes ?? [];

    const symbols = [
      ...new Set(
        quotes
          .map((q) => q.symbol)
          .filter(
            (s) => typeof s === "string" && s.length > 0 && s.endsWith(".JK")
          ) // Pastikan saham Indo
      ),
    ].slice(0, 40); // batasi supaya nggak kebanyakan

    const candidates = [];

    // 2) Untuk tiap symbol → ambil OHLC 6 bulan + hitung indikator
    for (const symbol of symbols) {
      try {
        const chartRes = await yf.chart(symbol, {
          range: "6mo",
          interval: "1d",
        });

        const timestamps = chartRes?.timestamp || chartRes?.timestamps;
        const quote = chartRes?.indicators?.quote?.[0];

        if (!Array.isArray(timestamps) || !quote || !quote.close) continue;

        const stockData = timestamps
          .map((ts, idx) => {
            const close = quote.close[idx];
            const open = quote.open?.[idx];
            const high = quote.high?.[idx];
            const low = quote.low?.[idx];
            const volume = quote.volume?.[idx];

            if (
              close == null ||
              open == null ||
              high == null ||
              low == null ||
              volume == null
            ) {
              return null;
            }

            return {
              date: new Date(ts * 1000).toISOString().slice(0, 10),
              open,
              high,
              low,
              close,
              volume,
            };
          })
          .filter(Boolean);

        if (stockData.length < 60) continue;

        const indicators = calculateIndicators(stockData);
        const last = indicators[indicators.length - 1];

        if (!last || last.technicalConfidence == null) continue;

        // Filter awal: Hanya yang confidence teknikalnya lumayan (>55)
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

    if (!candidates.length) {
      return res.status(200).json({ message: "No candidates found" });
    }

    // Sort lokal dulu by technicalConfidence, ambil top 15 buat AI
    const topCandidates = candidates
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
      - Confidence harus > 70 untuk masuk daftar.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let picks;
    try {
      picks = JSON.parse(text);
      if (!Array.isArray(picks)) {
        // Kadang Gemini bungkus di object { "picks": [...] }
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

        // Validasi tambahan
        if (p.signal !== "BUY" || (p.confidence ?? 0) < 70) continue;

        const ticker = p.ticker.toUpperCase();
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
      candidates: candidates.length,
    });
  } catch (error) {
    console.error("cron-ai-screener error:", error);
    return res.status(500).json({ error: error.message });
  }
}
