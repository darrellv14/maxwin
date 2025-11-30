from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import ssl
import re
from datetime import datetime


class DetikScraper:
    # Use finance.detik.com for stock-specific news only
    FINANCE_URL = "https://finance.detik.com/search/searchall"
    SEARCH_URL = "https://www.detik.com/search/searchnews"

    # Konglomerat Indonesia - untuk deteksi berita bisnis
    KONGLOMERAT = {
        "AGUAN": ["Aguan", "Aguan Salim", "Salim Group"],
        "PRAJOGO": ["Prajogo", "Prajogo Pangestu", "Barito"],
        "HARTONO": ["Hartono", "Robert Budi Hartono", "Michael Hartono", "Djarum"],
        "WIDJAJA": ["Widjaja", "Eka Tjipta Widjaja", "Sinar Mas"],
        "TAHIR": ["Tahir", "Dato Tahir", "Mayapada"],
        "TANOTO": ["Tanoto", "Sukanto Tanoto", "RGE", "Royal Golden Eagle"],
        "BAKRIE": ["Bakrie", "Aburizal Bakrie", "Nirwan Bakrie"],
        "RIADY": ["Riady", "Mochtar Riady", "James Riady", "Lippo"],
        "CIPUTRA": ["Ciputra"],
        "SURYA": ["Surya Paloh", "Chairul Tanjung", "CT Corp"],
        "HAPSORO": ["Happy Hapsoro", "Hapsoro"],
        "KATUARI": ["Katuari", "Garibaldi Thohir", "Erick Thohir"],
        "LIEM": ["Liem", "Anthony Salim", "Salim"],
        "SOERYADJAYA": ["Soeryadjaya", "Edwin Soeryadjaya"],
    }

    # Strict stock/finance keywords - berita HARUS mengandung salah satu ini
    STOCK_KEYWORDS = [
        # Bursa & Index
        "IHSG",
        "BEI",
        "BURSA",
        "IDX",
        "JKSE",
        "LQ45",
        "IDX30",
        # Trading terms
        "SAHAM",
        "EMITEN",
        "LISTING",
        "IPO",
        "RIGHT ISSUE",
        "STOCK SPLIT",
        "BUYBACK",
        "TENDER OFFER",
        "DELISTING",
        "SUSPEND",
        # Corporate actions
        "DIVIDEN",
        "LABA",
        "RUGI",
        "PENDAPATAN",
        "REVENUE",
        "PROFIT",
        "EARNING",
        "KINERJA KEUANGAN",
        "LAPORAN KEUANGAN",
        # Investor
        "INVESTOR",
        "ASING",
        "DOMESTIK",
        "NET BUY",
        "NET SELL",
        "FOREIGN",
        # Market movement
        "MENGUAT",
        "MELEMAH",
        "RALLY",
        "KOREKSI",
        "BULLISH",
        "BEARISH",
        "NAIK",
        "TURUN",
        "ANJLOK",
        "MEROKET",
        "REBOUND",
        # Sectors
        "PERBANKAN",
        "PERTAMBANGAN",
        "PROPERTI",
        "TELEKOMUNIKASI",
        "CONSUMER",
        "ENERGI",
        "INFRASTRUKTUR",
    ]

    @staticmethod
    def _article_has_saham_tag(url, headers, ctx, timeout=5):
        """
        Cek ke halaman artikel Detik dan pastikan di bagian Tag ada 'saham'.
        Implementasi simpel: cek apakah ada link ke /tag/saham di HTML.
        """
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
                html = resp.read().decode("utf-8", "ignore").lower()

            # Di footer artikel Detik, setiap tag adalah link ke /tag/<slug>
            # Contoh: ... <a href="https://www.detik.com/tag/saham">saham</a> ...
            # Jadi cukup cek substring /tag/saham di HTML.
            return "/tag/saham" in html
        except Exception as e:
            print(f"Tag check error for {url}: {e}")
            return False

    @staticmethod
    def get_stock_news(ticker, limit=10):
        """
        Fetch news from multiple Detik sources - tag page, finance search, general search.
        - Layer 1: /tag/{ticker} lalu filter lagi hanya artikel yang juga punya tag 'saham'
        - Layer 2: finance.detik.com search
        - Layer 3: general search (detik.com/search)
        """
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/webp,*/*;q=0.8",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            }

            articles = []
            existing_links = set()

            # =======================
            # 1. TAG PAGE: /tag/{ticker}
            # =======================
            # Misal /tag/bren akan berisi list berita terkait BREN. Kita ambil kandidat,
            # lalu untuk setiap artikel cek apakah halaman detailnya punya TAG 'saham'.
            tag_url = f"https://www.detik.com/tag/{ticker.lower()}"
            try:
                req = urllib.request.Request(tag_url, headers=headers)
                with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
                    html = response.read().decode("utf-8", "ignore")

                # Ambil kandidat lebih banyak sedikit karena nanti difilter lagi
                max_candidates = min(limit * 2, 20)
                tag_candidates = DetikScraper._parse_articles(
                    html, ticker, max_candidates, strict=False
                )

                for art in tag_candidates:
                    if len(articles) >= limit:
                        break

                    link = art["link"].strip()
                    if link in existing_links:
                        continue

                    # Hanya ambil artikel yang juga punya tag 'saham'
                    if DetikScraper._article_has_saham_tag(link, headers, ctx):
                        existing_links.add(link)
                        articles.append(art)

            except Exception as e:
                print(f"Tag page error: {e}")

            # =======================
            # 2. FINANCE SEARCH
            # =======================
            if len(articles) < limit:
                search_url = (
                    f"{DetikScraper.FINANCE_URL}"
                    f"?query={urllib.parse.quote(ticker + ' saham')}&siteid=2"
                )
                try:
                    req = urllib.request.Request(search_url, headers=headers)
                    with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
                        html = response.read().decode("utf-8", "ignore")

                    finance_articles = DetikScraper._parse_articles(
                        html, ticker, limit - len(articles), strict=True
                    )
                    for art in finance_articles:
                        link = art["link"].strip()
                        if link not in existing_links:
                            existing_links.add(link)
                            articles.append(art)
                            if len(articles) >= limit:
                                break
                except Exception as e:
                    print(f"Finance search error: {e}")

            # =======================
            # 3. GENERAL SEARCH
            # =======================
            if len(articles) < limit:
                search_url2 = (
                    f"{DetikScraper.SEARCH_URL}"
                    f"?query={urllib.parse.quote(ticker + ' saham bursa')}"
                )
                try:
                    req = urllib.request.Request(search_url2, headers=headers)
                    with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
                        html = response.read().decode("utf-8", "ignore")

                    more_articles = DetikScraper._parse_articles(
                        html, ticker, limit - len(articles), strict=True
                    )
                    for art in more_articles:
                        link = art["link"].strip()
                        if link not in existing_links:
                            existing_links.add(link)
                            articles.append(art)
                            if len(articles) >= limit:
                                break
                except Exception as e:
                    print(f"General search error: {e}")

            return articles[:limit]

        except Exception as e:
            print(f"Detik scrape error: {e}")
            return []

    @staticmethod
    def _parse_articles(html, ticker, limit, strict=True):
        """Parse articles - filter untuk berita saham/keuangan."""
        articles = []
        ticker_upper = ticker.upper().replace(".JK", "")

        # Company name mappings - include full names for better matching
        company_names = {
            "BBCA": ["BCA", "BANK CENTRAL ASIA", "CENTRAL ASIA"],
            "BBRI": ["BRI", "BANK RAKYAT INDONESIA", "BANK BRI", "RAKYAT INDONESIA"],
            "BMRI": ["MANDIRI", "BANK MANDIRI"],
            "BBNI": ["BNI", "BANK NEGARA INDONESIA", "NEGARA INDONESIA"],
            "TLKM": ["TELKOM", "TELEKOMUNIKASI INDONESIA"],
            "ASII": ["ASTRA", "ASTRA INTERNATIONAL"],
            "UNVR": ["UNILEVER"],
            "GOTO": ["GOTO", "GOJEK", "TOKOPEDIA"],
            "BREN": ["BARITO", "BARITO RENEWABLES"],
            "BRMS": ["BUMI RESOURCES MINERALS"],
            "BUMI": ["BUMI RESOURCES"],
            "ANTM": ["ANTAM", "ANEKA TAMBANG"],
            "INDF": ["INDOFOOD"],
            "ICBP": ["INDOFOOD CBP"],
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
            "RATU": ["RATU PRABU", "RATU PRABU ENERGI"],  # Specific for RATU
        }

        # Get search terms for this ticker
        search_terms = [ticker_upper]
        if ticker_upper in company_names:
            search_terms.extend(company_names[ticker_upper])

        # Pattern to extract articles - multiple patterns for different page layouts
        patterns = [
            r'media__title[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>',
            r'<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>',
            r'<a[^>]*href="(https?://[^"]*detik\.com/[^"]+)"[^>]*title="([^"]+)"',
        ]
        date_pattern = (
            r'<div[^>]*class="[^"]*media__date[^"]*"[^>]*>.*?<span[^>]*>([^<]+)</span>'
        )

        dates = re.findall(date_pattern, html, re.DOTALL | re.IGNORECASE)

        # Try all patterns
        matches = []
        for pattern in patterns:
            found = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
            matches.extend(found)

        # Remove duplicates
        seen = set()
        unique_matches = []
        for link, title in matches:
            if link not in seen:
                seen.add(link)
                unique_matches.append((link, title))

        for i, (link, title) in enumerate(unique_matches):
            if len(articles) >= limit:
                break

            title_clean = title.strip()
            title_clean = re.sub(r"\s+", " ", title_clean)
            title_upper = title_clean.upper()

            # Check if about this specific ticker/company
            is_about_ticker = any(term in title_upper for term in search_terms)

            # Jika strict=False (tag page), cukup cek tentang tickernya
            if not strict and is_about_ticker:
                article = {
                    "judul": title_clean,
                    "link": link.strip(),
                    "waktu": dates[i].strip() if i < len(dates) else "",
                }
                articles.append(article)
                continue

            # STRICT FILTER: Must be from finance domain OR contain stock keywords
            is_finance_url = "finance.detik.com" in link.lower()

            # Check if contains ANY stock keyword
            has_stock_keyword = any(
                kw in title_upper for kw in DetikScraper.STOCK_KEYWORDS
            )

            # Check if mentions any konglomerat (business news indicator)
            mentions_konglomerat = False
            for _, names in DetikScraper.KONGLOMERAT.items():
                if any(name.upper() in title_upper for name in names):
                    mentions_konglomerat = True
                    break

            # ACCEPTANCE CRITERIA (must meet at least one):
            # 1. From finance.detik.com AND about ticker
            # 2. Contains stock keyword AND about ticker
            # 3. About ticker AND mentions konglomerat
            # 4. Contains multiple stock keywords (general market news)

            should_include = False

            if is_about_ticker and (is_finance_url or has_stock_keyword):
                should_include = True
            elif is_about_ticker and mentions_konglomerat:
                should_include = True
            elif has_stock_keyword and is_finance_url:
                # General market news from finance section
                stock_keyword_count = sum(
                    1 for kw in DetikScraper.STOCK_KEYWORDS if kw in title_upper
                )
                if stock_keyword_count >= 2:
                    should_include = True

            if should_include:
                article = {
                    "judul": title_clean,
                    "link": link.strip(),
                    "waktu": dates[i].strip() if i < len(dates) else "",
                }
                articles.append(article)

        return articles


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

            # Fetch stock news from Detik (filtered)
            articles = DetikScraper.get_stock_news(ticker_clean, limit=10)

            # Return raw articles - AI di frontend yang analisis (Gemini, dsb)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()

            response = {
                "ticker": ticker,
                "articles": articles,
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
