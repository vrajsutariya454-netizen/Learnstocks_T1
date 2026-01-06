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
import { PieChart } from "lucide-react";
import { useRef } from "react";
import LiveBadge from "@/components/LiveBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useBalanceStore } from "@/stores/balanceStore";
import useLivePrices from "@/hooks/useLivePrices";

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
    null
  );
  // Range selection for portfolio chart
  const [range, setRange] = useState<"1D" | "1W" | "1M" | "1Y">("1M");
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesData, setSeriesData] = useState<
    { date: string; value: number }[]
  >([]);
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
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(pointsChannel);
      };
    }
  }, [user, fetchUserData, setBalance, syncFromBackend]);

  // set symbols to fetch: holdings only (removed Trading section)
  useEffect(() => {
    const syms = Array.from(
      new Set([...holdings.map((h) => `${h.symbol}.NS`)])
    );
    setSymbols(syms);
  }, [holdings]);

  // Periodically snapshot portfolio value into history (every 60s)
  useEffect(() => {
    const takeSnapshot = () => {
      try {
        const portfolio = usePortfolioStore.getState();
        // use currently polled prices from hook and snapshot ONLY invested equity (exclude cash)
        const currentPrices = prices || {};
        const investedValue = portfolio.holdings.reduce((s, h) => {
          const p =
            currentPrices[h.symbol]?.price ??
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

  // Helper: compute portfolio equity series for selected range using historical prices
  useEffect(() => {
    (async () => {
      try {
        setSeriesLoading(true);
        const dayMap = { "1D": 2, "1W": 7, "1M": 30, "1Y": 365 } as const; // 1D uses last 2 days for a line
        const days = dayMap[range];
        // Use all traded symbols so history reflects past holdings
        const symbols = Array.from(
          new Set(usePortfolioStore.getState().trades.map((t) => t.symbol))
        );
        if (symbols.length === 0) {
          setSeriesData([]);
          setSeriesLoading(false);
          return;
        }

        // Fetch historical for each symbol
        const results = await Promise.all(
          symbols.map(async (sym) => {
            const { data, error } = await supabase.functions.invoke(
              "get-stock-data",
              { body: { symbol: `${sym}.NS`, days } }
            );
            if (error)
              return { sym, hist: [] as { date: string; close: number }[] };
            let hist = (data?.historicalData || []).map((it: any) => ({
              date: new Date(it.date).toISOString().slice(0, 10),
              close: it.close as number,
            }));
            // Ensure ascending by date
            hist.sort((a, b) => a.date.localeCompare(b.date));
            // forward-fill close for missing days will be handled later by last-known lookup
            return { sym, hist };
          })
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
            for (const tr of ts) {
              if (tr.date.slice(0, 10) <= d)
                qty += tr.type === "BUY" ? tr.qty : -tr.qty;
            }
            if (qty <= 0) continue;
            const px = lastCloseOnOrBefore(sym, d);
            total += qty * px;
          }
          series.push({ date: d, value: total });
        }

        setSeriesData(series);
      } catch (e) {
        console.error("Failed to compute portfolio series", e);
        setSeriesData([]);
      } finally {
        setSeriesLoading(false);
      }
    })();
  }, [range, trades.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />

      <LoginReward isFirstLogin={isFirstLogin} lastLoginDate={lastLoginDate} />

      <main className="container mx-auto px-4 py-6">
        {/* Portfolio Overview Allocation (green theme) */}
        {(() => {
          const investedValue = holdings.reduce((s, h) => {
            const live = prices[h.symbol];
            const currentPrice = live
              ? live.price
              : mockStocks.find((m) => m.id === h.stockId)?.price ??
                h.avgBuyPrice;
            return s + h.quantity * currentPrice;
          }, 0);
          const cashValue = balance;
          const total = investedValue + cashValue;
          const investedPct = total > 0 ? (investedValue / total) * 100 : 0;
          const cashPct = total > 0 ? (cashValue / total) * 100 : 0;
          // P&L for stocks vs cost
          const investedCost = holdings.reduce(
            (s, h) => s + h.quantity * h.avgBuyPrice,
            0
          );
          const stocksPnL = investedValue - investedCost;
          const stocksPnLPct =
            investedCost > 0 ? (stocksPnL / investedCost) * 100 : 0;
          return (
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl">Portfolio Overview</CardTitle>
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
                        ₹{investedValue.toLocaleString()}
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          stocksPnL >= 0 ? "text-green-600" : "text-orange-500"
                        }`}
                      >
                        {stocksPnL >= 0 ? "+" : ""}₹
                        {Math.abs(stocksPnL).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ({stocksPnLPct.toFixed(2)}%)
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
              </CardContent>
            </Card>
          );
        })()}

        <div className="mb-6 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {(() => {
              // Current invested equity value (exclude cash)
              const investedValue = holdings.reduce((s, h) => {
                const live = prices[h.symbol];
                const currentPrice = live
                  ? live.price
                  : mockStocks.find((m) => m.id === h.stockId)?.price ??
                    h.avgBuyPrice;
                return s + h.quantity * currentPrice;
              }, 0);

              // Total cost basis of holdings
              const investedCost = holdings.reduce(
                (s, h) => s + h.quantity * h.avgBuyPrice,
                0
              );
              const investedPnL = investedValue - investedCost;
              const investedPnLPct =
                investedCost > 0 ? (investedPnL / investedCost) * 100 : 0;

              // Use computed seriesData for selected range; fallback to quick history if empty
              const chartData =
                seriesData && seriesData.length > 0
                  ? seriesData
                  : history && history.length > 0
                  ? history.map((pt) => ({
                      date: new Date(pt.date).toLocaleTimeString(),
                      value: pt.value,
                    }))
                  : undefined;

              return (
                <div className="relative">
                  <div className="absolute right-3 top-3 z-10">
                    <LiveBadge isLive={Object.keys(prices || {}).length > 0} />
                  </div>
                  <PortfolioChart
                    title="Portfolio Value"
                    description="Stocks invested value (excludes cash)"
                    value={investedValue}
                    change={investedPnL}
                    changePercent={investedPnLPct}
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
                </div>
              );
            })()}

            {/* Removed Available Cash and Holdings summary cards */}
          </div>
          {/* Holdings section returned below */}
          <div ref={holdingsRef} />
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
                  const live = prices[holding.symbol];
                  const mock = mockStocks.find(
                    (m) => m.id === holding.stockId
                  ) as Stock | undefined;
                  const currentPrice = live
                    ? live.price
                    : mock
                    ? mock.price
                    : holding.avgBuyPrice;
                  const currentChange = live
                    ? live.change ?? 0
                    : mock
                    ? mock.change ?? 0
                    : 0;
                  const value = holding.quantity * currentPrice;
                  const pnl = value - holding.quantity * holding.avgBuyPrice;
                  const pnlPct =
                    (pnl / (holding.quantity * holding.avgBuyPrice)) * 100;
                  const totalHoldingsValue = holdings.reduce((s, h) => {
                    const m = mockStocks.find((x) => x.id === h.stockId);
                    const price =
                      prices[h.symbol]?.price ?? (m ? m.price : h.avgBuyPrice);
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
                            const symNs = `${holding.symbol}.NS`;
                            const fetched = await fetchPrices([symNs]);
                            const liveFetched =
                              fetched[holding.symbol] || prices[holding.symbol];
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
                              change: liveFetched?.change ?? mock?.change ?? 0,
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
          <TradeDialog
            open={isSellDialogOpen}
            onOpenChange={setIsSellDialogOpen}
            stock={selectedSellStock}
            action="sell"
            onConfirm={(qty) => {
              if (!selectedHolding) return;
              (async () => {
                const symNs = `${selectedHolding.symbol}.NS`;
                const fetched = await fetchPrices([symNs]);
                const live =
                  fetched[selectedHolding.symbol] ||
                  prices[selectedHolding.symbol];
                const priceToUse = live
                  ? live.price
                  : mockStocks.find((m) => m.id === selectedHolding.stockId)
                      ?.price ?? selectedHolding.avgBuyPrice;
                const ok = sellStock(selectedHolding.stockId, qty, priceToUse);
                if (ok)
                  toast.success(
                    `Sold ${qty} ${
                      selectedHolding.symbol
                    } @ ₹${priceToUse.toFixed(2)}`
                  );
                else toast.error("Sell failed: invalid qty");
                // append a history snapshot after successful sell
                if (ok) {
                  try {
                    const combined = { ...(prices || {}), ...(fetched || {}) };
                    const portfolio = usePortfolioStore.getState();
                    const investedValue = portfolio.holdings.reduce((s, h) => {
                      const p =
                        combined[h.symbol]?.price ??
                        mockStocks.find((m) => m.id === h.stockId)?.price ??
                        h.avgBuyPrice;
                      return s + h.quantity * p;
                    }, 0);
                    usePortfolioStore.getState().addHistoryPoint(investedValue);
                  } catch (err) {
                    console.error(
                      "Failed to append history point after sell",
                      err
                    );
                  }
                }
                setIsSellDialogOpen(false);
                setSelectedHolding(null);
              })();
            }}
          />
        </div>
      </main>
    </div>
  );
};

export default Home;
