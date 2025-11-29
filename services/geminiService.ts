import { IndicatorData, AIAnalysisResult, SignalType } from "../types";

// Chat Assistant function - routes through backend API
interface ChatParams {
  prompt: string;
  type: "chat" | "analysis";
}

export const analyzeWithGemini = async ({ prompt, type }: ChatParams): Promise<string> => {
  try {
    // Route through backend API to hide Gemini
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const data = await response.json();
    return data.response || "Maaf, tidak ada respons dari AI.";
  } catch (error) {
    console.error("Chat Error:", error);
    throw new Error("Gagal mendapatkan respons dari AI");
  }
};

export const analyzeStockWithGemini = async (
  ticker: string,
  data: IndicatorData[]
): Promise<AIAnalysisResult> => {
  try {
    // Route through backend API to hide Gemini
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, data }),
    });

    if (!response.ok) {
      throw new Error("Analysis failed");
    }

    const result = await response.json();
    
    if (!result.success || !result.result) {
      throw new Error("Invalid response");
    }

    const parsedResult = result.result;

    let signalEnum = SignalType.HOLD;
    if (parsedResult.signal === "BUY") signalEnum = SignalType.BUY;
    if (parsedResult.signal === "SELL") signalEnum = SignalType.SELL;

    return {
      signal: signalEnum,
      confidence: parsedResult.confidence,
      reasoning: parsedResult.reasoning,
      entryArea: parsedResult.entryArea || "N/A",
      stopLoss: parsedResult.stopLoss || "N/A",
      takeProfit1: parsedResult.takeProfit1 || "N/A",
      takeProfit2: parsedResult.takeProfit2 || "N/A",
      predictionTime: parsedResult.predictionTime || "Unknown",
    };
  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      signal: SignalType.HOLD,
      confidence: 0,
      reasoning: "The Oracle is currently offline. Unable to connect to neural markets.",
      entryArea: "---",
      stopLoss: "---",
      takeProfit1: "---",
      takeProfit2: "---",
      predictionTime: "---",
    };
  }
};
