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
                
                tag_articles = DetikScraper._parse_articles(html, ticker, limit - len(articles))
                articles.extend(tag_articles)

            return articles[:limit]

        except Exception as e:
            print(f"Detik scrape error: {e}")
            return []

    @staticmethod
    def _parse_articles(html, ticker, limit):
        """Parse articles from Detik HTML and filter by relevance to ticker"""
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
        
        # Pattern to extract articles - multiple patterns for robustness
        patterns = [
            # Main pattern for media__title
            r'<h3[^>]*class="[^"]*media__title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>',
            # Alternative pattern with title attribute
            r'<a[^>]*href="(https?://[^"]*(?:finance|news)\.detik\.com/[^"]+)"[^>]*title="([^"]+)"',
            # Pattern for list items
            r'<article[^>]*>.*?<a[^>]*href="([^"]*detik\.com[^"]*)"[^>]*>([^<]+)</a>',
        ]
        
        # Date pattern
        date_pattern = r'<div[^>]*class="[^"]*media__date[^"]*"[^>]*>.*?<span[^>]*>([^<]+)</span>'
        dates = re.findall(date_pattern, html, re.DOTALL | re.IGNORECASE)
        
        all_matches = []
        for pattern in patterns:
            matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
            all_matches.extend(matches)
        
        # Remove duplicates based on link
        seen_links = set()
        unique_matches = []
        for link, title in all_matches:
            if link not in seen_links:
                seen_links.add(link)
                unique_matches.append((link, title))
        
        date_idx = 0
        for link, title in unique_matches:
            if len(articles) >= limit:
                break
                
            title_clean = title.strip()
            title_clean = re.sub(r"\s+", " ", title_clean)
            title_upper = title_clean.upper()
            
            # Check if article is relevant to the ticker
            is_relevant = False
            for term in search_terms:
                if term.upper() in title_upper:
                    is_relevant = True
                    break
            
            # Also include general stock market news for IHSG
            if ticker_upper in ["IHSG", "^JKSE"]:
                stock_keywords = ["IHSG", "BURSA", "BEI", "SAHAM", "INVESTOR", "ASING"]
                for kw in stock_keywords:
                    if kw in title_upper:
                        is_relevant = True
                        break
            
            if is_relevant:
                article = {
                    "judul": title_clean,
                    "link": link.strip(),
                    "waktu": dates[date_idx].strip() if date_idx < len(dates) else "",
                }
                articles.append(article)
            
            date_idx += 1

        return articles


def analyze_news_sentiment(articles, ticker):
    """Analyze sentiment from news articles using simple heuristics"""
    if not articles:
        return {
            "type": "NEUTRAL",
            "headline": f"Tidak ada berita terkini untuk {ticker}",
            "description": "Tidak ditemukan berita relevan dari sumber Detik News. Pertimbangkan faktor teknikal untuk analisis.",
            "source": "Detik News",
            "newsDate": "",
            "confidence": 30,
        }

    # Keywords for sentiment analysis
    bullish_words = [
        "naik",
        "meningkat",
        "profit",
        "laba",
        "untung",
        "positif",
        "tumbuh",
        "optimis",
        "rally",
        "menguat",
        "bullish",
        "rekor",
        "tinggi",
        "surplus",
        "dividen",
        "akuisisi",
        "ekspansi",
        "investasi",
        "kinerja baik",
        "outperform",
        "buy",
        "beli",
        "target",
        "prospek cerah",
    ]

    bearish_words = [
        "turun",
        "menurun",
        "rugi",
        "kerugian",
        "negatif",
        "anjlok",
        "melemah",
        "bearish",
        "rendah",
        "defisit",
        "bangkrut",
        "PHK",
        "gagal bayar",
        "pailit",
        "sell",
        "jual",
        "peringatan",
        "downgrade",
        "resesi",
        "koreksi",
        "tekanan",
        "merosot",
    ]

    bullish_score = 0
    bearish_score = 0

    # Analyze each article
    all_text = " ".join(
        [(a.get("judul", "") + " " + a.get("body", "")).lower() for a in articles]
    )

    for word in bullish_words:
        if word in all_text:
            bullish_score += 1

    for word in bearish_words:
        if word in all_text:
            bearish_score += 1

    # Determine sentiment
    if bullish_score > bearish_score + 2:
        sentiment_type = "BULLISH"
    elif bearish_score > bullish_score + 2:
        sentiment_type = "BEARISH"
    else:
        sentiment_type = "NEUTRAL"

    # Get the most recent headline
    main_article = articles[0]
    confidence = min(70, 30 + len(articles) * 8)  # Base 30, +8 per article, max 70

    return {
        "type": sentiment_type,
        "headline": main_article.get("judul", ""),
        "description": f"Ditemukan {len(articles)} berita terkait. Analisis menunjukkan sentimen {sentiment_type.lower()} berdasarkan kata kunci dalam berita.",
        "source": "Detik News",
        "newsDate": main_article.get("waktu", ""),
        "confidence": confidence,
    }


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

            # Analyze sentiment
            sentiment = analyze_news_sentiment(articles, ticker_clean)

            # Return response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=300")  # Cache 5 minutes
            self.end_headers()

            response = {
                "ticker": ticker,
                "sentiment": sentiment,
                "articles": articles[:5],  # Return top 5 relevant articles
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
