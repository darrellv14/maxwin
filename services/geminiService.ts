import { IndicatorData, AIAnalysisResult, SignalType } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export const analyzeStockWithGemini = async (
  ticker: string, 
  data: IndicatorData[]
): Promise<AIAnalysisResult> => {
  // Get the last 3 data points for trend analysis
  const recentData = data.slice(-5);
  const latest = recentData[recentData.length - 1];

  const isIndonesian = ticker.toUpperCase().endsWith('.JK') || ticker.toUpperCase() === '^JKSE';
  
  const strategyPrompt = isIndonesian 
    ? `1. **Strategy:** LONG-ONLY (Spot Market). Do NOT suggest Short Selling.
       - If Bearish: Signal 'SELL' (Exit holdings) or 'WAIT'. Set Entry/TP/SL to 'N/A' or describe support levels to watch.
       - If Bullish: Signal 'BUY'. Provide Entry, SL, TP.`
    : `1. **Strategy:** LONG & SHORT (Margin/Futures Market).
       - If Bullish: Signal 'BUY'. Entry < TP.
       - If Bearish: Signal 'SELL' (Short Sell). Entry > TP. Label targets clearly as 'Target (Downside)'.`;

  const prompt = `
    You are "The Oracle", a ruthless Wall Street Quantitative Developer and Senior Trader with BNSP Certified Technical Analyst and a Masters degree on Finance.
    Analyze the following technical indicators for the asset: ${ticker}.

    Recent Data (Last 5 periods):
    ${recentData.map(d => 
      `Date: ${d.date} | Close: ${d.close.toFixed(2)} | RSI: ${d.rsi?.toFixed(2)} | MACD Hist: ${d.macdHistogram?.toFixed(4)} | BB Pos: ${d.close > (d.bbUpper || 0) ? 'Over Upper' : d.close < (d.bbLower || 0) ? 'Below Lower' : 'Inside'}`
    ).join('\n')}

    Current Indicators:
    - RSI (14): ${latest.rsi?.toFixed(2)}
    - MACD Histogram: ${latest.macdHistogram?.toFixed(4)}
    - Price vs SMA50: ${latest.close > (latest.sma50 || 0) ? 'Bullish' : 'Bearish'}
    - Bollinger Band Squeeze: ${((latest.bbUpper || 0) - (latest.bbLower || 0)) / latest.close < 0.05 ? 'YES' : 'NO'}

    IMPORTANT CONSTRAINTS:
    ${strategyPrompt}
    2. **Pattern Recognition:** Search for Cup and Handle, Head and Shoulders, Double Bottom/Top, Flags, Triangles. 
       - ONLY report a pattern if you are >80% confident.
       - Fallback: If no clear pattern, focus on Trend and Support/Resistance. Do NOT hallucinate.

    Task:
    Provide a trading signal, "Win Rate Probability", and a concrete trade plan (Entry, SL, TP).
    Output purely in JSON format without markdown code blocks. PASTIKAN HASILNYA DALAM BAHASA INDONESIA PADA BAGIAN THE VERDICT ATAU REASONING
    
    JSON Schema:
    {
      "signal": "BUY" | "SELL" | "HOLD",
      "confidence": number, // 0-100
      "entryArea": "string range, e.g., '150.00 - 152.50'",
      "stopLoss": "string value, e.g., '145.00'",
      "takeProfit1": "string value, e.g., '160.00'",
      "takeProfit2": "string value, e.g., '175.00'",
      "predictionTime": "string value, e.g., 'Next 2-3 Days'",
      "reasoning": "A short, sharp, professional paragraph explaining why. Use financial jargon like 'divergence', 'overbought', 'momentum', 'consolidation'."
    }
  `;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    if (!text) throw new Error("No response from Gemini");

    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsedResult = JSON.parse(cleanText);

    let signalEnum = SignalType.HOLD;
    if (parsedResult.signal === 'BUY') signalEnum = SignalType.BUY;
    if (parsedResult.signal === 'SELL') signalEnum = SignalType.SELL;

    return {
      signal: signalEnum,
      confidence: parsedResult.confidence,
      reasoning: parsedResult.reasoning,
      entryArea: parsedResult.entryArea || 'N/A',
      stopLoss: parsedResult.stopLoss || 'N/A',
      takeProfit1: parsedResult.takeProfit1 || 'N/A',
      takeProfit2: parsedResult.takeProfit2 || 'N/A',
      predictionTime: parsedResult.predictionTime || 'Unknown'
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      signal: SignalType.HOLD,
      confidence: 0,
      reasoning: "The Oracle is currently offline. Unable to connect to neural markets.",
      entryArea: "---",
      stopLoss: "---",
      takeProfit1: "---",
      takeProfit2: "---",
      predictionTime: "---"
    };
  }
};
