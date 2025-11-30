from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import ssl
import re
from datetime import datetime


class DetikScraper:
    # Use tag/saham page for stock-specific news
    TAG_URL = "https://www.detik.com/tag/saham"
    SEARCH_URL = "https://www.detik.com/search/searchnews"

    @staticmethod
    def get_stock_news(ticker, limit=10):
        """
        Fetch news from Detik's saham tag page and filter by ticker.
        This ensures we only get stock-related news.
        """
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            }

            # First try: Search with ticker + saham on tag page
            search_url = f"{DetikScraper.SEARCH_URL}?query={urllib.parse.quote(ticker + ' saham')}"

            req = urllib.request.Request(search_url, headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
                html = response.read().decode("utf-8")

            articles = DetikScraper._parse_articles(html, ticker, limit)

            # If no results, try fetching from tag/saham page
            if len(articles) < 3:
                req = urllib.request.Request(DetikScraper.TAG_URL, headers=headers)
                with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
                    html = response.read().decode("utf-8")

                tag_articles = DetikScraper._parse_articles(
                    html, ticker, limit - len(articles)
                )
                articles.extend(tag_articles)

            return articles[:limit]

        except Exception as e:
            print(f"Detik scrape error: {e}")
            return []

    @staticmethod
    def _parse_articles(html, ticker, limit):
        """Parse articles from Detik HTML - return all stock-related news for Gemini to analyze"""
        articles = []
        ticker_upper = ticker.upper().replace(".JK", "")

        # Common company name mappings for major stocks
        company_names = {
            "BBCA": ["BCA", "Bank Central Asia"],
            "BBRI": ["BRI", "Bank Rakyat Indonesia", "Bank BRI"],
            "BMRI": ["Mandiri", "Bank Mandiri"],
            "BBNI": ["BNI", "Bank Negara Indonesia"],
            "TLKM": ["Telkom", "Telekomunikasi Indonesia"],
            "ASII": ["Astra", "Astra International"],
            "UNVR": ["Unilever"],
            "GOTO": ["GoTo", "Gojek Tokopedia"],
            "BREN": ["Barito", "Barito Renewables"],
            "BRMS": ["Bumi Resources Minerals"],
            "BUMI": ["Bumi Resources"],
            "ANTM": ["Antam", "Aneka Tambang"],
            "INDF": ["Indofood"],
            "ICBP": ["Indofood CBP"],
            "EXCL": ["XL", "XL Axiata"],
            "ISAT": ["Indosat", "Indosat Ooredoo"],
            "ADRO": ["Adaro"],
            "PTBA": ["Bukit Asam"],
            "PGAS": ["PGN", "Perusahaan Gas Negara"],
            "SMGR": ["Semen Indonesia"],
            "INTP": ["Indocement"],
            "IHSG": ["IHSG", "Indeks Harga Saham Gabungan", "bursa", "BEI"],
        }

        # Get search terms for this ticker
        search_terms = [ticker_upper]
        if ticker_upper in company_names:
            search_terms.extend(company_names[ticker_upper])

        # General stock market keywords - always relevant for context
        stock_keywords = ["IHSG", "BURSA", "BEI", "SAHAM", "INVESTOR", "ASING", "EMITEN", "DIVIDEN", "LABA", "RUGI"]

        # Pattern to extract articles
        pattern = r'media__title[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>'
        
        # Date pattern
        date_pattern = r'<div[^>]*class="[^"]*media__date[^"]*"[^>]*>.*?<span[^>]*>([^<]+)</span>'
        dates = re.findall(date_pattern, html, re.DOTALL | re.IGNORECASE)

        matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)

        # Separate into ticker-specific and general market news
        ticker_news = []
        market_news = []

        for i, (link, title) in enumerate(matches):
            title_clean = title.strip()
            title_clean = re.sub(r"\s+", " ", title_clean)
            title_upper = title_clean.upper()

            article = {
                "judul": title_clean,
                "link": link.strip(),
                "waktu": dates[i].strip() if i < len(dates) else "",
            }

            # Check if directly about ticker
            is_ticker_specific = False
            for term in search_terms:
                if term.upper() in title_upper:
                    is_ticker_specific = True
                    break

            # Check if general stock news
            is_stock_news = False
            for kw in stock_keywords:
                if kw in title_upper:
                    is_stock_news = True
                    break

            if is_ticker_specific:
                ticker_news.append(article)
            elif is_stock_news:
                market_news.append(article)

        # Prioritize ticker-specific news, then add general market news
        # Return mix: up to limit articles (prefer ticker news)
        result = ticker_news[:limit]
        remaining = limit - len(result)
        if remaining > 0:
            result.extend(market_news[:remaining])

        return result


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # Parse query parameters
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)

            ticker = params.get("ticker", [""])[0]

            if not ticker:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps({"error": "Ticker parameter required"}).encode()
                )
                return

            # Clean ticker for search
            ticker_clean = ticker.upper().replace(".JK", "")

            # Fetch stock news from Detik (filtered by saham tag)
            articles = DetikScraper.get_stock_news(ticker_clean, limit=10)

            # Return raw articles - let ai.js handle sentiment analysis with Gemini
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=300")  # Cache 5 minutes
            self.end_headers()

            response = {
                "ticker": ticker,
                "articles": articles,  # Return all articles for AI analysis
                "count": len(articles),
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
