import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import NavigationBar from "@/components/NavigationBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart as ReLineChart,
  Line,
  YAxis,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Simple type for chart data
interface StockDataPoint {
  date: string;
  close: number;
}

interface CurrentPriceInfo {
  symbol: string;
  shortName?: string;
  longName?: string;
  price?: number;
  diff?: number;
  regularMarketChangePercent?: number;
}

const SearchStockDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const [stockData, setStockData] = useState<StockDataPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<CurrentPriceInfo | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  useEffect(() => {
    const fetchStockData = async () => {
      if (!symbol) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-stock-data",
          {
            body: { symbol, days },
          },
        );

        if (error) throw error;

        if (data?.currentPrice) {
          setCurrentPrice(data.currentPrice as CurrentPriceInfo);
        }

        const formatted = (data?.historicalData || []).map(
          (item: { date: string; close: number }) => ({
            date: new Date(item.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            close: item.close,
          }),
        );

        setStockData(formatted);
      } catch (err) {
        console.error("Error fetching stock data from search view:", err);
        toast.error("Failed to fetch stock data.");
        setStockData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, [symbol, days]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg text-gray-800">
          <p className="font-bold text-sm">{`Date: ${label}`}</p>
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
          onClick={() => navigate(-1)}
          className="mb-4 text-gray-600 hover:text-gray-900"
        >
          ← Back
        </Button>

        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {symbol} <span className="text-learngreen-600">Overview</span>
          </h1>
          <p className="text-gray-500">
            View historical price chart and latest price. This view is read-only
            (no trading or AI prediction).
          </p>
        </div>

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
                  (currentPrice.diff ?? 0) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {currentPrice.diff && currentPrice.diff >= 0 ? "+" : ""}
                {(currentPrice.diff ?? 0).toFixed(2)} (
                {(currentPrice.regularMarketChangePercent ?? 0).toFixed(2)}%)
              </div>
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
        </div>

        <Card>
          <CardContent className="p-4 h-96">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="loader border-t-4 border-learngreen-600 rounded-full w-12 h-12 animate-spin"></div>
              </div>
            ) : stockData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart
                  data={stockData}
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
                    tickFormatter={(value) => `₹${Math.round(value as number)}`}
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
                </ReLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 flex justify-center items-center h-full">
                No data available for {symbol}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SearchStockDetail;
