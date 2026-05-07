import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import NavigationBar from "@/components/NavigationBar";
import mockStocks from "@/data/mockStocks";
import TradeDialog from "@/components/TradeDialog";
import { usePortfolioStore } from "@/stores/portfolioStore";
import { PortfolioChart } from "@/components/PortfolioChart";
import LoginReward from "@/components/LoginReward";
import { Stock, Portfolio } from "@/types";
import { PieChart, ArrowLeftRight } from "lucide-react";
import { useRef } from "react";
import LiveBadge from "@/components/LiveBadge";
import { supabase } from "@/integrations/supabase/client";
import { isNSEMarketOpen } from "@/lib/marketHours";
import { fetchStockData } from "@/services/stockApi";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useBalanceStore } from "@/stores/balanceStore";
import useLivePrices from "@/hooks/useLivePrices";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
} as const;

const Home = () => {
  const navigate = useNavigate();
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [lastLoginDate, setLastLoginDate] = useState<string | null>(null);
  const { balance, setBalance } = useBalanceStore();
  const [userPoints, setUserPoints] = useState(0);
  const [trendingStocks, setTrendingStocks] = useState<Stock[]>(mockStocks);
  const holdings = usePortfolioStore((s) => s.holdings);
  const trades = usePortfolioStore((s) => s.trades);
  const history = usePortfolioStore((s) => s.history);
  const addHistoryPoint = usePortfolioStore((s) => s.addHistoryPoint);
  const sellStock = usePortfolioStore((s) => s.sellStock);
  const syncFromBackend = usePortfolioStore((s) => s.syncFromBackend);
  const { prices, fetchPrices, setSymbols } = useLivePrices([], 5000);
  // Sell dialog state for holdings list
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any | null>(null);
  const [selectedSellStock, setSelectedSellStock] = useState<Stock | null>(
    null,
  );
  // Range selection for portfolio chart
  const [range, setRange] = useState<"1D" | "1W" | "1M" | "1Y">("1M");
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesData, setSeriesData] = useState<
    { date: string; value: number }[]
  >([]);
  // Toggle for Stocks bar: show PnL vs Total Invested
  const [showInvested, setShowInvested] = useState(false);
  // Bring back holdings list (below) and enable scroll target
  const holdingsRef = useRef<HTMLDivElement | null>(null);
  const [holdingsView, setHoldingsView] = useState<
    "invested" | "returns" | "contribution" | "price"
  >("invested");
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    // balance is managed by balanceStore; just ensure UI updates
  }, [balance]);

  const fetchUserData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("points, last_login_date, profile_completed")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user data:", error);
        toast.error("Failed to load your profile data");
        return;
      }

      if (data) {
        const remotePoints = data.points || 0;
        setUserPoints(remotePoints);
        // Always sync local cash balance from remote points so
        // every device reflects the latest balance for this user.
        setBalance(remotePoints);

        setLastLoginDate(data.last_login_date);
        setIsFirstLogin(!data.profile_completed);
      }
    } catch (err) {
      console.error("Error in fetchUserData:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, setBalance]);

  const handleTradeNow = () => {
    navigate("/games", { state: { activeTab: "simulator" } });
  };

  useEffect(() => {
    fetchUserData();

    if (user) {
      // Always sync holdings from backend on home load so
      // every device shows the same portfolio for this user.
      void syncFromBackend();

      const pointsChannel = supabase
        .channel("profile-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new && payload.new.points !== undefined) {
              const updatedPoints = payload.new.points || 0;
              setUserPoints(updatedPoints);
              // Mirror any remote points change (quizzes, login rewards,
              // challenges, or trades) into the local cash balance.
              setBalance(updatedPoints);
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(pointsChannel);
      };
    }
  }, [user, fetchUserData, setBalance, syncFromBackend]);

  // Symbol helpers to avoid mistakes like HINDUNILVR.NS.NS
  const baseSymbol = (symbol: string) => symbol.replace(".NS", "");
  const toNseSymbol = (symbol: string) =>
    symbol.includes(".") || symbol.includes("-") ? symbol : `${symbol}.NS`;

  // set symbols to fetch: holdings only (removed Trading section)
  useEffect(() => {
    const syms = Array.from(
      new Set(holdings.map((h) => toNseSymbol(baseSymbol(h.symbol)))),
    );
    setSymbols(syms);
  }, [holdings]);

  // Periodically snapshot portfolio value into history (every 60s)
  useEffect(() => {
    const takeSnapshot = () => {
      // Only snapshot if market is open
      if (!isNSEMarketOpen()) return;
      try {
        const portfolio = usePortfolioStore.getState();
        // use currently polled prices from hook and snapshot ONLY invested equity (exclude cash)
        const currentPrices = prices || {};
        const investedValue = portfolio.holdings.reduce((s, h) => {
          const key = baseSymbol(h.symbol);
          const p =
            currentPrices[key]?.price ??
            mockStocks.find((m) => m.id === h.stockId)?.price ??
            h.avgBuyPrice;
          return s + h.quantity * p;
        }, 0);
        usePortfolioStore.getState().addHistoryPoint(investedValue);
      } catch (err) {
        console.error("Failed to snapshot portfolio history", err);
      }
    };

    const id = setInterval(takeSnapshot, 60000);
    // take an immediate snapshot as well
    takeSnapshot();
    return () => clearInterval(id);
  }, [prices]);

  // Helper: format a date label depending on the selected range
  const formatDateLabel = (dateStr: string, rangeKey: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr; // already formatted
      if (rangeKey === "1D") {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      if (rangeKey === "1W") {
        return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      }
      if (rangeKey === "1Y") {
        return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      }
      // 1M default
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return dateStr;
    }
  };

  // Helper: compute portfolio equity series for selected range using historical prices
  useEffect(() => {
    (async () => {
      try {
        setSeriesLoading(true);

        // For 1D, use the local snapshot history instead of API historical data
        if (range === "1D") {
          setSeriesData([]);
          setSeriesLoading(false);
          return;
        }

        const dayMap = { "1W": 7, "1M": 30, "1Y": 365 } as const;
        const days = dayMap[range];
        // Use all traded symbols AND current holdings so history is complete
        const state = usePortfolioStore.getState();
        const symbols = Array.from(
          new Set([
            ...state.trades.map((t) => t.symbol),
            ...state.holdings.map((h) => h.symbol),
          ]),
        );
        if (symbols.length === 0) {
          setSeriesData([]);
          setSeriesLoading(false);
          return;
        }

        // Fetch historical for each symbol
        const results = await Promise.all(
          symbols.map(async (sym) => {
            const base = baseSymbol(sym);
            const symbolForApi = toNseSymbol(base);
            let hist: { date: string; close: number }[] = [];

            // Try fetching from Python API
            const { data, error } = await fetchStockData(symbolForApi, days);

            if (
              !error &&
              data?.historicalData &&
              data.historicalData.length > 0
            ) {
              hist = data.historicalData.map((it: any) => ({
                date: new Date(it.date).toISOString().slice(0, 10),
                close: Math.round((it.close as number) * 100) / 100,
              }));
            } else {
              // FALLBACK: Use current price as a flat line (no synthetic random walk)
              const baseSym = baseSymbol(sym);
              const livePrice = prices?.[baseSym]?.price;
              const mockPrice = mockStocks.find((m) => m.symbol === sym)?.price;
              const flatPrice = livePrice ?? mockPrice ?? 0;
              if (flatPrice > 0) {
                const end = new Date();
                for (let i = days - 1; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(end.getDate() - i);
                  // Skip weekends for a cleaner look
                  if (d.getDay() === 0 || d.getDay() === 6) continue;
                  hist.push({
                    date: d.toISOString().slice(0, 10),
                    close: Math.round(flatPrice * 100) / 100,
                  });
                }
              }
            }

            // Ensure ascending by date
            hist.sort((a, b) => a.date.localeCompare(b.date));
            return { sym, hist };
          }),
        );

        // Build a sorted union of dates
        const dateSet = new Set<string>();
        for (const r of results) for (const h of r.hist) dateSet.add(h.date);
        const dates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

        // Pre-index historical by symbol
        const histBySym: Record<string, { date: string; close: number }[]> = {};
        results.forEach(({ sym, hist }) => {
          histBySym[sym] = hist;
        });

        // Helper: get last known close on or before a date
        const lastCloseOnOrBefore = (sym: string, date: string) => {
          const arr = histBySym[sym] || [];
          let last = undefined as number | undefined;
          for (const rec of arr) {
            if (rec.date > date) break;
            last = rec.close;
          }
          return last ?? 0;
        };

        // Pre-index trades by symbol
        const tradesBySym: Record<
          string,
          { date: string; qty: number; type: "BUY" | "SELL" }[]
        > = {};
        for (const t of usePortfolioStore.getState().trades) {
          (tradesBySym[t.symbol] ||= []).push({
            date: t.date,
            qty: t.quantity,
            type: t.type,
          });
        }
        for (const sym of Object.keys(tradesBySym))
          tradesBySym[sym].sort((a, b) => a.date.localeCompare(b.date));

        // Compute equity series: for each date, sum qty(sym,<=date)*price(sym,date)
        const series: { date: string; value: number }[] = [];
        for (const d of dates) {
          let total = 0;
          for (const sym of symbols) {
            // effective qty up to end of date d
            const ts = tradesBySym[sym] || [];
            let qty = 0;

            if (ts.length === 0) {
              // FALLBACK: If no trades recorded, use current holdings quantity (assume held constant)
              const h = usePortfolioStore
                .getState()
                .holdings.find((x) => x.symbol === sym);
              if (h) qty = h.quantity;
            } else {
              for (const tr of ts) {
                if (tr.date.slice(0, 10) <= d)
                  qty += tr.type === "BUY" ? tr.qty : -tr.qty;
              }
            }

            if (qty <= 0) continue;
            const px = lastCloseOnOrBefore(sym, d);
            total += qty * px;
          }
          // Round to 2 decimals to avoid floating point display artifacts
          series.push({ date: d, value: Math.round(total * 100) / 100 });
        }

        setSeriesData(series);
      } catch (e) {
        console.error("Failed to compute portfolio series", e);
        setSeriesData([]);
      } finally {
        setSeriesLoading(false);
      }
    })();
  }, [range, trades.length, holdings.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />

      <LoginReward isFirstLogin={isFirstLogin} lastLoginDate={lastLoginDate} />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="container mx-auto px-4 py-6"
      >
        {/* Portfolio Overview Allocation (green theme) */}
        {(() => {
          // "Current" stocks value based on live prices when available,
          // otherwise mock price, otherwise average buy price.
          const investedValueRaw = holdings.reduce((s, h) => {
            const key = baseSymbol(h.symbol);
            const live = prices[key];
            const currentPrice = live
              ? live.price
              : (mockStocks.find((m) => m.id === h.stockId)?.price ??
                h.avgBuyPrice);
            return s + h.quantity * currentPrice;
          }, 0);
          // Pure cost basis (what the user actually invested)
          const investedCost = holdings.reduce(
            (s, h) => s + h.quantity * h.avgBuyPrice,
            0,
          );
          // If we couldn't resolve any prices (live/mock) but there is a
          // positive cost basis, fall back to cost as the "current" value
          // so the card never misleadingly shows ₹0 when the user holds
          // stocks but live prices are unavailable.
          const investedValue =
            investedValueRaw === 0 && investedCost > 0
              ? investedCost
              : investedValueRaw;
          const cashValue = balance;
          const total = investedValue + cashValue;
          const investedPct = total > 0 ? (investedValue / total) * 100 : 0;
          const cashPct = total > 0 ? (cashValue / total) * 100 : 0;
          const stocksPnL = investedValue - investedCost;
          const stocksPnLPct =
            investedCost > 0 ? (stocksPnL / investedCost) * 100 : 0;
          return (
            <motion.div variants={itemVariants}>
              <Card className="mb-6">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-xl">
                      Portfolio Overview
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      Total value across cash and holdings
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-learngreen-600" />
                    <Button
                      size="sm"
                      className="h-7 px-2 bg-learngreen-600"
                      onClick={handleTradeNow}
                    >
                      Trade Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={handleTradeNow}
                    >
                      Add More Cash
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Stocks allocation */}
                  <div
                    className="rounded-xl p-4 flex items-start justify-between mb-3 border relative overflow-hidden"
                    style={{
                      backgroundColor: "#ecfdf5",
                    }}
                  >
                    {/* Green striped overlay */}
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-60"
                      style={{
                        background:
                          "repeating-linear-gradient(45deg, rgba(16,185,129,0.18) 0, rgba(16,185,129,0.18) 12px, rgba(16,185,129,0.06) 12px, rgba(16,185,129,0.06) 24px)",
                      }}
                    />
                    {/* Content */}
                    <div className="relative w-full flex items-start justify-between">
                      <div
                        onClick={() =>
                          holdingsRef.current?.scrollIntoView({
                            behavior: "smooth",
                          })
                        }
                        className="cursor-pointer select-none"
                      >
                        <div className="text-xl font-bold">Stocks</div>
                        <div className="text-lg text-gray-700">
                          {investedPct.toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-extrabold">
                          ₹{investedValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {/* Toggle between PnL and Total Invested */}
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowInvested((p) => !p);
                            }}
                            className="p-0.5 rounded-md hover:bg-green-200/60 transition-colors"
                            title={showInvested ? "Show P&L" : "Show total invested"}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 text-gray-600" />
                          </button>
                          {showInvested ? (
                            <div className="text-sm font-semibold text-gray-700">
                              Invested: ₹{investedCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          ) : (
                            <div
                              className={`text-sm font-semibold ${
                                stocksPnL >= 0
                                  ? "text-green-600"
                                  : "text-orange-500"
                              }`}
                            >
                              {stocksPnL >= 0 ? "+" : ""}₹
                              {Math.abs(stocksPnL).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              ({stocksPnLPct.toFixed(2)}%)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash allocation */}
                  <div
                    className="rounded-xl p-4 flex items-start justify-between border relative overflow-hidden"
                    style={{ backgroundColor: "#f3f4f6" }}
                  >
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-50"
                      style={{
                        background:
                          "repeating-linear-gradient(45deg, rgba(107,114,128,0.18) 0, rgba(107,114,128,0.18) 12px, rgba(107,114,128,0.06) 12px, rgba(107,114,128,0.06) 24px)",
                      }}
                    />
                    <div className="relative w-full flex items-start justify-between">
                      <div className="select-none">
                        <div className="text-xl font-bold">Cash</div>
                        <div className="text-lg text-gray-700">
                          {cashPct.toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-extrabold">
                          ₹{cashValue.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          Available balance
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ratio Progress Bar */}
                  {total > 0 && (
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-3 flex overflow-hidden">
                      <div 
                        className="bg-learngreen-500 h-3" 
                        style={{ width: `${investedPct}%` }}
                        title={`Stocks: ${investedPct.toFixed(1)}%`}
                      />
                      <div 
                        className="bg-gray-400 h-3" 
                        style={{ width: `${cashPct}%` }}
                        title={`Cash: ${cashPct.toFixed(1)}%`}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}

        <div className="mb-6 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {(() => {
              // Current invested equity value (exclude cash)
              const investedValue = holdings.reduce((s, h) => {
                const live = prices[baseSymbol(h.symbol)];
                const currentPrice = live
                  ? live.price
                  : (mockStocks.find((m) => m.id === h.stockId)?.price ??
                    h.avgBuyPrice);
                return s + h.quantity * currentPrice;
              }, 0);

              // Total cost basis of holdings
              const investedCost = holdings.reduce(
                (s, h) => s + h.quantity * h.avgBuyPrice,
                0,
              );
              const investedPnL = investedValue - investedCost;
              const investedPnLPct =
                investedCost > 0 ? (investedPnL / investedCost) * 100 : 0;

              // Use computed seriesData for selected range; fallback to quick history if empty
              let chartData: { date: string; value: number }[] | undefined = undefined;
              if (range === "1D") {
                // 1D uses local real-time snapshots
                if (history && history.length > 0) {
                  const todayStr = new Date().toDateString();
                  chartData = history
                    .filter((pt) => {
                      const d = new Date(pt.date);
                      // Filter points: must be today
                      if (d.toDateString() !== todayStr) return false;
                      
                      // Check if it was recorded within market hours
                      const mins = d.getHours() * 60 + d.getMinutes();
                      const isMarketHrs = mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
                      return isMarketHrs;
                    })
                    .map((pt) => ({
                      date: formatDateLabel(pt.date, "1D"),
                      value: Math.round(pt.value * 100) / 100,
                    }));
                }
              } else if (seriesData && seriesData.length > 0) {
                // Historical ranges — pin last point to live value
                const computedSeries = seriesData.map((pt) => ({
                  date: formatDateLabel(pt.date, range),
                  value: pt.value,
                }));
                // Replace / append today's point with live invested value
                const todayLabel = formatDateLabel(new Date().toISOString().slice(0, 10), range);
                const lastIdx = computedSeries.length - 1;
                const roundedInvested = Math.round(investedValue * 100) / 100;
                if (computedSeries[lastIdx]?.date === todayLabel) {
                  computedSeries[lastIdx].value = roundedInvested;
                } else {
                  computedSeries.push({ date: todayLabel, value: roundedInvested });
                }
                chartData = computedSeries;
              } else if (history && history.length > 0) {
                chartData = history.map((pt) => ({
                  date: formatDateLabel(pt.date, range),
                  value: Math.round(pt.value * 100) / 100,
                }));
              }

              return (
                <motion.div variants={itemVariants} className="relative">
                  <div className="absolute right-3 top-3 z-10">
                    <LiveBadge isLive={Object.keys(prices || {}).length > 0} />
                  </div>
                  <PortfolioChart
                    title="Portfolio Value"
                    description="Stocks invested value (excludes cash)"
                    value={Math.round(investedValue * 100) / 100}
                    change={Math.round(investedPnL * 100) / 100}
                    changePercent={Math.round(investedPnLPct * 100) / 100}
                    data={chartData}
                    height={340}
                  />
                  {/* Range selector */}
                  <div className="mt-3 flex gap-2">
                    {(["1D", "1W", "1M", "1Y"] as const).map((r) => (
                      <button
                        key={r}
                        className={`px-3 py-1 rounded-full border ${
                          range === r
                            ? "bg-learngreen-600 text-white"
                            : "bg-white text-gray-700"
                        }`}
                        onClick={() => setRange(r)}
                        disabled={seriesLoading && range !== r}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </motion.div>
              );
            })()}

            {/* Removed Available Cash and Holdings summary cards */}
          </div>
          {/* Holdings section returned below */}
          <div ref={holdingsRef} />
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Your Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  {[
                    { key: "invested", label: "Current (Invested)" },
                    { key: "returns", label: "Returns (%)" },
                    { key: "contribution", label: "Contribution (Current)" },
                    { key: "price", label: "Price (1D%)" },
                  ].map((v) => (
                    <button
                      key={v.key}
                      aria-pressed={holdingsView === v.key}
                      className={`px-3 py-1 rounded-full border ${
                        holdingsView === (v.key as any)
                          ? "bg-learngreen-600 text-white"
                          : "bg-white text-gray-700"
                      }`}
                      onClick={() => setHoldingsView(v.key as any)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  {holdings.length === 0 && (
                    <div className="text-center text-gray-500 py-6">
                      You have no holdings yet. Buy stocks from the Trading tab.
                    </div>
                  )}

                  {holdings.map((holding) => {
                    const live = prices[baseSymbol(holding.symbol)];
                    const mock = mockStocks.find(
                      (m) => m.id === holding.stockId,
                    ) as Stock | undefined;
                    const currentPrice = live
                      ? live.price
                      : mock
                        ? mock.price
                        : holding.avgBuyPrice;
                    const currentChange = live
                      ? (live.change ?? 0)
                      : mock
                        ? (mock.change ?? 0)
                        : 0;
                    const value = holding.quantity * currentPrice;
                    const pnl = value - holding.quantity * holding.avgBuyPrice;
                    const pnlPct =
                      (pnl / (holding.quantity * holding.avgBuyPrice)) * 100;
                    const totalHoldingsValue = holdings.reduce((s, h) => {
                      const m = mockStocks.find((x) => x.id === h.stockId);
                      const price =
                        prices[baseSymbol(h.symbol)]?.price ??
                        (m ? m.price : h.avgBuyPrice);
                      return s + price * h.quantity;
                    }, 0);
                    const sharePercent =
                      totalHoldingsValue > 0
                        ? (value / totalHoldingsValue) * 100
                        : 0;

                    return (
                      <div
                        key={holding.stockId}
                        className="p-3 border rounded-md"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{holding.symbol}</div>
                            <div className="text-sm text-gray-500">
                              {holding.name}
                            </div>
                          </div>

                          <div className="text-right">
                            {holdingsView === "invested" && (
                              <>
                                <div className="font-semibold text-lg">
                                  ₹{value.toFixed(2)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {holding.quantity} Qty • Avg ₹
                                  {holding.avgBuyPrice.toFixed(2)}
                                </div>
                              </>
                            )}

                            {holdingsView === "returns" && (
                              <div
                                className={
                                  pnl >= 0 ? "text-green-600" : "text-red-600"
                                }
                              >
                                <div className="font-medium">
                                  {pnl >= 0 ? "+" : "-"}₹
                                  {Math.abs(pnl).toFixed(2)}
                                </div>
                                <div className="text-sm">
                                  {pnlPct.toFixed(2)}%
                                </div>
                              </div>
                            )}

                            {holdingsView === "contribution" && (
                              <div className="w-36">
                                <div className="text-sm text-gray-500">
                                  {sharePercent.toFixed(1)}%
                                </div>
                                <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                                  <div
                                    className="h-2 bg-learngreen-600"
                                    style={{ width: `${sharePercent}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  ₹{value.toFixed(2)}
                                </div>
                              </div>
                            )}

                            {holdingsView === "price" && (
                              <div className="text-right">
                                <div className="font-medium">
                                  ₹{currentPrice.toFixed(2)}
                                </div>
                                <div
                                  className={`text-sm ${
                                    currentChange >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {currentChange >= 0 ? "+" : ""}
                                  {currentChange.toFixed(2)} (
                                  {live?.changePercent?.toFixed(2) ??
                                    (mock?.changePercent ?? 0).toFixed(2)}
                                  %)
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              // fetch fresh price before opening sell dialog
                              const key = baseSymbol(holding.symbol);
                              const symNs = toNseSymbol(key);
                              const fetched = await fetchPrices([symNs]);
                              const liveFetched = fetched[key] || prices[key];
                              const priceToUse = liveFetched
                                ? liveFetched.price
                                : mock
                                  ? mock.price
                                  : holding.avgBuyPrice;
                              const stockObj: Stock = {
                                id: holding.stockId,
                                symbol: holding.symbol,
                                name: holding.name,
                                price: priceToUse,
                                change:
                                  liveFetched?.change ?? mock?.change ?? 0,
                                changePercent:
                                  liveFetched?.changePercent ??
                                  mock?.changePercent ??
                                  0,
                                volume: mock?.volume ?? 0,
                                marketCap: mock?.marketCap ?? 0,
                                sector: mock?.sector ?? "",
                              };
                              setSelectedHolding(holding);
                              setSelectedSellStock(stockObj);
                              setIsSellDialogOpen(true);
                            }}
                          >
                            Sell
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <TradeDialog
            open={isSellDialogOpen}
            onOpenChange={setIsSellDialogOpen}
            stock={selectedSellStock}
            action="sell"
            onConfirm={(qty) => {
              if (!selectedHolding) return;
              (async () => {
                const key = baseSymbol(selectedHolding.symbol);
                const symNs = toNseSymbol(key);
                const fetched = await fetchPrices([symNs]);
                const live = fetched[key] || prices[key];
                const priceToUse = live
                  ? live.price
                  : (mockStocks.find((m) => m.id === selectedHolding.stockId)
                      ?.price ?? selectedHolding.avgBuyPrice);
                const ok = sellStock(selectedHolding.stockId, qty, priceToUse);
                if (ok)
                  toast.success(
                    `Sold ${qty} ${
                      selectedHolding.symbol
                    } @ ₹${priceToUse.toFixed(2)}`,
                  );
                else toast.error("Sell failed: invalid qty");
                // append a history snapshot after successful sell
                if (ok) {
                  try {
                    const combined = { ...(prices || {}), ...(fetched || {}) };
                    const portfolio = usePortfolioStore.getState();
                    const investedValue = portfolio.holdings.reduce((s, h) => {
                      const k = baseSymbol(h.symbol);
                      const p =
                        combined[k]?.price ??
                        mockStocks.find((m) => m.id === h.stockId)?.price ??
                        h.avgBuyPrice;
                      return s + h.quantity * p;
                    }, 0);
                    usePortfolioStore.getState().addHistoryPoint(investedValue);
                  } catch (err) {
                    console.error(
                      "Failed to append history point after sell",
                      err,
                    );
                  }
                }
                setIsSellDialogOpen(false);
                setSelectedHolding(null);
              })();
            }}
          />
        </div>
      </motion.main>
    </div>
  );
};

export default Home;
