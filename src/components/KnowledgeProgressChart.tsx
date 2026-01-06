import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { KnowledgeProgressPoint, KnowledgeTrend } from "@/types";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

interface KnowledgeProgressChartProps {
  data: KnowledgeProgressPoint[];
  trend: KnowledgeTrend | null;
  loading?: boolean;
  className?: string;
}

const trendLabelMap: Record<KnowledgeTrend, string> = {
  improving: "Improving",
  stagnant: "Stable",
  declining: "Declining",
};

const trendColorMap: Record<KnowledgeTrend, string> = {
  improving: "text-emerald-600",
  stagnant: "text-gray-600",
  declining: "text-red-600",
};

const MarketKnowledgeProgressChart: React.FC<KnowledgeProgressChartProps> = ({
  data,
  trend,
  loading,
  className,
}) => {
  const hasData = data && data.length > 0;

  const chartData = React.useMemo(() => {
    // Group points by snapshot_date (YYYY-MM-DD) and sum activityScore per day.
    const groups: Record<
      string,
      {
        dateLabel: string;
        sumScore: number; // aggregated activityScore for the day
        count: number; // number of quizzes/challenges that day
        gameLabels: string[];
        outcomes: string[];
      }
    > = {};

    (data || []).forEach((point) => {
      const dateKey = (point.snapshot_date || "").slice(0, 10);
      const date = new Date(point.snapshot_date);
      const label = isNaN(date.getTime())
        ? point.snapshot_date
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

      const gameLabel =
        point.gameType === "quiz"
          ? `Quiz: ${(point.activityMetadata?.title as string) || point.gameId}`
          : `Challenge: ${(point.activityMetadata?.symbol as string) || point.gameId}`;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateLabel: label,
          sumScore: 0,
          count: 0,
          gameLabels: [],
          outcomes: [],
        };
      }

      groups[dateKey].sumScore += Number(point.activityScore || 0);
      groups[dateKey].count += 1;
      if (gameLabel) groups[dateKey].gameLabels.push(gameLabel);
      if (point.outcome) groups[dateKey].outcomes.push(point.outcome);
    });

    // Convert groups back to an ordered array (preserve original chronological order by date)
    const ordered = Object.keys(groups)
      .sort()
      .map((key, index) => {
        const g = groups[key];
        const maxPossible = g.count * 100;
        // Percentage normalization: (sum / (100 * count)) * 100 => sum / count
        const normalized = g.count > 0 ? g.sumScore / g.count : 0;
        const capped = Math.min(100, normalized);

        return {
          index,
          dateLabel: g.dateLabel,
          // value shown on chart: normalized and capped to 100
          knowledgeScore: capped,
          // raw totals for tooltip/context
          rawScore: g.sumScore,
          count: g.count,
          maxPossible,
          gameLabel: g.gameLabels.join(" · "),
          outcome: g.outcomes[g.outcomes.length - 1] || undefined,
        };
      });

    return ordered;
  }, [data]);

  const chartConfig = {
    knowledgeScore: {
      label: "Knowledge Score",
      color: "hsl(142.1 76.2% 36.3%)",
    },
  } as const;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Market Knowledge Progression</CardTitle>
          <CardDescription>
            Tracks how your overall market understanding evolves after each
            game.
          </CardDescription>
        </div>
        {trend && (
          <div
            className={cn(
              "text-sm font-medium px-2 py-1 rounded-full border bg-white",
              trendColorMap[trend]
            )}
          >
            {trendLabelMap[trend]}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            Loading progression...
          </div>
        ) : !hasData ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No progression data yet. Complete a quiz or market challenge to get
            started.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="w-full h-64">
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      if (!payload?.length) return null;
                      const p = payload[0].payload as any;
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{p.dateLabel}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.gameLabel}
                          </span>
                        </div>
                      );
                    }}
                    formatter={(value, _name, item) => {
                      const p = item?.payload as any;
                      const outcomeLabel =
                        p.outcome === "win"
                          ? "Improved"
                          : p.outcome === "loss"
                          ? "Declined"
                          : "Completed";

                      const normalized = Number(value);
                      const raw = Number(p.rawScore || 0);
                      const maxPossible = Number(p.maxPossible || 100);

                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs text-muted-foreground">
                            {outcomeLabel}
                          </span>
                          <span className="font-mono font-medium">
                            {normalized.toFixed(1)} / 100
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Combined: {raw.toFixed(1)} / {maxPossible}
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="knowledgeScore"
                stroke="hsl(142.1 76.2% 36.3%)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketKnowledgeProgressChart;
