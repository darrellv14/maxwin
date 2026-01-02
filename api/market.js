import YahooFinance from "yahoo-finance2";
import { setSecurityHeaders, sanitizeInput } from "./security.js";

const yahooFinance = new YahooFinance();

// ============ TRADINGVIEW SYMBOL MAPPING ============
// Symbols that don't exist in Yahoo Finance but are available on TradingView
const TRADINGVIEW_SYMBOLS = {
  // Forex
  "XAUUSD": { provider: "OANDA", tvSymbol: "OANDA:XAUUSD", description: "Gold/USD" },
  "XAGUSD": { provider: "OANDA", tvSymbol: "OANDA:XAGUSD", description: "Silver/USD" },
  "EURUSD": { provider: "OANDA", tvSymbol: "OANDA:EURUSD", description: "Euro/USD" },
  "GBPUSD": { provider: "OANDA", tvSymbol: "OANDA:GBPUSD", description: "GBP/USD" },
  "USDJPY": { provider: "OANDA", tvSymbol: "OANDA:USDJPY", description: "USD/JPY" },
  "AUDUSD": { provider: "OANDA", tvSymbol: "OANDA:AUDUSD", description: "AUD/USD" },
  "USDCAD": { provider: "OANDA", tvSymbol: "OANDA:USDCAD", description: "USD/CAD" },
  "NZDUSD": { provider: "OANDA", tvSymbol: "OANDA:NZDUSD", description: "NZD/USD" },
  "USDCHF": { provider: "OANDA", tvSymbol: "OANDA:USDCHF", description: "USD/CHF" },
  // Crypto (use COINBASE or BINANCE)
  "BTCUSD": { provider: "COINBASE", tvSymbol: "COINBASE:BTCUSD", description: "Bitcoin/USD" },
  "ETHUSD": { provider: "COINBASE", tvSymbol: "COINBASE:ETHUSD", description: "Ethereum/USD" },
  // More forex pairs with OANDA
  "XAUUSD.OANDA": { provider: "OANDA", tvSymbol: "OANDA:XAUUSD", description: "Gold/USD" },
  "OANDA:XAUUSD": { provider: "OANDA", tvSymbol: "OANDA:XAUUSD", description: "Gold/USD" },
};

// Check if symbol should use TradingView data
function shouldUseTradingView(ticker) {
  const upperTicker = ticker.toUpperCase().replace(/[:\s-]/g, "");
  
  // Direct match
  if (TRADINGVIEW_SYMBOLS[upperTicker]) {
    return TRADINGVIEW_SYMBOLS[upperTicker];
  }
  
  // Check for OANDA: prefix
  if (ticker.toUpperCase().startsWith("OANDA:")) {
    const symbol = ticker.toUpperCase().replace("OANDA:", "");
    if (TRADINGVIEW_SYMBOLS[symbol]) {
      return TRADINGVIEW_SYMBOLS[symbol];
    }
    // Create entry for unknown OANDA symbol
    return { provider: "OANDA", tvSymbol: `OANDA:${symbol}`, description: symbol };
  }
  
  // Common forex/commodity patterns
  if (/^XAU[A-Z]{3}$/i.test(upperTicker)) {
    return { provider: "OANDA", tvSymbol: `OANDA:${upperTicker}`, description: "Gold" };
  }
  if (/^XAG[A-Z]{3}$/i.test(upperTicker)) {
    return { provider: "OANDA", tvSymbol: `OANDA:${upperTicker}`, description: "Silver" };
  }
  
  return null;
}

// ============ TRADINGVIEW DATA FETCHER ============
/**
 * Fetch real OHLCV data from TradingView's public API
 * This uses the same endpoint that TradingView widgets use
 */
async function fetchTradingViewData(tvSymbol, period) {
  try {
    const [provider, symbol] = tvSymbol.includes(":") ? tvSymbol.split(":") : ["OANDA", tvSymbol];
    
    // Calculate resolution and time range
    let resolution = "D"; // Daily default
    let barsCount = 100;
    
    switch (period) {
      case "1D":
        resolution = "15"; // 15-min bars
        barsCount = 96;
        break;
      case "5D":
        resolution = "60"; // Hourly
        barsCount = 120;
        break;
      case "1M":
        resolution = "60";
        barsCount = 720;
        break;
      case "3M":
        resolution = "D";
        barsCount = 90;
        break;
      case "6M":
        resolution = "D";
        barsCount = 180;
        break;
      case "1Y":
        resolution = "D";
        barsCount = 365;
        break;
      case "5Y":
        resolution = "W";
        barsCount = 260;
        break;
      case "ALL":
        resolution = "W";
        barsCount = 1000;
        break;
      default:
        resolution = "D";
        barsCount = 90;
    }

    const now = Math.floor(Date.now() / 1000);
    const secondsPerBar = resolution === "D" ? 86400 : resolution === "W" ? 604800 : parseInt(resolution) * 60;
    const from = now - (barsCount * secondsPerBar);
    
    // TradingView UDF API endpoint
    const fullSymbol = `${provider}:${symbol}`;
    console.log(`[TradingView] Fetching ${fullSymbol} | Resolution: ${resolution} | Bars: ${barsCount}`);
    
    // Method 1: Try TradingView's scanning API (more reliable)
    const tvData = await fetchFromTVScan(fullSymbol, resolution, from, now);
    if (tvData && tvData.length > 0) {
      return tvData;
    }
    
    // Method 2: Try alternative forex API
    const altData = await fetchFromForexAPI(symbol, period);
    if (altData && altData.length > 0) {
      return altData;
    }
    
    throw new Error("No data available from any source");
    
  } catch (error) {
    console.error(`TradingView fetch error for ${tvSymbol}:`, error.message);
    throw error;
  }
}

/**
 * Fetch from TradingView's scan/chart API
 */
async function fetchFromTVScan(symbol, resolution, from, to) {
  try {
    // TradingView uses WebSocket for real-time, but has HTTP endpoints for historical
    // We'll use the chart data endpoint
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    // Try the TradingView history endpoint
    const url = `https://tvc4.investing.com/62e7388093f74eccec64f2b967fa61ac/1/1/1/1/history?symbol=${encodeURIComponent(symbol.replace(":", "_"))}&resolution=${resolution}&from=${from}&to=${to}`;
    
    console.log(`[TradingView] Trying Investing.com proxy: ${symbol}`);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.investing.com/",
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.log(`[TradingView] Investing.com returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.s !== "ok" || !data.t || data.t.length === 0) {
      console.log(`[TradingView] No data returned from Investing.com`);
      return null;
    }
    
    // Convert to our format
    const result = [];
    for (let i = 0; i < data.t.length; i++) {
      const date = new Date(data.t[i] * 1000);
      const useFullTimestamp = ["15", "30", "60"].includes(resolution);
      
      result.push({
        date: useFullTimestamp ? date.toISOString() : date.toISOString().split("T")[0],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v ? data.v[i] : 0,
      });
    }
    
    console.log(`[TradingView] Got ${result.length} bars from Investing.com`);
    return result;
    
  } catch (error) {
    console.error("[TradingView] Scan fetch error:", error.message);
    return null;
  }
}

/**
 * Fetch from free forex/commodities APIs
 */
async function fetchFromForexAPI(symbol, period) {
  try {
    // For XAUUSD, try multiple sources
    const upperSymbol = symbol.toUpperCase();
    
    // Source 1: Try Frankfurter API for forex (doesn't have gold though)
    if (upperSymbol.match(/^(EUR|GBP|USD|JPY|AUD|CAD|CHF|NZD)/)) {
      // This is a currency pair
      return await fetchCurrencyData(upperSymbol, period);
    }
    
    // Source 2: For Gold (XAU), try metals API
    if (upperSymbol.startsWith("XAU") || upperSymbol.startsWith("XAG")) {
      return await fetchMetalsData(upperSymbol, period);
    }
    
    return null;
  } catch (error) {
    console.error("[ForexAPI] Error:", error.message);
    return null;
  }
}

/**
 * Fetch currency pair data
 */
async function fetchCurrencyData(symbol, period) {
  try {
    // Extract base and quote currency
    const base = symbol.substring(0, 3);
    const quote = symbol.substring(3, 6);
    
    let days = 90;
    switch (period) {
      case "1D": days = 1; break;
      case "5D": days = 5; break;
      case "1M": days = 30; break;
      case "3M": days = 90; break;
      case "6M": days = 180; break;
      case "1Y": days = 365; break;
      case "5Y": days = 1825; break;
      default: days = 90;
    }
    
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    
    // Use exchangerate.host (free, no API key needed)
    const url = `https://api.exchangerate.host/timeseries?start_date=${startDate}&end_date=${endDate}&base=${base}&symbols=${quote}`;
    
    console.log(`[Currency] Fetching ${base}/${quote}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success || !data.rates) {
      return null;
    }
    
    // Convert to OHLC (this API only gives close prices, so OHLC will be same)
    const result = Object.entries(data.rates).map(([date, rates]) => ({
      date,
      open: rates[quote],
      high: rates[quote],
      low: rates[quote],
      close: rates[quote],
      volume: 0,
    }));
    
    return result.sort((a, b) => new Date(a.date) - new Date(b.date));
    
  } catch (error) {
    console.error("[Currency] Error:", error.message);
    return null;
  }
}

/**
 * Fetch precious metals data (Gold, Silver)
 */
async function fetchMetalsData(symbol, period) {
  try {
    // For metals, we need a specialized API
    // Try metals.live API (free tier available)
    
    const metal = symbol.startsWith("XAU") ? "gold" : "silver";
    const quote = symbol.substring(3, 6) || "USD";
    
    let days = 90;
    switch (period) {
      case "1D": days = 1; break;
      case "5D": days = 5; break;
      case "1M": days = 30; break;
      case "3M": days = 90; break;
      case "6M": days = 180; break;
      case "1Y": days = 365; break;
      case "5Y": days = 1825; break;
      default: days = 90;
    }
    
    console.log(`[Metals] Fetching ${metal} in ${quote}`);
    
    // Try Gold API (goldapi.io has free tier)
    // For now, fallback to Yahoo Finance gold/silver ETF as price proxy
    // GLD tracks gold price, SLV tracks silver
    const yahooSymbol = metal === "gold" ? "GC=F" : "SI=F";
    
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let interval = "1d";
    if (period === "1D") interval = "5m";
    else if (period === "5D") interval = "15m";
    else if (period === "1M") interval = "1h";
    else if (period === "5Y" || period === "ALL") interval = "1wk";
    
    const result = await yahooFinance.chart(yahooSymbol, {
      period1: startDate,
      period2: new Date(),
      interval: interval,
    });
    
    if (!result.quotes || result.quotes.length === 0) {
      return null;
    }
    
    const useFullTimestamp = ["5m", "15m", "30m", "1h"].includes(interval);
    
    // Note: GC=F is futures, has slight premium over spot XAUUSD
    // But the price movement pattern is identical
    return result.quotes
      .filter(q => q.open != null && q.close != null && !isNaN(q.close))
      .map(q => ({
        date: useFullTimestamp ? q.date.toISOString() : q.date.toISOString().split("T")[0],
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
        // Mark as futures proxy
        _source: "futures_proxy",
      }));
      
  } catch (error) {
    console.error("[Metals] Error:", error.message);
    return null;
  }
}

// Fetch forex data - Enhanced with multiple sources
async function fetchForexData(symbol, period) {
  try {
    const upperSymbol = symbol.toUpperCase().replace(/[^A-Z]/g, "");
    
    console.log(`[Forex] Fetching ${upperSymbol} for period ${period}`);
    
    // Check if it's a precious metal (XAU, XAG)
    if (upperSymbol.startsWith("XAU") || upperSymbol.startsWith("XAG")) {
      // First try TradingView/Investing.com
      const tvSymbol = `OANDA:${upperSymbol}`;
      const now = Math.floor(Date.now() / 1000);
      
      let resolution = "D";
      let days = 90;
      switch (period) {
        case "1D": resolution = "15"; days = 1; break;
        case "5D": resolution = "60"; days = 5; break;
        case "1M": resolution = "60"; days = 30; break;
        case "3M": resolution = "D"; days = 90; break;
        case "6M": resolution = "D"; days = 180; break;
        case "1Y": resolution = "D"; days = 365; break;
        case "5Y": resolution = "W"; days = 1825; break;
        default: resolution = "D"; days = 90;
      }
      
      const secondsPerBar = resolution === "D" ? 86400 : resolution === "W" ? 604800 : parseInt(resolution) * 60;
      const from = now - (days * 86400);
      
      // Try Investing.com data feed (used by TradingView)
      const tvData = await fetchFromTVScan(tvSymbol, resolution, from, now);
      if (tvData && tvData.length > 0) {
        console.log(`[Forex] Got ${tvData.length} bars from TradingView for ${upperSymbol}`);
        return tvData;
      }
      
      // Fallback to Yahoo Finance futures
      console.log(`[Forex] TradingView failed, falling back to Yahoo Finance futures`);
      return await fetchMetalsData(upperSymbol, period);
    }
    
    // For currency pairs (EURUSD, GBPUSD, etc.)
    // Map to Yahoo Finance format
    const forexMap = {
      "EURUSD": "EURUSD=X",
      "GBPUSD": "GBPUSD=X",
      "USDJPY": "USDJPY=X",
      "AUDUSD": "AUDUSD=X",
      "USDCAD": "USDCAD=X",
      "NZDUSD": "NZDUSD=X",
      "USDCHF": "USDCHF=X",
      "EURGBP": "EURGBP=X",
      "EURJPY": "EURJPY=X",
      "GBPJPY": "GBPJPY=X",
    };
    
    // First try TradingView for forex too
    const tvSymbol = `OANDA:${upperSymbol}`;
    const now = Math.floor(Date.now() / 1000);
    
    let resolution = "D";
    let days = 90;
    switch (period) {
      case "1D": resolution = "15"; days = 1; break;
      case "5D": resolution = "60"; days = 5; break;
      case "1M": resolution = "60"; days = 30; break;
      case "3M": resolution = "D"; days = 90; break;
      case "6M": resolution = "D"; days = 180; break;
      case "1Y": resolution = "D"; days = 365; break;
      case "5Y": resolution = "W"; days = 1825; break;
      default: resolution = "D"; days = 90;
    }
    
    const from = now - (days * 86400);
    
    // Try TradingView first
    const tvData = await fetchFromTVScan(tvSymbol, resolution, from, now);
    if (tvData && tvData.length > 0) {
      console.log(`[Forex] Got ${tvData.length} bars from TradingView for ${upperSymbol}`);
      return tvData;
    }
    
    // Fallback to Yahoo Finance
    const yahooSymbol = forexMap[upperSymbol];
    if (!yahooSymbol) {
      console.log(`[Forex] No Yahoo mapping for ${upperSymbol}`);
      return null;
    }
    
    let startDate = new Date();
    let interval = "1d";
    
    switch (period) {
      case "1D": startDate.setDate(startDate.getDate() - 2); interval = "1h"; break;
      case "5D": startDate.setDate(startDate.getDate() - 7); interval = "1h"; break;
      case "1M": startDate.setMonth(startDate.getMonth() - 1); break;
      case "3M": startDate.setMonth(startDate.getMonth() - 3); break;
      case "6M": startDate.setMonth(startDate.getMonth() - 6); break;
      case "1Y": startDate.setFullYear(startDate.getFullYear() - 1); break;
      case "5Y": startDate.setFullYear(startDate.getFullYear() - 5); interval = "1wk"; break;
      case "ALL": startDate = new Date(2000, 0, 1); interval = "1wk"; break;
      default: startDate.setMonth(startDate.getMonth() - 3);
    }
    
    console.log(`[Forex] Trying Yahoo Finance: ${yahooSymbol}`);
    
    const result = await yahooFinance.chart(yahooSymbol, {
      period1: startDate,
      period2: new Date(),
      interval: interval,
    });
    
    if (!result.quotes || result.quotes.length === 0) {
      return null;
    }
    
    const useFullTimestamp = ["1h", "30m", "15m", "5m"].includes(interval);
    
    return result.quotes
      .filter(q => q.open != null && q.close != null && !isNaN(q.close))
      .map(q => ({
        date: useFullTimestamp ? q.date.toISOString() : q.date.toISOString().split("T")[0],
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
      }));
      
  } catch (error) {
    console.error("Forex data fetch error:", error.message);
    return null;
  }
}

// ============ LIVE QUOTE ============
async function getLiveQuote(req, res) {
  const { ticker } = req.query;

  if (!ticker || typeof ticker !== "string") {
    return res.status(400).json({ error: "Ticker is required" });
  }

  // Map forex symbols to Yahoo Finance format
  const forexQuoteMap = {
    "XAUUSD": "GC=F",
    "XAGUSD": "SI=F", 
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    "AUDUSD": "AUDUSD=X",
    "USDCAD": "USDCAD=X",
    "NZDUSD": "NZDUSD=X",
    "USDCHF": "USDCHF=X",
  };

  // Check if forex symbol
  const upperTicker = ticker.toUpperCase().replace(/[:\s]/g, "").replace("OANDA", "");
  const actualTicker = forexQuoteMap[upperTicker] || ticker;

  try {
    const quote = await yahooFinance.quote(actualTicker);
    const price = quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice;
    const open = quote.regularMarketOpen;
    const prevClose = quote.regularMarketPreviousClose;

    return res.status(200).json({
      symbol: ticker, // Return original symbol
      price: price,
      open: open,
      prevClose: prevClose,
      source: actualTicker !== ticker ? "proxy" : "direct",
    });
  } catch (error) {
    console.error("Live quote error:", error);
    return res.status(500).json({ error: "Failed to fetch live quote" });
  }
}

// ============ HISTORICAL DATA ============
async function getHistoricalData(req, res) {
  const { ticker, period = "3M" } = req.query;

  if (!ticker || typeof ticker !== "string") {
    return res.status(400).json({ error: "Ticker is required" });
  }

  // =====================================================
  // 0️⃣ CHECK IF THIS IS A TRADINGVIEW/FOREX SYMBOL
  // =====================================================
  const tvConfig = shouldUseTradingView(ticker);
  if (tvConfig) {
    console.log(`[Market API] Using TradingView fallback for ${ticker} -> ${tvConfig.tvSymbol}`);
    try {
      // Try TradingView data first
      const tvData = await fetchTradingViewData(tvConfig.tvSymbol, period);
      if (tvData && tvData.length > 0) {
        console.log(`[Market API] TradingView returned ${tvData.length} bars for ${ticker}`);
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
        res.setHeader("X-Data-Source", "tradingview");
        return res.status(200).json(tvData);
      }
      
      // If TradingView failed, try forex fallback
      const forexData = await fetchForexData(ticker.replace("OANDA:", "").toUpperCase(), period);
      if (forexData && forexData.length > 0) {
        console.log(`[Market API] Forex fallback returned ${forexData.length} bars for ${ticker}`);
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
        res.setHeader("X-Data-Source", forexData[0]?._source || "forex");
        return res.status(200).json(forexData);
      }
      
      throw new Error("No data from any fallback source");
    } catch (fallbackError) {
      console.error(`Fallback failed for ${ticker}:`, fallbackError.message);
      // If it's a crypto pair like BTC-USD, let it fall through to Yahoo Finance
      if (ticker.includes("BTC") || ticker.includes("ETH") || ticker.includes("USD")) {
         console.log(`[Market API] TradingView failed for ${ticker}, falling back to Yahoo Finance`);
      } else {
        return res.status(404).json({
          error: `Tidak dapat mengambil data untuk '${ticker}'. Symbol ini mungkin tidak tersedia di sumber data kami.`,
          suggestion: "Coba gunakan GC=F (Gold Futures) atau EURUSD=X untuk forex.",
          originalSymbol: ticker,
          tvSymbol: tvConfig.tvSymbol,
        });
      }
    }
  }

  try {
    let startDate = new Date();
    const endDate = new Date();

    // ===============================
    // 1️⃣ SMART IPO DETECTION (for ALL)
    // ===============================
    async function getIPODate(symbol) {
      try {
        // We use quoteSummary to try and find the start date, and also to validate the ticker.
        const summary = await yahooFinance.quoteSummary(symbol, {
          modules: ["price", "defaultKeyStatistics"],
        });

        // Try to find a start date
        // defaultKeyStatistics.firstTradeDateMilliseconds is the best bet
        if (summary.defaultKeyStatistics?.firstTradeDateMilliseconds) {
          return new Date(summary.defaultKeyStatistics.firstTradeDateMilliseconds);
        }

        // Fallback to 2000 if not found
        return new Date(2000, 0, 1);
      } catch (err) {
        // If quoteSummary fails with 404, we know ticker is bad.
        if (err.message && (err.message.includes("Not Found") || err.message.includes("404"))) {
          throw new Error("Ticker Not Found");
        }
        // Other error, return fallback
        return new Date(2000, 0, 1);
      }
    }

    // =====================================
    // 2️⃣ RANGE HANDLER
    // =====================================
    let interval = "1d"; // default daily
    
    // Check if Indonesian stock (doesn't support intraday intervals well)
    const isIndonesian = ticker.toUpperCase().endsWith(".JK") || ticker.toUpperCase() === "^JKSE";
    
    switch (period) {
      case "1D":
        startDate.setDate(startDate.getDate() - 1);
        interval = isIndonesian ? "1h" : "5m"; // Indonesian stocks: hourly, US: 5min
        break;
      case "5D":
        startDate.setDate(startDate.getDate() - 7); // Get 7 days to ensure 5 trading days
        interval = isIndonesian ? "1h" : "15m"; // Indonesian stocks: hourly, US: 15min
        break;
      case "1M":
        startDate.setMonth(startDate.getMonth() - 1);
        interval = isIndonesian ? "1d" : "1h"; // Indonesian stocks: daily, US: hourly
        break;
      case "3M":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "6M":
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case "1Y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case "YTD":
        startDate = new Date(startDate.getFullYear(), 0, 1);
        break;
      case "5Y":
        startDate.setFullYear(startDate.getFullYear() - 5);
        interval = "1wk"; // weekly for 5 years
        break;
      case "ALL":
        startDate = await getIPODate(ticker);
        interval = "1wk"; // weekly for ALL
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 3);
    }

    // Store original values for smart fallback
    const originalStartDate = new Date(startDate);
    const originalInterval = interval;
    const isIntraday = ["1D", "5D", "1M"].includes(period) && !isIndonesian;

    // ===========================================
    // 3️⃣ CHART FETCH + SMART RETRY
    // ===========================================
    async function fetchChart() {
      // Helper for retrying on rate limits
      async function fetchWithRetry(symbol, options, retries = 3) {
        for (let i = 0; i < retries; i++) {
          try {
            return await yahooFinance.chart(symbol, options);
          } catch (err) {
            if (i === retries - 1) throw err;
            
            if (err.message && (err.message.includes("Too Many Requests") || err.message.includes("429"))) {
              console.log(`[Market API] Rate limited for ${symbol}. Retry ${i+1}/${retries}...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1) + Math.random() * 500));
              continue;
            }
            throw err;
          }
        }
      }

      try {
        const r = await fetchWithRetry(ticker, {
          period1: startDate,
          period2: endDate,
          interval: interval,
        });

        if (r.quotes && r.quotes.length > 0) return { result: r, usedInterval: interval };

        // If empty, maybe range was bad.
        throw new Error("Empty quotes");
      } catch (err) {
        // If it's a 404/Not Found, propagate it immediately
        if (err.message && (err.message.includes("Not Found") || err.message.includes("404"))) {
          throw new Error("Ticker Not Found");
        }
        
        // If it's a 429 that persisted after retries, propagate it
        if (err.message && (err.message.includes("Too Many Requests") || err.message.includes("429"))) {
           throw err;
        }

        // Smart fallback: use same date range but with daily interval
        console.log(`Fallback for ${ticker} ${period}: ${interval} -> 1d`);
        const fallbackResult = await fetchWithRetry(ticker, {
          period1: originalStartDate,
          period2: endDate,
          interval: "1d",
        });
        return { result: fallbackResult, usedInterval: "1d" };
      }
    }

    const { result, usedInterval } = await fetchChart();
    const quotes = result.quotes ?? [];

    // Determine if we should use full timestamp (for intraday intervals)
    const useFullTimestamp = ["5m", "15m", "30m", "1h"].includes(usedInterval);

    // Filter out quotes with null/undefined OHLC values (common in Indonesian stocks)
    const formattedData = quotes
      .filter((q) => 
        q.open != null && 
        q.high != null && 
        q.low != null && 
        q.close != null &&
        !isNaN(q.open) &&
        !isNaN(q.high) &&
        !isNaN(q.low) &&
        !isNaN(q.close)
      )
      .map((q) => ({
        // Use full ISO timestamp for intraday, date only for daily/weekly
        date: useFullTimestamp ? q.date.toISOString() : q.date.toISOString().split("T")[0],
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume || 0,
      }));

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
    return res.status(200).json(formattedData);
  } catch (error) {
    // =====================================================
    // FALLBACK: Try alternative data sources when Yahoo fails
    // =====================================================
    if (
      error.message === "Ticker Not Found" ||
      error.message.includes("Not Found") ||
      error.message.includes("404")
    ) {
      console.log(`[Market API] Yahoo failed for ${ticker}, trying alternative sources...`);
      
      // Try forex/commodity fallback
      try {
        const symbol = ticker.toUpperCase().replace(/[=\-\s]/g, "");
        const fallbackData = await fetchForexData(symbol, period);
        
        if (fallbackData && fallbackData.length > 0) {
          console.log(`[Market API] Alternative source succeeded for ${ticker}`);
          res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
          return res.status(200).json(fallbackData);
        }
      } catch (fallbackErr) {
        console.log(`[Market API] Alternative source also failed: ${fallbackErr.message}`);
      }
      
      return res.status(404).json({
        error: `Ticker '${ticker}' not found. Please check the symbol. For forex/commodities, try: GC=F (Gold), SI=F (Silver), EURUSD=X (EUR/USD).`,
      });
    }

    if (
      error.message.includes("Too Many Requests") || 
      error.message.includes("429")
    ) {
      return res.status(429).json({
        error: "Too many requests to data provider. Please try again later.",
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ============ MAIN HANDLER ============
export default async function handler(req, res) {
  setSecurityHeaders(res);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace("/api/market", "");
  const action = url.searchParams.get("action");

  // Route: GET /api/market?action=live&ticker=XXX - get live quote
  // Also support: GET /api/market/live?ticker=XXX (legacy path-based)
  if (action === "live" || path === "/live") {
    return getLiveQuote(req, res);
  }

  // Route: GET /api/market?ticker=XXX&period=3M - get historical data (default)
  return getHistoricalData(req, res);
}
