import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export default async function handler(req, res) {
  const { ticker } = req.query;

  if (!ticker || typeof ticker !== "string") {
    return res.status(400).json({ error: "Ticker is required" });
  }

  try {
    const quote = await yahooFinance.quote(ticker);

    // Map fields to match Python response
    // Python: symbol, price, open, prevClose
    // Node yahoo-finance2: symbol, regularMarketPrice, regularMarketOpen, regularMarketPreviousClose

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
