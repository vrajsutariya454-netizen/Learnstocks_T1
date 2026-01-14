import streamlit as st
import pandas as pd
import plotly.express as px
import numpy as np


# --------------------------------
# Page config
# --------------------------------
st.set_page_config(
    page_title="Portfolio Intelligence Dashboard",
    layout="wide"
)

st.title("📊 Portfolio Intelligence Dashboard")

st.markdown("""
A **CSV-based portfolio analytics tool** that evaluates profit/loss,
allocation, diversification, concentration risk, and rebalancing insights.
""")

# --------------------------------
# Sidebar: CSV Upload
# --------------------------------
st.sidebar.header("📂 Upload Holdings CSV")

uploaded_file = st.sidebar.file_uploader(
    "Upload CSV file",
    type=["csv"]
)

sample_df = pd.DataFrame({
    "symbol": ["TCS", "INFY", "RELIANCE"],
    "quantity": [15, 20, 10],
    "avg_price": [3200, 1350, 2100],
    "current_price": [3650, 1480, 2950]
})

st.sidebar.download_button(
    "⬇ Download Sample CSV",
    sample_df.to_csv(index=False),
    file_name="sample_holdings.csv",
    mime="text/csv"
)

if uploaded_file is None:
    st.info("⬅ Upload a CSV file to begin analysis.")
    st.stop()

# --------------------------------
# Load & Validate CSV
# --------------------------------
df = pd.read_csv(uploaded_file)
df.columns = [c.lower().strip() for c in df.columns]

required_cols = {"symbol", "quantity", "avg_price", "current_price"}
if not required_cols.issubset(df.columns):
    st.error("CSV must contain: symbol, quantity, avg_price, current_price")
    st.stop()

df["symbol"] = df["symbol"].astype(str).str.upper().str.strip()
df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(0).astype(int)
df["avg_price"] = pd.to_numeric(df["avg_price"], errors="coerce").fillna(0.0)
df["current_price"] = pd.to_numeric(df["current_price"], errors="coerce").fillna(0.0)

df = df[df["quantity"] > 0]

if df.empty:
    st.warning("No valid holdings found.")
    st.stop()

# --------------------------------
# Core Calculations
# --------------------------------
df["invested_value"] = df["quantity"] * df["avg_price"]
df["current_value"] = df["quantity"] * df["current_price"]

df["pnl"] = df["current_value"] - df["invested_value"]
# avoid division by zero for pnl_pct
df["pnl_pct"] = (df["pnl"] / df["invested_value"].replace({0: np.nan})) * 100
df["pnl_pct"] = df["pnl_pct"].fillna(0)

total_invested = df["invested_value"].sum()
total_current = df["current_value"].sum()
total_pnl = total_current - total_invested
total_pnl_pct = (total_pnl / total_invested) * 100 if total_invested != 0 else 0

df["allocation_pct"] = (df["current_value"] / total_current) * 100
df_sorted = df.sort_values("current_value", ascending=False).reset_index(drop=True)

# --------------------------------
# Core Risk Metrics (DEFINE FIRST!)
# --------------------------------
hhi = (df["allocation_pct"] / 100).pow(2).sum()
effective_n = int(1 / hhi) if hhi > 0 else len(df)

# --------------------------------
# Portfolio Health Score
# --------------------------------
# 1️⃣ Concentration
if hhi < 0.10:
    concentration_score = 100
elif hhi < 0.18:
    concentration_score = 70
else:
    concentration_score = 40

# 2️⃣ Diversification
if effective_n >= 50:
    diversification_score = 100
elif effective_n >= 30:
    diversification_score = 80
elif effective_n >= 15:
    diversification_score = 60
else:
    diversification_score = 40

# 3️⃣ Fragmentation
micro_count = len(df[df["allocation_pct"] < 0.1])
if micro_count < 20:
    fragmentation_score = 100
elif micro_count < 50:
    fragmentation_score = 70
else:
    fragmentation_score = 40

# 4️⃣ Top-5 dominance
top5_pct = df_sorted.head(5)["allocation_pct"].sum()
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

# --------------------------------
# Summary Cards
# --------------------------------
st.subheader("📌 Portfolio Summary")

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total Invested", f"₹ {total_invested:,.0f}")
c2.metric("Current Value", f"₹ {total_current:,.0f}")
c3.metric("Total P/L", f"₹ {total_pnl:,.0f}", f"{total_pnl_pct:.2f}%")
c4.metric(
    "Largest Holding",
    f"{df_sorted.loc[0, 'symbol']} ({df_sorted.loc[0, 'allocation_pct']:.2f}%)"
)

st.subheader("🧠 Portfolio Health Score")
st.metric("Health Score (0–100)", portfolio_health_score)

if portfolio_health_score >= 80:
    st.success("Excellent portfolio health")
elif portfolio_health_score >= 60:
    st.warning("Moderate portfolio health — some improvements possible")
else:
    st.error("Poor portfolio health — rebalancing recommended")

# --------------------------------
# Allocation Chart
# --------------------------------
st.subheader("🥧 Portfolio Allocation (Top 10 + Others)")

TOP_N = 10
top_df = df_sorted.head(TOP_N)
others_value = df_sorted.iloc[TOP_N:]["current_value"].sum()

if others_value > 0:
    plot_df = pd.concat([
        top_df[["symbol", "current_value"]],
        pd.DataFrame({"symbol": ["OTHERS"], "current_value": [others_value]})
    ])
else:
    plot_df = top_df[["symbol", "current_value"]]

fig = px.pie(
    plot_df,
    names="symbol",
    values="current_value",
    title="Top Holdings Contribution"
)
st.plotly_chart(fig, use_container_width=True)

# --------------------------------
# Buy / Hold / Reduce Suggestions
# --------------------------------
st.subheader("🔄 Buy / Hold / Reduce Suggestions")

MIN_TARGET = 0.5
MAX_TARGET = 8.0

buy_df = df[(df["allocation_pct"] < MIN_TARGET) & (df["pnl_pct"] > 0)]
hold_df = df[(df["allocation_pct"] >= MIN_TARGET) & (df["allocation_pct"] <= MAX_TARGET)]
reduce_df = df[(df["allocation_pct"] > MAX_TARGET) & (df["pnl_pct"] > 15)]

c1, c2, c3 = st.columns(3)

with c1:
    st.markdown("### 🟢 Buy / Add More")
    for s in buy_df.sort_values("allocation_pct").head(5)["symbol"]:
        st.write(f"• {s}")

with c2:
    st.markdown("### 🟡 Hold")
    for s in hold_df.sort_values("allocation_pct", ascending=False).head(5)["symbol"]:
        st.write(f"• {s}")

with c3:
    st.markdown("### 🔴 Reduce / Trim")
    for s in reduce_df.sort_values("allocation_pct", ascending=False).head(5)["symbol"]:
        st.write(f"• {s}")

# --------------------------------
# Disclaimer
# --------------------------------
st.caption(
    "⚠ Disclaimer: All insights are rule-based portfolio analytics. "
    "This is not financial advice."
)
