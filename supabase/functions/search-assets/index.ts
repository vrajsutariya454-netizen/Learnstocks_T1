// @ts-nocheck
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function yahooSearch(query: string) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query,
  )}&quotesCount=20&newsCount=0`;
  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error(`Yahoo search failed with status ${resp.status}`);
  }

  const data = await resp.json();
  // We mostly care about data.quotes; pass the whole object through
  return data;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = body.query as string | undefined;

    if (!query || !query.trim()) {
      // Return an empty array if the query is empty
      return new Response(JSON.stringify({ quotes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const searchResults = await yahooSearch(query.trim());

    return new Response(JSON.stringify(searchResults), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("search-assets error", error);
    // Instead of returning a 5xx (which surfaces as
    // "Edge Function returned a non-2xx status code" in the client),
    // degrade gracefully and return an empty result set. This keeps the
    // UI responsive and simply shows "No results" for transient Yahoo
    // failures or rate limits.
    return new Response(
      JSON.stringify({
        quotes: [],
        error: (error as Error).message ?? String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
