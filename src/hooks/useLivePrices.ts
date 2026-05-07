import { useEffect, useState, useRef, useCallback } from "react";
import { fetchStockBatch, type StockQuoteResponse } from "@/services/stockApi";
import { isNSEMarketOpen } from "@/lib/marketHours";

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
      "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "META", "AMD",
      "NFLX", "INTC", "PYPL", "ADBE", "CSCO", "PEP", "AVGO", "TXN",
      "TMUS", "QCOM", "COST", "SBUX", "GILD", "INTU", "MDLZ", "FISV",
      "ADP", "ISRG", "REGN", "VRTX", "CSX", "BIIB", "AMGN", "ADI",
      "ILMN", "LRCX", "MU", "ATVI", "MELI", "MNST", "KDP", "MAR",
      "CTAS", "ORLY", "SNPS", "PCAR", "CDNS", "ALGN", "AEP", "SGEN",
      "ZS", "FTNT", "VRSK", "PAYX", "ODFL", "CHTR", "FAST", "IDXX",
      "ROST", "EXC", "LULU", "CPRT", "XEL", "DLTR", "CTSH", "WBA",
      "DXCM", "SIRI", "VRSN", "ANSS", "CDW", "BKR", "MTCH", "CERN",
      "SWKS", "PTHF", "CHKP", "TCOM", "ALNX", "NTRS", "SPLK", "OKTA",
      "DOCU", "NTAP", "INCY", "V", "JPM", "BAC", "WFC", "C", "GS",
      "MS", "DIS", "BA", "CAT", "MMM", "CVX", "XOM", "KO", "WMT",
      "TGT", "PG", "JNJ", "PFE", "MRK", "ABBV", "UNH", "LLY", "NKE",
    ];

    const toFetch = toFetchRaw.map((s) => {
      if (s.includes(".") || s.includes("-")) return s;
      if (usTickers.includes(s)) return s;
      if (/^\d{6}$/.test(s)) return `${s}.BO`;
      return `${s}.NS`;
    });

    if (toFetch.length === 0) return {} as Record<string, PriceInfo>;

    try {
      // Use Python API batch endpoint instead of individual Supabase edge function calls
      const batchData = await fetchStockBatch(toFetch);

      const map: Record<string, PriceInfo> = {};

      for (const [sym, quote] of Object.entries(batchData)) {
        const cp = (quote as StockQuoteResponse)?.currentPrice;
        if (!cp) continue;

        const rawPrice: number | null =
          (typeof cp.price === "number" ? cp.price : null) ??
          (typeof cp.previousClose === "number" ? cp.previousClose : null);

        if (rawPrice == null || !Number.isFinite(rawPrice) || rawPrice <= 0) {
          continue;
        }

        const pct =
          typeof cp.regularMarketChangePercent === "number"
            ? cp.regularMarketChangePercent
            : cp.previousClose && typeof cp.diff === "number"
              ? (cp.diff / cp.previousClose) * 100
              : 0;

        const cleanSymbol = cp.symbol?.replace(".NS", "").replace(".BO", "") || sym.replace(".NS", "").replace(".BO", "");

        map[cleanSymbol] = {
          symbol: cleanSymbol,
          name: cp.longName || cp.shortName || cp.symbol,
          price: rawPrice,
          change: cp.diff || 0,
          changePercent: typeof pct === "number" ? pct : 0,
        };
      }

      setPrices((prev) => ({ ...prev, ...map }));
      return map;
    } catch (err) {
      console.error("useLivePrices fetch error:", err);
      return {} as Record<string, PriceInfo>;
    }
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      // Only poll when market is open — prevents after-hours value fluctuations
      if (isNSEMarketOpen()) fetchPrices();
    }, intervalMs);
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
