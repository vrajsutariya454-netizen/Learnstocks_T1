// This file is an Edge Function meant to run on Deno (Supabase functions).
// The repository's TypeScript tooling (tsc / TS Server) runs in the Node project
// context and doesn't understand Deno-specific imports like `https://deno.land/...`.
// To avoid editor/type-check noise for this Deno-targeted file we disable TS here.
// @ts-nocheck
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Add CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type HistoricalPoint = { date: string; close: number };

async function fetchCurrentQuote(symbol: string) {
  const resp = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?interval=1d&range=1d`,
  );

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch current quote for ${symbol} (status ${resp.status})`,
    );
  }

  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  if (!result?.meta) {
    throw new Error(`No quote data returned for ${symbol}`);
  }

  const meta = result.meta;
  // Sometimes the meta block does not contain a regularMarketPrice even
  // though the chart data has recent closes. In that case, fall back to the
  // latest valid close from the time-series so that we never silently return
  // a price of 0.
  let lastClose: number | null = null;
  try {
    const closes: (number | null)[] | undefined =
      result?.indicators?.quote?.[0]?.close;
    if (Array.isArray(closes) && closes.length > 0) {
      for (let i = closes.length - 1; i >= 0; i--) {
        const c = closes[i];
        if (c != null && !Number.isNaN(c)) {
          lastClose = c;
          break;
        }
      }
    }
  } catch (_) {
    // Ignore errors from historical parsing; we'll just rely on meta fields.
  }

  const price =
    meta.regularMarketPrice ??
    meta.chartPreviousClose ??
    meta.previousClose ??
    lastClose ??
    null;

  const previousClose =
    meta.previousClose ?? meta.chartPreviousClose ?? lastClose ?? null;

  const diff =
    price != null && previousClose != null ? price - previousClose : null;

  const changePercent =
    typeof meta.regularMarketChangePercent === "number"
      ? meta.regularMarketChangePercent
      : diff != null && previousClose
        ? (diff / previousClose) * 100
        : null;

  return {
    price,
    diff,
    regularMarketChangePercent: changePercent,
    previousClose,
    shortName: meta.shortName ?? meta.symbol ?? symbol,
    longName: meta.longName ?? meta.shortName ?? meta.symbol ?? symbol,
    symbol: meta.symbol ?? symbol,
  };
}

async function fetchHistorical(
  symbol: string,
  days: number,
): Promise<HistoricalPoint[]> {
  if (!days || days <= 0) return [];

  // Use the Yahoo chart API instead of CSV download (which now requires auth)
  const range = `${days}d`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=${range}`;

  const resp = await fetch(url);

  if (!resp.ok) {
    console.error(
      "get-stock-data historical fetch failed",
      symbol,
      resp.status,
      resp.statusText,
    );
    return [];
  }

  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
    console.error("get-stock-data historical missing fields", symbol);
    return [];
  }

  const timestamps: number[] = result.timestamp;
  const closes: (number | null)[] = result.indicators.quote[0].close;

  const points: HistoricalPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (close == null || Number.isNaN(close)) continue;
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    points.push({ date, close });
  }

  return points;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const symbol = body.symbol as string | undefined;
    const days = Number(body.days) || 0;

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: "Stock symbol is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const currentPrice = await fetchCurrentQuote(symbol);
    const historicalData = days > 0 ? await fetchHistorical(symbol, days) : [];

    const data = { symbol, currentPrice, historicalData };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("get-stock-data error", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message ?? String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
