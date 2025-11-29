import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { ticker, data, type = "analysis" } = req.body;

    if (!ticker || !data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Missing ticker or data" });
    }

    // Get the last 5 data points for trend analysis
    const recentData = data.slice(-5);
    const latest = recentData[recentData.length - 1];

    if (!latest) {
      return res.status(400).json({ error: "No data points provided" });
    }

    const isIndonesian = ticker.toUpperCase().endsWith(".JK") || ticker.toUpperCase() === "^JKSE";

    const strategyPrompt = isIndonesian
      ? `1. **Strategy:** LONG-ONLY (Spot Market). Do NOT suggest Short Selling.
         - If Bearish: Signal 'SELL' (Exit holdings) or 'WAIT'. Set Entry/TP/SL to 'N/A' or describe support levels to watch.
         - If Bullish: Signal 'BUY'. Provide Entry, SL, TP.`
      : `1. **Strategy:** LONG & SHORT (Margin/Futures Market).
         - If Bullish: Signal 'BUY'. Entry < TP.
         - If Bearish: Signal 'SELL' (Short Sell). Entry > TP. Label targets clearly as 'Target (Downside)'.`;

    const prompt = `
      You are "The Oracle", a ruthless Wall Street Quantitative Developer and Senior Trader with BNSP Certified Technical Analyst and a Masters degree on Finance.
      You have access to the latest market news, sentiment, and fundamental data up to your knowledge cutoff.
      
      Analyze the following technical indicators for the asset: ${ticker}.

      Recent Data (Last 5 periods):
      ${recentData
        .map(
          (d) =>
            `Date: ${d.date} | Close: ${Number(d.close).toFixed(2)} | RSI: ${d.rsi?.toFixed(2) || "N/A"} | MACD Hist: ${d.macdHistogram?.toFixed(4) || "N/A"} | BB Pos: ${d.close > (d.bbUpper || 0) ? "Over Upper" : d.close < (d.bbLower || 0) ? "Below Lower" : "Inside"}`
        )
        .join("\n")}

      Current Indicators:
      - RSI (14): ${latest.rsi?.toFixed(2) || "N/A"}
      - MACD Histogram: ${latest.macdHistogram?.toFixed(4) || "N/A"}
      - Price vs SMA50: ${latest.close > (latest.sma50 || 0) ? "Bullish" : "Bearish"}
      - Bollinger Band Squeeze: ${((latest.bbUpper || 0) - (latest.bbLower || 0)) / latest.close < 0.05 ? "YES" : "NO"}

      IMPORTANT CONSTRAINTS:
      ${strategyPrompt}
      2. **Pattern Recognition (REQUIRED - MUST INCLUDE):** Search for Cup and Handle, Head and Shoulders, Double Bottom/Top, Flags, Triangles. 
         - ONLY report a pattern if you are >80% confident.
         - Fallback: If no clear pattern, focus on Trend and Support/Resistance. Do NOT hallucinate.
      3. **Sentiment & News Analysis (REQUIRED - MUST INCLUDE):**
         - You MUST search your knowledge for ANY recent news, events, or sentiment about ${ticker}.
         - This is MANDATORY. Always provide sentiment data even if the news is from weeks/months ago.
         - Search for: earnings reports, quarterly results, corporate actions (dividends, stock splits, rights issue), 
           M&A activity, management changes, sector trends, regulatory news, macroeconomic factors, analyst ratings.
         - For Indonesian stocks (.JK): Check for RUPS, laporan keuangan, aksi korporasi, berita sektor.
         - For crypto/global assets: Check for regulatory news, adoption news, whale movements, protocol updates.
         - If absolutely NO news exists, explain the company's general business outlook or sector condition.
         - NEVER leave sentiment as null unless the ticker is completely unknown.

      Task:
      Provide a trading signal, "Win Rate Probability", and a concrete trade plan (Entry, SL, TP).
      Also include any relevant market sentiment or news that could affect the price.
      Output purely in JSON format without markdown code blocks. PASTIKAN HASILNYA DALAM BAHASA INDONESIA PADA BAGIAN REASONING DAN SENTIMENT (Kecuali sahamnya bukan saham IHSG atau ^JKSE).
      
      JSON Schema:
      {
        "signal": "BUY" | "SELL" | "HOLD",
        "confidence": number, // 0-100
        "entryArea": "string range, e.g., '150.00 - 152.50'",
        "stopLoss": "string value, e.g., '145.00'",
        "takeProfit1": "string value, e.g., '160.00'",
        "takeProfit2": "string value, e.g., '175.00'",
        "predictionTime": "string value, e.g., 'Next 2-3 Days'",
        "reasoning": "A short, sharp, professional paragraph explaining why. Use financial jargon like 'divergence', 'overbought', 'momentum', 'consolidation'. DALAM BAHASA INDONESIA.",
        "sentiment": {
          "type": "BULLISH" | "BEARISH" | "NEUTRAL",
          "headline": "Brief headline of the news/event. WAJIB DIISI. DALAM BAHASA INDONESIA.",
          "description": "Short description of the sentiment/news impact and why it matters for the stock. WAJIB DIISI. DALAM BAHASA INDONESIA (Kecuali sahamnya bukan saham IHSG atau ^JKSE).",
          "source": "Source type: 'Laporan Keuangan', 'Berita Sektor', 'Ekonomi Makro', 'Aksi Korporasi', 'Rating Analis', 'Berita Perusahaan', or 'Outlook Bisnis'. WAJIB DIISI."
        }
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      return res.status(500).json({ error: "No response from AI" });
    }

    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsedResult = JSON.parse(cleanText);

    return res.json({
      success: true,
      result: parsedResult,
    });
  } catch (error) {
    console.error("Analysis API Error:", error);
    return res.status(500).json({
      error: "Analysis failed",
      message: error.message,
    });
  }
}
