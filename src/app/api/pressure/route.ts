import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoCandles, syntheticOrderBookImbalance } from "@/lib/api/coingecko";
import { getYahooCandles, syntheticImbalance } from "@/lib/api/yahoo";
import { calculatePressure } from "@/lib/analysis/pressure";
import type { Timeframe, AssetClass } from "@/lib/types";

const VALID_TFS = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") || "";
  const tfParam = searchParams.get("timeframe") || "1h";
  const assetClass = (searchParams.get("class") || "crypto") as AssetClass;
  const timeframe = (VALID_TFS.has(tfParam) ? tfParam : "1h") as Timeframe;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    let candles;
    let imbalance;

    if (assetClass === "crypto") {
      candles = await getCoinGeckoCandles(symbol.toLowerCase(), timeframe);
      imbalance = syntheticOrderBookImbalance(candles);
    } else {
      candles = await getYahooCandles(symbol, timeframe);
      imbalance = syntheticImbalance(candles);
    }

    const pressure = calculatePressure(candles, imbalance);
    return NextResponse.json({ pressure, symbol, timeframe });
  } catch (error) {
    console.error(`Pressure calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate pressure" }, { status: 500 });
  }
}
