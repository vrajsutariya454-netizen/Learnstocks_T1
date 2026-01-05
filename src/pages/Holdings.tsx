import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavigationBar from "@/components/NavigationBar";
import { usePortfolioStore } from "@/stores/portfolioStore";
import useLivePrices from "@/hooks/useLivePrices";
import { Stock } from "@/types";
import mockStocks from "@/data/mockStocks";
import TradeDialog from "@/components/TradeDialog";
import { toast } from "sonner";
import { useBalanceStore } from "@/stores/balanceStore";
import { useAuth } from "@/contexts/AuthContext";

const HoldingsPage = () => {
  const holdings = usePortfolioStore((s) => s.holdings);
  const sellStock = usePortfolioStore((s) => s.sellStock);
  const syncFromBackend = usePortfolioStore((s) => s.syncFromBackend);
  const { prices, fetchPrices, setSymbols } = useLivePrices([], 5000);
  const [holdingsView, setHoldingsView] = useState<
    "invested" | "returns" | "contribution" | "price"
  >("invested");
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<any | null>(null);
  const [selectedSellStock, setSelectedSellStock] = useState<Stock | null>(
    null
  );
  const { user } = useAuth();

  useEffect(() => {
    const syms = Array.from(
      new Set([...holdings.map((h) => `${h.symbol}.NS`)])
    );
    setSymbols(syms);
  }, [holdings]);

  useEffect(() => {
    if (user) {
      void syncFromBackend();
    }
  }, [user, syncFromBackend]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <main className="container mx-auto px-4 py-6">
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
                  <div key={holding.stockId} className="p-3 border rounded-md">
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
                              {pnl >= 0 ? "+" : "-"}₹{Math.abs(pnl).toFixed(2)}
                            </div>
                            <div className="text-sm">{pnlPct.toFixed(2)}%</div>
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
      </main>
    </div>
  );
};

export default HoldingsPage;
