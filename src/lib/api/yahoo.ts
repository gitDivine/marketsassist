import type { PairInfo, Timeframe } from "../types";
import type { Candle } from "../analysis/indicators";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

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

// Fetch price + prevClose from chart endpoint (v8, no auth needed)
async function chartQuote(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const res = await yFetch(
      `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      120
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? 0,
      prevClose: meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice ?? 0,
    };
  } catch {
    return null;
  }
}

// Batch fetch in groups of N with delay between groups to avoid rate limits
async function batchChartQuotes(
  symbols: string[],
  batchSize = 5,
  delayMs = 300
): Promise<Map<string, { price: number; prevClose: number }>> {
  const map = new Map<string, { price: number; prevClose: number }>();

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((s) => chartQuote(s).then((r) => ({ symbol: s, data: r })))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.data && r.value.data.price > 0) {
        map.set(r.value.symbol, r.value.data);
      }
    }
    // Small delay between batches to respect rate limits
    if (i + batchSize < symbols.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return map;
}

// --- SYMBOLS ---
const FOREX_SYMBOLS = [
  // Majors (7)
  "EURUSD=X", "GBPUSD=X", "USDJPY=X", "USDCHF=X",
  "AUDUSD=X", "USDCAD=X", "NZDUSD=X",
  // EUR crosses (10)
  "EURGBP=X", "EURJPY=X", "EURCHF=X", "EURAUD=X", "EURCAD=X",
  "EURNZD=X", "EURSGD=X", "EURHKD=X", "EURSEK=X", "EURNOK=X",
  // GBP crosses (8)
  "GBPJPY=X", "GBPCHF=X", "GBPAUD=X", "GBPCAD=X", "GBPNZD=X",
  "GBPSGD=X", "GBPSEK=X", "GBPNOK=X",
  // JPY crosses (6)
  "AUDJPY=X", "NZDJPY=X", "CHFJPY=X", "CADJPY=X", "SGDJPY=X", "HKDJPY=X",
  // AUD crosses (3)
  "AUDNZD=X", "AUDCAD=X", "AUDCHF=X",
  // NZD crosses (2)
  "NZDCAD=X", "NZDCHF=X",
  // CAD crosses (1)
  "CADCHF=X",
  // Exotics — USD pairs (15)
  "USDSGD=X", "USDHKD=X", "USDZAR=X", "USDMXN=X", "USDTRY=X",
  "USDSEK=X", "USDNOK=X", "USDDKK=X", "USDPLN=X", "USDHUF=X",
  "USDCZK=X", "USDINR=X", "USDTHB=X", "USDKRW=X", "USDTWD=X",
  // Exotics — other (6)
  "ZARJPY=X", "MXNJPY=X", "TRYJPY=X", "NOKJPY=X", "SEKJPY=X", "NOKSEK=X",
];

// Metals & commodities — Yahoo uses futures symbols
const COMMODITY_SYMBOLS = [
  { symbol: "GC=F", name: "XAU/USD (Gold)", base: "XAU", quote: "USD" },
  { symbol: "SI=F", name: "XAG/USD (Silver)", base: "XAG", quote: "USD" },
  { symbol: "PL=F", name: "XPT/USD (Platinum)", base: "XPT", quote: "USD" },
  { symbol: "CL=F", name: "USOIL (WTI Crude)", base: "OIL", quote: "USD" },
  { symbol: "BZ=F", name: "UKOIL (Brent Crude)", base: "BRENT", quote: "USD" },
  { symbol: "NG=F", name: "NATGAS (Natural Gas)", base: "NATGAS", quote: "USD" },
  { symbol: "HG=F", name: "COPPER (Copper)", base: "COPPER", quote: "USD" },
];

const INDEX_SYMBOLS = [
  // US
  { symbol: "^GSPC", name: "S&P 500", base: "SPX" },
  { symbol: "^DJI", name: "Dow Jones", base: "DJI" },
  { symbol: "^IXIC", name: "NASDAQ Composite", base: "NASDAQ" },
  { symbol: "^NDX", name: "NASDAQ 100", base: "NDX" },
  { symbol: "^RUT", name: "Russell 2000", base: "RUT" },
  { symbol: "^VIX", name: "VIX Volatility Index", base: "VIX" },
  { symbol: "^DXY", name: "US Dollar Index", base: "DXY" },
  // Europe
  { symbol: "^FTSE", name: "FTSE 100 (UK)", base: "FTSE" },
  { symbol: "^GDAXI", name: "DAX (Germany)", base: "DAX" },
  { symbol: "^FCHI", name: "CAC 40 (France)", base: "CAC" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", base: "SX5E" },
  { symbol: "^AEX", name: "AEX (Netherlands)", base: "AEX" },
  { symbol: "^IBEX", name: "IBEX 35 (Spain)", base: "IBEX" },
  { symbol: "^SSMI", name: "SMI (Switzerland)", base: "SMI" },
  // Asia-Pacific
  { symbol: "^N225", name: "Nikkei 225 (Japan)", base: "N225" },
  { symbol: "^HSI", name: "Hang Seng (HK)", base: "HSI" },
  { symbol: "000001.SS", name: "Shanghai Composite", base: "SSEC" },
  { symbol: "^KS11", name: "KOSPI (Korea)", base: "KOSPI" },
  { symbol: "^TWII", name: "TAIEX (Taiwan)", base: "TAIEX" },
  { symbol: "^STI", name: "Straits Times (SG)", base: "STI" },
  { symbol: "^AXJO", name: "ASX 200 (Australia)", base: "ASX200" },
  { symbol: "^BSESN", name: "BSE Sensex (India)", base: "SENSEX" },
  { symbol: "^NSEI", name: "Nifty 50 (India)", base: "NIFTY" },
  // Americas
  { symbol: "^BVSP", name: "Bovespa (Brazil)", base: "BVSP" },
  { symbol: "^MXX", name: "IPC (Mexico)", base: "IPC" },
  { symbol: "^GSPTSE", name: "TSX Composite (Canada)", base: "TSX" },
];

const STOCK_SYMBOLS = [
  // Mega cap
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "TSM",
  // Finance
  "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "C", "AXP", "BLK", "SCHW", "PYPL", "SQ",
  // Tech
  "NFLX", "ADBE", "CRM", "AMD", "INTC", "AVGO", "QCOM", "ORCL", "IBM", "NOW", "SNOW",
  "UBER", "SHOP", "PLTR", "MU", "AMAT", "LRCX", "KLAC", "MRVL", "ARM", "PANW", "CRWD",
  "ZS", "NET", "DDOG", "TEAM", "WDAY", "HUBS", "VEEV", "TTD", "RBLX", "COIN", "HOOD",
  "SQ", "ABNB", "DASH", "SNAP", "PINS", "SPOT", "ZM", "DOCU", "TWLO", "OKTA", "MDB",
  // Healthcare
  "UNH", "LLY", "JNJ", "PFE", "ABBV", "MRK", "TMO", "ABT", "DHR", "ISRG", "AMGN",
  "GILD", "VRTX", "REGN", "BMY", "MDT", "SYK", "BSX", "ZTS", "CI", "ELV", "HUM",
  // Consumer
  "WMT", "HD", "PEP", "KO", "MCD", "NKE", "SBUX", "TGT", "COST", "LOW", "TJX",
  "LULU", "CMG", "YUM", "DPZ", "DKNG", "MGM", "WYNN", "MAR", "HLT", "BKNG",
  "DIS", "CMCSA", "CHTR", "WBD", "PARA", "LYV", "NCLH", "CCL", "RCL",
  // Industrial & Energy
  "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "MPC", "VLO", "PSX", "HAL",
  "CAT", "DE", "HON", "MMM", "GE", "RTX", "LMT", "NOC", "BA", "GD",
  "UNP", "UPS", "FDX", "DAL", "UAL", "AAL", "LUV", "JBLU",
  // Real estate & utilities
  "AMT", "PLD", "CCI", "EQIX", "SPG", "O", "WELL", "DLR",
  "NEE", "DUK", "SO", "AEP", "D", "EXC", "XEL", "ES",
  // Telecom & media
  "T", "VZ", "TMUS",
  // Materials
  "LIN", "APD", "SHW", "ECL", "FCX", "NEM", "NUE", "STLD",
  // China / International ADRs
  "BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI", "GRAB",
  // Meme / popular
  "GME", "AMC", "SOFI", "LCID", "RIVN", "MARA", "RIOT", "BITF",
];

const FUND_SYMBOLS = [
  // Major index ETFs
  { symbol: "SPY", name: "SPDR S&P 500 ETF" },
  { symbol: "QQQ", name: "Invesco Nasdaq 100 ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones ETF" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "VT", name: "Vanguard Total World Stock" },
  // Sector ETFs
  { symbol: "XLF", name: "Financial Select Sector" },
  { symbol: "XLK", name: "Technology Select Sector" },
  { symbol: "XLE", name: "Energy Select Sector" },
  { symbol: "XLV", name: "Health Care Select Sector" },
  { symbol: "XLI", name: "Industrial Select Sector" },
  { symbol: "XLP", name: "Consumer Staples Sector" },
  { symbol: "XLY", name: "Consumer Discretionary" },
  { symbol: "XLB", name: "Materials Select Sector" },
  { symbol: "XLU", name: "Utilities Select Sector" },
  { symbol: "XLRE", name: "Real Estate Select Sector" },
  { symbol: "XLC", name: "Communication Services" },
  // Thematic / popular
  { symbol: "ARKK", name: "ARK Innovation ETF" },
  { symbol: "ARKW", name: "ARK Next Gen Internet" },
  { symbol: "ARKG", name: "ARK Genomic Revolution" },
  { symbol: "ARKF", name: "ARK Fintech Innovation" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF" },
  { symbol: "HACK", name: "ETFMG Cybersecurity ETF" },
  { symbol: "TAN", name: "Invesco Solar ETF" },
  { symbol: "ICLN", name: "iShares Global Clean Energy" },
  { symbol: "LIT", name: "Global X Lithium & Battery" },
  { symbol: "BOTZ", name: "Global X Robotics & AI" },
  { symbol: "AIQ", name: "Global X AI & Technology" },
  // Commodity ETFs
  { symbol: "GLD", name: "SPDR Gold Shares" },
  { symbol: "SLV", name: "iShares Silver Trust" },
  { symbol: "USO", name: "United States Oil Fund" },
  { symbol: "UNG", name: "United States Natural Gas" },
  { symbol: "PPLT", name: "abrdn Platinum ETF" },
  { symbol: "DBA", name: "Invesco Agriculture" },
  { symbol: "DBC", name: "Invesco Commodities" },
  // Bond ETFs
  { symbol: "TLT", name: "iShares 20+ Year Treasury" },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury" },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury" },
  { symbol: "BND", name: "Vanguard Total Bond Market" },
  { symbol: "AGG", name: "iShares Core US Aggregate" },
  { symbol: "LQD", name: "iShares Investment Grade" },
  { symbol: "HYG", name: "iShares High Yield Corp" },
  { symbol: "JNK", name: "SPDR High Yield Bond" },
  { symbol: "EMB", name: "iShares Emerging Markets Bond" },
  // International ETFs
  { symbol: "EFA", name: "iShares MSCI EAFE" },
  { symbol: "EEM", name: "iShares MSCI Emerging Mkts" },
  { symbol: "VWO", name: "Vanguard Emerging Markets" },
  { symbol: "FXI", name: "iShares China Large-Cap" },
  { symbol: "EWJ", name: "iShares MSCI Japan" },
  { symbol: "EWG", name: "iShares MSCI Germany" },
  { symbol: "EWU", name: "iShares MSCI UK" },
  { symbol: "INDA", name: "iShares MSCI India" },
  { symbol: "EWZ", name: "iShares MSCI Brazil" },
  // Leveraged & Inverse
  { symbol: "TQQQ", name: "ProShares UltraPro QQQ 3x" },
  { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ" },
  { symbol: "SPXU", name: "ProShares UltraPro Short S&P" },
  { symbol: "UPRO", name: "ProShares UltraPro S&P 3x" },
  { symbol: "SOXL", name: "Direxion Semiconductor Bull 3x" },
  { symbol: "SOXS", name: "Direxion Semiconductor Bear 3x" },
  { symbol: "UVXY", name: "ProShares Ultra VIX Short-Term" },
  // Dividend / Income
  { symbol: "SCHD", name: "Schwab US Dividend Equity" },
  { symbol: "VYM", name: "Vanguard High Dividend" },
  { symbol: "DVY", name: "iShares Select Dividend" },
  { symbol: "HDV", name: "iShares Core High Dividend" },
  { symbol: "JEPI", name: "JPMorgan Equity Premium" },
];

const BOND_SYMBOLS = [
  { symbol: "^TNX", name: "US 10-Year Treasury Yield", base: "US10Y" },
  { symbol: "^TYX", name: "US 30-Year Treasury Yield", base: "US30Y" },
  { symbol: "^FVX", name: "US 5-Year Treasury Yield", base: "US5Y" },
  { symbol: "^IRX", name: "US 3-Month Treasury Yield", base: "US3M" },
];

export async function getForexPairs(): Promise<PairInfo[]> {
  const quotes = await batchChartQuotes(FOREX_SYMBOLS, 5, 200);
  const results: PairInfo[] = [];

  for (const sym of FOREX_SYMBOLS) {
    const q = quotes.get(sym);
    if (!q) continue;

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

  // Add metals & commodities (listed under forex since traders expect them there)
  const commoditySymbols = COMMODITY_SYMBOLS.map((c) => c.symbol);
  const commodityQuotes = await batchChartQuotes(commoditySymbols, 5, 200);
  for (const c of COMMODITY_SYMBOLS) {
    const q = commodityQuotes.get(c.symbol);
    if (!q) continue;
    const change = q.prevClose > 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;
    results.push({
      symbol: c.symbol,
      name: c.name,
      base: c.base,
      quote: c.quote,
      class: "forex",
      price: q.price,
      change24h: Math.round(change * 100) / 100,
    });
  }

  return results;
}

export async function getIndexPairs(): Promise<PairInfo[]> {
  const symbols = INDEX_SYMBOLS.map((i) => i.symbol);
  const quotes = await batchChartQuotes(symbols, 5, 200);
  const results: PairInfo[] = [];

  for (const idx of INDEX_SYMBOLS) {
    const q = quotes.get(idx.symbol);
    if (!q) continue;

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
  const quotes = await batchChartQuotes(STOCK_SYMBOLS, 5, 200);
  const results: PairInfo[] = [];

  for (const sym of STOCK_SYMBOLS) {
    const q = quotes.get(sym);
    if (!q) continue;

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

export async function getFundPairs(): Promise<PairInfo[]> {
  const symbols = FUND_SYMBOLS.map((f) => f.symbol);
  const quotes = await batchChartQuotes(symbols, 5, 200);
  const results: PairInfo[] = [];

  for (const fund of FUND_SYMBOLS) {
    const q = quotes.get(fund.symbol);
    if (!q) continue;
    const change = q.prevClose > 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;
    results.push({
      symbol: fund.symbol,
      name: `${fund.symbol} — ${fund.name}`,
      base: fund.symbol,
      quote: "USD",
      class: "funds",
      price: q.price,
      change24h: Math.round(change * 100) / 100,
    });
  }
  return results;
}

export async function getBondPairs(): Promise<PairInfo[]> {
  const symbols = BOND_SYMBOLS.map((b) => b.symbol);
  const quotes = await batchChartQuotes(symbols, 5, 200);
  const results: PairInfo[] = [];

  for (const bond of BOND_SYMBOLS) {
    const q = quotes.get(bond.symbol);
    if (!q) continue;
    const change = q.prevClose > 0 ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0;
    results.push({
      symbol: bond.symbol,
      name: bond.name,
      base: bond.base,
      quote: "%",
      class: "bonds",
      price: q.price,
      change24h: Math.round(change * 100) / 100,
    });
  }
  return results;
}

// --- CANDLE DATA ---
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
    const totalRange = h - l;
    let buyRatio = 0.5; // Start neutral
    if (totalRange > 0) {
      const bodyTop = Math.max(o, c);
      const bodyBottom = Math.min(o, c);
      const upperWick = h - bodyTop;
      const lowerWick = bodyBottom - l;
      const bodyDirection = (c - o) / totalRange;
      const wickBalance = (lowerWick - upperWick) / totalRange;
      buyRatio = 0.5 + (bodyDirection * 0.3) + (wickBalance * 0.2);
    }
    const clampedBuyRatio = Math.max(0.15, Math.min(0.85, buyRatio));

    candles.push({
      timestamp: timestamps[i] * 1000,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: vol,
      takerBuyVolume: vol * clampedBuyRatio,
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
  let score = 0;

  for (const c of recent) {
    const totalRange = c.high - c.low;
    if (totalRange === 0) continue;

    const bodyTop = Math.max(c.open, c.close);
    const bodyBottom = Math.min(c.open, c.close);
    const upperWick = c.high - bodyTop;
    const lowerWick = bodyBottom - c.low;
    const body = bodyTop - bodyBottom;

    const direction = c.close > c.open ? 1 : c.close < c.open ? -1 : 0;
    const bodyRatio = body / totalRange;
    const wickSignal = (lowerWick - upperWick) / totalRange;

    score += (direction * bodyRatio * 0.5) + (wickSignal * 0.5);
  }

  const avg = score / recent.length;
  return Math.max(-0.8, Math.min(0.8, avg));
}
