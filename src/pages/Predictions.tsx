import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import NavigationBar from "@/components/NavigationBar";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

// Fallback default watchlist when no search query
const defaultStocks = [
  "ETERNAL.NS",
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "ICICIBANK.NS",
  "HINDUNILVR.NS",
  "SBIN.NS",
  "BHARTIARTL.NS",
  "ITC.NS",
  "KOTAKBANK.NS",
  "LT.NS",
  "BAJFINANCE.NS",
  "AXISBANK.NS",
  "ASIANPAINT.NS",
  "MARUTI.NS",
  "WIPRO.NS",
  "ADANIENT.NS",
  "ULTRACEMCO.NS",
  "NESTLEIND.NS",
  "ONGC.NS",
];

// Define a type for our stock data
type StockData = {
  price: number;
  diff: number;
};

// Minimal type for global search results
interface SearchAssetResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: "EQUITY" | "ETF" | "MUTUALFUND" | "INDEX" | "CURRENCY" | "FUTURE";
  exchange: string;
}

const Predictions = () => {
  const navigate = useNavigate();
  const [stockData, setStockData] = useState<Record<string, StockData>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchAssetResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const fetchPricesFor = async (symbols: string[]) => {
      if (!symbols.length) return;
      setLoading(true);
      try {
        const promises = symbols.map((symbol) =>
          supabase.functions
            .invoke("get-stock-data", {
              body: { symbol },
            })
            .then(({ data, error }) => {
              if (error || !data?.currentPrice) {
                console.error(`Error for ${symbol}:`, error);
                return null;
              }
              const cp = data.currentPrice as any;
              const price =
                (typeof cp.price === "number" && cp.price) ||
                (typeof cp.previousClose === "number" && cp.previousClose) ||
                null;
              if (!price || !Number.isFinite(price)) return null;
              const diff = typeof cp.diff === "number" ? cp.diff : 0;
              return { [symbol]: { price, diff } as StockData };
            }),
        );

        const results = await Promise.all(promises);
        const mergedData = results
          .filter(Boolean)
          .reduce(
            (acc, current) => ({ ...acc, ...current }),
            {} as Record<string, StockData>,
          );

        setStockData((prev) => ({ ...prev, ...mergedData }));
      } finally {
        setLoading(false);
      }
    };

    // initial load for default list
    fetchPricesFor(defaultStocks);
    const interval = setInterval(() => fetchPricesFor(defaultStocks), 300000); // Refresh every 5 mins
    return () => clearInterval(interval);
  }, []);

  // Global search to enable any NSE stock in Predictions list
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "search-assets",
          {
            body: { query: searchQuery },
          },
        );
        if (error) {
          const status = (error as any)?.context?.status;
          const message =
            status === 429
              ? "Search is temporarily rate-limited by the data provider. Please try again in a minute."
              : (error as any)?.message || "Search failed. Please try again.";
          toast.error("Search failed", { description: message });
          setSearchResults([]);
        } else {
          const quotes = (data?.quotes || []) as SearchAssetResult[];
          setSearchResults(quotes);

          const equitySymbols = quotes
            .filter(
              (q) =>
                q.quoteType === "EQUITY" &&
                (q.exchange?.toUpperCase().includes("NSE") ||
                  q.symbol.endsWith(".NS")),
            )
            .map((q) =>
              q.symbol.endsWith(".NS") ? q.symbol : `${q.symbol}.NS`,
            );

          if (equitySymbols.length) {
            const unique = Array.from(new Set(equitySymbols));
            const promises = unique.map((symbol) =>
              supabase.functions
                .invoke("get-stock-data", {
                  body: { symbol },
                })
                .then(({ data, error }) => {
                  if (error) {
                    console.error(`Error for ${symbol}:`, error);
                    return null;
                  }
                  const cp = data.currentPrice as any;
                  const price =
                    (typeof cp.price === "number" && cp.price) ||
                    (typeof cp.previousClose === "number" &&
                      cp.previousClose) ||
                    null;
                  if (!price || !Number.isFinite(price)) return null;
                  const diff = typeof cp.diff === "number" ? cp.diff : 0;
                  return { [symbol]: { price, diff } as StockData };
                }),
            );
            const results = await Promise.all(promises);
            const mergedData = results
              .filter(Boolean)
              .reduce(
                (acc, current) => ({ ...acc, ...current }),
                {} as Record<string, StockData>,
              );
            setStockData((prev) => ({ ...prev, ...mergedData }));
          }
        }
      } catch (err) {
        console.error("Predictions search error:", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStockClick = (symbol: string) => {
    navigate(`/predictions/${symbol}`);
  };

  // Build list to display: when searching, show global results; otherwise default list
  const displaySymbols = useMemo(() => {
    if (!searchQuery) return defaultStocks;
    if (!searchResults.length) return [] as string[];

    return searchResults
      .filter(
        (q) =>
          q.quoteType === "EQUITY" &&
          (q.exchange?.toUpperCase().includes("NSE") ||
            q.symbol.endsWith(".NS")),
      )
      .map((q) => (q.symbol.endsWith(".NS") ? q.symbol : `${q.symbol}.NS`));
  }, [searchQuery, searchResults]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />
      <main className="container mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
            AI Stock <span className="text-learngreen-600">Predictions</span>
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Track real-time prices and use AI to predict future trends.
          </p>
        </div>

        <div className="mb-8 max-w-md mx-auto">
          <Input
            type="text"
            placeholder="Search for a stock symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-3"
          />
        </div>

        {loading || searchLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="loader border-t-4 border-learngreen-600 rounded-full w-12 h-12 animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displaySymbols.map((symbol) => {
              const data = stockData[symbol];
              const price = data?.price ?? 0;
              const diff = data?.diff ?? 0;
              const isPositive = diff >= 0;

              return (
                <Card
                  key={symbol}
                  onClick={() => handleStockClick(symbol)}
                  className="cursor-pointer hover:border-learngreen-500 hover:shadow-lg transition-all"
                >
                  <CardHeader className="p-4">
                    <CardTitle>{symbol}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-2xl font-bold text-gray-800">
                      ₹{price.toFixed(2)}
                    </p>
                    <div
                      className={`mt-1 font-semibold flex items-center text-sm ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUp className="h-4 w-4 mr-1" />
                      ) : (
                        <ArrowDown className="h-4 w-4 mr-1" />
                      )}
                      <span>{diff.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Predictions;
