import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoCandles, syntheticOrderBookImbalance } from "@/lib/api/coingecko";
import { getYahooCandles, syntheticImbalance } from "@/lib/api/yahoo";
import { getCryptoNews, getGoogleNews } from "@/lib/api/news";
import { getSocialSentiment } from "@/lib/api/social";
import { calculatePressure } from "@/lib/analysis/pressure";
import { analyzeStructure } from "@/lib/analysis/structure";
import { analyzeTrend, detectShift } from "@/lib/analysis/trend";
import { calculateVerdict } from "@/lib/analysis/verdict";
import type { TimeframeAnalysis } from "@/lib/analysis/verdict";
import type { Timeframe, AssetClass } from "@/lib/types";

const ALL_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") || "";
  const assetClass = (searchParams.get("class") || "crypto") as AssetClass;
  const base = searchParams.get("base") || symbol;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    // Fetch news + social in background while we get candles
    const newsPromise = Promise.all([
      getCryptoNews(base).catch(() => []),
      getGoogleNews(base + " price").catch(() => []),
    ]);
    const socialPromise = getSocialSentiment(base, assetClass).catch(() => ({
      overall: 0,
      posts: [],
      sources: [],
    }));

    // Build full 4-dimension analysis per timeframe
    const timeframeAnalyses: TimeframeAnalysis[] = [];

    if (assetClass === "crypto") {
      for (const tf of ALL_TIMEFRAMES) {
        try {
          const candles = await getCoinGeckoCandles(symbol.toLowerCase(), tf);
          if (candles.length < 5) continue;

          const imbalance = syntheticOrderBookImbalance(candles);
          const pressure = calculatePressure(candles, imbalance);
          const structure = analyzeStructure(candles);
          const trend = analyzeTrend(candles);
          const shift = detectShift(structure.structure, trend.trend, pressure.trend);

          timeframeAnalyses.push({ timeframe: tf, structure, trend, pressure, shift });
        } catch {
          // Skip failed timeframes
        }
      }
    } else {
      const klinesResults = await Promise.allSettled(
        ALL_TIMEFRAMES.map((tf) => getYahooCandles(symbol, tf))
      );
      for (let i = 0; i < ALL_TIMEFRAMES.length; i++) {
        const result = klinesResults[i];
        if (result.status === "rejected") continue;
        const candles = result.value;
        if (candles.length < 5) continue;

        const imbalance = syntheticImbalance(candles);
        const pressure = calculatePressure(candles, imbalance);
        const structure = analyzeStructure(candles);
        const trend = analyzeTrend(candles);
        const shift = detectShift(structure.structure, trend.trend, pressure.trend);

        timeframeAnalyses.push({ timeframe: ALL_TIMEFRAMES[i], structure, trend, pressure, shift });
      }
    }

    // Get news + social sentiment
    const [[cryptoNews, googleNews], social] = await Promise.all([newsPromise, socialPromise]);
    const allNews = [...cryptoNews, ...googleNews];
    let newsScore = 0;
    for (const n of allNews) {
      if (n.sentiment === "positive") newsScore++;
      else if (n.sentiment === "negative") newsScore--;
    }
    const rawNewsSentiment = allNews.length > 0
      ? Math.round((newsScore / allNews.length) * 100)
      : 0;

    let combinedSentiment = rawNewsSentiment;
    if (social.overall !== 0 && rawNewsSentiment !== 0) {
      combinedSentiment = Math.round(rawNewsSentiment * 0.5 + social.overall * 0.5);
    } else if (social.overall !== 0) {
      combinedSentiment = social.overall;
    }

    // Calculate verdict (replaces old confluence)
    const verdict = calculateVerdict(timeframeAnalyses, combinedSentiment);

    return NextResponse.json({
      verdict,
      symbol,
      newsSentiment: combinedSentiment,
      socialSentiment: social,
    });
  } catch (error) {
    console.error(`Verdict calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate verdict" }, { status: 500 });
  }
}
