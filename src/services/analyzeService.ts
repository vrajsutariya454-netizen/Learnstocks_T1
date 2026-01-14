import { useState, useCallback, useRef } from "react";

/**
 * Upload a CSV file to the FastAPI analyze endpoint and return parsed JSON.
 * Throws an Error when the request fails.
 */
export async function analyzePortfolio<T = any>(
  file: File,
  signal?: AbortSignal,
  url: string = "http://localhost:8000/analyze"
): Promise<T> {
  if (!file) throw new Error("File is required");

  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(url, {
    method: "POST",
    body: form,
    signal,
  });

  if (!res.ok) {
    // try to extract useful error payload
    let message: string;
    try {
      const payload = await res.json();
      message = (payload && (payload.detail || payload.message)) || JSON.stringify(payload);
    } catch (_e) {
      message = await res.text();
    }
    throw new Error(message || res.statusText || `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json as T;
}

/**
 * React hook wrapper that exposes a simple analyze function plus loading/error state.
 * - `analyze(file)` returns the parsed JSON (or throws).
 * - `loading` and `error` are useful for UI state (not included here per instructions).
 * - `abort()` cancels the in-flight request.
 */
export function useAnalyze<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (file: File, url?: string) => {
    setError(null);
    setLoading(true);

    // Cancel any previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const data = await analyzePortfolio<T>(file, controller.signal, url);
      return data;
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Request aborted");
      } else {
        setError(err?.message ?? String(err));
      }
      throw err;
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
      setLoading(false);
      setError("Request aborted");
    }
  }, []);

  return {
    analyze,
    loading,
    error,
    abort,
  } as const;
}
