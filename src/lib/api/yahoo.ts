import type { PairInfo, Timeframe } from "../types";
import type { Candle } from "../analysis/indicators";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const QUOTE_BASE = "https://query1.finance.yahoo.com/v7/finance/quote";

const TF_CONFIG: Record<Timeframe, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "1d" },
  "5m": { interval: "5m", range: "1d" },
  "15m": { interval: "15m", range: "5d" },
  "1h": { interval: "1h", range: "5d" },
  "4h": { interval: "1h", range: "1mo" },
  "1d": { interval: "1d", range: "3mo" },
  "1w": { interval: "1wk", range: "1y" },
};

async function yFetch(url: string, revalidate = 60): Promise<Response> {
  return fetch(url, {
    next: { revalidate },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketAssist/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
}

// --- ALL SYMBOLS ---
const FOREX_SYMBOLS = [
  "EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X", "AUDUSD=X",
  "USDCAD=X", "NZDUSD=X", "EURGBP=X", "EURJPY=X", "GBPJPY=X",
  "EURCHF=X", "AUDJPY=X", "GBPCHF=X", "EURAUD=X", "EURCAD=X",
  "AUDNZD=X", "NZDJPY=X", "GBPAUD=X", "GBPCAD=X", "CHFJPY=X",
  "EURNZD=X", "USDSGD=X", "USDHKD=X", "USDZAR=X", "USDMXN=X",
];

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
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", base: "SX5E" },
  { symbol: "^BVSP", name: "Bovespa", base: "BVSP" },
  { symbol: "^AXJO", name: "ASX 200", base: "AXJO" },
  { symbol: "^KS11", name: "KOSPI", base: "KS11" },
  { symbol: "^NSEI", name: "Nifty 50", base: "NSEI" },
];

const STOCK_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
  "JPM", "V", "JNJ", "WMT", "MA", "PG", "UNH", "HD", "DIS", "BAC",
  "XOM", "NFLX", "COST", "ADBE", "CRM", "AMD", "INTC", "PYPL",
  "PEP", "KO", "MRK", "ABT", "CSCO", "ACN", "ORCL", "MCD", "NKE",
  "T", "VZ", "CMCSA", "QCOM", "TXN", "AVGO", "LLY", "TMO", "PM",
  "IBM", "GE", "CAT", "BA", "MMM", "GS",
];

// Use bulk quote endpoint — ONE request for all symbols
async function bulkQuote(symbols: string[]): Promise<Map<string, { price: number; prevClose: number }>> {
  const map = new Map<string, { price: number; prevClose: number }>();
  try {
    const joined = symbols.map(encodeURIComponent).join(",");
    const res = await yFetch(
      `${QUOTE_BASE}?symbols=${joined}&fields=regularMarketPrice,regularMarketPreviousClose,shortName`,
      120
    );
    if (!res.ok) return map;

    const data = await res.json();
    const results = data.quoteResponse?.result || [];
    for (const q of results) {
      map.set(q.symbol, {
        price: q.regularMarketPrice ?? 0,
        prevClose: q.regularMarketPreviousClose ?? q.regularMarketPrice ?? 0,
      });
    }
  } catch {
    // Silently fail — individual markets will just be empty
  }
  return map;
}

export async function getForexPairs(): Promise<PairInfo[]> {
  const quotes = await bulkQuote(FOREX_SYMBOLS);
  const results: PairInfo[] = [];

  for (const sym of FOREX_SYMBOLS) {
    const q = quotes.get(sym);
    if (!q || q.price === 0) continue;

    const pair = sym.replace("=X", "");
    const base = pair.slice(0, 3);
    const quote = pair.slice(3);
    const change = q.prevClose > 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;

    results.push({
      symbol: sym,
      name: `${base}/${quote}`,
      base,
      quote,
      class: "forex",
      price: q.price,
      change24h: Math.round(change * 100) / 100,
    });
  }

  return results;
}

export async function getIndexPairs(): Promise<PairInfo[]> {
  const symbols = INDEX_SYMBOLS.map((i) => i.symbol);
  const quotes = await bulkQuote(symbols);
  const results: PairInfo[] = [];

  for (const idx of INDEX_SYMBOLS) {
    const q = quotes.get(idx.symbol);
    if (!q || q.price === 0) continue;

    const change = q.prevClose > 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;

    results.push({
      symbol: idx.symbol,
      name: idx.name,
      base: idx.base,
      quote: "USD",
      class: "indices",
      price: q.price,
      change24h: Math.round(change * 100) / 100,
    });
  }

  return results;
}

export async function getStockPairs(): Promise<PairInfo[]> {
  const quotes = await bulkQuote(STOCK_SYMBOLS);
  const results: PairInfo[] = [];

  for (const sym of STOCK_SYMBOLS) {
    const q = quotes.get(sym);
    if (!q || q.price === 0) continue;

    const change = q.prevClose > 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;

    results.push({
      symbol: sym,
      name: sym,
      base: sym,
      quote: "USD",
      class: "stocks",
      price: q.price,
      change24h: Math.round(change * 100) / 100,
    });
  }

  return results;
}

// --- CANDLE DATA (single symbol) ---
export async function getYahooCandles(
  symbol: string,
  timeframe: Timeframe
): Promise<Candle[]> {
  const config = TF_CONFIG[timeframe];
  const encoded = encodeURIComponent(symbol);
  const res = await yFetch(`${CHART_BASE}/${encoded}?interval=${config.interval}&range=${config.range}`, 30);
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

export function syntheticImbalance(candles: Candle[]): number {
  if (candles.length < 5) return 0;
  const recent = candles.slice(-10);
  let bullish = 0;
  for (const c of recent) {
    if (c.close > c.open) bullish++;
  }
  return Math.max(-0.8, Math.min(0.8, (bullish / recent.length - 0.5) * 2));
}
