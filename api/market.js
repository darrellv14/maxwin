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
  const upperTicker = ticker.toUpperCase().replace(/[:\s]/g, "");
  
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
async function fetchTradingViewData(tvSymbol, period) {
  try {
    // TradingView uses their own API - we'll use the public chart API
    // Note: This is a simplified approach. For production, consider using official TradingView data feeds
    
    const [provider, symbol] = tvSymbol.split(":");
    
    // Calculate time range
    let resolution = "D"; // Daily
    let barsCount = 100;
    
    switch (period) {
      case "1D":
        resolution = "15";
        barsCount = 96; // 15-min bars for 24h
        break;
      case "5D":
        resolution = "60";
        barsCount = 120; // Hourly for 5 days
        break;
      case "1M":
        resolution = "60";
        barsCount = 720; // Hourly for 1 month
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

    // Use TradingView's UDF (Universal Data Feed) format
    // This is the public API endpoint that TradingView widgets use
    const now = Math.floor(Date.now() / 1000);
    const from = now - (barsCount * (resolution === "D" ? 86400 : resolution === "W" ? 604800 : parseInt(resolution) * 60));
    
    const tvApiUrl = `https://tvc6.investing.com/2ed6d0e22c10e3f3f1b1bbd8a35b35e4/1/1/1/1/history?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}`;
    
    // Alternative: Use a more reliable public API
    // For now, let's generate realistic data based on actual market values
    // In production, you'd want to use a proper data provider
    
    console.log(`[TradingView Fallback] Fetching ${tvSymbol} with resolution ${resolution}`);
    
    // Try fetching from alternative sources
    const data = await fetchFromAlternativeSource(symbol, provider, period, resolution, barsCount);
    
    if (data && data.length > 0) {
      return data;
    }
    
    throw new Error("No data available from TradingView sources");
    
  } catch (error) {
    console.error(`TradingView fetch error for ${tvSymbol}:`, error.message);
    throw error;
  }
}

// Fetch from alternative public sources
async function fetchFromAlternativeSource(symbol, provider, period, resolution, barsCount) {
  try {
    // Try Alpha Vantage for forex (free tier available)
    if (provider === "OANDA" && symbol.startsWith("XAU")) {
      // For gold, try commodities API
      return await fetchGoldData(symbol, period);
    }
    
    // For forex pairs, try exchangerate API or similar
    if (provider === "OANDA") {
      return await fetchForexData(symbol, period);
    }
    
    return null;
  } catch (error) {
    console.error("Alternative source error:", error.message);
    return null;
  }
}

// Fetch gold/commodity data
async function fetchGoldData(symbol, period) {
  try {
    // Use metals-api.com free tier or similar
    // For demo, we'll use Yahoo Finance alternative symbols
    
    // Gold can be fetched via GC=F (Gold Futures) or GLD (SPDR Gold ETF)
    const goldSymbol = "GC=F"; // Gold futures
    
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
    
    const result = await yahooFinance.chart(goldSymbol, {
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
    console.error("Gold data fetch error:", error.message);
    return null;
  }
}

// Fetch forex data
async function fetchForexData(symbol, period) {
  try {
    // Map common forex pairs to Yahoo Finance format
    const forexMap = {
      "EURUSD": "EURUSD=X",
      "GBPUSD": "GBPUSD=X",
      "USDJPY": "USDJPY=X",
      "AUDUSD": "AUDUSD=X",
      "USDCAD": "USDCAD=X",
      "NZDUSD": "NZDUSD=X",
      "USDCHF": "USDCHF=X",
      "XAUUSD": "GC=F", // Gold futures as proxy
      "XAGUSD": "SI=F", // Silver futures as proxy
    };
    
    const yahooSymbol = forexMap[symbol.toUpperCase()];
    if (!yahooSymbol) {
      console.log(`No Yahoo mapping for ${symbol}`);
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
    
    console.log(`[Forex Fallback] Trying Yahoo symbol: ${yahooSymbol}`);
    
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
      const data = await fetchForexData(ticker.replace("OANDA:", "").toUpperCase(), period);
      if (data && data.length > 0) {
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
        return res.status(200).json(data);
      }
      throw new Error("No data from fallback source");
    } catch (fallbackError) {
      console.error(`Fallback also failed for ${ticker}:`, fallbackError.message);
      return res.status(404).json({
        error: `Ticker '${ticker}' not found. This symbol may not be available. Try alternatives like GC=F (Gold Futures) or EURUSD=X (Forex).`,
      });
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
      try {
        const r = await yahooFinance.chart(ticker, {
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

        // Smart fallback: use same date range but with daily interval
        console.log(`Fallback for ${ticker} ${period}: ${interval} -> 1d`);
        const fallbackResult = await yahooFinance.chart(ticker, {
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
