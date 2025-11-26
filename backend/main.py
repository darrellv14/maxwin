from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import uvicorn

app = FastAPI()

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/history")
def get_stock_history(ticker: str, period: str = "3mo"):
    try:
        # Map frontend timeframe to yfinance period
        # Frontend: '1M', '3M', '6M', '1Y'
        # yfinance: '1mo', '3mo', '6mo', '1y'
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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quote")
def get_stock_quote(ticker: str):
    try:
        stock = yf.Ticker(ticker)
        # fast_info is often faster/more reliable for current price than .info
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
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
