from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import ssl
import re
import os
from datetime import datetime

# Import the news scraper
from .news import NewsScraper

# Gemini API via REST (no SDK needed)
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
        }
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
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


def analyze_news_sentiment(articles: list, ticker: str, is_ihsg_fallback: bool = False) -> dict:
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
        "headline": articles[0].get("judul", "Berita tersedia") if articles else "Tidak ada berita",
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
