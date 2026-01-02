import pool from "./db.js";
import YahooFinance from "yahoo-finance2";
import { GoogleGenerativeAI } from "@google/generative-ai";
import TI from "technicalindicators";
import { setSecurityHeaders, rateLimit } from "./security.js";

// Ensure user_id is nullable for AI picks
const ensureNullableUserId = async () => {
  try {
    await pool.query(`
      ALTER TABLE analysis_history ALTER COLUMN user_id DROP NOT NULL;
    `);
  } catch (e) {
    // Ignore - already nullable or doesn't exist
  }
};
ensureNullableUserId().catch(() => {});

// Helper: Calculate Risk-Reward Ratio
const calculateRRR = (entry, tp1, sl) => {
  if (!entry || !tp1 || !sl) return "N/A";
  const risk = entry - sl;
  const reward = tp1 - entry;
  if (risk <= 0) return "N/A";
  const ratio = (reward / risk).toFixed(1);
  return `1:${ratio}`;
};

// =======================
//  Helper: TECHNICALS
// =======================
const calculateAdvancedIndicators = (stockData) => {
  const opens = stockData.map((d) => d.open);
  const highs = stockData.map((d) => d.high);
  const lows = stockData.map((d) => d.low);
  const closes = stockData.map((d) => d.close);
  const volumes = stockData.map((d) => d.volume);

  const sma20 = TI.SMA.calculate({ period: 20, values: closes });
  const sma50 = TI.SMA.calculate({ period: 50, values: closes });
  const ema200 = TI.EMA.calculate({ period: 200, values: closes });

  const rsi = TI.RSI.calculate({ period: 14, values: closes });
  const macd = TI.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const bb = TI.BollingerBands.calculate({
    period: 20,
    stdDev: 2,
    values: closes,
  });

  const atr = TI.ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes,
  });

  const obv = TI.OBV.calculate({
    close: closes,
    volume: volumes,
  });

  const lastIndex = stockData.length - 1;
  const tiIndex = (arr) => arr[arr.length - 1];

  if (closes.length < 55) return null;

  const lastRSI = tiIndex(rsi);
  const lastMACD = tiIndex(macd);
  const lastBB = tiIndex(bb);
  const lastSMA20 = tiIndex(sma20);
  const lastSMA50 = tiIndex(sma50);
  const lastEMA200 = tiIndex(ema200);
  const lastATR = tiIndex(atr);
  const lastOBV = tiIndex(obv);
  const prevOBV = obv[obv.length - 2];

  let techScore = 50;
  const currentClose = closes[lastIndex];

  // SMA20 crossover - short term momentum
  if (currentClose > lastSMA20) techScore += 5;
  // SMA20 above SMA50 - bullish alignment
  if (lastSMA20 > lastSMA50) techScore += 5;
  // Price above SMA50 - medium term trend
  if (currentClose > lastSMA50) techScore += 10;
  // Price above EMA200 - long term trend
  if (lastEMA200 && currentClose > lastEMA200) techScore += 10;
  // MACD histogram positive - momentum
  if (lastMACD.histogram > 0) techScore += 5;
  // RSI in bullish zone but not overbought
  if (lastRSI > 50 && lastRSI < 70) techScore += 5;
  // OBV increasing - volume confirmation
  if (lastOBV > prevOBV) techScore += 5;
  // Price breakout above Bollinger upper band
  if (currentClose > lastBB.upper) techScore += 10;

  const technicalConfidence = Math.min(100, Math.max(0, techScore));

  return {
    technicalConfidence,
    indicators: {
      rsi: lastRSI,
      macdHist: lastMACD.histogram,
      sma20: lastSMA20,
      sma50: lastSMA50,
      ema200: lastEMA200,
      bbUpper: lastBB.upper,
      bbLower: lastBB.lower,
      atr: lastATR,
      obvSlope: lastOBV > prevOBV ? "UP" : "DOWN",
    },
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// IDX Universe - Comprehensive list of Indonesian stocks
const IDX_UNIVERSE = [
  // === BANKING (BIG CAPS & DIGITAL) ===
  "BBCA.JK",
  "BBRI.JK",
  "BMRI.JK",
  "BBNI.JK", // Big 4
  "BNGA.JK",
  "BDMN.JK",
  "NISP.JK",
  "BRIS.JK", // Second Liner
  "ARTO.JK",
  "BBHI.JK",
  "BBYB.JK",
  "BANK.JK",
  "BABP.JK",
  "AGRO.JK",
  "AMAR.JK",
  "BEKS.JK", // Digital & Volatile
  "BGTG.JK",
  "BINA.JK",
  "BTPS.JK",
  "BVIC.JK",
  "MCOR.JK",
  "NOBU.JK",
  "SDRA.JK",

  // === GRUP PRAJOGO PANGESTU (Barito - The Mover) ===
  "BRPT.JK",
  "TPIA.JK",
  "BREN.JK",
  "CUAN.JK",
  "PTRO.JK",
  "CDIA.JK",
  "SSIA.JK",

  // === GRUP HAPSORO (Happy Hapsoro - Sering Digoreng) ===
  "RAJA.JK",
  "RATU.JK",
  "MINA.JK",
  "SINI.JK",
  "BUVA.JK",
  "UANG.JK",
  "CBRE.JK",
  "HADE.JK",
  "BEER.JK",
  "FUJI.JK",
  "LUCK.JK",
  "PAMG.JK",
  "IKAN.JK",
  "DEAL.JK",

  // === GRUP HUMI / GTSI (Sering Pump) ===
  "HUMI.JK",
  "GTSI.JK",
  "MABA.JK",
  "NASI.JK",
  "NASA.JK",
  "NAIK.JK",
  "KIOS.JK",
  "TAMU.JK",
  "DAYA.JK",
  "CITY.JK",
  "TECH.JK",
  "BLUE.JK",

  // === GRUP SALIM (Indofood & Tech) ===
  "INDF.JK",
  "ICBP.JK",
  "AMMN.JK",
  "DNET.JK",
  "IMAS.JK",
  "SIMP.JK",
  "BUMI.JK",
  "EMTK.JK",
  "LSIP.JK",
  "META.JK",

  // === GRUP BAKRIE (High Volatility/Legendary Gorengan) ===
  "BRMS.JK",
  "DEWA.JK",
  "ENRG.JK",
  "BUMI.JK",
  "VKTR.JK",
  "BNBR.JK",
  "UNSP.JK",
  "VIVA.JK",
  "MDIA.JK",
  "ELTY.JK",

  // === GRUP LIPPO (Sering Spike Tiba-tiba) ===
  "LPKR.JK",
  "LPCK.JK",
  "MLPL.JK",
  "MLPT.JK",
  "MPPA.JK",
  "LPPF.JK",
  "SILO.JK",
  "GOLL.JK",

  // === GRUP PANIN (Value Trap / Volatile) ===
  "PNIN.JK",
  "PNLF.JK",
  "PNBN.JK",
  "PANS.JK",

  // === GRUP SINAR MAS (Keluarga Widjaja) ===
  "BSDE.JK",
  "DSSA.JK",
  "INKP.JK",
  "TKIM.JK",
  "SMAR.JK",
  "GEMS.JK",
  "FREN.JK",
  "DMAS.JK",

  // === GRUP DJARUM (Hartono) ===
  "TOWR.JK",
  "BELI.JK",
  "RANC.JK",

  // === BUMN "GORENGAN" / HIGH BETA (GIAA, Karya, Pharma) ===
  "GIAA.JK",
  "GMFI.JK", // Airlines
  "WSKT.JK",
  "WIKA.JK",
  "PTPP.JK",
  "ADHI.JK",
  "PPRO.JK",
  "WEGE.JK", // Konstruksi & Properti
  "KAEF.JK",
  "INAF.JK",
  "SMBR.JK",
  "KRAS.JK",
  "ANTM.JK",
  "TINS.JK", // Others
  "JSMR.JK",
  "WTON.JK",
  "NRCA.JK",
  "DGIK.JK",
  "ACST.JK",
  "TOTL.JK",

  // === LOW TUCK KWONG (Coal King) ===
  "BYAN.JK",
  "MYOH.JK",

  // === GARIBALDI "BOY" THOHIR ===
  "ADRO.JK",
  "ADMR.JK",
  "MDKA.JK",
  "MBMA.JK",
  "ESSA.JK",

  // === HERMANTO TANOKO (Tancorp) ===
  "AVIA.JK",
  "CLEO.JK",
  "DEPO.JK",
  "RISE.JK",
  "PEVE.JK",
  "BLES.JK",

  // === HARY TANOE (MNC Group) ===
  "MNCN.JK",
  "BHIT.JK",
  "KPIG.JK",
  "IPTV.JK",
  "BCAP.JK",
  "BABP.JK",

  // === PROPERTY AGUAN (PIK) & OTHERS ===
  "PANI.JK", // Aguan / Sedayu
  "BSBK.JK", // Wulandari (Sering dimainin)
  "SMRA.JK",
  "CTRA.JK",
  "ASRI.JK",
  "PWON.JK",
  "BKSL.JK",
  "DILD.JK",
  "BEST.JK",
  "KIJA.JK",
  "JRPT.JK",
  "RBMS.JK",
  "NZIA.JK",
  "URBN.JK",
  "LAND.JK",
  "OMRE.JK",
  "POLL.JK",
  "RODA.JK",

  // === MINING & ENERGY (Commodity Swing) ===
  "PTBA.JK",
  "ITMG.JK",
  "HRUM.JK",
  "MEDC.JK",
  "PGAS.JK",
  "INCO.JK",
  "PSAB.JK",
  "DOID.JK",
  "ELSA.JK",
  "APEX.JK",
  "SOCI.JK",
  "FIRE.JK",
  "ZINC.JK",
  "SMMT.JK",
  "IFII.JK",
  "BSSR.JK",
  "COAL.JK",
  "AKRA.JK",

  // === SAHAM GOCAP / THIRD LINER / SERING DITERBANGIN ===
  "ZATA.JK",
  "GTBO.JK",
  "STRK.JK",
  "WIDI.JK",
  "NICE.JK",
  "AEGS.JK",
  "AYLS.JK",
  "REAL.JK",
  "SBAT.JK",
  "POSA.JK",
  "CARE.JK",
  "WINR.JK",
  "GOTO.JK",
  "GTRA.JK",
  "KJEN.JK",
  "LUCK.JK",
  "FILM.JK",
  "BOLA.JK",
  "JSKY.JK",
  "SAFE.JK",
  "CBMF.JK",
  "CLAY.JK",
  "PSGO.JK",
  "EAST.JK",
  "BOSS.JK",
  "SATU.JK",
  "SOTS.JK",
  "MPRO.JK",
  "SOFA.JK",
  "OBMD.JK",
  "WAPO.JK",
  "YELO.JK",
  "NPGF.JK",

  // === TRENDING / HOT PICKS / RECENT MOVERS ===
  "DAAZ.JK",
  "AWAN.JK",
  "PYFA.JK",
  "SRAJ.JK", // Kesehatan lagi manggung
  "WIFI.JK",
  "PACK.JK",
  "ARCI.JK",
  "EMAS.JK",
  "DCII.JK",
  "BUKA.JK",
  "BOAT.JK",
  "JARR.JK",
  "RONY.JK",
  "GULA.JK",
  "BAUT.JK",
  "CASH.JK",
  "HILL.JK",
  "KOPI.JK",
  "KEEN.JK",
  "NETV.JK",
  "OILS.JK",
  "PGJO.JK",
  "SAPX.JK",
  "SGER.JK",
  "TEBE.JK",
  "TRIM.JK",
  "WIFI.JK",
  "ZONE.JK",

  // === CONSUMER & RETAIL ===
  "MYOR.JK",
  "AMRT.JK",
  "MIDI.JK",
  "CPIN.JK",
  "JPFA.JK",
  "UNVR.JK",
  "KLBF.JK",
  "HMSP.JK",
  "GGRM.JK",
  "SIDO.JK",
  "ACES.JK",
  "ERAA.JK",
  "ERAL.JK",
  "LUCY.JK",
  "HERO.JK",
  "LPPF.JK",
  "MAPI.JK",
  "RALS.JK",
  "SUPRA.JK",
  "TSPC.JK",

  // === TELCO ===
  "TLKM.JK",
  "ISAT.JK",
  "EXCL.JK",

  // === AUTO & INDUSTRIAL ===
  "ASII.JK",
  "AUTO.JK",
  "GJTL.JK",
  "INDS.JK",
  "SMSM.JK",
  "BOLT.JK",
  "DRMA.JK",
  "IMPC.JK",
  "ARNA.JK",
  "MARK.JK",
  "TOTO.JK",
];

// ============ GET AI PICKS ============
async function getAIPicks(req, res) {
  const limit = parseInt(req.query.limit || "20", 10);

  try {
    // Get latest AI screener picks (public - no user filter)
    const query = `
      SELECT DISTINCT ON (ticker)
        id, ticker, signal, entry_price, tp1, tp2, stop_loss,
        highest_price, lowest_price, status, reasoning, date_created
      FROM analysis_history
      WHERE reasoning LIKE '[AI-SCREENER]%'
        AND date_created > NOW() - INTERVAL '7 days'
      ORDER BY ticker, date_created DESC
      LIMIT $1
    `;

    const { rows } = await pool.query(query, [limit]);

    // Extract confidence from reasoning field (format: "[AI-SCREENER] Conf=85% | ...")
    const rowsWithConfidence = rows.map(row => {
      let confidence = 75; // default
      const match = row.reasoning?.match(/Conf=(\d+)%/);
      if (match) {
        confidence = parseInt(match[1], 10);
      }
      return { ...row, confidence };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
    return res.status(200).json(rowsWithConfidence);
  } catch (error) {
    console.error("AI Picks API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

// ============ RUN SCREENER (CRON) ============
async function runScreener(req, res) {
  try {
    // Check auth only for /run-screener path from external sources
    // Allow ?action=generate for admin manual trigger
    const url = new URL(req.url, `http://${req.headers.host}`);
    const isDevMode = url.searchParams.get("action") === "generate";

    // For cron job from Vercel, check CRON_SECRET
    // For manual trigger (action=generate), allow without auth (admin only via frontend)
    const secret = process.env.CRON_SECRET;
    if (secret && !isDevMode) {
      const authHeader = req.headers["authorization"] || req.headers["Authorization"];
      // Vercel cron sends secret as Bearer token
      const token = authHeader?.replace("Bearer ", "");
      if (token !== secret && authHeader !== secret) {
        console.log("[AI-ORACLE] Unauthorized cron request");
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    console.log(`[AI-ORACLE] Screener triggered - isDevMode: ${isDevMode}`);
    const yf = new YahooFinance();
    const symbols = IDX_UNIVERSE;
    console.log(`[AI-ORACLE] Analyzing ${symbols.length} stocks...`);

    const processedData = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (symbol) => {
        try {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 365);

          const chartRes = await yf.chart(symbol, {
            period1: startDate,
            interval: "1d",
          });

          const q = chartRes?.quotes ?? [];
          if (!q.length) return null;

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

          if (stockData.length < 200) return null;

          const analysis = calculateAdvancedIndicators(stockData);
          if (!analysis) return null;

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

    const topCandidates = processedData
      .sort((a, b) => b.technicalConfidence - a.technicalConfidence)
      .slice(0, 25);

    if (topCandidates.length === 0) {
      return res.status(200).json({ message: "Market bearish. No candidates passed filter." });
    }

    const prompt = `
      ROLE: Anda adalah "THE ORACLE" - algoritma hedge fund kuantitatif elit khusus IHSG (Bursa Efek Indonesia).

      MISI: Analisis kandidat saham dan pilih TOP 7-10 saham TERBAIK untuk posisi SWING TRADE (hold 3-10 hari).

      ═══════════════════════════════════════════════════════════════
      ▓▓ STRATEGI ANALISIS: THE KAIROS PROTOCOL ▓▓
      ═══════════════════════════════════════════════════════════════

      【1】 VPA (VOLUME PRICE ANALYSIS) - Bobot 35%
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      • Volume Spike: Cari candle dengan volume > 2x rata-rata 20 hari
      • Accumulation Sign: Bullish candle + High Volume = Smart Money masuk
      • Distribution Warning: Bearish candle + High Volume = Hindari
      • OBV Slope: Positif = Akumulasi tersembunyi, Negatif = Distribusi

      【2】 MOMENTUM & TREND CONFLUENCE - Bobot 30%
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      • RSI Sweet Spot: 40-60 (Momentum building), bukan overbought
      • MACD Crossover: Histogram berubah dari negatif ke positif
      • Price vs MA: Close > SMA50 = Uptrend confirmed
      • Bollinger Squeeze: Band menyempit = Explosive move coming

      【3】 PATTERN RECOGNITION - Bobot 20%
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      • Bullish Reversal: Hammer, Morning Star, Bullish Engulfing
      • Continuation: Three White Soldiers, Rising Three Methods
      • Breakout Setup: Close di atas resistance dengan volume tinggi
      • Support Test: Bounce dari support kuat dengan volume meningkat

      【4】 RISK ENGINEERING (CRITICAL) - Bobot 15%
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      • Stop Loss Formula: Entry - (1.5 × ATR) untuk swing trade
      • TP1 Target: Risk:Reward minimal 1:1.5
      • TP2 Target: Risk:Reward minimal 1:2.5 hingga 1:3
      • Position Sizing: ATR tinggi = Ukuran posisi lebih kecil

      ═══════════════════════════════════════════════════════════════
      ▓▓ SIGNAL CLASSIFICATION ▓▓
      ═══════════════════════════════════════════════════════════════
      
      🟢 STRONG BUY (Confidence 85-95%)
         → Semua kriteria terpenuhi + Volume spike + Breakout pattern
         → RRR minimal 1:2.5

      🟡 BUY (Confidence 75-84%)
         → Mayoritas kriteria terpenuhi + Trend aligned
         → RRR minimal 1:2

      🔵 SPECULATIVE BUY (Confidence 65-74%)
         → Setup menarik tapi belum konfirmasi sempurna
         → Potential high reward, higher risk
         → RRR minimal 1:3 untuk kompensasi risiko

      ═══════════════════════════════════════════════════════════════
      ▓▓ INPUT DATA KANDIDAT ▓▓
      ═══════════════════════════════════════════════════════════════
      ${JSON.stringify(topCandidates)}

      ═══════════════════════════════════════════════════════════════
      ▓▓ OUTPUT FORMAT (STRICT JSON ARRAY) ▓▓
      ═══════════════════════════════════════════════════════════════
      [
        {
          "ticker": "KODE.JK",
          "signal": "STRONG BUY" | "BUY" | "SPECULATIVE BUY",
          "confidence": 85,
          "entry": 1000,
          "tp1": 1150,
          "tp2": 1300,
          "stopLoss": 920,
          "rrr": "1:2.5",
          "reasoning": "VPA: Volume spike 2.5x avg + Bullish Engulfing. MOMENTUM: RSI 52 rising, MACD cross bullish. PATTERN: Breakout resistance 980 confirmed. RISK: ATR 40, SL aman di 920 (2x ATR below entry)."
        }
      ]

      INSTRUKSI PENTING:
      1. Pilih HANYA 7-10 saham TERBAIK dengan setup paling meyakinkan
      2. Reasoning HARUS mencakup analisis VPA, Momentum, dan Pattern
      3. Hitung RRR aktual: (TP1 - Entry) / (Entry - SL)
      4. Confidence score berdasarkan kualitas setup, BUKAN spekulasi
      5. JANGAN pilih saham dengan OBV negatif atau volume menurun
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(prompt);
    const responseAI = await result.response;
    const picks = JSON.parse(responseAI.text());

    let savedCount = 0;
    const cleanPicks = Array.isArray(picks) ? picks : picks.picks || [];

    for (const p of cleanPicks) {
      // Accept all BUY signals: STRONG BUY, BUY, SPECULATIVE BUY
      const isBuySignal = p.signal && (
        p.signal.toUpperCase().includes("BUY") || 
        p.signal === "STRONG BUY" || 
        p.signal === "SPECULATIVE BUY"
      );
      
      if (isBuySignal && p.confidence >= 65) {
        if (!p.ticker.includes(".JK")) continue;

        // Include RRR in reasoning for display
        const rrr = p.rrr || calculateRRR(p.entry, p.tp1, p.stopLoss);
        const reasoning = `[AI-SCREENER] Signal: ${p.signal} | Conf: ${p.confidence}% | RRR: ${rrr} | ${p.reasoning}`;

        const entry = Math.round(p.entry);
        const tp1 = Math.round(p.tp1);
        const tp2 = Math.round(p.tp2);
        const sl = Math.round(p.stopLoss);

        // AI Picks are public (user_id = NULL) - different from personal analysis history
        await pool.query(
          `INSERT INTO analysis_history 
          (user_id, ticker, signal, entry_price, tp1, tp2, stop_loss, highest_price, lowest_price, status, reasoning, date_created)
          VALUES (NULL, $1, $2, $3, $4, $5, $6, $3, $3, 'ACTIVE', $7, NOW())`,
          [p.ticker, p.signal.toUpperCase(), entry, tp1, tp2, sl, reasoning]
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

// ============ MAIN HANDLER ============
export default async function handler(req, res) {
  setSecurityHeaders(res);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace("/api/ai-picks", "");
  const action = url.searchParams.get("action");

  // Route: GET /api/ai-picks - get current AI picks
  if (req.method === "GET" && (path === "" || path === "/") && !action) {
    return getAIPicks(req, res);
  }

  // Route: GET /api/ai-picks?action=generate - manual trigger (dev/testing)
  // Route: POST /api/ai-picks/run-screener - run the AI screener (cron)
  if (action === "generate" || path === "/run-screener") {
    return runScreener(req, res);
  }

  return res.status(404).json({ error: "Endpoint not found" });
}
