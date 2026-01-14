from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import numpy as np
from sklearn.preprocessing import MinMaxScaler
import traceback
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import List, Dict, Any, Optional
import pandas as pd
from dotenv import load_dotenv

# Load .env data
load_dotenv()
load_dotenv("../.env")

app = FastAPI(title="Stock Prediction + Sentiment API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- HEALTH CHECK (CRITICAL) ----------
@app.get("/health")
def health():
    return {"status": "ok"}

# ---------- Lazy-loaded globals ----------
tf = None
SentimentIntensityAnalyzer = None
analyzer = None

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# ---------- Startup hook ----------
@app.on_event("startup")
def startup():
    global tf, analyzer, SentimentIntensityAnalyzer
    print("🔄 Starting backend...")

    try:
        import tensorflow as _tf
        tf = _tf
        print("✅ TensorFlow loaded")
    except ImportError:
        print("⚠️ TensorFlow not found. Prediction endpoints will be disabled.")
        tf = None

    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer as _SIA
        SentimentIntensityAnalyzer = _SIA
        analyzer = SentimentIntensityAnalyzer()
        print("✅ Sentiment Analyzer loaded")
    except ImportError:
         print("⚠️ vaderSentiment not found. Sentiment endpoints will be disabled.")


# ---------- Request Models ----------
class PredictRequest(BaseModel):
    symbol: str
    days: int
    closePrices: list[float]

# ---------- Price Prediction ----------
@app.post("/predict")
def predict(data: PredictRequest):
    if tf is None:
         return JSONResponse(content={"error": "TensorFlow not available on server"}, status_code=503)
         
    try:
        prices = np.array(data.closePrices).reshape(-1, 1)

        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_prices = scaler.fit_transform(prices)

        timesteps = 15 if data.days >= 90 else 10 if data.days >= 60 else 5

        if len(scaled_prices) <= timesteps:
            return JSONResponse(
                content={"error": f"Need >{timesteps} days data"},
                status_code=400
            )

        X, y = [], []
        for i in range(timesteps, len(scaled_prices)):
            X.append(scaled_prices[i - timesteps:i, 0])
            y.append(scaled_prices[i, 0])

        X, y = np.array(X), np.array(y)
        X = X.reshape((X.shape[0], X.shape[1], 1))

        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(50, return_sequences=True, input_shape=(X.shape[1], 1)),
            tf.keras.layers.LSTM(50),
            tf.keras.layers.Dense(1)
        ])
        model.compile(optimizer="adam", loss="mse")
        model.fit(X, y, epochs=10, batch_size=1, verbose=0)

        last_seq = scaled_prices[-timesteps:].reshape(1, timesteps, 1)
        pred_scaled = model.predict(last_seq, verbose=0)
        pred_price = scaler.inverse_transform(pred_scaled)

        return {"symbol": data.symbol, "predicted_next_close": float(pred_price[0][0])}

    except Exception as e:
        return JSONResponse(
            content={"error": str(e), "trace": traceback.format_exc()},
            status_code=500
        )

# ---------- Sentiment ----------
@app.get("/sentiment/{symbol}")
def sentiment(symbol: str):
    if analyzer is None:
        return {"symbol": symbol, "message": "Sentiment analysis disabled (module missing)"}

    try:
        url = f"https://newsapi.org/v2/everything?q={symbol}&language=en&apiKey={NEWS_API_KEY}"
        res = requests.get(url).json()

        if "articles" not in res:
            return {"symbol": symbol, "message": "No news found"}

        pos = neg = neu = 0

        for art in res["articles"][:10]:
            text = f"{art.get('title','')} {art.get('description','')}"
            score = analyzer.polarity_scores(text)["compound"]
            if score > 0.05: pos += 1
            elif score < -0.05: neg += 1
            else: neu += 1

        total = pos + neg + neu
        return {
            "symbol": symbol,
            "positive": pos,
            "negative": neg,
            "neutral": neu,
            "total": total
        }

    except Exception as e:
        return JSONResponse(
            content={"error": str(e), "trace": traceback.format_exc()},
            status_code=500
        )

# ==========================================
# PORTFOLIO INTELLIGENCE (Merged from api.py)
# ==========================================

class AnalysisResult(BaseModel):
    summary: Dict[str, Any]
    portfolio_health: Dict[str, Any]
    holdings: List[Dict[str, Any]]
    allocation: List[Dict[str, Any]]
    suggestions: Dict[str, List[Dict[str, Any]]]

REQUIRED_COLS = {"symbol", "quantity", "avg_price", "current_price"}

def _to_py(value):
    """Convert numpy scalar to native python types for JSON serialization."""
    if isinstance(value, (np.floating, np.integer)):
        return value.item()
    if isinstance(value, (np.ndarray,)):
        return value.tolist()
    return value

def load_and_validate_csv(file: UploadFile) -> pd.DataFrame:
    try:
        df = pd.read_csv(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to read CSV: {e}")

    df.columns = [c.lower().strip() for c in df.columns]

    if not REQUIRED_COLS.issubset(set(df.columns)):
        missing = REQUIRED_COLS - set(df.columns)
        raise HTTPException(status_code=400, detail=f"CSV missing columns: {', '.join(missing)}")

    # coerce types
    df["symbol"] = df["symbol"].astype(str).str.upper().str.strip()
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0).astype(int)
    df["avg_price"] = pd.to_numeric(df["avg_price"], errors="coerce").fillna(0.0)
    df["current_price"] = pd.to_numeric(df["current_price"], errors="coerce").fillna(0.0)

    # keep only positive quantities
    df = df[df["quantity"] > 0].copy()

    if df.empty:
        raise HTTPException(status_code=400, detail="No valid holdings found in CSV (quantity > 0 required).")

    return df

def compute_portfolio_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    df = df.copy()

    # core calculations
    df["invested_value"] = df["quantity"] * df["avg_price"]
    df["current_value"] = df["quantity"] * df["current_price"]
    df["pnl"] = df["current_value"] - df["invested_value"]
    # avoid division by zero
    df["pnl_pct"] = (df["pnl"] / df["invested_value"].replace({0: np.nan})) * 100
    df["pnl_pct"] = df["pnl_pct"].fillna(0)

    total_invested = float(df["invested_value"].sum())
    total_current = float(df["current_value"].sum())
    total_pnl = total_current - total_invested
    total_pnl_pct = (total_pnl / total_invested) * 100 if total_invested != 0 else 0.0

    if total_current > 0:
        df["allocation_pct"] = (df["current_value"] / total_current) * 100
    else:
        df["allocation_pct"] = 0.0

    df_sorted = df.sort_values("current_value", ascending=False).reset_index(drop=True)

    # concentration (Herfindahl-Hirschman Index style)
    hhi = (df["allocation_pct"] / 100).pow(2).sum()
    effective_n = int(1 / hhi) if hhi > 0 else len(df)

    # portfolio health components
    if hhi < 0.10:
        concentration_score = 100
    elif hhi < 0.18:
        concentration_score = 70
    else:
        concentration_score = 40

    if effective_n >= 50:
        diversification_score = 100
    elif effective_n >= 30:
        diversification_score = 80
    elif effective_n >= 15:
        diversification_score = 60
    else:
        diversification_score = 40

    micro_count = int(len(df[df["allocation_pct"] < 0.1]))
    if micro_count < 20:
        fragmentation_score = 100
    elif micro_count < 50:
        fragmentation_score = 70
    else:
        fragmentation_score = 40

    top5_pct = float(df_sorted.head(5)["allocation_pct"].sum()) if not df_sorted.empty else 0.0
    if top5_pct < 40:
        dominance_score = 100
    elif top5_pct < 60:
        dominance_score = 70
    else:
        dominance_score = 40

    portfolio_health_score = round(
        0.30 * concentration_score +
        0.30 * diversification_score +
        0.20 * fragmentation_score +
        0.20 * dominance_score
    )

    summary = {
        "total_invested": _to_py(total_invested),
        "total_current": _to_py(total_current),
        "total_pnl": _to_py(total_pnl),
        "total_pnl_pct": _to_py(total_pnl_pct),
        "largest_holding": None if df_sorted.empty else {
            "symbol": df_sorted.loc[0, "symbol"],
            "allocation_pct": _to_py(df_sorted.loc[0, "allocation_pct"])
        }
    }

    portfolio_health = {
        "score": _to_py(portfolio_health_score),
        "components": {
            "concentration_score": _to_py(concentration_score),
            "diversification_score": _to_py(diversification_score),
            "fragmentation_score": _to_py(fragmentation_score),
            "dominance_score": _to_py(dominance_score),
            "hhi": _to_py(hhi),
            "effective_n": _to_py(effective_n),
            "top5_pct": _to_py(top5_pct)
        }
    }

    # prepare holdings list (convert numeric types to native)
    holdings = []
    for _, row in df_sorted.iterrows():
        holdings.append({
            "symbol": row["symbol"],
            "quantity": int(row["quantity"]),
            "avg_price": _to_py(row["avg_price"]),
            "current_price": _to_py(row["current_price"]),
            "invested_value": _to_py(row["invested_value"]),
            "current_value": _to_py(row["current_value"]),
            "pnl": _to_py(row["pnl"]),
            "pnl_pct": _to_py(row["pnl_pct"]),
            "allocation_pct": _to_py(row["allocation_pct"]) if "allocation_pct" in row else 0.0
        })

    return {
        "summary": summary,
        "portfolio_health": portfolio_health,
        "holdings_df": df_sorted,
        "holdings": holdings
    }

def generate_allocation(plot_df: pd.DataFrame, top_n: int = 10) -> List[Dict[str, Any]]:
    df_sorted = plot_df.sort_values("current_value", ascending=False).reset_index(drop=True)
    top = df_sorted.head(top_n)
    others_value = df_sorted.iloc[top_n:]["current_value"].sum() if len(df_sorted) > top_n else 0.0

    allocation = []
    for _, r in top.iterrows():
        allocation.append({
            "symbol": r["symbol"],
            "current_value": _to_py(r["current_value"]),
            "allocation_pct": _to_py((r["current_value"] / df_sorted["current_value"].sum()) * 100) if df_sorted["current_value"].sum() > 0 else 0.0
        })

    if others_value > 0:
        allocation.append({
            "symbol": "OTHERS",
            "current_value": _to_py(others_value),
            "allocation_pct": _to_py((others_value / df_sorted["current_value"].sum()) * 100) if df_sorted["current_value"].sum() > 0 else 0.0
        })

    return allocation

def generate_suggestions(df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
    MIN_TARGET = 0.5
    MAX_TARGET = 8.0

    buy_df = df[(df["allocation_pct"] < MIN_TARGET) & (df["pnl_pct"] > 0)].sort_values("allocation_pct")
    hold_df = df[(df["allocation_pct"] >= MIN_TARGET) & (df["allocation_pct"] <= MAX_TARGET)].sort_values("allocation_pct", ascending=False)
    reduce_df = df[(df["allocation_pct"] > MAX_TARGET) & (df["pnl_pct"] > 15)].sort_values("allocation_pct", ascending=False)

    def row_to_suggestion(r):
        return {
            "symbol": r["symbol"],
            "allocation_pct": _to_py(r.get("allocation_pct", 0.0)),
            "pnl_pct": _to_py(r.get("pnl_pct", 0.0)),
            "current_value": _to_py(r.get("current_value", 0.0))
        }

    suggestions = {
        "buy": [row_to_suggestion(r) for _, r in buy_df.head(10).iterrows()],
        "hold": [row_to_suggestion(r) for _, r in hold_df.head(10).iterrows()],
        "reduce": [row_to_suggestion(r) for _, r in reduce_df.head(10).iterrows()]
    }

    return suggestions

@app.post("/analyze", response_model=AnalysisResult)
async def analyze_portfolio(file: UploadFile = File(...)):
    df = load_and_validate_csv(file)
    metrics = compute_portfolio_metrics(df)
    df_sorted = metrics["holdings_df"]
    allocation = generate_allocation(df_sorted, top_n=10)
    suggestions = generate_suggestions(df_sorted)

    return {
        "summary": metrics["summary"],
        "portfolio_health": metrics["portfolio_health"],
        "holdings": metrics["holdings"],
        "allocation": allocation,
        "suggestions": suggestions
    }

# ==========================================
# QUIZ GENERATION (Moved from Supabase Edge Function)
# ==========================================

class QuizRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"

@app.post("/generate_quiz")
def generate_quiz(req: QuizRequest):
    def log(msg):
        print(msg)
        with open("debug_log.txt", "a", encoding="utf-8") as f:
            f.write(msg + "\n")

    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        api_key = api_key.strip().replace('"', '').replace("'", "")
    
    log(f"DEBUG: Key loaded: {'Yes' if api_key else 'No'}")
    if api_key:
        log(f"DEBUG: Key starts: {api_key[:6]}... Length: {len(api_key)}")

    if not api_key:
        log("⚠️ GROQ_API_KEY not found. Returning mock quiz.")
        # ... (mock response) ...
        return {"questions": [
            {
                "id": "mock-1",
                "text": f"What is a key characteristic of {req.topic}?",
                "options": ["High Volatility", "Stability", "Guaranteed Returns", "None of the above"],
                "correctOption": 1,
                "explanation": "This is a mock question because the AI key is missing.",
                "difficulty": req.difficulty
            },
             {
                "id": "mock-2",
                "text": "Which metric is most important?",
                "options": ["P/E Ratio", "RSI", "MACD", "All of the above"],
                "correctOption": 3,
                "explanation": "Context depends on strategy.",
                "difficulty": req.difficulty
            },
             {
                "id": "mock-3",
                "text": "Who regulates the market?",
                "options": ["SEBI", "RBI", "Govt of India", "NSE"],
                "correctOption": 0,
                "explanation": "SEBI is the regulator.",
                "difficulty": req.difficulty
            },
             {
                "id": "mock-4",
                "text": "A 'Bull Market' means?",
                "options": ["Prices rising", "Prices falling", "No movement", "Crash"],
                "correctOption": 0,
                "explanation": "Bull means going up.",
                "difficulty": req.difficulty
            },
             {
                "id": "mock-5",
                "text": "The implementation of 'Online Mode' requires:",
                "options": ["API Keys", "Magic", "Luck", "Coffee"],
                "correctOption": 0,
                "explanation": "Please add GROQ_API_KEY to your valid environment to get real questions!",
                "difficulty": req.difficulty
            }
        ]}

    try:
        log(f"DEBUG: Attempting Groq call for topic: {req.topic}")
        from groq import Groq
        client = Groq(api_key=api_key)
        
        system_prompt = f"""You are a financial education assistant. Generate 5 multiple-choice questions about '{req.topic}' at '{req.difficulty}' difficulty level.
Return strictly a JSON array of objects (no markdown). Each object must have:
- id: unique string
- text: question text
- options: array of 4 strings
- correctOption: index (0-3)
- explanation: brief string
- difficulty: string
"""
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate now."}
            ],
            model="llama-3.1-8b-instant", 
            temperature=0.7,
        )
        
        content = chat_completion.choices[0].message.content
        log("DEBUG: Groq response received")
        
        import json
        try:
            # Clean potential markdown
            content = content.replace("```json", "").replace("```", "").strip()
            questions = json.loads(content)
            return {"questions": questions}
        except Exception as e:
            log(f"JSON Parse Error: {e}")
            log(f"Raw Content: {content}")
            return JSONResponse(content={"error": "Failed to parse AI response"}, status_code=500)

    except Exception as e:
        log(f"Groq API Error: {e}")
        log(traceback.format_exc())
        return JSONResponse(content={"error": str(e)}, status_code=500)

