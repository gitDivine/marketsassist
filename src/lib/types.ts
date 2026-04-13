export type AssetClass = "crypto" | "forex" | "stocks" | "indices";

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

export interface PairInfo {
  symbol: string;
  name: string;
  base: string;
  quote: string;
  class: AssetClass;
  price?: number;
  change24h?: number;
}

export interface PressureData {
  buyPressure: number; // 0-100
  sellPressure: number; // 0-100
  volume: number;
  buyVolume: number;
  sellVolume: number;
  rsi: number;
  mfi: number;
  orderBookImbalance: number; // -1 to 1 (negative = sell heavy)
  trend: "bullish" | "bearish" | "neutral";
  strength: number; // 0-100
}

export interface ConfluenceResult {
  overallTrend: "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
  confidence: number; // 0-100
  timeframes: {
    timeframe: Timeframe;
    trend: "bullish" | "bearish" | "neutral";
    pressure: PressureData;
    weight: number;
  }[];
  summary: string;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  sentiment: "positive" | "negative" | "neutral";
  publishedAt: string;
}

export interface SentimentData {
  overall: number; // -100 to 100
  sources: {
    name: string;
    sentiment: number;
    posts: number;
  }[];
  news: NewsItem[];
  summary: string;
}

export interface AnalysisNote {
  type: "technical" | "sentiment" | "news" | "confluence";
  content: string;
  importance: "high" | "medium" | "low";
  timestamp: string;
}
