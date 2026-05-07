
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface PortfolioChartProps {
  title: string;
  description?: string;
  value: number;
  change: number;
  changePercent: number;
  data?: { date: string; value: number }[];
  className?: string;
  height?: number;
}

/** Format a number as ₹XX,XXX.XX */
function formatCurrency(v: number): string {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Shorten large currency for Y-axis ticks: ₹1.2L, ₹75K etc. */
function formatYTick(v: number): string {
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

export function PortfolioChart({
  title,
  description,
  value,
  change,
  changePercent,
  data: chartData,
  className,
  height = 200,
}: PortfolioChartProps) {
  const isPositive = change >= 0;
  const hasData = chartData && chartData.length > 0;

  // Compute Y domain with 5% padding for a clean graph look
  const [yMin, yMax] = useMemo(() => {
    if (!hasData) return [0, 100];
    const values = chartData.map((d) => d.value).filter(Number.isFinite);
    if (values.length === 0) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || max * 0.05 || 100;
    const padding = range * 0.08;
    return [Math.max(0, min - padding), max + padding];
  }, [chartData, hasData]);

  // Determine first value for reference line (opening / start of range)
  const startValue = hasData ? chartData[0].value : 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <div className="text-2xl font-bold">{formatCurrency(value)}</div>
        <div className={cn("flex items-center gap-1", isPositive ? "text-green-600" : "text-red-600")}>
          <span>{isPositive ? "+" : ""}{formatCurrency(change).replace("₹", "")}</span>
          <span className="text-xs">({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <div className="w-full" style={{ height }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={isPositive ? "#22c55e" : "#ef4444"}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={isPositive ? "#22c55e" : "#ef4444"}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  strokeOpacity={0.5}
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />

                <YAxis
                  domain={[yMin, yMax]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={formatYTick}
                  width={55}
                  tickCount={5}
                />

                {/* Reference line at the start value for a Groww-like baseline */}
                {startValue > 0 && (
                  <ReferenceLine
                    y={startValue}
                    stroke="#d1d5db"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}

                <Tooltip
                  cursor={{
                    stroke: "#6b7280",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  animationDuration={150}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const val = d.value as number;
                      const diff = val - startValue;
                      const diffPct = startValue > 0 ? (diff / startValue) * 100 : 0;
                      const up = diff >= 0;
                      return (
                        <div className="rounded-lg border bg-white/95 backdrop-blur-sm px-3 py-2 shadow-lg min-w-[180px]">
                          <div className="text-xs text-gray-500 mb-1">{d.date}</div>
                          <div className="text-sm font-bold text-gray-900">{formatCurrency(val)}</div>
                          <div className={cn("text-xs font-medium", up ? "text-green-600" : "text-red-500")}>
                            {up ? "+" : ""}{formatCurrency(diff).replace("₹", "")} ({up ? "+" : ""}{diffPct.toFixed(2)}%)
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? "#22c55e" : "#ef4444"}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#portfolioGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: isPositive ? "#22c55e" : "#ef4444",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            /* Empty state when no chart data is available */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-gray-400 text-sm font-medium">Market is closed</div>
                <div className="text-gray-300 text-xs mt-1">Chart data will appear during market hours (9:15 AM – 3:30 PM)</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
