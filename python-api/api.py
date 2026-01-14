from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np

app = FastAPI(title="Portfolio Intelligence API")


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
    """Read uploaded CSV into a cleaned DataFrame.

    Raises HTTPException on validation errors.
    """
    try:
        df = pd.read_csv(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to read CSV: {e}")

    # normalize column names
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
    """Compute core portfolio metrics and enrich the DataFrame."""
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
    """Return top N allocation list with an 'OTHERS' bucket if needed."""
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
    """Create buy/hold/reduce suggestions based on allocation and pnl."""
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
    """Accept a CSV file and return portfolio analytics as JSON.

    Expected CSV columns: `symbol`, `quantity`, `avg_price`, `current_price`.
    """
    df = load_and_validate_csv(file)

    metrics = compute_portfolio_metrics(df)
    df_sorted = metrics["holdings_df"]

    allocation = generate_allocation(df_sorted, top_n=10)
    suggestions = generate_suggestions(df_sorted)

    response = {
        "summary": metrics["summary"],
        "portfolio_health": metrics["portfolio_health"],
        "holdings": metrics["holdings"],
        "allocation": allocation,
        "suggestions": suggestions
    }

    return JSONResponse(content=response)


@app.get("/")
async def root():
    return {"message": "Portfolio Intelligence API. POST CSV to /analyze."}
