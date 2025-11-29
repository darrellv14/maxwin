import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export default async function handler(req, res) {
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
    
    switch (period) {
      case "1D":
        startDate.setDate(startDate.getDate() - 1);
        interval = "5m"; // 5 minute intervals for 1 day
        break;
      case "5D":
        startDate.setDate(startDate.getDate() - 5);
        interval = "15m"; // 15 minute intervals for 5 days
        break;
      case "1M":
        startDate.setMonth(startDate.getMonth() - 1);
        interval = "1h"; // hourly for 1 month
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

    // ===========================================
    // 3️⃣ CHART FETCH + AUTO-RETRY
    // ===========================================
    async function fetchChart() {
      try {
        const r = await yahooFinance.chart(ticker, {
          period1: startDate,
          period2: endDate,
          interval: interval,
        });

        if (r.quotes && r.quotes.length > 0) return r;

        // If empty, maybe range was bad.
        throw new Error("Empty quotes");
      } catch (err) {
        // If it's a 404/Not Found, propagate it immediately
        if (err.message && (err.message.includes("Not Found") || err.message.includes("404"))) {
          throw new Error("Ticker Not Found");
        }

        // Retry with daily interval as fallback
        return await yahooFinance.chart(ticker, {
          period1: new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate()),
          period2: endDate,
          interval: "1d",
        });
      }
    }

    const result = await fetchChart();
    const quotes = result.quotes ?? [];

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
        date: q.date.toISOString().split("T")[0],
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
