/**
 * Agent API Service
 * Interacts with FastAPI Multi-Agent system endpoints.
 */

export interface AgentStep {
  agent: string;
  status: "thinking" | "completed" | "failed" | "finished";
  message: string;
  data?: any;
  payload?: any;
}

/**
 * Initiates the multi-agent terminal stream analysis for a given stock symbol.
 * Uses a chunk-by-chunk standard stream reader to parse SSE 'data: {...}' lines in real-time.
 */
export async function runAgentAnalysis(
  symbol: string,
  days: number = 90,
  onUpdate: (step: AgentStep) => void
): Promise<void> {
  const env = (import.meta as any).env;
  const baseUrl = (env?.VITE_PY_API_BASE_URL || env?.VITE_API_BASE_URL || "/py-api").replace(/\/$/, "");
  
  const response = await fetch(`${baseUrl}/agents/analysis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbol, days }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Agent Analysis failed with HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming is not supported or response body is empty.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Save the last incomplete line back to the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const rawJson = trimmed.substring(6).trim();
            if (rawJson) {
              const step: AgentStep = JSON.parse(rawJson);
              onUpdate(step);
            }
          } catch (err) {
            console.warn("Failed to parse SSE line JSON:", trimmed, err);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetch static compiled crew report for a stock symbol.
 */
export async function fetchCrewReport(symbol: string): Promise<any> {
  const env = (import.meta as any).env;
  const baseUrl = (env?.VITE_PY_API_BASE_URL || env?.VITE_API_BASE_URL || "/py-api").replace(/\/$/, "");
  
  const response = await fetch(`${baseUrl}/agents/crew-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbol }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch crew report: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch static news sentiment for a stock symbol.
 */
export async function fetchSentiment(symbol: string): Promise<any> {
  const env = (import.meta as any).env;
  const baseUrl = (env?.VITE_PY_API_BASE_URL || env?.VITE_API_BASE_URL || "/py-api").replace(/\/$/, "");
  
  const response = await fetch(`${baseUrl}/agents/sentiment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbol }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch news sentiment: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch multi-day future price forecast for a stock symbol.
 * Returns predicted prices with upper/lower confidence bounds.
 */
export interface ForecastPoint {
  day: number;
  date: string;
  predicted_close: number;
  upper_bound: number;
  lower_bound: number;
}

export interface ForecastResponse {
  symbol: string;
  last_close: number;
  forecast: ForecastPoint[];
  model: string;
  volatility_daily_pct: number;
  momentum_10d_pct: number;
}

export async function fetchForecast(symbol: string, forecastDays: number = 7): Promise<ForecastResponse> {
  const env = (import.meta as any).env;
  const baseUrl = (env?.VITE_PY_API_BASE_URL || env?.VITE_API_BASE_URL || "/py-api").replace(/\/$/, "");
  
  const response = await fetch(`${baseUrl}/agents/forecast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ symbol, forecast_days: forecastDays }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch forecast: ${response.statusText}`);
  }

  return response.json();
}
