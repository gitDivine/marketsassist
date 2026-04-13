import type { Timeframe, PairInfo } from "../types";
import type { Candle } from "../analysis/indicators";

// Binance has multiple API endpoints — try them in order as fallbacks
const BINANCE_ENDPOINTS = [
  "https://api1.binance.com/api/v3",
  "https://api2.binance.com/api/v3",
  "https://api3.binance.com/api/v3",
  "https://api4.binance.com/api/v3",
  "https://api.binance.com/api/v3",
];

const TF_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

async function fetchWithFallback(path: string, cacheSeconds = 30): Promise<Response> {
  for (const base of BINANCE_ENDPOINTS) {
    try {
      const res = await fetch(`${base}${path}`, {
        next: { revalidate: cacheSeconds },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return res;
    } catch {
      // try next endpoint
    }
  }
  throw new Error(`All Binance endpoints failed for ${path}`);
}

export async function getBinancePairs(): Promise<PairInfo[]> {
  const res = await fetchWithFallback("/ticker/24hr", 300);

  const data: Array<{
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    volume: string;
    quoteVolume: string;
  }> = await res.json();

  const usdtPairs = data
    .filter((t) => t.symbol.endsWith("USDT") && parseFloat(t.quoteVolume) > 100000)
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, 200);

  return usdtPairs.map((t) => ({
    symbol: t.symbol,
    name: t.symbol.replace("USDT", "/USDT"),
    base: t.symbol.replace("USDT", ""),
    quote: "USDT",
    class: "crypto" as const,
    price: parseFloat(t.lastPrice),
    change24h: parseFloat(t.priceChangePercent),
  }));
}

export async function getBinanceKlines(
  symbol: string,
  timeframe: Timeframe,
  limit = 100
): Promise<Candle[]> {
  const interval = TF_MAP[timeframe];
  const res = await fetchWithFallback(
    `/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    30
  );

  const data: number[][] = await res.json();

  return data.map((k) => ({
    timestamp: k[0] as number,
    open: parseFloat(k[1] as unknown as string),
    high: parseFloat(k[2] as unknown as string),
    low: parseFloat(k[3] as unknown as string),
    close: parseFloat(k[4] as unknown as string),
    volume: parseFloat(k[5] as unknown as string),
    takerBuyVolume: parseFloat(k[9] as unknown as string),
  }));
}

export async function getBinanceOrderBook(
  symbol: string,
  limit = 20
): Promise<{ bidTotal: number; askTotal: number; imbalance: number }> {
  const res = await fetchWithFallback(`/depth?symbol=${symbol}&limit=${limit}`, 10);

  const data: { bids: string[][]; asks: string[][] } = await res.json();

  const bidTotal = data.bids.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
  const askTotal = data.asks.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
  const total = bidTotal + askTotal;
  const imbalance = total > 0 ? (bidTotal - askTotal) / total : 0;

  return { bidTotal, askTotal, imbalance };
}
