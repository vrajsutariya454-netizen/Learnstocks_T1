import React, { useState } from "react";
import InvestmentChat from "./InvestmentChat";

const ChatbotWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [risk, setRisk] = useState("Moderate");
  const [reason, setReason] = useState("Long-term growth");
  const [market, setMarket] = useState("Global");

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 9999 }}>
      {open && (
        <div
          style={{
            width: 360,
            height: 520,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            display: "flex",
            flexDirection: "column",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderBottom: "1px solid #e6f2ea",
              background: "linear-gradient(90deg,#ecfdf5,#bbf7d0)",
            }}
          >
            <div style={{ fontWeight: 600, color: "#065f46" }}>Investment Advisor</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ padding: 8, borderBottom: "1px solid #f0f0f0", display: "flex", gap: 8, alignItems: "center" }}>
            <select value={risk} onChange={(e) => setRisk(e.target.value)} style={{ padding: 6, borderRadius: 6 }}>
              <option>Conservative</option>
              <option>Moderate</option>
              <option>Aggressive</option>
            </select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, padding: 6, borderRadius: 6 }} />
            <select value={market} onChange={(e) => setMarket(e.target.value)} style={{ padding: 6, borderRadius: 6 }}>
              <option>Global</option>
              <option>India</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <InvestmentChat riskTolerance={risk} investmentReason={reason} market={market} />
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((s) => !s)}
        aria-label="Toggle chat"
        style={{
          width: 56,
          height: 56,
          borderRadius: "999px",
          border: "none",
          background: "linear-gradient(135deg,#16a34a,#059669)",
          color: "white",
          boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M6 18L18 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default ChatbotWidget;
