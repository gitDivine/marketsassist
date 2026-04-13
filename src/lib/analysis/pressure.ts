import { Candle, calculateRSI, calculateMFI, calculateVolumeProfile } from "./indicators";
import type { PressureData } from "../types";

export function calculatePressure(candles: Candle[], orderBookImbalance = 0): PressureData {
  if (candles.length === 0) {
    return {
      buyPressure: 50,
      sellPressure: 50,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
      rsi: 50,
      mfi: 50,
      orderBookImbalance: 0,
      trend: "neutral",
      strength: 0,
    };
  }

  const rsi = calculateRSI(candles);
  const mfi = calculateMFI(candles);
  const volumeProfile = calculateVolumeProfile(candles);

  // Normalize components to 0-100 (where 100 = max buy pressure)
  const rsiScore = rsi; // already 0-100
  const mfiScore = mfi; // already 0-100
  const volumeScore = volumeProfile.ratio * 100; // 0-100
  const obScore = (orderBookImbalance + 1) * 50; // -1..1 → 0-100

  // Weighted combination
  const weights = { volume: 0.35, rsi: 0.2, mfi: 0.2, orderBook: 0.25 };
  const buyPressure = Math.round(
    volumeScore * weights.volume +
    rsiScore * weights.rsi +
    mfiScore * weights.mfi +
    obScore * weights.orderBook
  );

  const sellPressure = 100 - buyPressure;

  // Determine trend
  let trend: PressureData["trend"] = "neutral";
  if (buyPressure >= 58) trend = "bullish";
  else if (buyPressure <= 42) trend = "bearish";

  const strength = Math.abs(buyPressure - 50) * 2; // 0-100

  const totalVolume = candles.reduce((sum, c) => sum + c.volume, 0);

  return {
    buyPressure: Math.min(100, Math.max(0, buyPressure)),
    sellPressure: Math.min(100, Math.max(0, sellPressure)),
    volume: totalVolume,
    buyVolume: volumeProfile.buyVolume,
    sellVolume: volumeProfile.sellVolume,
    rsi: Math.round(rsi * 10) / 10,
    mfi: Math.round(mfi * 10) / 10,
    orderBookImbalance,
    trend,
    strength: Math.round(strength),
  };
}
