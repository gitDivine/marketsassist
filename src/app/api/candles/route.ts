import { NextRequest, NextResponse } from "next/server";

const VALID_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;
type Timeframe = (typeof VALID_TIMEFRAMES)[number];

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// CoinGecko OHLC granularity: days → candle size
// 1-2 days → 30min, 3-30 → 4h, 31-90 → daily, 91+ → daily
const TF_TO_CG_DAYS: Record<Timeframe, number> = {
  "1m": 1,    // 30min candles (finest available free)
  "5m": 1,    // 30min candles
  "15m": 1,   // 30min candles
  "1h": 7,    // 4h candles — we'll show as-is
  "4h": 30,   // 4h candles
  "1d": 90,   // daily candles
  "1w": 365,  // daily candles — aggregate to weekly
};

// Yahoo Finance interval mapping
const TF_TO_YAHOO: Record<Timeframe, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "1d" },
  "5m": { interval: "5m", range: "5d" },
  "15m": { interval: "15m", range: "5d" },
  "1h": { interval: "1h", range: "30d" },
  "4h": { interval: "1h", range: "60d" },  // aggregate 4x1h
  "1d": { interval: "1d", range: "6mo" },
  "1w": { interval: "1wk", range: "2y" },
};

function sanitizeSymbol(s: string): string {
  return s.replace(/[^a-zA-Z0-9\-_.^=]/g, "").slice(0, 30);
}

async function fetchCryptoCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const days = TF_TO_CG_DAYS[tf];

  // Fetch OHLC and volume in parallel
  const [ohlcRes, volRes] = await Promise.all([
    fetch(
      `https://api.coingecko.com/api/v3/coins/${symbol}/ohlc?vs_currency=usd&days=${days}`,
      { next: { revalidate: 60 } }
    ),
    fetch(
      `https://api.coingecko.com/api/v3/coins/${symbol}/market_chart?vs_currency=usd&days=${days}`,
      { next: { revalidate: 60 } }
    ),
  ]);

  if (!ohlcRes.ok) throw new Error(`CoinGecko OHLC: ${ohlcRes.status}`);

  const ohlcData: number[][] = await ohlcRes.json();
  let volumes: Map<number, number> = new Map();

  if (volRes.ok) {
    const volData = await volRes.json();
    if (volData.total_volumes) {
      for (const [ts, vol] of volData.total_volumes) {
        // Round to nearest 30min bucket for matching
        const bucket = Math.round(ts / 1800000) * 1800000;
        volumes.set(bucket, vol);
      }
    }
  }

  let candles: Candle[] = ohlcData.map(([ts, open, high, low, close]) => {
    const bucket = Math.round(ts / 1800000) * 1800000;
    const vol = volumes.get(bucket) || 0;
    return {
      time: Math.floor(ts / 1000),
      open,
      high,
      low,
      close,
      volume: vol,
    };
  });

  // Aggregate to weekly if needed
  if (tf === "1w") {
    candles = aggregateCandles(candles, 7 * 86400);
  }

  return candles.slice(-500);
}

async function fetchYahooCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const { interval, range } = TF_TO_YAHOO[tf];

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) throw new Error(`Yahoo: ${res.status}`);

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No Yahoo data");

  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens: number[] = quote.open || [];
  const highs: number[] = quote.high || [];
  const lows: number[] = quote.low || [];
  const closes: number[] = quote.close || [];
  const vols: number[] = quote.volume || [];

  let candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (opens[i] == null || closes[i] == null) continue;
    candles.push({
      time: timestamps[i],
      open: opens[i],
      high: highs[i] ?? opens[i],
      low: lows[i] ?? opens[i],
      close: closes[i],
      volume: vols[i] ?? 0,
    });
  }

  // Aggregate 1h → 4h if needed
  if (tf === "4h") {
    candles = aggregateCandles(candles, 4 * 3600);
  }

  return candles.slice(-500);
}

function aggregateCandles(candles: Candle[], periodSeconds: number): Candle[] {
  if (candles.length === 0) return [];

  const result: Candle[] = [];
  let bucket: Candle | null = null;

  for (const c of candles) {
    const bucketStart = Math.floor(c.time / periodSeconds) * periodSeconds;

    if (!bucket || bucket.time !== bucketStart) {
      if (bucket) result.push(bucket);
      bucket = { ...c, time: bucketStart };
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    }
  }
  if (bucket) result.push(bucket);

  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = searchParams.get("symbol") || "";
  const tf = searchParams.get("timeframe") as Timeframe;
  const assetClass = searchParams.get("class") || "crypto";

  const symbol = sanitizeSymbol(rawSymbol);

  if (!symbol || !VALID_TIMEFRAMES.includes(tf)) {
    return NextResponse.json(
      { candles: [], error: "Invalid symbol or timeframe" },
      { status: 400 }
    );
  }

  try {
    let candles: Candle[];

    if (assetClass === "crypto") {
      candles = await fetchCryptoCandles(symbol, tf);
    } else {
      candles = await fetchYahooCandles(symbol, tf);
    }

    // Sort by time ascending, deduplicate
    candles.sort((a, b) => a.time - b.time);
    const seen = new Set<number>();
    candles = candles.filter((c) => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    });

    return NextResponse.json(
      { candles, symbol, timeframe: tf },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
        },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { candles: [], error: `Failed to fetch candles: ${msg}` },
      { status: 500 }
    );
  }
}
