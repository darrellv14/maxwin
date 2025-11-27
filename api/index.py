from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime
import os

# Set cache directory for yfinance to /tmp for serverless environments
os.environ['XDG_CACHE_HOME'] = '/tmp/cache'

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


class AnalysisCreate(BaseModel):
    ticker: str
    signal: str
    entry_price: float
    tp1: float
    tp2: float
    stop_loss: float
    reasoning: str


class AnalysisResponse(AnalysisCreate):
    id: int
    date_created: datetime
    status: str
    highest_price: float
    lowest_price: float

    class Config:
        orm_mode = True


@app.post("/_svc/analysis", response_model=AnalysisResponse)
def create_analysis(analysis: AnalysisCreate, db: Session = Depends(get_db)):
    db_analysis = AnalysisHistory(
        ticker=analysis.ticker,
        signal=analysis.signal,
        entry_price=analysis.entry_price,
        tp1=analysis.tp1,
        tp2=analysis.tp2,
        stop_loss=analysis.stop_loss,
        reasoning=analysis.reasoning,
        highest_price=analysis.entry_price,
        lowest_price=analysis.entry_price
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return db_analysis


@app.get("/_svc/analysis", response_model=List[AnalysisResponse])
def get_analysis_history(db: Session = Depends(get_db)):
    # Fetch all active analysis to update their status
    active_analyses = db.query(AnalysisHistory).filter(
        AnalysisHistory.status == "ACTIVE"
    ).all()

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
        except Exception as e:
            print(f"Error updating analysis {analysis.id}: {e}")
            continue

    return db.query(AnalysisHistory).order_by(
        AnalysisHistory.date_created.desc()
    ).all()


@app.get("/_svc/data")
def get_stock_history(ticker: str, period: str = "3mo"):
    try:
        # Map frontend timeframe to yfinance period
        yf_period = period.lower()
        if yf_period == "1m":
            yf_period = "1mo"
        if yf_period == "3m":
            yf_period = "3mo"
        if yf_period == "6m":
            yf_period = "6mo"

        stock = yf.Ticker(ticker)
        hist = stock.history(period=yf_period)

        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found")

        data = []
        for date, row in hist.iterrows():
            data.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "open": row["Open"],
                    "high": row["High"],
                    "low": row["Low"],
                    "close": row["Close"],
                    "volume": row["Volume"],
                }
            )

        return data
    except Exception as e:
        print(f"Error fetching stock data: {e}")
        # Return the error message to the client for debugging
        raise HTTPException(
            status_code=500,
            detail=f"Stock data error: {str(e)}"
        )


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
            status_code=500,
            detail=f"Live quote error: {str(e)}"
        )
