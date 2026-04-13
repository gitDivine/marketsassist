import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoPairs } from "@/lib/api/coingecko";
import { getForexPairs, getStockPairs, getIndexPairs } from "@/lib/api/yahoo";
import type { AssetClass } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classFilter = searchParams.get("class") as AssetClass | null;

  try {
    // Fetch all markets in parallel
    const [crypto, forex, stocks, indices] = await Promise.allSettled([
      getCoinGeckoPairs(),
      getForexPairs(),
      getStockPairs(),
      getIndexPairs(),
    ]);

    const allPairs = [
      ...(crypto.status === "fulfilled" ? crypto.value : []),
      ...(forex.status === "fulfilled" ? forex.value : []),
      ...(stocks.status === "fulfilled" ? stocks.value : []),
      ...(indices.status === "fulfilled" ? indices.value : []),
    ];

    const filtered = classFilter
      ? allPairs.filter((p) => p.class === classFilter)
      : allPairs;

    return NextResponse.json({ pairs: filtered });
  } catch (error) {
    console.error("Failed to fetch pairs:", error);
    return NextResponse.json({ pairs: [], error: "Failed to fetch pairs" }, { status: 500 });
  }
}
