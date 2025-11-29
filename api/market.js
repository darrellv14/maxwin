import YahooFinance from "yahoo-finance2";
import { setSecurityHeaders, sanitizeInput } from "./security.js";

const yahooFinance = new YahooFinance();

// ============ LIVE QUOTE ============
async function getLiveQuote(req, res) {
  const { ticker } = req.query;

  if (!ticker || typeof ticker !== "string") {
    return res.status(400).json({ error: "Ticker is required" });
  }

  try {
    const quote = await yahooFinance.quote(ticker);
    const price = quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice;
    const open = quote.regularMarketOpen;
    const prevClose = quote.regularMarketPreviousClose;

    return res.status(200).json({
      symbol: quote.symbol,
      price: price,
      open: open,
      prevClose: prevClose,
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
    if (
      error.message === "Ticker Not Found" ||
      error.message.includes("Not Found") ||
      error.message.includes("404")
    ) {
      return res.status(404).json({
        error: `Ticker '${ticker}' not found. Please check the symbol.`,
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
