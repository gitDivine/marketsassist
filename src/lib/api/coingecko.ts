import type { PairInfo } from "../types";
import type { Candle } from "../analysis/indicators";
import type { Timeframe } from "../types";

const BASE = "https://api.coingecko.com/api/v3";

const TF_CONFIG: Record<Timeframe, { days: string }> = {
  "1m": { days: "1" },
  "5m": { days: "1" },
  "15m": { days: "1" },
  "1h": { days: "2" },
  "4h": { days: "7" },
  "1d": { days: "30" },
  "1w": { days: "90" },
};

// Shared rate-limit queue — max 1 request per 200ms
let lastRequestTime = 0;
async function cgFetch(url: string, revalidate = 60): Promise<Response> {
  // Throttle: wait at least 200ms between requests
  const now = Date.now();
  const wait = Math.max(0, lastRequestTime + 200 - now);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();

  const res = await fetch(url, {
    next: { revalidate },
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 3000));
    lastRequestTime = Date.now();
    return fetch(url, {
      next: { revalidate },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
  }
  return res;
}

export async function getCoinGeckoPairs(): Promise<PairInfo[]> {
  // Fetch 2 pages of 250 for ~500 crypto pairs
  const [res1, res2] = await Promise.allSettled([
    cgFetch(
      `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h`,
      120
    ),
    cgFetch(
      `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2&sparkline=false&price_change_percentage=24h`,
      120
    ),
  ]);

  type CoinData = {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    total_volume: number;
  };

  let data: CoinData[] = [];
  if (res1.status === "fulfilled" && res1.value.ok) {
    data = data.concat(await res1.value.json());
  }
  if (res2.status === "fulfilled" && res2.value.ok) {
    data = data.concat(await res2.value.json());
  }
  if (data.length === 0) throw new Error("CoinGecko markets failed");

  const stablecoins = new Set(["usdt", "usdc", "dai", "busd", "tusd", "usdp", "frax", "usdd", "gusd", "pyusd", "fdusd"]);

  return data
    .filter((c) => !stablecoins.has(c.symbol.toLowerCase()) && c.total_volume > 50000)
    .map((c) => ({
      symbol: c.id,
      name: `${c.symbol.toUpperCase()}/USD`,
      base: c.symbol.toUpperCase(),
      quote: "USD",
      class: "crypto" as const,
      price: c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
    }));
}

export async function getCoinGeckoCandles(
  coinId: string,
  timeframe: Timeframe
): Promise<Candle[]> {
  const config = TF_CONFIG[timeframe];

  // Use market_chart for BOTH price and volume in one request (saves rate limit)
  const res = await cgFetch(
    `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${config.days}`,
    30
  );
  if (!res.ok) throw new Error(`CoinGecko chart failed for ${coinId}: ${res.status}`);

  const data: {
    prices: number[][];
    total_volumes: number[][];
  } = await res.json();

  const prices = data.prices || [];
  const volumes = data.total_volumes || [];

  if (prices.length < 4) return [];

  // Build candles from price points by grouping adjacent points
  // Each "candle" = a window of price points
  const windowSize = Math.max(2, Math.floor(prices.length / 50)); // ~50 candles
  const candles: Candle[] = [];

  for (let i = 0; i < prices.length - windowSize; i += windowSize) {
    const window = prices.slice(i, i + windowSize + 1);
    const volWindow = volumes.slice(i, i + windowSize + 1);

    const open = window[0][1];
    const close = window[window.length - 1][1];
    const high = Math.max(...window.map((p) => p[1]));
    const low = Math.min(...window.map((p) => p[1]));
    const vol = volWindow.reduce((s, v) => s + (v[1] || 0), 0) / Math.max(1, volWindow.length);
    const timestamp = window[0][0];

    // Accurate buy ratio using wick analysis:
    // - Body = |close - open|
    // - Upper wick = high - max(open, close) → selling rejection
    // - Lower wick = min(open, close) - low → buying support
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const upperWick = high - bodyTop;
    const lowerWick = bodyBottom - low;
    const totalRange = high - low;

    let buyRatio = 0.5; // Start neutral
    if (totalRange > 0) {
      // Body direction: close > open = bullish body
      const bodyDirection = (close - open) / totalRange; // -1 to 1
      // Wick balance: more lower wick = buying support, more upper wick = selling
      const wickBalance = (lowerWick - upperWick) / totalRange; // -1 to 1

      // Combine: 60% body direction, 40% wick analysis
      buyRatio = 0.5 + (bodyDirection * 0.3) + (wickBalance * 0.2);
    }
    const clampedRatio = Math.max(0.15, Math.min(0.85, buyRatio));

    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume: vol,
      takerBuyVolume: vol * clampedRatio,
    });
  }

  if (timeframe === "4h") return resampleCandles(candles, 4);
  if (timeframe === "1w") return resampleCandles(candles, 7);

  return candles;
}

function resampleCandles(candles: Candle[], groupSize: number): Candle[] {
  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const group = candles.slice(i, i + groupSize);
    if (group.length === 0) continue;
    result.push({
      timestamp: group[0].timestamp,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((s, c) => s + c.volume, 0),
      takerBuyVolume: group.reduce((s, c) => s + c.takerBuyVolume, 0),
    });
  }
  return result;
}

// Synthetic order book using wick analysis, not just candle color
export function syntheticOrderBookImbalance(candles: Candle[]): number {
  if (candles.length < 5) return 0;

  const recent = candles.slice(-10);
  let score = 0;

  for (const c of recent) {
    const totalRange = c.high - c.low;
    if (totalRange === 0) continue;

    const bodyTop = Math.max(c.open, c.close);
    const bodyBottom = Math.min(c.open, c.close);
    const upperWick = c.high - bodyTop;
    const lowerWick = bodyBottom - c.low;
    const body = bodyTop - bodyBottom;

    // Body direction
    const direction = c.close > c.open ? 1 : c.close < c.open ? -1 : 0;
    // Body significance (big body = strong conviction)
    const bodyRatio = body / totalRange;
    // Wick rejection (upper wick = sell rejection, lower wick = buy support)
    const wickSignal = (lowerWick - upperWick) / totalRange;

    // Weighted: 50% direction*conviction, 50% wick rejection
    score += (direction * bodyRatio * 0.5) + (wickSignal * 0.5);
  }

  const avg = score / recent.length;
  return Math.max(-0.8, Math.min(0.8, avg));
}
