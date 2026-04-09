import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import NavigationBar from "@/components/NavigationBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Search as SearchIcon,
  LineChart,
  Shield,
  Box,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// NEW: A predefined list of popular Indian assets to show on page load
const POPULAR_ASSETS = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS", // Stocks
  "NIFTYBEES.NS",
  "BANKBEES.NS", // ETFs
  "0P0000XW6J.BO", // SBI Bluechip Fund (Example Mutual Fund)
];

// Type for the search results from our Edge Function
interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType: "EQUITY" | "ETF" | "MUTUALFUND" | "INDEX" | "CURRENCY" | "FUTURE";
  exchange: string;
}

// NEW: Type for the fetched data of popular assets
interface PopularAssetData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const Search = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // NEW: State for the popular assets shown on page load
  const [popularAssets, setPopularAssets] = useState<PopularAssetData[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);

  const navigate = useNavigate();

  // NEW: useEffect to fetch data for the popular assets on initial page load
  useEffect(() => {
    const fetchPopularAssets = async () => {
      setIsLoadingPopular(true);
      try {
        const promises = POPULAR_ASSETS.map((symbol) =>
          supabase.functions.invoke("get-stock-data", {
            body: { symbol },
          }),
        );

        const responses = await Promise.all(promises);

        const fetchedAssets = responses
          .filter(({ data, error }) => !error && data?.currentPrice)
          .map(({ data }) => {
            const cp = data.currentPrice;
            // Prefer a real-time price; otherwise fall back to previousClose.
            const rawPrice: number =
              (typeof cp.price === "number" ? cp.price : null) ??
              (typeof cp.previousClose === "number" ? cp.previousClose : 0);

            // If we still don't have a sane price, skip this asset rather
            // than showing ₹0.00 which confuses the user.
            if (!rawPrice || !Number.isFinite(rawPrice) || rawPrice <= 0) {
              return null;
            }

            const pct =
              typeof cp.regularMarketChangePercent === "number"
                ? cp.regularMarketChangePercent
                : cp.previousClose && typeof cp.diff === "number"
                  ? (cp.diff / cp.previousClose) * 100
                  : 0;
            return {
              symbol: data.symbol,
              name: cp.longName || cp.shortName || data.symbol,
              price: rawPrice,
              change: cp.diff || 0,
              changePercent: typeof pct === "number" ? pct : 0,
            };
          });

        // Filter out any nulls from the skip-logic above
        setPopularAssets(fetchedAssets.filter(Boolean) as PopularAssetData[]);
      } catch (error) {
        console.error("Failed to fetch popular assets", error);
        toast.error("Could not load popular assets.");
      } finally {
        setIsLoadingPopular(false);
      }
    };

    fetchPopularAssets();
  }, []);

  // Debouncing logic for the search bar
  useEffect(() => {
    if (!searchQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const debounceTimer = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // Main search function
  const performSearch = async (query: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("search-assets", {
        body: { query },
      });
      if (error) {
        const status = (error as any)?.context?.status;
        const message =
          status === 429
            ? "Search is temporarily rate-limited by the data provider. Please try again in a minute."
            : (error as any)?.message || "Search failed. Please try again.";
        toast.error("Search failed", { description: message });
        setResults([]);
        return;
      }
      setResults((data as any)?.quotes || []);
    } catch (error: any) {
      console.error("Error searching assets:", error);
      const status = error?.context?.status;
      const message =
        status === 429
          ? "Search is temporarily rate-limited by the data provider. Please try again in a minute."
          : error?.message || "Search failed. Please try again.";
      toast.error("Search failed", { description: message });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const stocks = useMemo(
    () => results.filter((r) => r.quoteType === "EQUITY"),
    [results],
  );
  const etfs = useMemo(
    () => results.filter((r) => r.quoteType === "ETF"),
    [results],
  );
  const mutualFunds = useMemo(
    () => results.filter((r) => r.quoteType === "MUTUALFUND"),
    [results],
  );

  const handleViewDetails = (symbol: string) => {
    if (!symbol) return;
    // For Search we show a read-only overview page without AI prediction/trading
    navigate(`/stock/${symbol}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationBar />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Search Investments</h1>
          <p className="text-gray-500">
            Find real-time data for stocks, ETFs, and mutual funds.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-8 sticky top-[70px] z-10">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search by name or symbol (e.g., RELIANCE.NS, NIFTYBEES)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
        </div>

        {isLoading && (
          <div className="text-center p-8 text-gray-600">Searching...</div>
        )}

        {/* Show search results when user is typing */}
        {!isLoading && searchQuery && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Tabs defaultValue="stocks">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="stocks">
                  Stocks ({stocks.length})
                </TabsTrigger>
                <TabsTrigger value="mutual-funds">
                  Mutual Funds ({mutualFunds.length})
                </TabsTrigger>
                <TabsTrigger value="etfs">ETFs ({etfs.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="stocks" className="p-4">
                {stocks.length > 0 ? (
                  <div className="grid gap-4">
                    {stocks.map((stock) => (
                      <SearchResultItem
                        key={stock.symbol}
                        item={stock}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                ) : (
                  <NoResultsFound />
                )}
              </TabsContent>
              <TabsContent value="mutual-funds" className="p-4">
                {mutualFunds.length > 0 ? (
                  <div className="grid gap-4">
                    {mutualFunds.map((fund) => (
                      <SearchResultItem
                        key={fund.symbol}
                        item={fund}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                ) : (
                  <NoResultsFound />
                )}
              </TabsContent>
              <TabsContent value="etfs" className="p-4">
                {etfs.length > 0 ? (
                  <div className="grid gap-4">
                    {etfs.map((etf) => (
                      <SearchResultItem
                        key={etf.symbol}
                        item={etf}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                ) : (
                  <NoResultsFound />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* NEW: Show popular assets when search bar is empty */}
        {!searchQuery && !isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>Popular Stocks</CardTitle>
              <CardDescription>
                Here are some of the most-watched assets in the Indian market.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPopular ? (
                // Loading Skeleton
                <div className="grid md:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="border p-4 rounded-lg animate-pulse"
                    >
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                // Actual Data
                <div className="grid md:grid-cols-2 gap-4">
                  {popularAssets.map((asset) => (
                    <PopularAssetCard key={asset.symbol} asset={asset} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

// Component for displaying a single search result
const SearchResultItem = ({
  item,
  onViewDetails,
}: {
  item: SearchResult;
  onViewDetails: (symbol: string) => void;
}) => {
  const getIcon = (quoteType: SearchResult["quoteType"]) => {
    switch (quoteType) {
      case "EQUITY":
        return <LineChart className="h-5 w-5 text-blue-500" />;
      case "ETF":
        return <Box className="h-5 w-5 text-green-500" />;
      case "MUTUALFUND":
        return <Shield className="h-5 w-5 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="border p-4 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-2 rounded-full">
            {getIcon(item.quoteType)}
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">
              {item.shortname || item.longname}
            </h4>
            <div className="text-sm text-gray-500">
              {item.symbol} | {item.exchange}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(item.symbol)}
        >
          View Details
        </Button>
      </div>
    </div>
  );
};

// NEW: A dedicated component to display a popular asset card
const PopularAssetCard = ({ asset }: { asset: PopularAssetData }) => {
  const isPositive = asset.change >= 0;
  return (
    <div className="border p-4 rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold text-gray-800">{asset.symbol}</h4>
          <p className="text-sm text-gray-500 truncate max-w-[200px]">
            {asset.name}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-lg">₹{asset.price.toFixed(2)}</p>
          <div
            className={`flex items-center justify-end text-sm font-semibold ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            <span>
              {asset.change.toFixed(2)} ({asset.changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NoResultsFound = () => (
  <div className="text-center p-8 text-gray-500">
    <p>No results of this type found for the current search.</p>
  </div>
);

export default Search;
