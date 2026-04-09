import { toast } from "sonner";
import React, { useEffect, useState } from "react";
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
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import NavigationBar from "@/components/NavigationBar";
import { supabase } from "../lib/supabaseClient.ts";

// Define a type for a single data point in our chart
type StockDataPoint = {
  date: string;
  close: number;
};

const StockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [stockData, setStockData] = useState<StockDataPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<any | null>(null);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">("buy");
  const [selectedTradeStock, setSelectedTradeStock] = useState<any | null>(
    null,
  );
  const [days, setDays] = useState(90); // Default to 90 days for a better initial view
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);

  useEffect(() => {
    const fetchStockData = async () => {
      if (!symbol) return;
      setLoading(true);
      setPrediction(null); // Clear previous prediction when data changes
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-stock-data",
          {
            body: { symbol, days },
          },
        );

        if (error) throw error;

        // store current price (if present) and historical data for chart
        if (data?.currentPrice) setCurrentPrice(data.currentPrice);
        const formattedData = (data.historicalData || []).map(
          (item: { date: string; close: number }) => ({
            ...item,
            date: new Date(item.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
          }),
        );
        setStockData(formattedData);
      } catch (err) {
        console.error("Error fetching stock data:", err);
        toast.error("Failed to fetch stock data.");
        setStockData([]);
      }
      setLoading(false);
    };
    fetchStockData();
  }, [symbol, days]);

  // live price helper
  const { prices, fetchPrices } = useLivePrices([], 5000);
  const buyStock = usePortfolioStore((s) => s.buyStock);
  const sellStock = usePortfolioStore((s) => s.sellStock);

  const openTrade = async (action: "buy" | "sell") => {
    if (!symbol) return;
    // Normalize symbols so we don't accidentally call MAHABANK.NS.NS
    const baseSymbol = symbol.replace(".NS", "");
    const ns =
      baseSymbol.includes(".") || baseSymbol.includes("-")
        ? baseSymbol
        : `${baseSymbol}.NS`;

    const fetched = await fetchPrices([ns]);
    const live = fetched?.[baseSymbol] || prices?.[baseSymbol];
    const priceToUse = live?.price ?? currentPrice?.price ?? 0;
    const stockObj = {
      id: baseSymbol,
      symbol: baseSymbol,
      name: currentPrice?.shortName || currentPrice?.longName || symbol,
      price: priceToUse,
      change: live?.change ?? currentPrice?.diff ?? 0,
      changePercent:
        live?.changePercent ?? currentPrice?.regularMarketChangePercent ?? 0,
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
      if (ok)
        toast.success(
          `Bought ${qty} ${selectedTradeStock.symbol} @ ₹${priceToUse.toFixed(
            2,
          )}`,
        );
      else toast.error("Buy failed: insufficient balance or invalid quantity");
    } else {
      ok = sellStock(selectedTradeStock.id, qty, priceToUse);
      if (ok)
        toast.success(
          `Sold ${qty} ${selectedTradeStock.symbol} @ ₹${priceToUse.toFixed(2)}`,
        );
      else toast.error("Sell failed: invalid qty");
    }

    if (ok) {
      try {
        // append a history snapshot
        const portfolio = usePortfolioStore.getState();
        const combined = { ...(prices || {}) };
        const investedValue = portfolio.holdings.reduce((s, h) => {
          const p = combined[h.symbol]?.price ?? h.avgBuyPrice;
          return s + h.quantity * p;
        }, 0);
        usePortfolioStore.getState().addHistoryPoint(investedValue);
      } catch (err) {
        console.error("Failed to append history point after trade", err);
      }
    }

    setIsTradeOpen(false);
    setSelectedTradeStock(null);
  };

  const handlePredict = async () => {
    if (!stockData.length || !symbol) {
      toast.error("No stock data is available to make a prediction.");
      return;
    }

    setPredicting(true);

    try {
      const pythonApiUrl = `${import.meta.env.VITE_API_BASE_URL}/predict`;

      const requestBody = {
        symbol,
        days,
        closePrices: stockData.map((s) => s.close),
      };

      const response = await fetch(pythonApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Prediction API failed: ${errorText}`);
      }

      const data = await response.json();

      if (data.predicted_next_close !== undefined) {
        setPrediction(data.predicted_next_close);
        toast.success(`Successfully predicted next price for ${symbol}!`);
      } else {
        throw new Error("Prediction API did not return a valid result.");
      }
    } catch (err: any) {
      console.error("Error getting prediction:", err);
      toast.error("Prediction failed.", {
        description:
          err.message || "Please check the Python terminal for errors.",
      });
    } finally {
      setPredicting(false);
    }
  };

  const lastClose = stockData.length
    ? stockData[stockData.length - 1].close
    : null;
  const shouldBuy =
    lastClose !== null && prediction !== null ? prediction > lastClose : null;

  // Append prediction to chart data if available
  const chartData =
    prediction !== null
      ? [...stockData, { date: "Pred.", close: prediction }]
      : stockData;

  // Custom Tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg text-gray-800">
          <p className="font-bold text-sm">
            {label === "Pred." ? `Prediction` : `Date: ${label}`}
          </p>
          <p className="text-learngreen-600">{`Price: ₹${payload[0].value.toFixed(
            2,
          )}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <main className="container mx-auto px-4 py-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/predictions")}
          className="mb-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Predictions
        </Button>
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {symbol} <span className="text-learngreen-600">Stock Analysis</span>
          </h1>
          <p className="text-gray-500">
            Historical data and AI-powered price prediction.
          </p>
        </div>
        {/* Summary card with live price */}
        {currentPrice && (
          <div className="mb-4 bg-white p-4 rounded-lg shadow flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">
                {currentPrice.shortName || currentPrice.longName || symbol}
              </div>
              <div className="text-2xl font-bold">
                ₹{(currentPrice.price ?? 0).toFixed(2)}
              </div>
              <div
                className={`text-sm ${
                  currentPrice.diff >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {currentPrice.diff >= 0 ? "+" : ""}
                {(currentPrice.diff ?? 0).toFixed(2)} (
                {(currentPrice.regularMarketChangePercent ?? 0).toFixed(2)}%)
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => openTrade("buy")}
                className="bg-learngreen-600 hover:bg-learngreen-700"
              >
                Buy
              </Button>
              <Button variant="outline" onClick={() => openTrade("sell")}>
                Sell
              </Button>
            </div>
          </div>
        )}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-learngreen-500"
          >
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
          </select>
          <Button
            onClick={handlePredict}
            disabled={predicting || loading}
            className="bg-learngreen-600 hover:bg-learngreen-700 disabled:opacity-50"
          >
            {predicting ? "Predicting..." : "Run AI Prediction"}
          </Button>
        </div>
        <Card>
          <CardContent className="p-4 h-96">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="loader border-t-4 border-learngreen-600 rounded-full w-12 h-12 animate-spin"></div>
              </div>
            ) : stockData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    angle={-45}
                    textAnchor="end"
                    height={50}
                    interval="preserveStartEnd"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <YAxis
                    domain={["dataMin - 10", "dataMax + 10"]}
                    tickFormatter={(value) => `₹${Math.round(value)}`}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Close Price"
                  />
                  {prediction !== null && (
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Prediction"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 flex justify-center items-center h-full">
                No data available for {symbol}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Mobile fixed CTA bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t flex gap-2">
          <Button
            className="flex-1 bg-learngreen-600"
            onClick={() => openTrade("buy")}
          >
            Buy
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => openTrade("sell")}
          >
            Sell
          </Button>
        </div>

        <TradeDialog
          open={isTradeOpen}
          onOpenChange={setIsTradeOpen}
          stock={selectedTradeStock}
          action={tradeAction}
          onConfirm={onConfirmTrade}
        />
        {shouldBuy !== null && (
          <Card
            className={`mt-6 ${
              shouldBuy
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <CardContent className="p-4 flex items-center gap-4">
              {shouldBuy ? (
                <TrendingUp size={28} className="text-green-600" />
              ) : (
                <TrendingDown size={28} className="text-red-600" />
              )}
              <div>
                <p className="font-bold text-gray-800">
                  Predicted Price:{" "}
                  <span className="text-xl">₹{prediction?.toFixed(2)}</span>
                </p>
                <p
                  className={`font-semibold mt-1 ${
                    shouldBuy ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {/* Updated Recommendation Logic */}
                  Recommendation: {shouldBuy ? "BUY" : "SELL / HOLD"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default StockDetail;
