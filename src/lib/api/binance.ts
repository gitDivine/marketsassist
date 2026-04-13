import type { Timeframe, PairInfo } from "../types";
import type { Candle } from "../analysis/indicators";

const BASE_URL = "https://api.binance.com/api/v3";

const TF_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

export async function getBinancePairs(): Promise<PairInfo[]> {
  const res = await fetch(`${BASE_URL}/ticker/24hr`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch Binance pairs");

  const data: Array<{
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    volume: string;
    quoteVolume: string;
  }> = await res.json();

  // Filter to USDT pairs with decent volume
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
  const res = await fetch(
    `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch klines for ${symbol}`);

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
  const res = await fetch(`${BASE_URL}/depth?symbol=${symbol}&limit=${limit}`, {
    next: { revalidate: 10 },
  });
  if (!res.ok) throw new Error(`Failed to fetch order book for ${symbol}`);

  const data: { bids: string[][]; asks: string[][] } = await res.json();

  const bidTotal = data.bids.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
  const askTotal = data.asks.reduce((sum, [, qty]) => sum + parseFloat(qty), 0);
  const total = bidTotal + askTotal;
  const imbalance = total > 0 ? (bidTotal - askTotal) / total : 0;

  return { bidTotal, askTotal, imbalance };
}
