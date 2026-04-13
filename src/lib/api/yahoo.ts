import type { PairInfo, Timeframe } from "../types";
import type { Candle } from "../analysis/indicators";

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// Yahoo timeframe mapping: interval + range
const TF_CONFIG: Record<Timeframe, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "1d" },
  "5m": { interval: "5m", range: "1d" },
  "15m": { interval: "15m", range: "5d" },
  "1h": { interval: "1h", range: "5d" },
  "4h": { interval: "1h", range: "1mo" },   // resample to 4h
  "1d": { interval: "1d", range: "3mo" },
  "1w": { interval: "1wk", range: "1y" },
};

async function yFetch(url: string): Promise<Response> {
  return fetch(url, {
    next: { revalidate: 60 },
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MarketAssist/1.0)",
    },
    signal: AbortSignal.timeout(10000),
  });
}

// --- FOREX PAIRS ---
const FOREX_PAIRS = [
  { base: "EUR", quote: "USD" },
  { base: "GBP", quote: "USD" },
  { base: "USD", quote: "JPY" },
  { base: "USD", quote: "CHF" },
  { base: "AUD", quote: "USD" },
  { base: "USD", quote: "CAD" },
  { base: "NZD", quote: "USD" },
  { base: "EUR", quote: "GBP" },
  { base: "EUR", quote: "JPY" },
  { base: "GBP", quote: "JPY" },
  { base: "EUR", quote: "CHF" },
  { base: "AUD", quote: "JPY" },
  { base: "GBP", quote: "CHF" },
  { base: "EUR", quote: "AUD" },
  { base: "EUR", quote: "CAD" },
  { base: "AUD", quote: "NZD" },
  { base: "NZD", quote: "JPY" },
  { base: "GBP", quote: "AUD" },
  { base: "GBP", quote: "CAD" },
  { base: "CHF", quote: "JPY" },
  { base: "EUR", quote: "NZD" },
  { base: "USD", quote: "SGD" },
  { base: "USD", quote: "HKD" },
  { base: "USD", quote: "ZAR" },
  { base: "USD", quote: "MXN" },
];

export async function getForexPairs(): Promise<PairInfo[]> {
  const results: PairInfo[] = [];

  // Fetch prices for all forex pairs in parallel (batched)
  const fetches = FOREX_PAIRS.map(async ({ base, quote }) => {
    const yahooSymbol = `${base}${quote}=X`;
    try {
      const res = await yFetch(`${BASE}/${yahooSymbol}?interval=1d&range=2d`);
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta) return null;

      const price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

      return {
        symbol: yahooSymbol,
        name: `${base}/${quote}`,
        base,
        quote,
        class: "forex" as const,
        price,
        change24h: Math.round(change * 100) / 100,
      };
    } catch {
      return null;
    }
  });

  const all = await Promise.allSettled(fetches);
  for (const r of all) {
    if (r.status === "fulfilled" && r.value) results.push(r.value);
  }

  return results;
}

// --- STOCK INDICES ---
const INDEX_SYMBOLS = [
  { symbol: "^GSPC", name: "S&P 500", base: "SPX" },
  { symbol: "^DJI", name: "Dow Jones", base: "DJI" },
  { symbol: "^IXIC", name: "NASDAQ", base: "IXIC" },
  { symbol: "^RUT", name: "Russell 2000", base: "RUT" },
  { symbol: "^FTSE", name: "FTSE 100", base: "FTSE" },
  { symbol: "^GDAXI", name: "DAX", base: "DAX" },
  { symbol: "^FCHI", name: "CAC 40", base: "CAC" },
  { symbol: "^N225", name: "Nikkei 225", base: "N225" },
  { symbol: "^HSI", name: "Hang Seng", base: "HSI" },
  { symbol: "000001.SS", name: "Shanghai", base: "SSEC" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", base: "SX5E" },
  { symbol: "^BVSP", name: "Bovespa", base: "BVSP" },
  { symbol: "^AXJO", name: "ASX 200", base: "AXJO" },
  { symbol: "^KS11", name: "KOSPI", base: "KS11" },
  { symbol: "^NSEI", name: "Nifty 50", base: "NSEI" },
];

export async function getIndexPairs(): Promise<PairInfo[]> {
  const results: PairInfo[] = [];

  const fetches = INDEX_SYMBOLS.map(async ({ symbol, name, base }) => {
    try {
      const res = await yFetch(`${BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2d`);
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta) return null;

      const price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

      return {
        symbol,
        name,
        base,
        quote: "USD",
        class: "indices" as const,
        price,
        change24h: Math.round(change * 100) / 100,
      };
    } catch {
      return null;
    }
  });

  const all = await Promise.allSettled(fetches);
  for (const r of all) {
    if (r.status === "fulfilled" && r.value) results.push(r.value);
  }

  return results;
}

// --- TOP STOCKS ---
const STOCK_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
  "JPM", "V", "JNJ", "WMT", "MA", "PG", "UNH", "HD", "DIS", "BAC",
  "XOM", "NFLX", "COST", "ADBE", "CRM", "AMD", "INTC", "PYPL",
  "PEP", "KO", "MRK", "ABT", "CSCO", "ACN", "ORCL", "MCD", "NKE",
  "T", "VZ", "CMCSA", "QCOM", "TXN", "AVGO", "LLY", "TMO", "PM",
  "IBM", "GE", "CAT", "BA", "MMM", "GS",
];

export async function getStockPairs(): Promise<PairInfo[]> {
  const results: PairInfo[] = [];

  const fetches = STOCK_SYMBOLS.map(async (symbol) => {
    try {
      const res = await yFetch(`${BASE}/${symbol}?interval=1d&range=2d`);
      if (!res.ok) return null;
      const data = await res.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta) return null;

      const price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

      return {
        symbol,
        name: symbol,
        base: symbol,
        quote: "USD",
        class: "stocks" as const,
        price,
        change24h: Math.round(change * 100) / 100,
      };
    } catch {
      return null;
    }
  });

  const all = await Promise.allSettled(fetches);
  for (const r of all) {
    if (r.status === "fulfilled" && r.value) results.push(r.value);
  }

  return results;
}

// --- CANDLE DATA (works for any Yahoo symbol) ---
export async function getYahooCandles(
  symbol: string,
  timeframe: Timeframe
): Promise<Candle[]> {
  const config = TF_CONFIG[timeframe];
  const encoded = encodeURIComponent(symbol);
  const res = await yFetch(
    `${BASE}/${encoded}?interval=${config.interval}&range=${config.range}`
  );
  if (!res.ok) throw new Error(`Yahoo chart failed for ${symbol}: ${res.status}`);

  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`No chart data for ${symbol}`);

  const timestamps: number[] = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = quotes.open || [];
  const highs: (number | null)[] = quotes.high || [];
  const lows: (number | null)[] = quotes.low || [];
  const closes: (number | null)[] = quotes.close || [];
  const volumes: (number | null)[] = quotes.volume || [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = opens[i], h = highs[i], l = lows[i], c = closes[i], v = volumes[i];
    if (o == null || h == null || l == null || c == null) continue;

    const vol = v ?? 0;
    // Estimate buy volume from candle direction
    const buyRatio = c >= o
      ? 0.55 + Math.min(0.25, (c - o) / o * 3)
      : 0.45 - Math.min(0.25, (o - c) / o * 3);

    candles.push({
      timestamp: timestamps[i] * 1000,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: vol,
      takerBuyVolume: vol * Math.max(0.2, Math.min(0.8, buyRatio)),
    });
  }

  // Resample 1h → 4h if needed
  if (timeframe === "4h") return resampleCandles(candles, 4);

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

// Synthetic order book imbalance from recent candle momentum
export function syntheticImbalance(candles: Candle[]): number {
  if (candles.length < 5) return 0;
  const recent = candles.slice(-10);
  let bullish = 0;
  for (const c of recent) {
    if (c.close > c.open) bullish++;
  }
  return Math.max(-0.8, Math.min(0.8, (bullish / recent.length - 0.5) * 2));
}
