import { NextRequest, NextResponse } from "next/server";
import { getBinanceKlines, getBinanceOrderBook } from "@/lib/api/binance";
import { calculatePressure } from "@/lib/analysis/pressure";
import type { Timeframe } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");
  const timeframe = (searchParams.get("timeframe") || "1h") as Timeframe;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    const [candles, orderBook] = await Promise.all([
      getBinanceKlines(symbol, timeframe),
      getBinanceOrderBook(symbol),
    ]);

    const pressure = calculatePressure(candles, orderBook.imbalance);

    return NextResponse.json({ pressure, symbol, timeframe });
  } catch (error) {
    console.error(`Pressure calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate pressure" }, { status: 500 });
  }
}
