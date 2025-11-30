from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import ssl
import re
import os
from datetime import datetime


# ============ NEWS SCRAPER (copied from news.py to avoid import issues) ============
class NewsScraper:
    """News scraper for Detik with article content fetching for AI analysis"""

    DETIK_SEARCH_URL = "https://www.detik.com/search/searchall"

    COMPANY_NAMES = {
        "BBCA": ["BCA", "BANK CENTRAL ASIA"],
        "BBRI": ["BRI", "BANK RAKYAT INDONESIA", "BANK BRI"],
        "BMRI": ["MANDIRI", "BANK MANDIRI"],
        "BBNI": ["BNI", "BANK NEGARA INDONESIA"],
        "TLKM": ["TELKOM", "TELEKOMUNIKASI INDONESIA"],
        "ASII": ["ASTRA", "ASTRA INTERNATIONAL"],
        "UNVR": ["UNILEVER"],
        "GOTO": ["GOTO", "GOJEK", "TOKOPEDIA"],
        "BREN": ["BARITO RENEWABLES", "BARITO"],
        "BRPT": ["BARITO PACIFIC", "BARITO"],
        "TPIA": ["CHANDRA ASRI", "TPIA"],
        "CUAN": ["PETRINDO JAYA", "CUAN"],
        "BRMS": ["BUMI RESOURCES MINERALS"],
        "BUMI": ["BUMI RESOURCES"],
        "ANTM": ["ANTAM", "ANEKA TAMBANG"],
        "INDF": ["INDOFOOD"],
        "ICBP": ["INDOFOOD CBP", "INDOFOOD"],
        "EXCL": ["XL", "XL AXIATA"],
        "ISAT": ["INDOSAT", "INDOSAT OOREDOO"],
        "ADRO": ["ADARO"],
        "PTBA": ["BUKIT ASAM"],
        "PGAS": ["PGN", "PERUSAHAAN GAS NEGARA"],
        "SMGR": ["SEMEN INDONESIA"],
        "INTP": ["INDOCEMENT"],
        "ACES": ["ACE HARDWARE"],
        "MYOR": ["MAYORA"],
        "KLBF": ["KALBE", "KALBE FARMA"],
        "CPIN": ["CHAROEN POKPHAND"],
        "INCO": ["VALE INDONESIA", "VALE", "INCO"],
        "NCKL": ["TRIMEGAH BANGUN", "HARITA NICKEL"],
        "MDKA": ["MERDEKA COPPER", "MERDEKA"],
        "AMMN": ["AMMAN MINERAL"],
    }

    STOCK_KEYWORDS = [
        "IHSG",
        "BEI",
        "BURSA",
        "IDX",
        "LQ45",
        "IDX30",
        "SAHAM",
        "EMITEN",
        "LISTING",
        "IPO",
        "RIGHT ISSUE",
        "STOCK SPLIT",
        "DIVIDEN",
        "LABA",
        "RUGI",
        "PENDAPATAN",
        "REVENUE",
        "PROFIT",
        "INVESTOR",
        "ASING",
        "NET BUY",
        "NET SELL",
        "MENGUAT",
        "MELEMAH",
        "RALLY",
        "KOREKSI",
        "BULLISH",
        "BEARISH",
        "PERBANKAN",
        "PERTAMBANGAN",
        "PROPERTI",
        "ENERGI",
    ]

    @staticmethod
    def _get_ssl_context():
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    @staticmethod
    def _get_headers():
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        }

    @staticmethod
    def _get_search_terms(ticker):
        ticker_upper = ticker.upper().replace(".JK", "")
        terms = [ticker_upper]
        if ticker_upper in NewsScraper.COMPANY_NAMES:
            terms.extend(NewsScraper.COMPANY_NAMES[ticker_upper])
        return terms

    @staticmethod
    def _is_about_ticker(text, search_terms):
        text_upper = text.upper()
        return any(term.upper() in text_upper for term in search_terms)

    @staticmethod
    def _has_stock_keyword(text):
        text_upper = text.upper()
        return any(kw in text_upper for kw in NewsScraper.STOCK_KEYWORDS)

    @staticmethod
    def _fetch_article_content(url, ctx, headers, timeout=5):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
                html = resp.read().decode("utf-8", "ignore")

            paragraphs = re.findall(r"<p[^>]*>([^<]{50,})</p>", html, re.DOTALL)

            content_parts = []
            for p in paragraphs:
                p_clean = re.sub(r"\s+", " ", p).strip()
                if len(p_clean) > 50 and not any(
                    skip in p_clean.lower()
                    for skip in ["baca juga", "simak video", "saksikan"]
                ):
                    content_parts.append(p_clean)
                    if len(content_parts) >= 2:
                        break

            return " ".join(content_parts)[:400]
        except Exception as e:
            print(f"Article fetch error for {url}: {e}")
            return ""

    @staticmethod
    def get_stock_news(ticker, limit=10):
        ticker_clean = ticker.upper().replace(".JK", "")
        ctx = NewsScraper._get_ssl_context()
        headers = NewsScraper._get_headers()
        search_terms = NewsScraper._get_search_terms(ticker_clean)

        is_ihsg = ticker_clean in ["IHSG", "^JKSE", "JKSE"]
        if is_ihsg:
            search_terms = ["IHSG", "INDEKS", "BEI", "BURSA EFEK", "LQ45", "IDX"]

        articles = []

        try:
            search_query = "IHSG bursa saham" if is_ihsg else ticker_clean
            search_url = f"{NewsScraper.DETIK_SEARCH_URL}?query={urllib.parse.quote(search_query)}"
            req = urllib.request.Request(search_url, headers=headers)

            with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
                html = response.read().decode("utf-8", "ignore")

            patterns = [
                r'media__title[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>',
                r'<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>',
            ]

            matches = []
            for pattern in patterns:
                found = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
                matches.extend(found)

            seen_links = set()
            for link, title in matches:
                if len(articles) >= limit:
                    break

                if link in seen_links:
                    continue

                title_clean = re.sub(r"\s+", " ", title).strip()
                is_finance = "finance.detik.com" in link.lower()

                if is_ihsg:
                    if (
                        not NewsScraper._has_stock_keyword(title_clean)
                        and not is_finance
                    ):
                        continue
                else:
                    if not NewsScraper._is_about_ticker(title_clean, search_terms):
                        continue
                    if not is_finance and not NewsScraper._has_stock_keyword(
                        title_clean
                    ):
                        continue

                seen_links.add(link)

                content = ""
                if len(articles) < 3:
                    content = NewsScraper._fetch_article_content(link, ctx, headers)

                articles.append(
                    {
                        "judul": title_clean,
                        "link": link,
                        "konten": content,
                        "source": "Detik Finance" if is_finance else "Detik",
                    }
                )

        except Exception as e:
            print(f"Search error: {e}")

        return articles[:limit]


# ============ GEMINI API ============
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def call_gemini(prompt: str) -> dict:
    """Call Gemini API directly via REST"""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return None

    url = f"{GEMINI_API_URL}?key={api_key}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1024,
        },
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}, method="POST"
        )

        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))

        # Extract text from Gemini response
        if result.get("candidates"):
            text = result["candidates"][0]["content"]["parts"][0]["text"]
            # Parse JSON from response
            clean_text = re.sub(r"```json\n?|\n?```", "", text).strip()
            return json.loads(clean_text)
        return None
    except Exception as e:
        print(f"Gemini API error: {e}")
        return None


def analyze_news_sentiment(
    articles: list, ticker: str, is_ihsg_fallback: bool = False
) -> dict:
    """Analyze news sentiment using Gemini"""
    if not articles:
        return {
            "type": "NEUTRAL",
            "headline": "Tidak ada berita terkini",
            "description": "Tidak ditemukan berita relevan untuk saham ini.",
            "source": "N/A",
            "newsDate": None,
            "confidence": 30,
            "keyNews": [],
            "isIHSGFallback": False,
        }

    ticker_clean = ticker.replace(".JK", "").upper()

    # Format articles for prompt
    news_text = ""
    for i, a in enumerate(articles[:5]):
        news_text += f'{i+1}. JUDUL: "{a.get("judul", "")}"\n'
        if a.get("konten"):
            news_text += f'   ISI: {a["konten"]}\n'
        news_text += "\n"

    if is_ihsg_fallback:
        prompt = f"""Kamu adalah analis sentimen pasar saham Indonesia. Analisis berita IHSG berikut:

BERITA IHSG TERKINI:
{news_text}

Berikan analisis sentimen pasar dalam format JSON (tanpa markdown):
{{
  "type": "BULLISH" | "BEARISH" | "NEUTRAL",
  "headline": "Rangkuman kondisi pasar",
  "description": "Analisis 2-3 kalimat tentang kondisi IHSG",
  "source": "Detik News (IHSG)",
  "newsDate": "Terbaru",
  "confidence": 0-100,
  "keyNews": ["Berita penting 1", "Berita penting 2"],
  "isIHSGFallback": true
}}"""
    else:
        prompt = f"""Kamu adalah analis sentimen berita saham Indonesia. Analisis berita untuk {ticker_clean}:

BERITA TERKINI:
{news_text}

TUGAS:
1. Cek apakah berita BENAR-BENAR tentang {ticker_clean}
2. Jika relevan: Tentukan sentimen BULLISH, BEARISH, atau NEUTRAL
3. Jika TIDAK relevan: Set isRelevant = false

Format JSON (tanpa markdown):
{{
  "type": "BULLISH" | "BEARISH" | "NEUTRAL",
  "headline": "Rangkuman berita",
  "description": "Analisis dampak ke harga saham dengan DATA SPESIFIK",
  "source": "Detik News",
  "newsDate": "Terbaru",
  "confidence": 0-100,
  "keyNews": ["Berita penting 1", "Berita penting 2"],
  "isRelevant": true | false,
  "isIHSGFallback": false
}}"""

    result = call_gemini(prompt)

    if result:
        # If not relevant, try IHSG fallback
        if result.get("isRelevant") == False and not is_ihsg_fallback:
            ihsg_articles = NewsScraper.get_stock_news("IHSG", limit=10)
            if ihsg_articles:
                return analyze_news_sentiment(ihsg_articles, "IHSG", True)
        return result

    # Fallback if Gemini fails
    return {
        "type": "NEUTRAL",
        "headline": (
            articles[0].get("judul", "Berita tersedia")
            if articles
            else "Tidak ada berita"
        ),
        "description": f"Ditemukan {len(articles)} berita terkait.",
        "source": "Detik News",
        "newsDate": "Terbaru",
        "confidence": 40,
        "keyNews": [],
        "isIHSGFallback": False,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            ticker = params.get("ticker", [""])[0]

            if not ticker:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Ticker required"}).encode())
                return

            ticker_clean = ticker.upper().replace(".JK", "")

            # Fetch news
            articles = NewsScraper.get_stock_news(ticker_clean, limit=10)

            # Analyze sentiment
            sentiment = analyze_news_sentiment(articles, ticker_clean)

            # If no articles found, try IHSG fallback
            if not articles:
                ihsg_articles = NewsScraper.get_stock_news("IHSG", limit=10)
                if ihsg_articles:
                    sentiment = analyze_news_sentiment(ihsg_articles, "IHSG", True)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            response = {
                "ticker": ticker,
                "sentiment": sentiment,
                "articles_count": len(articles),
                "timestamp": datetime.now().isoformat(),
            }

            self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
