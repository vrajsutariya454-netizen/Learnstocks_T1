import { toast } from "sonner";
import React, { useEffect, useState, useRef } from "react";
import useLivePrices from "@/hooks/useLivePrices";
import TradeDialog from "@/components/TradeDialog";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useParams, useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  YAxis,
  XAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Area,
  ComposedChart
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Cpu,
  Shield,
  Newspaper,
  Activity,
  Sparkles,
  Terminal,
  Clock,
  Gauge,
  Flame,
  Bookmark,
  ChevronRight,
  Info,
  CheckCircle,
  AlertTriangle,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NavigationBar from "@/components/NavigationBar";
import { fetchStockData } from "@/services/stockApi";
import { runAgentAnalysis, AgentStep, fetchForecast } from "@/services/agentApi";
import { motion, AnimatePresence } from "framer-motion";

// Custom light/dark theme-aware markdown helper parser
const renderMarkdownToJSX = (mdText: string) => {
  if (!mdText) return null;
  const lines = mdText.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-2" />;

    // Headers
    if (trimmed.startsWith("# ")) {
      return (
        <h1 key={idx} className="text-2xl font-extrabold mt-6 mb-3 text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
          {trimmed.replace("# ", "")}
        </h1>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={idx} className="text-xl font-bold mt-5 mb-2 text-slate-800 dark:text-slate-200">
          {trimmed.replace("## ", "")}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={idx} className="text-lg font-bold mt-4 mb-2 text-slate-700 dark:text-slate-300">
          {trimmed.replace("### ", "")}
        </h3>
      );
    }

    // Dividers
    if (trimmed === "---") {
      return <hr key={idx} className="my-4 border-slate-200 dark:border-slate-800" />;
    }

    // Bullet points
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      const content = trimmed.substring(2);
      // Highlight bold in lists
      const parts = content.split("**");
      return (
        <li key={idx} className="ml-5 list-disc text-sm text-slate-600 dark:text-slate-400 my-1 leading-relaxed">
          {parts.map((part, pIdx) => (
            pIdx % 2 === 1 ? <strong key={pIdx} className="text-slate-900 dark:text-slate-100 font-semibold">{part}</strong> : part
          ))}
        </li>
      );
    }

    // Bold text highlights
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      return (
        <p key={idx} className="text-sm font-bold text-slate-900 dark:text-slate-100 my-2">
          {trimmed.replace(/\*\*/g, "")}
        </p>
      );
    }

    // Simple paragraph text with potential inline bold items
    const textParts = trimmed.split("**");
    return (
      <p key={idx} className="text-sm text-slate-600 dark:text-slate-400 my-2 leading-relaxed">
        {textParts.map((part, pIdx) => (
          pIdx % 2 === 1 ? <strong key={pIdx} className="text-slate-900 dark:text-slate-200 font-semibold">{part}</strong> : part
        ))}
      </p>
    );
  });
};

type StockDataPoint = {
  date: string;
  close: number;
  upperConfidence?: number;
  lowerConfidence?: number;
};

// Available Agents mapping with icons & descriptions
const agentsMeta = [
  {
    id: "Research Agent",
    name: "Lead Research Agent",
    icon: Cpu,
    role: "Financial Crawls",
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/40",
    desc: "Retrieves enterprise profiles, trading volumes, and global company valuations."
  },
  {
    id: "Technical Analyst Agent",
    name: "Technical Analyst Agent",
    icon: Activity,
    role: "Quantitative Gauges",
    color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/40",
    desc: "Computes RSI, MACD oscillators, moving average standard deviations, and trading momentum."
  },
  {
    id: "Sentiment Agent",
    name: "News Sentiment Agent",
    icon: Newspaper,
    role: "Public Media Crawls",
    color: "text-orange-500 bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/40",
    desc: "Processes news publisher feeds, calculating composite polarity score and headline impact."
  },
  {
    id: "Risk Agent",
    name: "Risk Management Agent",
    icon: Shield,
    role: "Exposure Matrix",
    color: "text-red-500 bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/40",
    desc: "Measures asset Beta coefficients, historical variance weights, and calculates Value at Risk (VaR)."
  },
  {
    id: "Recommendation Agent",
    name: "Recommendation Advisor",
    icon: Sparkles,
    role: "Consensus Synthesis",
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40",
    desc: "Correlates multi-agent metrics to generate buy/sell calls and drafts the final report."
  }
];

const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Core Stock Data State
  const [stockData, setStockData] = useState<StockDataPoint[]>([]);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<any | null>(null);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);

  // Trading Modal State
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const [selectedTradeStock, setSelectedTradeStock] = useState<any | null>(null);

  // --- Multi-Agent Workspace State ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeAgentIndex, setActiveAgentIndex] = useState<number | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, "idle" | "thinking" | "completed" | "failed">>({
    "Research Agent": "idle",
    "Technical Analyst Agent": "idle",
    "Sentiment Agent": "idle",
    "Risk Agent": "idle",
    "Recommendation Agent": "idle"
  });
  const [terminalLogs, setTerminalLogs] = useState<Array<{ time: string; text: string; type: "info" | "success" | "warn" }>>([]);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);

  // Real-time metrics computed and returned by the multi-agent stream
  const [indicatorsMetrics, setIndicatorsMetrics] = useState<any | null>(null);
  const [sentimentMetrics, setSentimentMetrics] = useState<any | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<any | null>(null);
  const [recommendationMetrics, setRecommendationMetrics] = useState<any | null>(null);

  // yfinance live pricing helpers
  const { prices, fetchPrices } = useLivePrices([], 5000);
  const buyStock = usePortfolioStore((s) => s.buyStock);
  const sellStock = usePortfolioStore((s) => s.sellStock);

  // Fetch initial yfinance pricing history
  useEffect(() => {
    const fetchData = async () => {
      if (!symbol) return;
      setLoading(true);
      try {
        const { data, error } = await fetchStockData(symbol, days);
        if (error) throw new Error(error);

        if (data?.currentPrice) setCurrentPrice(data.currentPrice);
        const formattedData = (data?.historicalData || []).map(
          (item: { date: string; close: number }) => ({
            date: new Date(item.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            close: item.close,
          })
        );
        setStockData(formattedData);

        // Fetch 60-day forecast trend
        try {
          const forecastRes = await fetchForecast(symbol, 60);
          if (forecastRes && forecastRes.forecast) {
            setForecastData(forecastRes.forecast);
          }
        } catch (fErr) {
          console.error("Failed to fetch forecast:", fErr);
        }
      } catch (err) {
        console.error("Error fetching stock data:", err);
        toast.error("Failed to fetch stock data.");
        setStockData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [symbol, days]);

  // Scroll terminal logs to bottom automatically
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  const addLog = (text: string, type: "info" | "success" | "warn" = "info") => {
    const timeString = new Date().toLocaleTimeString("en-US", { hour12: false });
    setTerminalLogs((prev) => [...prev, { time: timeString, text, type }]);
  };

  // --- Run Multi-Agent Streaming Analysis ---
  const handleRunAgentAnalysis = async () => {
    if (!symbol || !stockData.length) return;

    // Reset Analysis State
    setIsAnalyzing(true);
    setAnalysisReport(null);
    setIndicatorsMetrics(null);
    setSentimentMetrics(null);
    setRiskMetrics(null);
    setRecommendationMetrics(null);
    setTerminalLogs([]);

    const initialStatuses = {
      "Research Agent": "idle",
      "Technical Analyst Agent": "idle",
      "Sentiment Agent": "idle",
      "Risk Agent": "idle",
      "Recommendation Agent": "idle"
    } as any;
    setAgentStatuses(initialStatuses);
    setActiveAgentIndex(0);

    addLog(`🔄 Initializing Multi-Agent Network Core for ${symbol}...`, "info");

    try {
      await runAgentAnalysis(symbol, days, (step) => {
        const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });

        // Handle Agent status and console logging updates
        if (step.agent && step.agent !== "System") {
          // Track index of active agent for UI spotlight
          const agIdx = agentsMeta.findIndex(a => a.id === step.agent);
          if (agIdx !== -1) {
            setActiveAgentIndex(agIdx);
          }

          setAgentStatuses((prev) => ({
            ...prev,
            [step.agent]: step.status === "thinking" ? "thinking" : "completed"
          }));
        }

        const logType = step.status === "completed" ? "success" : step.status === "failed" ? "warn" : "info";
        addLog(`[${step.agent}] ${step.message}`, logType);

        // Map incremental metrics outputs returned by the stream
        if (step.status === "completed" && step.data) {
          if (step.agent === "Technical Analyst Agent") {
            setIndicatorsMetrics(step.data);
          } else if (step.agent === "Sentiment Agent") {
            setSentimentMetrics(step.data);
          } else if (step.agent === "Risk Agent") {
            setRiskMetrics(step.data);
          } else if (step.agent === "Recommendation Agent") {
            setRecommendationMetrics(step.data);
            if (step.data.report) setAnalysisReport(step.data.report);
          }
        }

        // Complete whole sequence
        if (step.agent === "System" && step.status === "finished") {
          setActiveAgentIndex(null);
          setIsAnalyzing(false);
          toast.success(`Multi-agent synthesis complete for ${symbol}!`);

          // Populate complete final values
          if (step.payload) {
            const { indicators, sentiment, risk, recommendation, report } = step.payload;
            if (indicators) setIndicatorsMetrics(indicators);
            if (sentiment) setSentimentMetrics(sentiment);
            if (risk) setRiskMetrics(risk);
            if (recommendation) setRecommendationMetrics(recommendation);
            if (report) setAnalysisReport(report);
          }

          // Refresh the 60-day forecast to synchronize
          try {
            fetchForecast(symbol, 60).then((res) => {
              if (res && res.forecast) setForecastData(res.forecast);
            });
          } catch (fErr) {
            console.error("Failed to refresh forecast:", fErr);
          }
        }
      });
    } catch (err: any) {
      console.error("Multi-agent stream failed:", err);
      setIsAnalyzing(false);
      setActiveAgentIndex(null);
      addLog(`❌ Analysis Pipeline Aborted: ${err.message || String(err)}`, "warn");
      toast.error("Multi-agent analysis failed.", {
        description: "Please check that your FastAPI python-api service is running."
      });
    }
  };

  // Portfolio actions hooks
  const openTrade = async (action: "buy" | "sell") => {
    if (!symbol) return;
    const baseSymbol = symbol.replace(".NS", "");
    const ns = baseSymbol.includes(".") || baseSymbol.includes("-") ? baseSymbol : `${baseSymbol}.NS`;

    const fetched = await fetchPrices([ns]);
    const live = fetched?.[baseSymbol] || prices?.[baseSymbol];
    const priceToUse = live?.price ?? currentPrice?.price ?? 0;
    const stockObj = {
      id: baseSymbol,
      symbol: baseSymbol,
      name: currentPrice?.shortName || currentPrice?.longName || symbol,
      price: priceToUse,
      change: live?.change ?? currentPrice?.diff ?? 0,
      changePercent: live?.changePercent ?? currentPrice?.regularMarketChangePercent ?? 0,
    };
    setSelectedTradeStock(stockObj);
    setTradeAction(action);
    setIsTradeOpen(true);
  };

  const onConfirmTrade = async (qty: number) => {
    if (!selectedTradeStock) return;
    const priceToUse = selectedTradeStock.price;
    let ok = false;
    if (tradeAction === "buy") {
      ok = buyStock(selectedTradeStock, qty, priceToUse);
      if (ok) toast.success(`Bought ${qty} ${selectedTradeStock.symbol} @ ₹${priceToUse.toFixed(2)}`);
      else toast.error("Buy failed: insufficient balance");
    } else {
      ok = sellStock(selectedTradeStock.id, qty, priceToUse);
      if (ok) toast.success(`Sold ${qty} ${selectedTradeStock.symbol} @ ₹${priceToUse.toFixed(2)}`);
      else toast.error("Sell failed: insufficient holdings quantity");
    }

    if (ok) {
      try {
        const portfolio = usePortfolioStore.getState();
        const combined = { ...(prices || {}) };
        const investedValue = portfolio.holdings.reduce((s, h) => {
          const p = combined[h.symbol]?.price ?? h.avgBuyPrice;
          return s + h.quantity * p;
        }, 0);
        usePortfolioStore.getState().addHistoryPoint(investedValue);
      } catch (err) {
        console.error("Failed to append history point", err);
      }
    }
    setIsTradeOpen(false);
    setSelectedTradeStock(null);
  };

  // Build predictions chart sequence (append 60-day predicted trend dynamically with visual standard deviation boundaries)
  const chartData = React.useMemo(() => {
    if (!stockData.length) return [];

    const baseData = stockData.map(item => ({ ...item }));

    if (!forecastData || !forecastData.length) {
      return baseData;
    }

    const lastPoint = baseData[baseData.length - 1];

    // Ensure the last real closing has shadow bounds and prediction value connecting seamlessly to the forecast
    lastPoint.upperConfidence = lastPoint.close;
    lastPoint.lowerConfidence = lastPoint.close;
    lastPoint.prediction = lastPoint.close; // Bridge Predicted Price line to real Close Price

    const forecastPoints = forecastData.map((fPoint) => {
      const formattedDate = new Date(fPoint.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      return {
        date: formattedDate,
        prediction: fPoint.predicted_close, // Unique key!
        upperConfidence: fPoint.upper_bound,
        lowerConfidence: fPoint.lower_bound,
        isForecast: true
      };
    });

    return [...baseData, ...forecastPoints];
  }, [stockData, forecastData]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <NavigationBar />

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Navigation back and selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/predictions")}
            className="w-fit text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Predictions
          </Button>

          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-learngreen-500"
            >
              <option value={30}>30 Days Range</option>
              <option value={60}>60 Days Range</option>
              <option value={90}>90 Days Range</option>
            </select>

            <Button
              onClick={handleRunAgentAnalysis}
              disabled={isAnalyzing || loading}
              className="bg-learngreen-600 hover:bg-learngreen-700 text-white font-semibold shadow-md shadow-learngreen-500/10 flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="border-t-2 border-white rounded-full w-4 h-4 animate-spin" />
                  Terminal Running...
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  Run AI Terminal Analysis
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ================= HEADER CARD ================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-6 rounded-xl shadow-sm gap-6 mb-6">
          <div className="md:col-span-8 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-learngreen-100 dark:bg-learngreen-950/40 text-learngreen-700 dark:text-learngreen-400 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                NSE Listed
              </span>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded">
                EQ
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {symbol}{" "}
              <span className="text-slate-400 dark:text-slate-500 font-medium text-lg block sm:inline">
                {currentPrice?.shortName || currentPrice?.longName || "Asset Exchange Standard"}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <Clock size={12} />
              Real-time feed updated via yfinance analytical scrapers
            </p>
          </div>

          <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
            <div className="text-left md:text-right">
              <div className="text-3xl font-black text-slate-950 dark:text-white">
                ₹{(currentPrice?.price ?? 0).toFixed(2)}
              </div>
              <div
                className={`text-sm font-semibold flex items-center gap-1 mt-0.5 md:justify-end ${(currentPrice?.diff ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
              >
                {(currentPrice?.diff ?? 0) >= 0 ? "+" : ""}
                {(currentPrice?.diff ?? 0).toFixed(2)} (
                {(currentPrice?.regularMarketChangePercent ?? 0).toFixed(2)}%)
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => openTrade("buy")}
                className="bg-learngreen-600 hover:bg-learngreen-700 text-white font-bold h-11 px-5"
              >
                Buy
              </Button>
              <Button
                variant="outline"
                onClick={() => openTrade("sell")}
                className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 h-11 px-5"
              >
                Sell
              </Button>
            </div>
          </div>
        </div>

        {/* ================= MAIN DASHBOARD ROW ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-6">
          {/* LEFT SIDE: CHARTS & COLLABORATIVE NETWORK (col-span-8) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Chart Card */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity size={16} className="text-learngreen-600" />
                    Market Predictive Curve
                  </CardTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    60-day price trends and next-day forecasting shadow channels
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-6 h-80">
                {loading ? (
                  <div className="flex flex-col justify-center items-center h-full gap-2">
                    <div className="loader border-t-2 border-learngreen-600 rounded-full w-8 h-8 animate-spin" />
                    <span className="text-xs text-slate-500">Querying market series...</span>
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={["dataMin - 5", "dataMax + 5"]}
                        tickFormatter={(v) => `₹${Math.round(v)}`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        width={55}
                      />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          borderColor: "#e2e8f0",
                          borderRadius: "8px",
                          color: "#1e293b",
                          fontSize: "12px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
                        }}
                      />
                      {/* Technical Confidence Shadow Overlay */}
                      {forecastData.length > 0 && (
                        <Area
                          type="monotone"
                          dataKey="upperConfidence"
                          dataKey2="lowerConfidence"
                          stroke="none"
                          fill="url(#confidenceBand)"
                          name="95% Confidence shadow"
                          connectNulls
                        />
                      )}
                      {/* Real Prices Area */}
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#colorClose)"
                        name="Close Price"
                        dot={false}
                      />
                      {/* Glowing dashed predictor */}
                      {forecastData.length > 0 && (
                        <Line
                          type="monotone"
                          dataKey="prediction"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          dot={false}
                          activeDot={{ r: 6 }}
                          name="Predicted Price"
                          connectNulls
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-slate-500 flex justify-center items-center h-full text-sm">
                    No ticker history returned. Try an alternative symbol.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI MULTI-AGENT WORKFLOW PANEL */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Cpu size={16} className="text-learngreen-600" />
                      Collaborative Multi-Agent Workspace
                    </CardTitle>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Step-by-step orchestrations of specialized analyst nodes
                    </p>
                  </div>
                  {isAnalyzing && (
                    <span className="text-xs text-learngreen-600 dark:text-learngreen-400 animate-pulse font-bold flex items-center gap-1">
                      <Activity size={12} className="animate-spin" />
                      Orchestrator active...
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Agent Cards Horizontal Row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {agentsMeta.map((agent, index) => {
                    const status = agentStatuses[agent.id];
                    const isActive = activeAgentIndex === index;
                    const AgentIcon = agent.icon;

                    return (
                      <div
                        key={agent.id}
                        className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all duration-300 ${isActive
                            ? "border-learngreen-500/80 bg-learngreen-50/20 dark:bg-learngreen-950/20 shadow-md scale-105"
                            : status === "completed"
                              ? "border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 opacity-90"
                              : "border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-900 opacity-60"
                          }`}
                      >
                        <div
                          className={`p-2.5 rounded-full mb-2 ${isActive
                              ? "bg-learngreen-100 dark:bg-learngreen-950 text-learngreen-600 dark:text-learngreen-400 animate-bounce"
                              : status === "completed"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                : "bg-slate-50 dark:bg-slate-900 text-slate-400"
                            }`}
                        >
                          <AgentIcon size={18} />
                        </div>
                        <div className="text-xs font-bold leading-tight line-clamp-1">
                          {agent.name.split(" ")[0]}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                          {agent.role}
                        </div>
                        <div className="mt-2">
                          {isActive ? (
                            <span className="text-[10px] bg-learngreen-100 dark:bg-learngreen-950/80 text-learngreen-700 dark:text-learngreen-400 font-bold px-1.5 py-0.5 rounded animate-pulse">
                              Active
                            </span>
                          ) : status === "completed" ? (
                            <span className="text-[10px] bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400 font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <CheckCircle size={8} /> Ready
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                              Standby
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Console Log Screen */}
                <div className="bg-slate-950 dark:bg-slate-950 rounded-xl p-4 border border-slate-800/80 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5 font-mono">
                      <Terminal size={12} className="text-learngreen-500" />
                      Live Streamed Agentic Consensus Log
                    </span>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>

                  <div className="font-mono text-[11px] h-44 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                    {terminalLogs.length === 0 ? (
                      <div className="text-slate-600 flex justify-center items-center h-full italic">
                        Terminal is dormant. Trigger analysis above to stream logs.
                      </div>
                    ) : (
                      terminalLogs.map((log, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-slate-500 select-none">[{log.time}]</span>
                          <span
                            className={
                              log.type === "success"
                                ? "text-green-400"
                                : log.type === "warn"
                                  ? "text-yellow-400 font-bold"
                                  : "text-slate-300"
                            }
                          >
                            {log.text}
                          </span>
                        </div>
                      ))
                    )}
                    <div ref={consoleEndRef} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT SIDE: SCORES & TECHNICAL GAUGES (col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* TERMINAL AI SIGNAL SCORE */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles size={16} className="text-learngreen-600" />
                  Terminal Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-col items-center">
                {recommendationMetrics ? (
                  <div className="w-full text-center">
                    <div
                      className={`text-5xl font-black tracking-tighter mb-2 ${recommendationMetrics.signal === "BUY"
                          ? "text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                          : recommendationMetrics.signal === "SELL"
                            ? "text-red-600 dark:text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                            : "text-amber-500 dark:text-amber-400"
                        }`}
                    >
                      {recommendationMetrics.signal}
                    </div>

                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                      Signal Consensus Confidence:{" "}
                      <span className="text-base text-slate-900 dark:text-white font-extrabold ml-1">
                        {recommendationMetrics.confidence}%
                      </span>
                    </div>

                    {/* Progress slider bar representation */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full mt-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${recommendationMetrics.signal === "BUY"
                            ? "bg-emerald-500"
                            : recommendationMetrics.signal === "SELL"
                              ? "bg-red-500"
                              : "bg-amber-500"
                          }`}
                        style={{ width: `${recommendationMetrics.confidence}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-5 text-left border-t border-slate-100 dark:border-slate-800 pt-4">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Short-term outlook
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                          {recommendationMetrics.short_term === "Bullish" ? (
                            <TrendingUp size={12} className="text-emerald-500" />
                          ) : recommendationMetrics.short_term === "Bearish" ? (
                            <TrendingDown size={12} className="text-red-500" />
                          ) : (
                            <ChevronRight size={12} className="text-amber-500" />
                          )}
                          {recommendationMetrics.short_term}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Historical Probability
                        </div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {recommendationMetrics.probability_pct ?? 82}%
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm flex flex-col items-center gap-2">
                    <Info size={24} />
                    Run Terminal analysis to generate AI Consensus Signal
                  </div>
                )}
              </CardContent>
            </Card>

            {/* TECHNICAL STRENGTH PANEL */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Gauge size={16} className="text-learngreen-600" />
                  Technical Analysis Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {indicatorsMetrics ? (
                  <div className="space-y-4">
                    {/* RSI representation */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-500">Relative Strength Index (RSI 14)</span>
                        <span className="font-extrabold text-slate-800 dark:text-white">
                          {indicatorsMetrics.rsi.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full relative">
                        {/* Overlay marker lines */}
                        <div className="absolute left-[30%] top-0 bottom-0 border-l border-slate-300 dark:border-slate-700" />
                        <div className="absolute left-[70%] top-0 bottom-0 border-l border-slate-300 dark:border-slate-700" />
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${indicatorsMetrics.rsi < 30
                              ? "bg-blue-500"
                              : indicatorsMetrics.rsi > 70
                                ? "bg-red-500"
                                : "bg-emerald-500"
                            }`}
                          style={{ width: `${indicatorsMetrics.rsi}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1">
                        <span>OVERSOLD (&lt;30)</span>
                        <span>NEUTRAL</span>
                        <span>OVERBOUGHT (&gt;70)</span>
                      </div>
                    </div>

                    {/* Numeric Indicators Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs font-semibold">
                      <div className="flex justify-between pb-1.5 border-b border-slate-50 dark:border-slate-900/60">
                        <span className="text-slate-400">MACD Histogram</span>
                        <span className={indicatorsMetrics.macd_hist >= 0 ? "text-emerald-500" : "text-red-500"}>
                          {indicatorsMetrics.macd_hist.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between pb-1.5 border-b border-slate-50 dark:border-slate-900/60">
                        <span className="text-slate-400">10-Day Momentum</span>
                        <span>{indicatorsMetrics.momentum.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">20-Day SMA</span>
                        <span>₹{indicatorsMetrics.sma20.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">50-Day SMA</span>
                        <span>₹{indicatorsMetrics.sma50.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm flex flex-col items-center gap-2">
                    <Info size={24} />
                    Run Terminal analysis to load technical gauges
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SENTIMENT NEWS BREAKDOWN */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Newspaper size={16} className="text-learngreen-600" />
                  Sentiment & News Index
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {sentimentMetrics ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 justify-between">
                      <div className="w-16 h-16 rounded-full border-[5px] border-emerald-500/80 border-t-red-500 flex items-center justify-center font-black text-lg text-slate-900 dark:text-white relative">
                        {sentimentMetrics.score.toFixed(0)}
                      </div>
                      <div className="flex-1 space-y-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span className="text-emerald-500 flex items-center gap-1">🟢 Positive</span>
                          <span>{sentimentMetrics.positive} articles</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 flex items-center gap-1">⚪ Neutral</span>
                          <span>{sentimentMetrics.neutral} articles</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-500 flex items-center gap-1">🔴 Negative</span>
                          <span>{sentimentMetrics.negative} articles</span>
                        </div>
                      </div>
                    </div>

                    {/* Headline feeds */}
                    {sentimentMetrics.news && sentimentMetrics.news.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Processed Headlines:
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                          {sentimentMetrics.news.slice(0, 3).map((n: any, nIdx: number) => (
                            <a
                              href={n.link}
                              target="_blank"
                              rel="noreferrer"
                              key={nIdx}
                              className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-learngreen-600 leading-normal hover:underline"
                            >
                              📰 {n.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm flex flex-col items-center gap-2">
                    <Info size={24} />
                    Run Terminal analysis to read sentiment matrix
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RISK & VOLATILITY MATRIX */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/60">
              <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Shield size={16} className="text-learngreen-600" />
                  Risk Volatility Matrix
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {riskMetrics ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-100 dark:border-slate-900">
                      <span className="text-xs font-semibold text-slate-500">Risk Classification</span>
                      <span
                        className={`text-sm font-extrabold px-2 py-0.5 rounded ${riskMetrics.risk_class === "Low"
                            ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                            : riskMetrics.risk_class === "High"
                              ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                          }`}
                      >
                        {riskMetrics.risk_class} Risk
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <div className="bg-slate-50/40 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Beta Coefficient</div>
                        <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                          {riskMetrics.beta.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-slate-50/40 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Historical Volatility</div>
                        <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                          {riskMetrics.volatility.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-slate-50/40 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Value at Risk (95% VaR)</div>
                        <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                          -{riskMetrics.var_95_pct}%
                        </div>
                      </div>
                      <div className="bg-slate-50/40 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Peak Drawdown Est.</div>
                        <div className="text-base font-black text-slate-950 dark:text-white mt-0.5">
                          -{riskMetrics.max_drawdown_est_pct}%
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm flex flex-col items-center gap-2">
                    <Info size={24} />
                    Run Terminal analysis to evaluate asset risks
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ================= DYNAMIC INVESTMENT PROSPECTUS REPORT VIEWER ================= */}
        <AnimatePresence>
          {analysisReport && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="mt-6"
            >
              <Card className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-md p-6 sm:p-8 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                  <div className="p-2 bg-learngreen-100 dark:bg-learngreen-950/60 rounded-lg text-learngreen-600">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-950 dark:text-white leading-none">
                      Lead Agent Analyst Consensus
                    </h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                      Synthesized Investment Prospectus Report Summary
                    </p>
                  </div>
                </div>

                <div className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 select-text selection:bg-learngreen-100 dark:selection:bg-learngreen-900/50">
                  {renderMarkdownToJSX(analysisReport)}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trade Execution Dialog */}
        <TradeDialog
          open={isTradeOpen}
          onOpenChange={setIsTradeOpen}
          stock={selectedTradeStock}
          action={tradeAction}
          onConfirm={onConfirmTrade}
        />
      </main>
    </div>
  );
};

export default StockDetail;
