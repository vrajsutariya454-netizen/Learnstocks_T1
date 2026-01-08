"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { SendIcon } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface InvestmentChatProps {
  riskTolerance: string;
  investmentReason: string;
  apiBase?: string;
  market?: string;
}

export default function InvestmentChat({
  riskTolerance,
  investmentReason,
  apiBase,
  market = "Global",
}: InvestmentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conciseMode, setConciseMode] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const systemPrompt = `You are an expert investment advisor with deep knowledge of financial markets, portfolio management, and investment strategies.

Client Profile:
- Risk Tolerance: ${riskTolerance}
- Investment Goal: ${investmentReason}

Provide personalized investment advice based on their profile. Be professional, helpful, and clear. Always consider their risk tolerance and investment goals when making recommendations. Discuss diversification, asset allocation, and risk management principles.`;

  // If market is India, bias suggestions to Indian stocks and mention exchanges
  const marketNote =
    market === "India"
      ? "When recommending equities, prefer Indian stocks listed on NSE or BSE, indicate ticker symbols and a brief rationale. Provide suggested allocation in INR and consider Indian market-specific factors (GST, taxation, domestic macro outlook)."
      : "";

  const fullSystemPrompt = `${systemPrompt}\n\n${marketNote}`;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Track which URL we are actually calling for easier debugging
    let devProxy: string | null = null;
    let envUrl: string | undefined;
    let base = "";
    let url = "";

    try {
      // Prefer the Vite dev proxy during development so requests are same-origin.
      // Vite exposes `import.meta.env.DEV` as a boolean at build time.
      devProxy = (import.meta as any).env?.DEV ? "/advisor-api" : null;
      envUrl = (import.meta as any).env?.VITE_ADVISOR_URL || undefined;
      base = apiBase || (devProxy ?? envUrl ?? "http://localhost:3000");
      url = `${base}/api/chat`;

      console.log("[InvestmentChat] Calling advisor API", {
        devProxy,
        envUrl,
        apiBase,
        base,
        url,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: conciseMode
                ? fullSystemPrompt +
                  "\n\nPlease keep responses concise (about 100-150 words) and prefer short bullet points when appropriate."
                : fullSystemPrompt,
            },
            ...messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            {
              role: "user",
              content: input,
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Advisor API error ${response.status}: ${text}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text || data?.message || JSON.stringify(data),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error calling advisor API:", error);
      // Provide an actionable error message when connection is refused
      const msg = error?.message || String(error);
      const isConnRefused = /refused|Failed to fetch|ECONNREFUSED/i.test(msg);
      const helpText = isConnRefused
        ? `Error: ${msg}. Advisor URL tried: ${
            url || "(unknown)"
          }. Resolved base: ${base || "(empty)"}. VITE_ADVISOR_URL at build: ${
            envUrl || "(undefined)"
          }. If running locally, make sure the investment-advisor server is running on http://localhost:3000. In production, set VITE_ADVISOR_URL in the LearnStocks Vercel project to your deployed advisor URL.`
        : `Error: ${msg}`;

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: helpText,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col bg-background"
      style={{ width: "100%", height: "100%" }}
    >
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ maxHeight: 440 }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-4xl">📊</div>
              <h2 className="text-lg font-bold text-foreground">
                Welcome to Your Investment Advisor
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask me anything about investing, portfolio strategies, market
                trends, or financial planning.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isLong = message.content.length > 420;
              const isExpanded = expandedMessages.includes(message.id);
              const display =
                isLong && !isExpanded
                  ? message.content.slice(0, 400) + "..."
                  : message.content;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <Card
                    className={`max-w-md px-4 py-3 ${
                      message.role === "user"
                        ? ""
                        : "bg-card text-foreground border-border"
                    }`}
                    style={
                      message.role === "user"
                        ? {
                            background:
                              "linear-gradient(90deg,#16a34a,#059669)",
                            color: "white",
                          }
                        : undefined
                    }
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {display}
                    </p>
                    {isLong && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          className="text-xs underline"
                          style={{
                            color:
                              message.role === "user" ? "#e6fffa" : "#047857",
                          }}
                          onClick={() => {
                            setExpandedMessages((prev) =>
                              prev.includes(message.id)
                                ? prev.filter((id) => id !== message.id)
                                : [...prev, message.id]
                            );
                          }}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <Card className="bg-card px-4 py-3 border-border">
                  <div style={{ width: 16, height: 16 }}>
                    <svg width="16" height="16" viewBox="0 0 50 50">
                      <circle
                        cx="25"
                        cy="25"
                        r="20"
                        fill="none"
                        stroke="#059669"
                        strokeWidth="4"
                        strokeDasharray="31.4 31.4"
                      >
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from="0 25 25"
                          to="360 25 25"
                          dur="1s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </svg>
                  </div>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid #e6e6e6",
          padding: 12,
          background: "#fff",
        }}
      >
        <div className="mb-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={conciseMode}
              onChange={(e) => setConciseMode(e.target.checked)}
            />
            <span>Concise responses</span>
          </label>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about investment strategies, portfolios, or markets..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded bg-secondary text-foreground placeholder-muted-foreground border"
            style={{ borderRadius: 8, border: "1px solid #ddd" }}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2"
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
