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

    // Breakout / breakdown (Bollinger)
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
//  IDX UNIVERSE (KONGLO + FUNDA)
// =======================
// Semua harus .JK karena ini ticker Yahoo untuk IHSG
const IDX_UNIVERSE = [
  // --- 1. BIG BANKS (The Movers) ---
  "BBCA.JK",
  "BBRI.JK",
  "BMRI.JK",
  "BBNI.JK",
  "BNGA.JK", // Tier 2 Dividend Play

  // --- 2. DIGITAL BANKS (Tech & Volatile) ---
  "ARTO.JK", // GoTo Ecosystem (Jerry Ng)
  "BBHI.JK", // Allo Bank (Chairul Tanjung)
  "BBYB.JK", // Akulaku (Sering volatile)
  "BANK.JK", // Aladin (Syariah digital)

  // --- 3. PRAJOGO PANGESTU (The "Barito Boys" - High Beta) ---
  "BREN.JK", // Renewable Energy (Market Cap Giant)
  "BRPT.JK", // Induk Barito
  "TPIA.JK", // Petrochemical
  "CUAN.JK", // Coal mining (Sering terbang tinggi)
  "PTRO.JK", // Konstruksi tambang (Baru diakuisisi Prajogo)
  "CDIA.JK", // Petrosea (Holding)

  // --- 4. BAKRIE x SALIM (Mineral & Gold - "Harta Karun") ---
  "BRMS.JK", // Emas (Trending kuat akhir 2024 - 2025)
  "BUMI.JK", // Coal (The legend of retail)
  "AMMN.JK", // Tembaga/Emas (Salim & Medco - Monster IPO)
  "DEWA.JK", // Konstruksi (Sering digoreng isunya)
  "ENRG.JK", // Oil & Gas Bakrie

  // --- 5. AGUAN / AGUNG SEDAYU / PIK (Property & Infra) ---
  "PANI.JK", // PIK 2 (Primadona Property Aguan)
  "NICE.JK", // Nikel (Sempat hype, sering volatile)
  "BSDE.JK", // BSD City (Fundamental Property)
  "SMRA.JK", // Summarecon
  "CTRA.JK", // Ciputra
  "ASRI.JK", // Alam Sutera
  "CBDK.JK", // Alam Sutera

  // --- 6. HAJI ISAM & COAL TRADING (Kalimantan Power) ---
  "JARR.JK", // Jhonlin Agro (Sawit Haji Isam)
  "SGER.JK", // Coal Trading (Sering ARA/ARB, hati-hati)
  "ADRO.JK", // Adaro (Mau spin off AADI, lagi hot)

  // --- 7. CONSUMER, RETAIL & POULTRY ---
  "ICBP.JK",
  "MYOR.JK",
  "AMRT.JK", // Alfamart (Defensive growth)
  "MIDI.JK", // Alfamidi
  "CPIN.JK", // Charoen
  "JPFA.JK", // Japfa

  // --- 8. GORENGAN PREMIUM / TRENDING / IPO BARU ---
  "DAAZ.JK", // Data center/Tech services (Trending IPO late 2024)
  "MLPT.JK", // Multipolar (Grup Lippo, sempat terbang gila-gilaan)
  "AWAN.JK", // Tech/Cloud (Small cap volatile)
  "PYFA.JK", // Pharma (Sering bergerak liar)
  "INET.JK", // ISP (Gorengan receh)
  "BOAT.JK", // Shipping (Sering main di running trade)
  "DATA.JK", // Data center play

  // --- 9. TECH & TELCO ---
  "GOTO.JK", // Ecosystem play (Patrick Walujo)
  "TLKM.JK",
  "ISAT.JK",
  "EXCL.JK",
  "RATU.JK",
  "MINA.JK",
  "RAJA.JK",

  // --- 10. COMMODITY & ENERGY OTHERS ---
  "MEDC.JK", // Oil & Gas (Panigoro)
  "PGAS.JK",
  "ANTM.JK", // Emas/Nikel BUMN
  "MDKA.JK", // Saratogo/Boy Thohir
  "INKP.JK", // Pulp & Paper (Sinarmas)
];

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

    // 1) Universe: list saham konglo + funda (IDX_UNIVERSE)
    const symbols = IDX_UNIVERSE;
    console.log("[AI-SCREENER] universe size:", symbols.length);

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

        if (!Array.isArray(q) || q.length === 0) {
          console.warn("[AI-SCREENER] No quotes for", symbol);
          continue;
        }

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
              date: d.toISOString().slice(0, 10),
              open: row.open,
              high: row.high,
              low: row.low,
              close: row.close,
              volume: row.volume,
            };
          })
          .filter(Boolean);

        if (stockData.length < 60) {
          console.warn(
            "[AI-SCREENER] Not enough data for",
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

        // Prefilter: buang yang teknikalnya jelek banget (threshold 55)
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
        console.error("[AI-SCREENER] Error processing symbol", symbol, err);
      }
    }

    console.log(
      "[AI-SCREENER] allLastSnapshots:",
      allLastSnapshots.length,
      "| candidates (techConf>=55):",
      candidates.length
    );

    // Kalau nggak ada yang lolos filter teknikal tapi data ada,
    // fallback: ambil top 10 berdasarkan technicalConfidence dari semua snapshots.
    let effectiveCandidates = candidates;
    if (!effectiveCandidates.length && allLastSnapshots.length) {
      console.warn(
        "[AI-SCREENER] No candidates with technicalConfidence>=55, falling back to top 10 from universe."
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
      return res.status(200).json({
        message: "No candidates found from IDX_UNIVERSE (no usable OHLC).",
        universeSize: symbols.length,
        snapshots: allLastSnapshots.length,
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
      - Semua ticker yang diberikan sudah dalam format Yahoo Finance (".JK").
      - Jangan pernah mengeluarkan ticker luar negeri (seperti AAPL, TSLA, NVDA, dll).
      
      Input Data Kandidat:
      ${JSON.stringify(topCandidates)}

      Output JSON Schema (Array of Objects):
      [
        {
          "ticker": "KODE.JK",
          "signal": "BUY",
          "confidence": number (0-100),
          "entry": number,
          "tp1": number,
          "tp2": number,
          "stopLoss": number,
          "reasoning": "Alasan singkat padat dalam Bahasa Indonesia, gunakan istilah teknikal."
        }
      ]
      
      PENTING:
      - Hanya berikan output JSON murni.
      - Pastikan harga Entry, TP, SL logis sesuai fraksi harga saham Indonesia.
      - Hanya sertakan saham dengan confidence >= 70.
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
      console.error("[AI-SCREENER] Failed to parse Gemini JSON", e, text);
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

        // Hanya BUY, confidence >= 70
        if (p.signal !== "BUY" || (p.confidence ?? 0) < 70) continue;

        const rawTicker = String(p.ticker || "")
          .toUpperCase()
          .trim();

        // HARD FILTER: hanya ticker .JK yang kita terima
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
        console.error("[AI-SCREENER] Failed inserting pick", p, e);
      }
    }

    return res.status(200).json({
      message: "AI screener run complete",
      inserted,
      universeSize: symbols.length,
      totalCandidatesAfterFilter: effectiveCandidates.length,
      totalRawSnapshots: allLastSnapshots.length,
    });
  } catch (error) {
    console.error("cron-ai-screener error:", error);
    return res.status(500).json({ error: error.message });
  }
}
