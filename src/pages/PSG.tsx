import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sparkles, BarChart, Briefcase, Upload, Loader2 } from "lucide-react";
import NavigationBar from "@/components/NavigationBar";
import { toast } from "sonner";
import { usePortfolioStore } from "@/stores/portfolioStore";
import useLivePrices from "@/hooks/useLivePrices";

const COLORS = [
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
  "#F97316",
  "#84CC16",
  "#CBD5E1",
];

// Types for Python API Response
interface AnalysisResult {
  summary: {
    total_invested: number;
    total_current: number;
    total_pnl: number;
    total_pnl_pct: number;
    largest_holding: { symbol: string; allocation_pct: number } | null;
  };
  portfolio_health: {
    score: number;
    components: {
      concentration_score: number;
      diversification_score: number;
      fragmentation_score: number;
      dominance_score: number;
    };
  };
  holdings: Array<{
    symbol: string;
    quantity: number;
    avg_price: number;
    current_price: number;
    invested_value: number;
    current_value: number;
    pnl: number;
    pnl_pct: number;
    allocation_pct: number;
  }>;
  allocation: Array<{ symbol: string; allocation_pct: number }>;
  suggestions: {
    buy: Array<any>;
    hold: Array<any>;
    reduce: Array<any>;
  };
}

const CountingNumber = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  React.useEffect(() => {
    const duration = 2000;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      setDisplay(Math.floor(value * ease));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplay(value);
      }
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{display}</>;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 60, damping: 12 },
  },
};

const PSG = () => {
  const { user } = useAuth();

  // -- Analyzer State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [file, setFile] = useState<File | null>(null);

  // -- Hooks
  const portfolioHoldings = usePortfolioStore((s) => s.holdings);
  const { fetchPrices } = useLivePrices([], 0); // Manual fetch only for virtual portfolio

  const chartData = useMemo(() => {
    if (!analysisResult?.allocation) return [];

    // Filter out potential pre-existing "Others" component from backend/CSV
    const cleanData: typeof analysisResult.allocation = [];
    let preExistingOthers = 0;

    analysisResult.allocation.forEach((item) => {
      if (item.symbol.toUpperCase() === "OTHERS") {
        preExistingOthers += item.allocation_pct;
      } else {
        cleanData.push(item);
      }
    });

    let data = cleanData.sort((a, b) => b.allocation_pct - a.allocation_pct);

    // If we have more than 10 stocks OR we laid aside some "Others" already
    if (data.length > 10 || preExistingOthers > 0) {
      const top = data.slice(0, 10);
      const others = data.slice(10);
      const othersSum =
        others.reduce((sum, item) => sum + item.allocation_pct, 0) +
        preExistingOthers;

      if (othersSum > 0) {
        data = [...top, { symbol: "Others", allocation_pct: othersSum }];
      }
    }
    return data;
  }, [analysisResult]);

  React.useEffect(() => {
    if (
      analysisResult?.portfolio_health?.score &&
      analysisResult.portfolio_health.score >= 80
    ) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10B981", "#3B82F6", "#F59E0B"],
      });
    }
  }, [analysisResult]);

  // ---------------------------------------------
  // Analyzer Logic
  // ---------------------------------------------

  const performAnalysis = async (formData: FormData) => {
    setAnalyzing(true);
    try {
      // In development we use the Vite proxy `/py-api`.
      // In production, configure VITE_PY_API_BASE_URL to point to the
      // deployed FastAPI base URL (e.g. https://your-api.example.com).
      const base = (import.meta as any).env?.VITE_PY_API_BASE_URL || "/py-api";
      const url = `${base.replace(/\/$/, "")}/analyze`;

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 25000); // 25s safety timeout

      const res = await fetch(url, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      // Read body once and try to parse JSON; this avoids calling
      // res.json() on empty/non-JSON responses which can throw the
      // "Unexpected end of JSON input" error in production.
      const text = await res.text();
      let payload: any = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          // leave payload as null if not valid JSON
        }
      }

      if (!res.ok) {
        const message =
          (payload && (payload.detail || payload.message)) ||
          text ||
          `HTTP ${res.status}`;
        throw new Error(message);
      }

      if (!payload) {
        throw new Error("Analyzer returned an empty or invalid response.");
      }

      const data: AnalysisResult = payload;
      setAnalysisResult(data);
      toast.success("Portfolio analysis complete!");
    } catch (err: any) {
      console.error("Analysis Error:", err);
      const msg =
        err?.name === "AbortError"
          ? "Analyzer timed out. Please try again in a moment."
          : err?.message || String(err);
      toast.error(`Analysis failed: ${msg}`);
    } finally {
      // Clear timeout and reset state
      // (no-op if controller already aborted)
      try {
        if (typeof window !== "undefined") {
          window.clearTimeout?.(timeoutId as any);
        }
      } catch {}
      setAnalyzing(false);
    }
  };

  const analyzeVirtualPortfolio = async () => {
    if (portfolioHoldings.length === 0) {
      toast.error(
        "Your virtual portfolio is empty! Buy some stocks first or upload a CSV."
      );
      return;
    }

    setAnalyzing(true);
    toast.info("Fetching latest prices for accuracy...");

    try {
      // 1. Get Live Prices
      const symbols = portfolioHoldings.map((h) =>
        h.symbol.includes(".NS") ? h.symbol : `${h.symbol}.NS`
      );
      const priceMap = await fetchPrices(symbols);

      // 2. Construct CSV content
      // Header: symbol,quantity,avg_price,current_price
      let csvContent = "symbol,quantity,avg_price,current_price\n";

      portfolioHoldings.forEach((h) => {
        // Strip .NS for display/csv consistency if needed, but Python handles it.
        // We'll strip .NS for symbol to look cleaner.
        const cleanSymbol = h.symbol.replace(".NS", "");
        const priceObj =
          priceMap[cleanSymbol] ||
          priceMap[`${cleanSymbol}.NS`] ||
          priceMap[h.symbol];
        const currentPrice = priceObj ? priceObj.price : h.avgBuyPrice; // Fallback to buy price if fetch fails

        csvContent += `${cleanSymbol},${h.quantity},${h.avgBuyPrice},${currentPrice}\n`;
      });

      // 3. Create File object
      const blob = new Blob([csvContent], { type: "text/csv" });
      const file = new File([blob], "virtual_portfolio.csv", {
        type: "text/csv",
      });

      const formData = new FormData();
      formData.append("file", file);

      // 4. Send
      await performAnalysis(formData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to prepare portfolio data.");
      setAnalyzing(false);
    }
  };

  const analyzeUploadedFile = async () => {
    if (!file) {
      toast.error("Please select a CSV file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    await performAnalysis(formData);
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setFile(null);
  };

  // ---------------------------------------------
  // Render Helpers
  // ---------------------------------------------

  const getColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-600";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart className="h-8 w-8 text-learngreen-600" />
              Portfolio Analyzer
            </h1>
            <p className="text-gray-600 mt-1">
              Deep analysis and health check for your investments.
            </p>
          </div>
        </div>

        {/* ANALYZER CONTENT */}
        <div className="space-y-6">
          {!analysisResult ? (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Analyze Virtual Portfolio */}
              <Card className="border-2 border-learngreen-50 bg-learngreen-50/10 hover:border-learngreen-200 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-learngreen-600" />{" "}
                    Virtual Portfolio
                  </CardTitle>
                  <CardDescription>
                    Analyze the stocks you hold in LearnStocks simulator.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-4">
                    You currently have{" "}
                    <strong>{portfolioHoldings.length}</strong> active
                    positions.
                  </div>
                  <Button
                    onClick={analyzeVirtualPortfolio}
                    disabled={analyzing}
                    className="w-full bg-learngreen-600 hover:bg-learngreen-700"
                  >
                    {analyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Analyze My Portfolio
                  </Button>
                </CardContent>
              </Card>

              {/* Upload External CSV */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" /> Upload Broker CSV
                  </CardTitle>
                  <CardDescription>
                    Analyze an external portfolio (Zerodha, Groww format).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-dashed rounded bg-gray-50 text-center text-sm text-gray-500">
                    CSV must have:{" "}
                    <code>symbol, quantity, avg_price, current_price</code>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                  </div>
                  <Button
                    onClick={analyzeUploadedFile}
                    disabled={!file || analyzing}
                    variant="secondary"
                    className="w-full"
                  >
                    {analyzing ? "Analyzing..." : "Upload & Analyze"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Briefcase className="h-6 w-6 text-primary" />
                  Portfolio Diagnosis
                </h2>
                <Button
                  variant="outline"
                  onClick={resetAnalysis}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Run New Analysis
                </Button>
              </div>

              {/* Health Score */}
              <motion.div
                variants={itemVariants}
                className="grid md:grid-cols-2 gap-6"
              >
                {/* Health Score */}
                <motion.div whileHover={{ scale: 1.02 }} className="h-full">
                  <Card className="h-full shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle>Health Score</CardTitle>
                      <CardDescription>
                        Composite variance & risk score
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center py-6">
                      <div
                        className={`text-5xl font-bold mb-2 ${getColor(
                          analysisResult.portfolio_health.score
                        )}`}
                      >
                        <CountingNumber
                          value={analysisResult.portfolio_health.score}
                        />
                        /100
                      </div>
                      <Progress
                        value={analysisResult.portfolio_health.score}
                        className={`h-3 w-full max-w-md ${getProgressColor(
                          analysisResult.portfolio_health.score
                        )}`}
                      />

                      <div className="grid grid-cols-2 gap-4 mt-8 w-full">
                        {Object.entries(
                          analysisResult.portfolio_health.components
                        )
                          .slice(0, 4)
                          .map(([key, val]) => (
                            <div
                              key={key}
                              className="text-center p-3 bg-gray-50 rounded"
                            >
                              <div className="text-xs text-gray-500 uppercase mb-1">
                                {key.replace("_score", "")}
                              </div>
                              <div className="font-semibold">
                                {val as number}/100
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Allocation Chart */}
                <motion.div whileHover={{ scale: 1.02 }} className="h-full">
                  <Card className="flex flex-col h-full shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle>Allocation</CardTitle>
                      <CardDescription>
                        Top 10 Holdings Breakdown
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="allocation_pct"
                            nameKey="symbol"
                            animationDuration={1500}
                          >
                            {chartData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: number) => `${val.toFixed(1)}%`}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Suggestions */}
              <motion.div
                variants={itemVariants}
                className="grid md:grid-cols-3 gap-6"
              >
                <motion.div
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="h-full"
                >
                  <Card className="border-l-4 border-l-green-500 h-full shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="text-green-700">
                        Buy / Add
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analysisResult.suggestions.buy.length ? (
                        <ul className="space-y-2">
                          {analysisResult.suggestions.buy.map((s: any) => (
                            <li
                              key={s.symbol}
                              className="flex justify-between border-b pb-1"
                            >
                              <span>{s.symbol}</span>{" "}
                              <span className="text-green-600 text-sm font-medium">
                                Underweight
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-500">
                          No immediate buy signals.
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="h-full"
                >
                  <Card className="border-l-4 border-l-yellow-500 h-full shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="text-yellow-700">Hold</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-600">
                        {analysisResult.suggestions.hold.length > 0 ? (
                          <>
                            {analysisResult.suggestions.hold
                              .slice(0, 5)
                              .map((s: any) => s.symbol)
                              .join(", ")}
                            {analysisResult.suggestions.hold.length > 5 &&
                              "..."}
                          </>
                        ) : (
                          <span className="text-gray-500">
                            No specific hold recommendations.
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="h-full"
                >
                  <Card className="border-l-4 border-l-red-500 h-full shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="text-red-700">
                        Reduce Risk
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analysisResult.suggestions.reduce.length ? (
                        <ul className="space-y-2">
                          {analysisResult.suggestions.reduce.map((s: any) => (
                            <li
                              key={s.symbol}
                              className="flex justify-between border-b pb-1"
                            >
                              <span>{s.symbol}</span>{" "}
                              <span className="text-red-600 text-sm font-medium">
                                Overweight
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-500">
                          Allocation looks balanced.
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Holdings Table */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader>
                    <CardTitle>Holdings Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-2 text-left">Symbol</th>
                            <th className="p-2 text-right">Inv. Value</th>
                            <th className="p-2 text-right">Curr. Value</th>
                            <th className="p-2 text-right">PnL</th>
                            <th className="p-2 text-right">Alloc %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisResult.holdings.map((h) => (
                            <tr
                              key={h.symbol}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="p-2 font-medium">{h.symbol}</td>
                              <td className="p-2 text-right">
                                ₹{h.invested_value.toFixed(0)}
                              </td>
                              <td className="p-2 text-right">
                                ₹{h.current_value.toFixed(0)}
                              </td>
                              <td
                                className={`p-2 text-right font-medium ${
                                  h.pnl >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {h.pnl_pct.toFixed(2)}%
                              </td>
                              <td className="p-2 text-right">
                                {h.allocation_pct.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PSG;
