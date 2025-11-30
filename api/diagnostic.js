// Simple test to check if Detik is accessible from Vercel
export default async function handler(req, res) {
  const results = [];

  // Test different URLs
  const testUrls = [
    "https://www.detik.com/tag/bbca",
    "https://finance.detik.com/search/searchall?query=BBCA%20saham&siteid=2",
    "https://www.detik.com/search/searchnews?query=BBCA",
  ];

  for (const url of testUrls) {
    try {
      const start = Date.now();
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer: "https://www.detik.com/",
        },
        signal: AbortSignal.timeout(8000),
      });

      const duration = Date.now() - start;
      const html = await response.text();
      const hasArticles = html.includes("<article");

      results.push({
        url,
        status: response.status,
        ok: response.ok,
        duration: `${duration}ms`,
        contentLength: html.length,
        hasArticles,
        hasScript: html.includes("<script"),
        title: html.match(/<title>(.*?)<\/title>/)?.[1] || "N/A",
      });
    } catch (error) {
      results.push({
        url,
        error: error.message,
        errorType: error.name,
      });
    }
  }

  res.status(200).json({
    timestamp: new Date().toISOString(),
    results,
  });
}
