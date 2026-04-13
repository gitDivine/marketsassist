import { NextRequest, NextResponse } from "next/server";
import { getBinanceKlines, getBinanceOrderBook } from "@/lib/api/binance";
import { calculatePressure } from "@/lib/analysis/pressure";
import { calculateConfluence } from "@/lib/analysis/confluence";
import type { Timeframe } from "@/lib/types";

const ALL_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    // Fetch order book once
    const orderBook = await getBinanceOrderBook(symbol);

    // Fetch all timeframes in parallel
    const klinesResults = await Promise.allSettled(
      ALL_TIMEFRAMES.map((tf) => getBinanceKlines(symbol, tf, 100))
    );

    const timeframePressures = ALL_TIMEFRAMES
      .map((tf, i) => {
        const result = klinesResults[i];
        if (result.status === "rejected") return null;
        const pressure = calculatePressure(result.value, orderBook.imbalance);
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
