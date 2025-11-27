from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import os
import tempfile
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set cache directory for yfinance to a writable location
cache_dir = os.path.join(tempfile.gettempdir(), "yfinance_cache")
os.environ["XDG_CACHE_HOME"] = cache_dir

# Add current directory to sys.path to fix import issues on Vercel

import yfinance as yf  # noqa: E402
from database import init_db, get_db, AnalysisHistory  # noqa: E402

app = FastAPI()


# Initialize Database
try:
    init_db()
except Exception as e:
    print(f"Database initialization failed: {e}")

# Allow CORS - Restricted to your domain
origins = [
    "https://moocuan.darrellvalentino.com",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)


# Models removed as they are handled by Node.js now


# Endpoints removed as they are handled by Node.js now


@app.post("/_svc/update-status")
def update_analysis_status(db: Session = Depends(get_db)):
    # Fetch all active analysis to update their status
    active_analyses = (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.status == "ACTIVE")
        .all()
    )

    updated_count = 0
    for analysis in active_analyses:
        try:
            # Fetch current price and day's high/low
            stock = yf.Ticker(analysis.ticker)
            # fast_info is faster
            current_price = stock.fast_info.last_price

            # Update highest/lowest seen
            if current_price > analysis.highest_price:
                analysis.highest_price = current_price
            if current_price < analysis.lowest_price:
                analysis.lowest_price = current_price

            # Check Targets based on Signal
            if analysis.signal == "BUY":
                if current_price >= analysis.tp2:
                    analysis.status = "TP2 HIT"
                elif current_price >= analysis.tp1:
                    if analysis.status != "TP2 HIT":
                        analysis.status = "TP1 HIT"
                elif current_price <= analysis.stop_loss:
                    analysis.status = "SL HIT"

            elif analysis.signal == "SELL":
                if current_price <= analysis.tp2:
                    analysis.status = "TP2 HIT"
                elif current_price <= analysis.tp1:
                    if analysis.status != "TP2 HIT":
                        analysis.status = "TP1 HIT"
                elif current_price >= analysis.stop_loss:
                    analysis.status = "SL HIT"

            db.commit()
            updated_count += 1
        except Exception as e:
            print(f"Error updating analysis {analysis.id}: {e}")
            continue
            
    return {"message": "Status updated", "updated_count": updated_count}


# Stock history endpoint removed (replaced by api/market.js)


@app.get("/_svc/live")
def get_stock_quote(ticker: str):
    try:
        stock = yf.Ticker(ticker)
        price = stock.fast_info.last_price
        prev_close = stock.fast_info.previous_close
        open_price = stock.fast_info.open

        if not price:
            hist = stock.history(period="1d")
            if not hist.empty:
                last = hist.iloc[-1]
                price = last["Close"]
                open_price = last["Open"]

        return {
            "symbol": ticker,
            "price": price,
            "open": open_price,
            "prevClose": prev_close,
        }
    except Exception as e:
        print(f"Error fetching live quote: {e}")
        raise HTTPException(
            status_code=500, detail=f"Live quote error: {str(e)}"
        )
