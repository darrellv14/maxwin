// News scraping from Detik for Indonesian stocks
import { setSecurityHeaders } from "./security.js";

// Company name mappings for better search
const COMPANY_NAMES = {
  BBCA: ["BCA", "BANK CENTRAL ASIA"],
  BBRI: ["BRI", "BANK RAKYAT INDONESIA", "BANK BRI"],
  BMRI: ["MANDIRI", "BANK MANDIRI"],
  BBNI: ["BNI", "BANK NEGARA INDONESIA"],
  TLKM: ["TELKOM", "TELEKOMUNIKASI INDONESIA"],
  ASII: ["ASTRA", "ASTRA INTERNATIONAL"],
  UNVR: ["UNILEVER"],
  GOTO: ["GOTO", "GOJEK", "TOKOPEDIA"],
  BREN: ["BARITO RENEWABLES", "BARITO"],
  ANTM: ["ANTAM", "ANEKA TAMBANG"],
  INDF: ["INDOFOOD"],
  ICBP: ["INDOFOOD CBP", "INDOFOOD"],
  ADRO: ["ADARO"],
  PTBA: ["BUKIT ASAM"],
  PGAS: ["PGN", "PERUSAHAAN GAS NEGARA"],
  INCO: ["VALE INDONESIA", "VALE", "INCO"],
  MDKA: ["MERDEKA COPPER", "MERDEKA"],
};

// Check if title is relevant to ticker
function isRelevant(title, ticker) {
  const titleUpper = title.toUpperCase();
  const tickerClean = ticker.replace(".JK", "").toUpperCase();

  // Check ticker code
  if (titleUpper.includes(tickerClean)) return true;

  // Check company names
  const names = COMPANY_NAMES[tickerClean] || [];
  return names.some((name) => titleUpper.includes(name.toUpperCase()));
}

// Fetch article content from Detik
async function fetchArticleContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return "";

    const html = await response.text();

    // Extract content from detail__body-text class
    const contentMatch = html.match(
      /<div[^>]*class="[^"]*detail__body-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    if (!contentMatch) return "";

    let content = contentMatch[1];

    // Remove HTML tags and clean up
    content = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Get first 500 chars
    return content.substring(0, 500);
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error.message);
    return "";
  }
}

// Scrape news from Detik search
async function scrapeDetikNews(ticker, limit = 10) {
  const tickerClean = ticker.replace(".JK", "").toUpperCase();
  const searchUrl = `https://www.detik.com/search/searchnews?query=${encodeURIComponent(
    tickerClean
  )}`;

  console.log(`[NEWS] Scraping: ${searchUrl}`);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[NEWS] Failed: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Extract article links and titles using regex
    const articlePattern =
      /<article[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*media__title[^"]*"[^>]*>([^<]+)<\/h3>[\s\S]*?<\/article>/gi;

    const matches = [...html.matchAll(articlePattern)];
    const articles = [];
    const seen = new Set();

    console.log(`[NEWS] Found ${matches.length} potential articles`);

    for (const match of matches) {
      if (articles.length >= limit) break;

      const link = match[1];
      const title = match[2].trim();

      if (seen.has(link)) continue;
      seen.add(link);

      // Filter by finance domain
      const isFinance = link.includes("finance.detik.com");
      
      // Check relevance
      if (!isRelevant(title, tickerClean)) {
        console.log(`[NEWS] Skipping irrelevant: ${title.substring(0, 50)}`);
        continue;
      }

      articles.push({
        judul: title,
        link: link,
        source: isFinance ? "Detik Finance" : "Detik",
      });
    }

    // Fetch content for first 3 articles
    console.log(`[NEWS] Fetching content for ${Math.min(3, articles.length)} articles...`);
    const contentPromises = articles
      .slice(0, 3)
      .map(async (article, index) => {
        const content = await fetchArticleContent(article.link);
        articles[index].konten = content;
      });

    await Promise.all(contentPromises);

    console.log(`[NEWS] Successfully scraped ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error(`[NEWS] Error:`, error.message);
    return [];
  }
}

// Main handler
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

  try {
    const { ticker } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: "Ticker parameter required" });
    }

    const articles = await scrapeDetikNews(ticker, 10);

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    return res.json({
      success: true,
      ticker: ticker,
      articles: articles,
      count: articles.length,
      source: "Detik",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[NEWS] Handler error:", error);
    return res.status(500).json({
      error: "Failed to fetch news",
      message: error.message,
    });
  }
}
