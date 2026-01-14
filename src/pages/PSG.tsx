import React, { useState, useEffect } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { UserProfile, StockSuggestion } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  RefreshCw,
  BarChart,
  Briefcase,
  Upload,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Loader2
} from "lucide-react";
import NavigationBar from "@/components/NavigationBar";
import { toast } from "sonner";
import { getPersonalizedSuggestions } from "@/utils/psgLogic";
import { usePortfolioStore } from '@/stores/portfolioStore';
import useLivePrices from '@/hooks/useLivePrices';

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

const PSG = () => {
  const { user } = useAuth();

  // -- Common State
  const [activeTab, setActiveTab] = useState("suggestions");

  // -- Suggestions State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [marketPref, setMarketPref] = useState<"Global" | "US" | "India">("Global"); // Market Preference
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // -- Analyzer State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // -- Hooks
  const portfolioHoldings = usePortfolioStore(s => s.holdings);
  const { fetchPrices } = useLivePrices([], 0); // Manual fetch only

  // ---------------------------------------------
  // 1. Suggestions Logic (Existing)
  // ---------------------------------------------
  // Helper to update prices
  const updateSuggestionsWithLivePrices = async (initialSuggestions: StockSuggestion[]) => {
    if (initialSuggestions.length === 0) return initialSuggestions;

    try {
      const symbolsToFetch = initialSuggestions.map(s => {
        // Heuristic: If it looks like an Indian stock (from our known list or marketPref) and no suffix, add .NS
        const isIndian = s.symbol.length > 5 || ["TCS", "ITC", "SBIN", "LT", "INFY"].includes(s.symbol) || marketPref === "India";
        return isIndian && !s.symbol.includes(".") ? `${s.symbol}.NS` : s.symbol;
      });

      const priceMap = await fetchPrices(symbolsToFetch);

      return initialSuggestions.map(s => {
        const lookupSymbol = s.symbol.length > 5 || ["TCS", "ITC", "SBIN", "LT", "INFY"].includes(s.symbol) || marketPref === "India" ? `${s.symbol}.NS` : s.symbol;
        const liveData = priceMap[lookupSymbol] || priceMap[s.symbol];

        if (liveData) {
          return {
            ...s,
            currentPrice: liveData.price,
            reason: liveData.changePercent ? `${s.reason} (Day: ${liveData.changePercent > 0 ? '+' : ''}${liveData.changePercent.toFixed(2)}%)` : s.reason
          };
        }
        return s;
      });
    } catch (e) {
      console.error("Failed to fetch live prices for suggestions", e);
      return initialSuggestions;
    }
  };

  // ---------------------------------------------
  // 1. Suggestions Logic (Existing)
  // ---------------------------------------------
  const loadData = async (userId: string) => {
    try {
      setIsLoading(true);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        toast.error("Failed to load profile data.");
        return;
      }

      const { data: sectorData } = await supabase.from('user_sectors').select('sector').eq('user_id', userId);
      const sectors = sectorData ? sectorData.map(s => s.sector) : [];

      const userProfile: UserProfile = {
        id: profileData.id,
        name: profileData.name || '',
        age: profileData.age || 0,
        experience: profileData.experience as any || 'Beginner',
        riskTolerance: profileData.risk_tolerance as any || 'Low',
        investmentGoals: profileData.investment_goals as any || [],
        points: profileData.points || 0,
        lastLoginDate: profileData.last_login_date || new Date().toISOString(),
        portfolioValue: 0,
        email: profileData.email || '',
        sectorPreferences: sectors
      };

      setProfile(userProfile);

      // Get suggestions (with market preference)
      const content = getPersonalizedSuggestions(userProfile, marketPref).slice(0, 6);

      // Fetch Live Prices
      const liveContent = await updateSuggestionsWithLivePrices(content);
      setSuggestions(liveContent);

    } catch (error) {
      console.error("Error in loadData:", error);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) loadData(user.id);
  }, [user, marketPref]);

  const handleRefreshSuggestions = async () => {
    if (user && profile) {
      setIsRefreshing(true);
      const content = getPersonalizedSuggestions(profile, marketPref).slice(0, 6);
      const liveContent = await updateSuggestionsWithLivePrices(content);
      setSuggestions(liveContent);
      setIsRefreshing(false);
      toast.success("Market data refreshed");
    }
  };

  // ---------------------------------------------
  // 2. Analyzer Logic (New)
  // ---------------------------------------------

  const performAnalysis = async (formData: FormData) => {
    setAnalyzing(true);
    try {
      // Proxy to Python API
      const res = await fetch('/py-api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }

      const data: AnalysisResult = await res.json();
      setAnalysisResult(data);
      toast.success("Portfolio analysis complete!");
    } catch (err: any) {
      console.error("Analysis Error:", err);
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeVirtualPortfolio = async () => {
    if (portfolioHoldings.length === 0) {
      toast.error("Your virtual portfolio is empty! Buy some stocks first or upload a CSV.");
      return;
    }

    setAnalyzing(true);
    toast.info("Fetching latest prices for accuracy...");

    try {
      // 1. Get Live Prices
      const symbols = portfolioHoldings.map(h => h.symbol.includes(".NS") ? h.symbol : `${h.symbol}.NS`);
      const priceMap = await fetchPrices(symbols);

      // 2. Construct CSV content
      // Header: symbol,quantity,avg_price,current_price
      let csvContent = "symbol,quantity,avg_price,current_price\n";

      portfolioHoldings.forEach(h => {
        // Strip .NS for display/csv consistency if needed, but Python handles it.
        // We'll strip .NS for symbol to look cleaner.
        const cleanSymbol = h.symbol.replace(".NS", "");
        const priceObj = priceMap[cleanSymbol] || priceMap[`${cleanSymbol}.NS`] || priceMap[h.symbol];
        const currentPrice = priceObj ? priceObj.price : h.avgBuyPrice; // Fallback to buy price if fetch fails

        csvContent += `${cleanSymbol},${h.quantity},${h.avgBuyPrice},${currentPrice}\n`;
      });

      // 3. Create File object
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], "virtual_portfolio.csv", { type: "text/csv" });

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-learngreen-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-yellow-500" />
              Personalized Guidance
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">Live AI</Badge>
            </h1>
            <p className="text-gray-600 mt-1">Smart insights for your investment journey.</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full md:w-[400px] grid-cols-2">
            <TabsTrigger value="suggestions">Ask AI (Suggestions)</TabsTrigger>
            <TabsTrigger value="analyzer">Portfolio Check</TabsTrigger>
          </TabsList>

          {/* TAB 1: SUGGESTIONS */}
          <TabsContent value="suggestions" className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
              <p className="text-sm text-gray-500">
                Based on your <strong>{profile?.riskTolerance}</strong> profile ({marketPref}).
              </p>

              <div className="flex items-center gap-2">
                <Select value={marketPref} onValueChange={(v: any) => setMarketPref(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Market" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Global">Global</SelectItem>
                    <SelectItem value="India">India (NSE)</SelectItem>
                    <SelectItem value="US">US Market</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={handleRefreshSuggestions} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
                </Button>
              </div>
            </div>

            {suggestions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suggestions.map((s, i) => (
                  <Card key={i} className="hover:shadow-lg transition-shadow border-t-4 border-t-learngreen-500">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {s.symbol} <Badge variant="outline">{s.riskLevel}</Badge>
                          </CardTitle>
                          <CardDescription>{s.name}</CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">
                            {marketPref === "India" ? "₹" : "$"}{s.currentPrice.toFixed(2)}
                          </div>
                          <div className={`text-xs font-bold ${s.potentialGain && s.potentialGain > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {s.potentialGain ? `+${(s.potentialGain * 100).toFixed(1)}%` : "0%"} Est.
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm italic text-gray-600 bg-gray-50 p-3 rounded mb-4">
                        <Sparkles className="inline w-3 h-3 mr-1 text-yellow-500" />{s.reason}
                      </p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Match</span><span>{Math.min(s.score, 100)}/100</span>
                        </div>
                        <Progress value={Math.min(s.score, 100)} className="h-2" />
                      </div>
                    </CardContent>

                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed">
                <BarChart className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>No suggestions available. Try updating your profile.</p>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: ANALYZER */}
          <TabsContent value="analyzer">
            {!analysisResult ? (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Analyze Virtual Portfolio */}
                <Card className="border-2 border-blue-50 bg-blue-50/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-600" /> Virtual Portfolio</CardTitle>
                    <CardDescription>Analyze the stocks you hold in LearnStocks simulator.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-gray-600 mb-4">
                      You currently have <strong>{portfolioHoldings.length}</strong> active positions.
                    </div>
                    <Button onClick={analyzeVirtualPortfolio} disabled={analyzing} className="w-full bg-blue-600 hover:bg-blue-700">
                      {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Analyze My Portfolio
                    </Button>
                  </CardContent>
                </Card>

                {/* Upload External CSV */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Upload Broker CSV</CardTitle>
                    <CardDescription>Analyze an external portfolio (Zerodha, Groww format).</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 border border-dashed rounded bg-gray-50 text-center text-sm text-gray-500">
                      CSV must have: <code>symbol, quantity, avg_price, current_price</code>
                    </div>
                    <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <Button onClick={analyzeUploadedFile} disabled={!file || analyzing} variant="secondary" className="w-full">
                      {analyzing ? "Analyzing..." : "Upload & Analyze"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Portfolio Diagnosis</h2>
                  <Button variant="outline" onClick={resetAnalysis}>Run New Analysis</Button>
                </div>

                {/* Health Score */}
                <Card>
                  <CardHeader>
                    <CardTitle>Health Score</CardTitle>
                    <CardDescription>Composite variance & risk score</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center py-6">
                    <div className={`text-5xl font-bold mb-2 ${getColor(analysisResult.portfolio_health.score)}`}>
                      {analysisResult.portfolio_health.score}/100
                    </div>
                    <Progress value={analysisResult.portfolio_health.score} className={`h-3 w-full max-w-md ${getProgressColor(analysisResult.portfolio_health.score)}`} />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 w-full">
                      {Object.entries(analysisResult.portfolio_health.components).slice(0, 4).map(([key, val]) => (
                        <div key={key} className="text-center p-3 bg-gray-50 rounded">
                          <div className="text-xs text-gray-500 uppercase mb-1">{key.replace("_score", "")}</div>
                          <div className="font-semibold">{val as number}/100</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Suggestions */}
                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="border-l-4 border-l-green-500">
                    <CardHeader><CardTitle className="text-green-700">Buy / Add</CardTitle></CardHeader>
                    <CardContent>
                      {analysisResult.suggestions.buy.length ? (
                        <ul className="space-y-2">
                          {analysisResult.suggestions.buy.map((s: any) => (
                            <li key={s.symbol} className="flex justify-between border-b pb-1">
                              <span>{s.symbol}</span> <span className="text-green-600 text-sm font-medium">Underweight</span>
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-sm text-gray-500">No immediate buy signals.</span>}
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-yellow-500">
                    <CardHeader><CardTitle className="text-yellow-700">Hold</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-600">
                        {analysisResult.suggestions.hold.slice(0, 5).map((s: any) => s.symbol).join(", ")}
                        {analysisResult.suggestions.hold.length > 5 && "..."}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-red-500">
                    <CardHeader><CardTitle className="text-red-700">Reduce Risk</CardTitle></CardHeader>
                    <CardContent>
                      {analysisResult.suggestions.reduce.length ? (
                        <ul className="space-y-2">
                          {analysisResult.suggestions.reduce.map((s: any) => (
                            <li key={s.symbol} className="flex justify-between border-b pb-1">
                              <span>{s.symbol}</span> <span className="text-red-600 text-sm font-medium">Overweight</span>
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-sm text-gray-500">Allocation looks balanced.</span>}
                    </CardContent>
                  </Card>
                </div>

                {/* Holdings Table */}
                <Card>
                  <CardHeader><CardTitle>Holdings Analysis</CardTitle></CardHeader>
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
                            <tr key={h.symbol} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-medium">{h.symbol}</td>
                              <td className="p-2 text-right">₹{h.invested_value.toFixed(0)}</td>
                              <td className="p-2 text-right">₹{h.current_value.toFixed(0)}</td>
                              <td className={`p-2 text-right font-medium ${h.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {h.pnl_pct.toFixed(2)}%
                              </td>
                              <td className="p-2 text-right">{h.allocation_pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PSG;
