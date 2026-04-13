import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoCandles, syntheticOrderBookImbalance } from "@/lib/api/coingecko";
import { getYahooCandles, syntheticImbalance } from "@/lib/api/yahoo";
import { calculatePressure } from "@/lib/analysis/pressure";
import { calculateConfluence } from "@/lib/analysis/confluence";
import type { Timeframe, AssetClass } from "@/lib/types";

const ALL_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") || "";
  const assetClass = (searchParams.get("class") || "crypto") as AssetClass;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    const klinesResults = await Promise.allSettled(
      ALL_TIMEFRAMES.map((tf) =>
        assetClass === "crypto"
          ? getCoinGeckoCandles(symbol.toLowerCase(), tf)
          : getYahooCandles(symbol, tf)
      )
    );

    const timeframePressures = ALL_TIMEFRAMES
      .map((tf, i) => {
        const result = klinesResults[i];
        if (result.status === "rejected") return null;
        const candles = result.value;
        const imbalance = assetClass === "crypto"
          ? syntheticOrderBookImbalance(candles)
          : syntheticImbalance(candles);
        const pressure = calculatePressure(candles, imbalance);
        return { timeframe: tf, pressure };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const confluence = calculateConfluence(timeframePressures);
    return NextResponse.json({ confluence, symbol });
  } catch (error) {
    console.error(`Confluence calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate confluence" }, { status: 500 });
  }
}
