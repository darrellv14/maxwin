// Test endpoint to check if we can fetch from Detik
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  try {
    const url = "https://www.detik.com/search/searchnews?query=BBCA";
    
    console.log("[TEST] Fetching:", url);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    console.log("[TEST] Status:", response.status);
    console.log("[TEST] Headers:", Object.fromEntries(response.headers));
    
    const html = await response.text();
    const htmlLength = html.length;
    const hasArticleTag = html.includes("<article");
    const hasMediaTitle = html.includes("media__title");
    
    return res.json({
      success: true,
      status: response.status,
      htmlLength: htmlLength,
      hasArticleTag: hasArticleTag,
      hasMediaTitle: hasMediaTitle,
      firstFewChars: html.substring(0, 500),
    });
  } catch (error) {
    return res.json({
      success: false,
      error: error.message,
      name: error.name,
    });
  }
}
