import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { prompt, type = "chat", context } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: "Prompt harus diisi" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let systemPrompt = "";

    if (type === "chat") {
      systemPrompt = `Anda adalah AI assistant trading saham bernama MooCuan AI. Anda ahli dalam:
- Analisis teknikal (RSI, MACD, Bollinger Bands, SMA, EMA, Volume, dll)
- Analisis fundamental dasar (PE Ratio, PBV, ROE, DER, dll)
- Strategi trading (swing trading, scalping, positional trading, value investing)
- Manajemen risiko dan money management
- Psikologi trading dan behavioral finance
- Pasar saham Indonesia (IDX/BEI)

Berikan jawaban yang:
- Informatif, akurat, dan berbasis data
- Dalam bahasa Indonesia yang santai tapi profesional
- Gunakan emoji untuk memperjelas poin penting 📈📉💡
- Berikan contoh konkret jika memungkinkan
- Selalu ingatkan tentang manajemen risiko
- Jika ada data teknikal, berikan interpretasi yang jelas

${context ? `Konteks saat ini: ${context}` : ""}`;
    } else if (type === "analysis") {
      systemPrompt = `Anda adalah analis teknikal profesional bersertifikasi BNSP. 
Berikan analisis mendalam dengan pendekatan kuantitatif.
Fokus pada: trend analysis, support/resistance, momentum indicators, dan volume analysis.
${context ? `Data teknikal: ${context}` : ""}`;
    } else if (type === "education") {
      systemPrompt = `Anda adalah mentor trading yang sabar dan edukatif.
Jelaskan konsep trading dengan cara yang mudah dipahami pemula.
Gunakan analogi dan contoh nyata dari pasar Indonesia.
${context ? `Topik: ${context}` : ""}`;
    }

    const result = await model.generateContent(`${systemPrompt}\n\nUser: ${prompt}`);
    const response = await result.response;
    const text = response.text();

    return res.json({
      success: true,
      response: text,
      type,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mendapatkan respons dari AI",
      error: error.message,
    });
  }
}
