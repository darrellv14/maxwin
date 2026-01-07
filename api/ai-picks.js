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
//  Helper: WhatsApp Notification via Fonnte
// =======================
/**
 * Mengirim notifikasi WhatsApp ke grup/nomor via Fonnte API
 * Pastikan FONNTE_TOKEN dan WA_TARGET sudah diset di .env
 */
const sendWhatsAppNotification = async (picks) => {
  const token = process.env.FONNTE_TOKEN;
  const target = process.env.WA_TARGET; // Bisa nomor (08xx) atau Group ID (@g.us)

  if (!token || !target) {
    console.warn("[WA] FONNTE_TOKEN atau WA_TARGET belum di-set di environment variables.");
    return { success: false, reason: "Missing credentials" };
  }

  if (!picks || picks.length === 0) {
    console.warn("[WA] Tidak ada picks untuk dikirim.");
    return { success: false, reason: "No picks" };
  }

  // Format tanggal Indonesia
  const today = new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Membuat format pesan yang enak dibaca di HP
  let message = `🚀 *MOOCUAN ORACLE REPORT* 🚀\n`;
  message += `📅 ${today}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  picks.forEach((p, i) => {
    const signal = p.signal || 'BUY';
    const emoji = signal.includes('STRONG') ? '🔥' : signal.includes('SPEC') ? '⚡' : '✅';
    
    message += `${i + 1}. ${emoji} *${p.ticker}* (${signal})\n`;
    message += `   🎯 Entry: *${Math.round(p.entry)}*\n`;
    message += `   💰 TP1: ${Math.round(p.tp1)} | TP2: ${Math.round(p.tp2 || p.tp1)}\n`;
    message += `   🛡️ SL: ${Math.round(p.stopLoss)}\n`;
    message += `   📊 Conf: ${p.confidence}% | RRR: ${p.rrr || 'N/A'}\n`;
    
    // Full reasoning tanpa truncate
    const reasoning = p.reasoning || '';
    message += `   💡 _${reasoning}_\n\n`;
  });

  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📈 Total: *${picks.length} sinyal*\n`;
  message += `_Powered by MooCuan AI Oracle_ 🐮`;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token // Fonnte tidak pakai 'Bearer '
      },
      body: new URLSearchParams({
        target: target,
        message: message,
        delay: '2', // Jeda 2 detik antar pesan jika kirim banyak
        countryCode: '62'
      })
    });

    const result = await response.json();
    
    if (result.status) {
      console.log(`[WA] ✅ Berhasil kirim ${picks.length} sinyal ke:`, target);
      return { success: true, target, count: picks.length };
    } else {
      console.error("[WA] ❌ Gagal kirim:", result.reason || result.detail);
      return { success: false, reason: result.reason || result.detail };
    }
  } catch (error) {
    console.error("[WA] ❌ Error koneksi ke Fonnte:", error.message);
    return { success: false, reason: error.message };
  }
};

// =======================
//  Helper: ATR Calculation
// =======================
/**
 * Menghitung ATR untuk menentukan volatilitas dan jarak Stop Loss yang logis
 */
const calculateATR = (high, low, close, period = 14) => {
  const atrInput = { high, low, close, period };
  const values = TI.ATR.calculate(atrInput);
  return values[values.length - 1];
};

// =======================
//  Helper: S/R Zones (Multiple Touchpoints)
// =======================
/**
 * Mendeteksi zona S/R berdasarkan akumulasi sentuhan harga (Multiple Touchpoints)
 */
const calculateSRZones = (stockData, sensitivity = 0.02) => {
  const highs = stockData.map(d => d.high);
  const lows = stockData.map(d => d.low);
  const currentPrice = stockData[stockData.length - 1].close;

  const findPivots = (prices, type = 'high') => {
    let pivots = [];
    for (let i = 5; i < prices.length - 5; i++) {
      const window = prices.slice(i - 5, i + 6);
      const target = prices[i];
      if (type === 'high' && target === Math.max(...window)) pivots.push(target);
      if (type === 'low' && target === Math.min(...window)) pivots.push(target);
    }
    return pivots;
  };

  const clusterPrices = (pivots) => {
    let zones = [];
    pivots.forEach(price => {
      let zone = zones.find(z => Math.abs(z.price - price) / price < sensitivity);
      if (zone) {
        zone.hits++;
        zone.price = (zone.price + price) / 2;
      } else {
        zones.push({ price, hits: 1 });
      }
    });
    return zones.sort((a, b) => b.hits - a.hits);
  };

  const supportZones = clusterPrices(findPivots(lows, 'low'));
  const resistanceZones = clusterPrices(findPivots(highs, 'high'));

  return {
    nearestSupport: supportZones.find(z => z.price < currentPrice * 0.99) || { price: Math.min(...lows), hits: 1 },
    nearestResistance: resistanceZones.find(z => z.price > currentPrice * 1.01) || { price: Math.max(...highs), hits: 1 },
    allSupports: supportZones.slice(0, 3),
    allResistances: resistanceZones.slice(0, 3)
  };
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
  // === COAL & ENERGY (WTE - Waste to Energy & Batubara) ===
  "TOBA.JK",  // TBS Energi Utama (Coal & Energy)
  "OASA.JK",  // Protech Mitra Perkasa (WTE)
  "MHKI.JK",  // Multi Hanna Kreasindo (WTE)
  "UNTR.JK",  // United Tractors (Coal contractor)
  "SMDR.JK",  // Samudera Indonesia (Coal shipping)
  "TPMA.JK",  // Trans Power Marine (Coal barging)
  "MBSS.JK",  // Mitrabahtera Segara (Coal barging)
  "SHIP.JK",  // Sillo Maritime (Shipping)
  "RIGS.JK",  // Rig Tenders Indonesia
  "BULL.JK",  // Buana Lintas Lautan (Tanker)
  "HATM.JK",  // Habco Trans Maritima
  "SGER.JK",  // Sumber Global Energy (Coal)
  "KKGI.JK",  // Resource Alam Indonesia (Coal)
  "GTBO.JK",  // Garda Tujuh Buana (Coal)
  "BORN.JK",  // Borneo Lumbung Energi
  "PKPK.JK",  // Perdana Karya Perkasa (Coal)
  "SQMI.JK",  // Wilton Makmur Indonesia
  "CGAS.JK",  // Citra Nusantara Gemilang (LPG)
  "WOWS.JK",  // Ginting Jaya Energi (Coal)
  "PGEO.JK",  // Pertamina Geothermal

  // === INFRASTRUCTURE & LOGISTICS ===
  "PIPA.JK",  // Citra Tubindo (Pipa baja)
  "MMLP.JK",  // Mega Manunggal Property (Logistics/Warehouse)
  "ESIP.JK",  // Sinergi Inti Plastindo
  "ESTI.JK",  // Ever Shine Tex
  "NINE.JK",  // Techno Nine Indonesia
  "LAPD.JK",  // Leyand International (Logistics)
  "MEJA.JK",  // Meja Lintas Properti
  "TRUE.JK",  // True Wira (Tech)
  "TRIN.JK",  // Perintis Triniti Property

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
          if (!q.length || q.length < 200) return null;

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

          // ═══════════════════════════════════════════════════════════════
          // ▓▓ NODE.JS PRE-FILTER (TRASH FILTER) - Hemat Token API ▓▓
          // ═══════════════════════════════════════════════════════════════
          const closes = stockData.map(d => d.close);
          const volumes = stockData.map(d => d.volume);
          const highs = stockData.map(d => d.high);
          const lows = stockData.map(d => d.low);
          
          const lastClose = closes[closes.length - 1];
          const lastVol = volumes[volumes.length - 1];
          const avgVol20 = TI.SMA.calculate({ period: 20, values: volumes });
          const avgVol = avgVol20[avgVol20.length - 1];
          const ema200Arr = TI.EMA.calculate({ period: 200, values: closes });
          const ema200 = ema200Arr[ema200Arr.length - 1];
          
          // 1. TREND FILTER: Harus di atas EMA 200 (Long Term Uptrend)
          if (lastClose < ema200) return null;
          
          // 2. LIQUIDITY FILTER: Transaksi harian minimal 500 Juta IDR (lebih fleksibel untuk small caps)
          const dailyValue = lastClose * lastVol;
          if (dailyValue < 500_000_000) return null;

          // 3. ACTIVITY FILTER: Volume minimal 70% dari rata-rata (bukan saham tidur)
          if (lastVol < (avgVol * 0.7)) return null;

          // ═══════════════════════════════════════════════════════════════
          // ▓▓ DATA PROCESSING FOR AI (Compact Summary) ▓▓
          // ═══════════════════════════════════════════════════════════════
          const sr = calculateSRZones(stockData);
          const atr = calculateATR(highs, lows, closes);
          const analysis = calculateAdvancedIndicators(stockData);
          
          if (!analysis) return null;
          if (analysis.technicalConfidence < 60) return null;

          // Calculate distance to support/resistance
          const distToSupport = ((lastClose - sr.nearestSupport.price) / lastClose * 100).toFixed(2);
          const distToResistance = ((sr.nearestResistance.price - lastClose) / lastClose * 100).toFixed(2);
          
          // Determine setup type
          let setupType = "NEUTRAL";
          const volRatio = lastVol / avgVol;
          if (parseFloat(distToSupport) < 3 && sr.nearestSupport.hits >= 2) {
            setupType = "BOW"; // Buy On Weakness - near strong support
          } else if (parseFloat(distToResistance) < 2 && volRatio > 1.5) {
            setupType = "BOB"; // Buy On Breakout - breaking resistance with volume
          } else if (analysis.technicalConfidence >= 75) {
            setupType = "MOMENTUM";
          }

          return {
            ticker: symbol,
            lastClose: Math.round(lastClose),
            ema200: Math.round(ema200),
            atr: Math.round(atr),
            // S/R Data (compact)
            support: { price: Math.round(sr.nearestSupport.price), hits: sr.nearestSupport.hits },
            resistance: { price: Math.round(sr.nearestResistance.price), hits: sr.nearestResistance.hits },
            distToSupport: `${distToSupport}%`,
            distToResistance: `${distToResistance}%`,
            // Volume & Activity
            volRatio: volRatio.toFixed(2),
            dailyValueB: (dailyValue / 1_000_000_000).toFixed(2), // in Billions
            // Setup Classification
            setupType,
            // Technical Summary (compact - tidak kirim raw data)
            techScore: analysis.technicalConfidence,
            rsi: Math.round(analysis.indicators.rsi),
            macdSignal: analysis.indicators.macdHist > 0 ? "BULLISH" : "BEARISH",
            obvTrend: analysis.indicators.obvSlope,
            // Recent price action (last 3 candles only - hemat token)
            last3Candles: analysis.recentCandles.slice(-3).map(c => ({
              c: Math.round(c.c),
              chg: (((c.c - c.o) / c.o) * 100).toFixed(1) + "%"
            }))
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

    // Sort by techScore and prioritize BOW/BOB setups
    const topCandidates = processedData
      .sort((a, b) => {
        // Prioritize clear setups (BOW/BOB) over neutral
        const setupPriority = { BOW: 10, BOB: 10, MOMENTUM: 5, NEUTRAL: 0 };
        const aPriority = setupPriority[a.setupType] || 0;
        const bPriority = setupPriority[b.setupType] || 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        // Then by techScore
        return b.techScore - a.techScore;
      })
      .slice(0, 25); // Reduced from 25 to 20 for token efficiency
    
    console.log(`[AI-ORACLE] Filtered candidates: ${topCandidates.length} (BOW: ${topCandidates.filter(c => c.setupType === 'BOW').length}, BOB: ${topCandidates.filter(c => c.setupType === 'BOB').length})`);

    if (topCandidates.length === 0) {
      return res.status(200).json({ message: "Market bearish. No candidates passed filter." });
    }

    // ═══════════════════════════════════════════════════════════════
    // ▓▓ OPTIMIZED PROMPT - TOKEN EFFICIENT + HUMAN-READABLE ▓▓
    // ═══════════════════════════════════════════════════════════════
    const prompt = `
ROLE: QUANT TRADER elit IHSG. Data sudah difilter (uptrend, liquid, active).

TUGAS: Pilih 7-10 setup TERBAIK untuk SWING TRADE (3-10 hari).

【SETUP TYPES】
• BOW (Buy On Weakness): distToSupport < 3%, support.hits >= 2, volRatio normal
• BOB (Buy On Breakout): distToResistance < 2%, volRatio > 1.5x, momentum bullish  
• MOMENTUM: techScore >= 75, RSI 40-65, MACD bullish, OBV UP

【ENTRY RULES】
• BOW: Entry = lastClose, SL = support.price - ATR
• BOB: Entry = resistance.price, SL = Entry - (2 * ATR)
• MOMENTUM: Entry = lastClose, SL = Entry - (1.5 * ATR)

【TARGET RULES】
• TP1 = resistance.price (atau Entry + 2*ATR jika BOB)
• TP2 = TP1 + ATR
• RRR minimal 1:1.5

【CONFIDENCE SCORING】
• 85-95 STRONG BUY: Setup sempurna + volume confirm + multi-indicator align
• 75-84 BUY: Setup bagus + trend aligned
• 65-74 SPEC BUY: Setup menarik tapi butuh konfirmasi

【REJECT IF】
• OBV = BEARISH + volRatio < 1
• RSI > 75 (overbought)
• distToResistance > 15% tanpa momentum kuat

【REASONING FORMAT - PENTING!】
Tulis reasoning dalam BAHASA INDONESIA yang natural dan mudah dibaca (bukan bullet points teknis).
Format seperti ini:

Contoh BOW:
"Saham ini sedang berada di area support kuat di 950 yang sudah diuji 3 kali sebelumnya dan selalu mental. RSI di 52 menunjukkan belum overbought dengan volume 1.2x rata-rata. Potensi naik ke resistance 1150 dengan risk reward 1:1.9."

Contoh BOB:
"Harga sedang menguji resistance 1200 dengan volume melonjak 1.8x di atas rata-rata, sinyal breakout potensial. Momentum bullish dengan MACD positif dan OBV naik. Target breakout ke 1350 dengan risk terjaga."

Contoh MOMENTUM:
"Trend bullish kuat dengan harga di atas semua MA. RSI 58 masih sehat, MACD histogram positif, dan volume konsisten naik. Momentum bagus untuk swing trade dengan target resistance terdekat."

DATA (Pre-filtered uptrend stocks):
${JSON.stringify(topCandidates)}

OUTPUT (JSON Array):
[{"ticker":"KODE.JK","signal":"BUY","confidence":80,"entry":1000,"tp1":1150,"tp2":1250,"stopLoss":920,"rrr":"1:1.9","setupType":"BOW","reasoning":"Saham ini sedang berada di area support kuat di 950 yang sudah diuji 3 kali sebelumnya. RSI di 52 belum overbought dengan volume 1.2x rata-rata. Potensi naik ke resistance 1150 dengan risk reward 1:1.9."}]
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

    // ═══════════════════════════════════════════════════════════════
    // ▓▓ SEND WHATSAPP NOTIFICATION via FONNTE ▓▓
    // ═══════════════════════════════════════════════════════════════
    let waResult = { success: false, reason: "Not attempted" };
    if (cleanPicks.length > 0) {
      console.log(`[AI-ORACLE] 📱 Mengirim ${cleanPicks.length} sinyal ke WhatsApp...`);
      waResult = await sendWhatsAppNotification(cleanPicks);
    }

    // Helper: Normalize signal to fit varchar(10) limit in database
    const normalizeSignal = (signal) => {
      const s = (signal || "").toUpperCase();
      if (s.includes("STRONG")) return "STRONG BUY";
      if (s.includes("SPEC")) return "SPEC BUY"; // Shortened from "SPECULATIVE BUY"
      if (s.includes("BUY")) return "BUY";
      return "BUY";
    };

    for (const p of cleanPicks) {
      // Accept all BUY signals: STRONG BUY, BUY, SPECULATIVE BUY
      const isBuySignal = p.signal && (
        p.signal.toUpperCase().includes("BUY") || 
        p.signal === "STRONG BUY" || 
        p.signal === "SPECULATIVE BUY"
      );
      
      if (isBuySignal && p.confidence >= 65) {
        if (!p.ticker.includes(".JK")) continue;

        // Normalize signal to fit database column (varchar 10)
        const dbSignal = normalizeSignal(p.signal);
        
        // Include RRR in reasoning for display (keep original signal in reasoning)
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
          [p.ticker, dbSignal, entry, tp1, tp2, sl, reasoning]
        );
        savedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      analyzed: processedData.length,
      candidates_sent_to_ai: topCandidates.length,
      signals_saved: savedCount,
      whatsapp_notification: waResult,
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

  // Route: GET /api/ai-picks?action=wa-groups - Get WhatsApp Group List
  if (action === "wa-groups") {
    return getWhatsAppGroups(req, res);
  }

  // Route: GET /api/ai-picks?action=wa-test - Test WhatsApp Connection
  if (action === "wa-test") {
    return testWhatsAppConnection(req, res);
  }

  return res.status(404).json({ error: "Endpoint not found" });
}

// ============ GET WHATSAPP GROUPS ============
async function getWhatsAppGroups(req, res) {
  const token = process.env.FONNTE_TOKEN;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const subAction = url.searchParams.get("sub"); // Sub-action: fetch atau kosong

  if (!token) {
    return res.status(400).json({ 
      error: "FONNTE_TOKEN belum di-set di environment variables" 
    });
  }

  try {
    // LANGKAH 1: FETCH (Sinkronisasi Grup Baru)
    // Jalankan ini sekali saja jika Anda baru join grup
    if (subAction === "fetch") {
      const response = await fetch('https://api.fonnte.com/fetch-group', {
        method: 'POST',
        headers: { 'Authorization': token }
      });
      const data = await response.json();
      return res.status(200).json({
        success: true,
        message: "Proses sinkronisasi (fetch) dimulai. Tunggu 10-30 detik lalu jalankan tanpa sub=fetch.",
        next_step: "Panggil ?action=wa-groups (tanpa &sub=fetch) untuk melihat daftar grup",
        fonnte_response: data
      });
    }

    // LANGKAH 2: GET LIST (Ambil ID Grup yang sudah tersinkron)
    const response = await fetch('https://api.fonnte.com/get-whatsapp-group', {
      method: 'POST',
      headers: { 'Authorization': token }
    });

    const text = await response.text();
    console.log("[WA-GROUPS] Raw response:", text);

    // Handle jika endpoint salah
    if (text.includes("Cannot POST") || text.includes("Cannot GET")) {
      return res.status(404).json({
        error: "Endpoint Fonnte error",
        raw_response: text.substring(0, 200),
        hint: "Pastikan HP sudah terkoneksi di dashboard Fonnte (md.fonnte.com)"
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      return res.status(500).json({
        error: "Response dari Fonnte tidak valid JSON",
        raw_response: text.substring(0, 500),
        hint: "Pastikan HP sudah terkoneksi di dashboard Fonnte (md.fonnte.com) dan status Connected"
      });
    }

    if (data.status === false) {
      return res.status(400).json({ 
        error: "Gagal mengambil daftar grup",
        reason: data.reason || data.detail,
        hint: "Jalankan ?action=wa-groups&sub=fetch dulu untuk sinkronisasi"
      });
    }

    // Fonnte biasanya return array langsung atau di dalam properti data
    const groups = Array.isArray(data) ? data : (data.data || []);

    if (groups.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Grup tidak ditemukan. Pastikan sudah menjalankan ?action=wa-groups&sub=fetch terlebih dahulu.",
        groups: []
      });
    }
    
    // Mapping agar output bersih
    const formattedGroups = groups.map(g => ({
      name: g.name || g.subject || "Tanpa Nama",
      id: g.id || g.group_id,
      participants: g.participants || g.size || "N/A"
    }));

    return res.status(200).json({
      success: true,
      total_groups: formattedGroups.length,
      groups: formattedGroups,
      usage_hint: "Copy 'id' grup yang diinginkan (format: xxx@g.us), lalu set ke WA_TARGET di Vercel env"
    });
  } catch (error) {
    return res.status(500).json({ 
      error: "Error koneksi ke Fonnte",
      message: error.message 
    });
  }
}

// ============ TEST WHATSAPP CONNECTION ============
async function testWhatsAppConnection(req, res) {
  const token = process.env.FONNTE_TOKEN;
  const target = process.env.WA_TARGET;

  if (!token) {
    return res.status(400).json({ 
      error: "FONNTE_TOKEN belum di-set" 
    });
  }

  if (!target) {
    return res.status(400).json({ 
      error: "WA_TARGET belum di-set",
      hint: "Set WA_TARGET dengan nomor HP (08xx) atau Group ID dari ?action=wa-groups"
    });
  }

  const testMessage = `🔔 *TEST KONEKSI MOOCUAN*\n\n✅ WhatsApp notification berhasil terhubung!\n\n📅 ${new Date().toLocaleString('id-ID')}\n_Pesan ini dikirim otomatis untuk testing._`;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: new URLSearchParams({
        target: target,
        message: testMessage,
        countryCode: '62'
      })
    });

    const result = await response.json();

    if (result.status) {
      return res.status(200).json({
        success: true,
        message: "Test message berhasil dikirim!",
        target: target,
        fonnte_response: result
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Gagal mengirim test message",
        reason: result.reason || result.detail,
        target: target
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      error: "Error koneksi ke Fonnte",
      message: error.message 
    });
  }
}
