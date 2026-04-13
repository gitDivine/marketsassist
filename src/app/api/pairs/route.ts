import { NextResponse } from "next/server";
import { getBinancePairs } from "@/lib/api/binance";

export async function GET() {
  try {
    const pairs = await getBinancePairs();
    return NextResponse.json({ pairs });
  } catch (error) {
    console.error("Failed to fetch pairs:", error);
    return NextResponse.json({ pairs: [], error: "Failed to fetch pairs" }, { status: 500 });
  }
}
