import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance(); // ← pakai instance, bukan default function

export default async function handler(req, res) {
  const { ticker, period = "3M" } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: "Ticker is required" });
  }

  try {
    // Calculate start date based on period
    const startDate = new Date();
    switch (period) {
      case "1M":
        startDate.setMonth(startDate.getMonth() - 1);
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
      default:
        startDate.setMonth(startDate.getMonth() - 3); // Default 3M
    }

    // Fetch data from Yahoo Finance (pakai instance)
    const result = await yf.historical(ticker, {
      period1: startDate.toISOString().split("T")[0], // YYYY-MM-DD
      interval: "1d",
    });

    // Format data ke bentuk yang frontend harapkan
    const formattedData = result.map((quote) => ({
      date: quote.date.toISOString().split("T")[0],
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
    }));

    // Cache untuk 60 detik
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

    return res.status(200).json(formattedData);
  } catch (error) {
    console.error("Node API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
