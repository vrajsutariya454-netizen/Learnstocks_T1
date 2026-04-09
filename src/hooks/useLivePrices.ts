import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type PriceInfo = {
  symbol: string;
  name?: string;
  price: number;
  change?: number;
  changePercent?: number;
};

export function useLivePrices(
  initialSymbols: string[] = [],
  intervalMs = 5000,
) {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const symbolsRef = useRef<string[]>(initialSymbols);
  const timerRef = useRef<number | null>(null);

  const fetchPrices = useCallback(async (symbols?: string[]) => {
    const toFetchRaw = symbols || symbolsRef.current || [];
    // Smarter logic: If it has a dot or is a known US ticker, don't append .NS.
    const usTickers = [
      "AAPL",
      "MSFT",
      "NVDA",
      "GOOGL",
      "AMZN",
      "TSLA",
      "META",
      "AMD",
      "NFLX",
      "INTC",
      "PYPL",
      "ADBE",
      "CSCO",
      "PEP",
      "AVGO",
      "TXN",
      "TMUS",
      "QCOM",
      "COST",
      "SBUX",
      "GILD",
      "INTU",
      "MDLZ",
      "FISV",
      "ADP",
      "ISRG",
      "REGN",
      "VRTX",
      "CSX",
      "BIIB",
      "AMGN",
      "ADI",
      "ILMN",
      "LRCX",
      "MU",
      "ATVI",
      "MELI",
      "MNST",
      "KDP",
      "MAR",
      "CTAS",
      "ORLY",
      "SNPS",
      "PCAR",
      "CDNS",
      "ALGN",
      "AEP",
      "SGEN",
      "ZS",
      "FTNT",
      "VRSK",
      "PAYX",
      "ODFL",
      "CHTR",
      "FAST",
      "IDXX",
      "ROST",
      "EXC",
      "LULU",
      "CPRT",
      "XEL",
      "DLTR",
      "CTSH",
      "WBA",
      "DXCM",
      "SIRI",
      "VRSN",
      "ANSS",
      "CDW",
      "BKR",
      "MTCH",
      "CERN",
      "SWKS",
      "PTHF",
      "CHKP",
      "TCOM",
      "ALNX",
      "NTRS",
      "SPLK",
      "OKTA",
      "DOCU",
      "NTAP",
      "INCY",
      "V",
      "JPM",
      "BAC",
      "WFC",
      "C",
      "GS",
      "MS",
      "DIS",
      "BA",
      "CAT",
      "MMM",
      "CVX",
      "XOM",
      "KO",
      "PEP",
      "WMT",
      "TGT",
      "PG",
      "JNJ",
      "PFE",
      "MRK",
      "ABBV",
      "UNH",
      "LLY",
      "NKE",
    ];
    const toFetch = toFetchRaw.map((s) =>
      s.includes(".") || usTickers.includes(s) || s.includes("-")
        ? s
        : `${s}.NS`,
    );
    if (toFetch.length === 0) return {} as Record<string, PriceInfo>;

    try {
      // Use Supabase Edge Function `get-stock-data` for each symbol so we match other pages
      const promises = toFetch.map((symbol) =>
        supabase.functions
          .invoke("get-stock-data", { body: { symbol } })
          .then(({ data, error }) => {
            if (error || !data?.currentPrice) return null;
            const cp = data.currentPrice;
            // Choose a sensible price: prefer the real-time price, otherwise
            // fall back to previousClose. If we still don't have a valid,
            // positive price, treat this quote as unavailable instead of 0.
            const rawPrice: number | null =
              (typeof cp.price === "number" ? cp.price : null) ??
              (typeof cp.previousClose === "number" ? cp.previousClose : null);

            if (
              rawPrice == null ||
              !Number.isFinite(rawPrice) ||
              rawPrice <= 0
            ) {
              return null;
            }

            // compute percent change: prefer provided percent, otherwise compute from previousClose if available
            const pct =
              typeof cp.regularMarketChangePercent === "number"
                ? cp.regularMarketChangePercent
                : cp.previousClose && typeof cp.diff === "number"
                  ? (cp.diff / cp.previousClose) * 100
                  : 0;
            return {
              symbol:
                cp.symbol?.replace(".NS", "") || symbol.replace(".NS", ""),
              name: cp.longName || cp.shortName || cp.symbol,
              price: rawPrice,
              change: cp.diff || 0,
              changePercent: typeof pct === "number" ? pct : 0,
            } as PriceInfo;
          }),
      );

      const results = await Promise.all(promises);
      const map: Record<string, PriceInfo> = {};
      results.filter(Boolean).forEach((p: any) => {
        map[p.symbol] = p;
      });

      setPrices((prev) => ({ ...prev, ...map }));
      return map;
    } catch (err) {
      console.error("useLivePrices fetch error:", err);
      return {} as Record<string, PriceInfo>;
    }
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => fetchPrices(), intervalMs);
  }, [fetchPrices, intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setSymbols = useCallback(
    (symbols: string[]) => {
      symbolsRef.current = symbols;
      fetchPrices(symbols);
    },
    [fetchPrices],
  );

  useEffect(() => {
    // initial
    if (initialSymbols.length > 0) fetchPrices(initialSymbols);
    start();
    return () => stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { prices, fetchPrices, setSymbols, start, stop } as const;
}

export default useLivePrices;
