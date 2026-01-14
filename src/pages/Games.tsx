import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import NavigationBar from "@/components/NavigationBar";
import StockQuiz from "@/components/StockQuiz";
import KnowledgeProgressChart from "@/components/KnowledgeProgressChart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  GamepadIcon,
  Trophy,
  BookOpen,
  Brain,
  Timer,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Loader2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { Quiz, QuizQuestion } from "@/types";
import TradeDialog from "@/components/TradeDialog";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { useBalanceStore } from "@/stores/balanceStore";
import { useAuth } from "@/contexts/AuthContext";
import StockCard from "@/components/StockCard";
import useLivePrices from "@/hooks/useLivePrices";
import { useMarketChallengeStore } from "@/stores/marketChallengeStore";
import type { PredictionDirection } from "@/stores/marketChallengeStore";
import { supabase } from "@/integrations/supabase/client";
import { useGamePointsStore } from "@/stores/gamePointsStore";
import { isNSEMarketOpen } from "@/lib/marketHours";
import {
  calculateQuizActivityScore,
  detectOverallTrend,
  fetchKnowledgeProgressSeries,
  logGameActivity,
  updateKnowledgeProgress,
} from "@/lib/knowledgeProgress";
import type {
  DifficultyLevel,
  KnowledgeProgressPoint,
  KnowledgeTrend,
} from "@/types";
import { FALLBACK_QUESTIONS_BASICS, FALLBACK_QUESTIONS_TECHNICAL, FALLBACK_QUESTIONS_NEWS } from "@/data/fallbackQuizzes";

// == DYNAMIC CONFIGURATION ==

// A larger pool of stocks to pick from randomly for the "Prediction Game"
const MASTER_STOCK_UNIVERSE = [
  "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "HINDUNILVR.NS",
  "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS", "LT.NS", "BAJFINANCE.NS",
  "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "WIPRO.NS", "ADANIENT.NS",
  "ULTRACEMCO.NS", "NESTLEIND.NS", "ONGC.NS", "TITAN.NS", "SUNPHARMA.NS",
  "NTPC.NS", "POWERGRID.NS", "TATASTEEL.NS", "JSWSTEEL.NS", "M&M.NS",
  "LTIM.NS", "HCLTECH.NS", "COALINDIA.NS", "TATAMOTORS.NS", "PIDILITIND.NS"
];

const getRandomSubarray = (arr: string[], size: number) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
};

// Lightweight type for search-assets results
interface SearchAssetResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: "EQUITY" | "ETF" | "MUTUALFUND" | "INDEX" | "CURRENCY" | "FUTURE";
  exchange: string;
}

type BasicStock = { symbol: string; name?: string };

const Games = () => {
  const location = useLocation();
  const initialCategory = location.state?.activeTab || "quizzes";

  const { user } = useAuth();

  // -- STATE --
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);

  // Quiz State
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Prediction / Simulator State
  const [predictionStocks, setPredictionStocks] = useState<BasicStock[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchAssetResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const [isTradeDialogOpen, setIsTradeDialogOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");

  // Stores & Hooks
  const buyStock = usePortfolioStore((s) => s.buyStock);
  const trades = usePortfolioStore((s) => s.trades);
  const { addToBalance } = useBalanceStore();

  // Live Prices - Initialize with empty, populate via effect
  const { prices, fetchPrices, setSymbols } = useLivePrices([], 5000);

  const predictions = useMarketChallengeStore((s) => s.predictions);
  const addPrediction = useMarketChallengeStore((s) => s.addPrediction);
  const evaluatePredictions = useMarketChallengeStore((s) => s.evaluatePredictions);
  const clearAllPredictions = useMarketChallengeStore((s) => s.clearAll);

  const events = useGamePointsStore((s) => s.events);
  const addGamePointEvent = useGamePointsStore((s) => s.addEvent);
  const todayPointsISO = new Date().toISOString().slice(0, 10);
  const todayPoints = events
    .filter((e) => e.dateISO === todayPointsISO)
    .reduce((sum, e) => sum + e.points, 0);
  const marketOpen = isNSEMarketOpen();

  // Knowledge Progress
  const [knowledgeSeries, setKnowledgeSeries] = useState<KnowledgeProgressPoint[]>([]);
  const [knowledgeTrend, setKnowledgeTrend] = useState<KnowledgeTrend | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  // -- EFFECTS --

  // 1. Initialize Random Stock Universe
  useEffect(() => {
    // Pick 12 random stocks for this session
    const subset = getRandomSubarray(MASTER_STOCK_UNIVERSE, 12);
    const mapped = subset.map(s => ({
      symbol: s.replace(".NS", ""),
      name: s.replace(".NS", "") // Name will be updated by live price fetch if possible
    }));
    setPredictionStocks(mapped);

    // Subscribe to these symbols
    setSymbols(subset);
  }, [setSymbols]);

  // 2. Fetch Knowledge Progress
  const refreshKnowledgeProgress = useCallback(async () => {
    if (!user) return;
    setKnowledgeLoading(true);
    try {
      const series = await fetchKnowledgeProgressSeries(user.id);
      setKnowledgeSeries(series);
      const trend = series.length > 0 ? detectOverallTrend(series) : "stagnant";
      setKnowledgeTrend(trend);
    } catch (err) {
      console.error("Failed to fetch knowledge progression", err);
    } finally {
      setKnowledgeLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshKnowledgeProgress();
    else {
      setKnowledgeSeries([]);
      setKnowledgeTrend(null);
    }
  }, [user, refreshKnowledgeProgress]);

  // 3. Handle Tab Change from Router
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveCategory(location.state.activeTab);
    }
  }, [location.state]);

  // 4. Search Assets
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      // Revert to random universe if search cleared
      setSymbols(predictionStocks.map(s => s.symbol.includes(".NS") ? s.symbol : `${s.symbol}.NS`));
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("search-assets", {
          body: { query: searchQuery },
        });
        if (error) throw error;
        setSearchResults((data?.quotes || []) as SearchAssetResult[]);

        const equitySymbols = (data?.quotes || [])
          .filter((q: SearchAssetResult) => q.quoteType === "EQUITY")
          .map((q: SearchAssetResult) =>
            q.symbol.endsWith(".NS") ? q.symbol : `${q.symbol}.NS`
          );
        if (equitySymbols.length) setSymbols(equitySymbols);
      } catch (err) {
        console.error("Games search error:", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, setSymbols, predictionStocks]);

  // -- HELPER LOGIC --

  const filteredStocks = useMemo(() => {
    if (!searchQuery) return predictionStocks;
    if (!searchResults.length) return [];

    const equities = searchResults.filter(
      (r) =>
        r.quoteType === "EQUITY" &&
        (r.exchange?.toUpperCase().includes("NSE") || r.symbol.endsWith(".NS"))
    );

    return equities.map((r) => {
      const base = r.symbol.replace(/\.NS$/i, "");
      return {
        symbol: base,
        name: r.shortname || r.longname || base,
      } as BasicStock;
    });
  }, [searchQuery, searchResults, predictionStocks]);

  const getDayChangePercent = useCallback(async (symbol: string, dateISO: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-stock-data", {
        body: { symbol: `${symbol}.NS`, days: 14 }
      });
      if (error || !data?.historicalData) return null;
      const hist = (data.historicalData as any[])
        .map((h) => ({
          date: new Date(h.date).toISOString().slice(0, 10),
          close: h.close as number,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const idx = hist.findIndex((h) => h.date === dateISO);
      if (idx <= 0) return null;
      return ((hist[idx].close - hist[idx - 1].close) / hist[idx - 1].close) * 100;
    } catch {
      return null;
    }
  }, []);

  const handleEvaluateNow = () => {
    if (marketOpen) {
      toast.info("Evaluation is available only after market close (15:30 IST).");
      return;
    }
    evaluatePredictions(getDayChangePercent).then(() => {
      if (user) refreshKnowledgeProgress();
    });
  };

  const generateAndStartQuiz = async (category: "basics" | "technical" | "news") => {
    setIsGeneratingQuiz(true);
    let topic = "Stock Market Basics";
    if (category === "technical") topic = "Technical Analysis";
    if (category === "news") topic = "Market News and Current Events";

    try {

      // Use Python Backend for generation (Local "Online Mode")
      const response = await fetch('/py-api/generate_quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty: "Medium" })
      });

      if (!response.ok) throw new Error("API call failed");
      const data = await response.json();

      if (data && data.questions) {
        const newQuiz: Quiz = {
          id: category,
          title: `${topic} (AI Generated)`,
          description: "Freshly generated questions just for you.",
          points: 500,
          questions: data.questions,
          totalQuestionsToAsk: 5
        };
        setSelectedQuiz(newQuiz);
        setIsQuizDialogOpen(true);
        toast.success("Quiz generated successfully!");
      }
    } catch (err) {
      console.error("Quiz generation failed (using fallback):", err);
      toast.info("AI unavailable. Switching to Offline Quiz Mode.");

      // Fallback Logic
      let fallbackQuestions = FALLBACK_QUESTIONS_BASICS;
      if (category === "technical") fallbackQuestions = FALLBACK_QUESTIONS_TECHNICAL;
      if (category === "news") fallbackQuestions = FALLBACK_QUESTIONS_NEWS;

      const newQuiz: Quiz = {
        id: category,
        title: `${topic} (Offline Mode)`,
        description: "Classic questions to test your knowledge.",
        points: 500,
        questions: fallbackQuestions
      };

      // Add a small delay to simulate loading
      setTimeout(() => {
        setSelectedQuiz(newQuiz);
        setIsQuizDialogOpen(true);
      }, 500);

    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleQuizComplete = async (score: number) => {
    if (!selectedQuiz || !user) return;
    const totalQuestions = (selectedQuiz as any).totalQuestionsToAsk || selectedQuiz.questions.length;
    const percentCorrect = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    const earnedPoints = Math.round((percentCorrect / 100) * selectedQuiz.points);

    addToBalance(earnedPoints);
    try {
      addGamePointEvent({ source: "quiz", label: selectedQuiz.title, points: earnedPoints });
    } catch { }

    toast.success(`Quiz Complete! You earned ${earnedPoints} points! 🏆`);

    // Save completion
    const today = new Date().toDateString();
    localStorage.setItem(`quiz_completed_${selectedQuiz.id}_${today}_${user.id}`, "true");

    // Log progress
    try {
      const difficulty = "medium";
      const activityScore = calculateQuizActivityScore(percentCorrect, difficulty);
      await logGameActivity({
        gameType: "quiz",
        gameId: selectedQuiz.id,
        difficultyLevel: difficulty,
        score: activityScore,
        outcome: "completed",
        metadata: { title: selectedQuiz.title, percentCorrect, totalQuestions },
      });
      await updateKnowledgeProgress({ source: "quiz", gameScore: activityScore, difficultyLevel: difficulty });
      await refreshKnowledgeProgress();
    } catch (e) { console.error(e); }

    setTimeout(() => {
      setIsQuizDialogOpen(false);
      setSelectedQuiz(null);
    }, 3000);
  };

  // -- SUBCOMPONENTS -- (Defined here to access closure scope easily)

  const PredictionsList: React.FC<{ prices: any }> = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your Predictions</CardTitle>
          <CardDescription>Status and results for today & previous days</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEvaluateNow} disabled={marketOpen}>
            <RefreshCw className="h-4 w-4 mr-1" /> Evaluate
          </Button>
          <Button variant="ghost" onClick={clearAllPredictions}>Clear</Button>
        </div>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No predictions yet.</div>
        ) : (
          <div className="space-y-2">
            {predictions.map((p) => {
              const isCorrect = p.correct;
              return (
                <div key={p.id} className="p-2 border rounded flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">{p.dateISO}</span>
                    <div className="font-medium">{p.symbol}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`font-semibold ${p.direction === "UP" ? "text-green-600" : "text-red-600"}`}>
                      {p.direction}
                    </div>
                    {p.resolved ? (
                      <div className={`text-sm ${isCorrect ? "text-green-700" : "text-orange-600"}`}>
                        {isCorrect ? "+500" : "-100"} pts
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Pending</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const PredictionPicker: React.FC<{ filteredStocks: any[]; prices: any }> = ({ filteredStocks, prices }) => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {filteredStocks.slice(0, 8).map((stock) => {
          const live = prices[stock.symbol];
          const price = live ? live.price : 0;
          const already = predictions.some(
            (p) => p.symbol === stock.symbol && p.dateISO === todayISO && !p.resolved
          );
          const place = (dir: PredictionDirection) => {
            if (!marketOpen) {
              toast.info("Market is closed. Predictions allowed 09:15–15:30 IST (Mon–Fri)");
              return;
            }
            if (already) {
              toast.info(`Already predicted for ${stock.symbol} today.`);
              return;
            }
            addPrediction({ symbol: stock.symbol, dateISO: todayISO, direction: dir });
            toast.success(`Prediction placed: ${stock.symbol} ${dir}`);
          };
          return (
            <div key={stock.symbol} className="p-3 border rounded flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{stock.symbol}</div>
                <div className="text-sm text-gray-500">{live?.name || stock.name}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{price ? `₹${price.toFixed(2)}` : "—"}</div>
                <div className="text-xs text-gray-500">Today</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={already || !marketOpen} onClick={() => place("UP")}>
                  <TrendingUp className="h-4 w-4 mr-1" /> Up
                </Button>
                <Button size="sm" variant="destructive" disabled={already || !marketOpen} onClick={() => place("DOWN")}>
                  <TrendingDown className="h-4 w-4 mr-1" /> Down
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // -- RENDER --

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <main className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Games & Quizzes</h1>
          <div className="bg-learngreen-100 px-4 py-2 rounded-lg flex items-center shadow-sm">
            <Trophy className="h-5 w-5 text-learngreen-600 mr-2" />
            <span className="font-semibold text-learngreen-700">{todayPoints} Points Earned Today</span>
          </div>
        </div>

        {user && (
          <div className="mb-6">
            <KnowledgeProgressChart data={knowledgeSeries} trend={knowledgeTrend} loading={knowledgeLoading} />
          </div>
        )}

        {!marketOpen && (
          <div className="mb-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-3">
            Market Closed • Predictions and trades allowed 09:15–15:30 IST (Mon–Fri)
          </div>
        )}

        {/* Category Tabs */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[
            { id: "quizzes", title: "Knowledge Quizzes", icon: BookOpen, desc: "AI-Generated challenges." },
            { id: "simulator", title: "Trading Simulator", icon: Brain, desc: "Practice with virtual money." },
            { id: "challenges", title: "Market Challenges", icon: Timer, desc: "Timed prediction games." }
          ].map((cat) => (
            <Card
              key={cat.id}
              className={`text-center transition-all cursor-pointer ${activeCategory === cat.id ? "border-2 border-learngreen-500 shadow-lg" : "hover:shadow-md"}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <CardHeader>
                <div className="flex justify-center mb-2">
                  <div className="bg-learngreen-100 p-3 rounded-full">
                    <cat.icon className="h-8 w-8 text-learngreen-600" />
                  </div>
                </div>
                <CardTitle>{cat.title}</CardTitle>
                <CardDescription>{cat.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* QUIZZES TAB */}
        {activeCategory === "quizzes" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-semibold">Daily AI Quizzes</h2>
              <Badge className="bg-purple-100 text-purple-700"><Sparkles className="w-3 h-3 mr-1" /> AI Powered</Badge>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { id: "basics", title: "Market Basics", desc: "Fundamental concepts generated by AI.", points: 500 },
                { id: "technical", title: "Technical Analysis", desc: "Charts & patterns generated by AI.", points: 750 },
                { id: "news", title: "Market News", desc: "Daily financial news & events quiz.", points: 600 }
              ].map((q) => {
                const today = new Date().toDateString();
                const completedKey = `quiz_completed_${q.id}_${today}_${user?.id}`;
                const completedToday = localStorage.getItem(completedKey) === "true";

                return (
                  <Card key={q.id} className={completedToday ? "bg-gray-100 opacity-80" : ""}>
                    <CardHeader>
                      <div className="flex justify-between">
                        <CardTitle>{q.title}</CardTitle>
                        {completedToday && <Badge variant="outline">Completed</Badge>}
                      </div>
                      <CardDescription>{q.desc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span>5 Questions</span>
                        <span className="font-semibold text-learngreen-700">{q.points} pts</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full bg-learngreen-600"
                        disabled={completedToday || isGeneratingQuiz}
                        onClick={() => generateAndStartQuiz(q.id as any)}
                      >
                        {isGeneratingQuiz ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {isGeneratingQuiz ? "Generating..." : (completedToday ? "Check back tomorrow" : "Start Quiz")}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* SIMULATOR TAB */}
        {activeCategory === "simulator" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trading Simulator</CardTitle>
                <CardDescription>Search stocks and buy with your virtual balance.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <input
                    className="w-full border p-2 rounded"
                    placeholder="Search by symbol or name (e.g. RELIANCE)"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {filteredStocks.map((stock) => {
                    const live = prices[stock.symbol];
                    const display = {
                      id: stock.symbol,
                      symbol: stock.symbol,
                      name: live?.name || stock.name || stock.symbol,
                      price: live?.price || 0,
                      change: live?.change || 0,
                      changePercent: live?.changePercent || 0,
                      volume: 0,
                      marketCap: 0,
                      sector: "",
                    } as any;
                    return (
                      <div key={stock.symbol} onClick={() => { setSelectedStock(display); setTradeAction("buy"); setIsTradeDialogOpen(true); }}>
                        <StockCard stock={display} />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Recent Trades</CardTitle></CardHeader>
              <CardContent>
                {trades.length === 0 ? <div className="text-center text-gray-500 py-8">No trades yet.</div> : (
                  <div className="space-y-3">
                    {trades.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <div className="font-medium">{t.symbol} • {t.type}</div>
                          <div className="text-sm text-gray-500">{new Date(t.date).toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div>Qty: {t.quantity}</div>
                          <div>₹{t.price.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <TradeDialog
              open={isTradeDialogOpen}
              onOpenChange={setIsTradeDialogOpen}
              stock={selectedStock}
              action={tradeAction}
              onConfirm={(qty) => {
                if (!selectedStock) return;
                if (tradeAction === "buy") {
                  (async () => {
                    const symbolWithNs = `${selectedStock.symbol}.NS`;
                    const fetched = await fetchPrices([symbolWithNs]);
                    const live = fetched[selectedStock.symbol] || prices[selectedStock.symbol];
                    const priceToUse = live ? live.price : selectedStock.price;
                    const ok = buyStock(selectedStock, qty, priceToUse);
                    if (ok) {
                      toast.success(`Bought ${qty} ${selectedStock.symbol} @ ₹${priceToUse.toFixed(2)}`);
                      try {
                        usePortfolioStore.getState().addHistoryPoint(0); // Trigger history update logic roughly
                      } catch { }
                    } else toast.error("Insufficient balance");
                  })();
                }
                setIsTradeDialogOpen(false);
              }}
            />
          </div>
        )}

        {/* CHALLENGES TAB */}
        {activeCategory === "challenges" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Direction Prediction</CardTitle>
                <CardDescription>Predict if a stock will close UP or DOWN today. Correct: +500 • Wrong: -100</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <input
                    className="w-full border p-2 rounded"
                    placeholder="Search stock (e.g. RELIANCE)"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </div>
                <PredictionPicker filteredStocks={filteredStocks} prices={prices} />
              </CardContent>
            </Card>
            <PredictionsList prices={prices} />
          </div>
        )}
      </main>

      <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col bg-white">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>{selectedQuiz?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4 overflow-y-auto">
            {selectedQuiz && (
              <StockQuiz quiz={selectedQuiz} onComplete={handleQuizComplete} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Games;
