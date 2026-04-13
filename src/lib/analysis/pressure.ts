import { Candle, calculateRSI, calculateMFI, calculateVolumeProfile, calculateMomentumScore } from "./indicators";
import type { PressureData } from "../types";

// Generate synthetic volume from price range for assets with no volume (forex)
function injectSyntheticVolume(candles: Candle[]): Candle[] {
  const hasVolume = candles.some((c) => c.volume > 0);
  if (hasVolume) return candles;

  // Use price range (high - low) as volume proxy — larger moves = more activity
  // Normalize to a reasonable scale
  const ranges = candles.map((c) => c.high - c.low);
  const avgRange = ranges.reduce((s, r) => s + r, 0) / Math.max(1, ranges.length);

  return candles.map((c) => {
    const range = c.high - c.low;
    // Scale: average range = 1000 units of synthetic volume
    const syntheticVol = avgRange > 0 ? (range / avgRange) * 1000 : 1000;

    // Buy ratio from wick analysis (same as coingecko/yahoo estimation)
    const totalRange = c.high - c.low;
    let buyRatio = 0.5;
    if (totalRange > 0) {
      const bodyTop = Math.max(c.open, c.close);
      const bodyBottom = Math.min(c.open, c.close);
      const upperWick = c.high - bodyTop;
      const lowerWick = bodyBottom - c.low;
      const bodyDirection = (c.close - c.open) / totalRange;
      const wickBalance = (lowerWick - upperWick) / totalRange;
      buyRatio = 0.5 + (bodyDirection * 0.3) + (wickBalance * 0.2);
    }
    const clampedRatio = Math.max(0.15, Math.min(0.85, buyRatio));

    return {
      ...c,
      volume: syntheticVol,
      takerBuyVolume: syntheticVol * clampedRatio,
    };
  });
}

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

  // Inject synthetic volume for forex/assets with no volume data
  const processedCandles = injectSyntheticVolume(candles);
  const hasRealVolume = candles.some((c) => c.volume > 0);

  const rsi = calculateRSI(processedCandles);
  const mfi = calculateMFI(processedCandles);
  const volumeProfile = calculateVolumeProfile(processedCandles);
  const momentum = calculateMomentumScore(processedCandles); // -100 to +100

  const rsiScore = rsi; // 0-100
  const mfiScore = mfi; // 0-100
  const volumeScore = volumeProfile.ratio * 100; // 0-100
  const obScore = (orderBookImbalance + 1) * 50; // 0-100
  const momentumScore = (momentum + 100) / 2; // -100..+100 → 0-100

  // Weights include momentum to anchor direction from price structure
  // Momentum prevents the "always bullish" bias by checking actual trend direction
  const weights = hasRealVolume
    ? { volume: 0.25, rsi: 0.15, mfi: 0.15, orderBook: 0.15, momentum: 0.30 }
    : { volume: 0.15, rsi: 0.20, mfi: 0.10, orderBook: 0.20, momentum: 0.35 };

  const buyPressure = Math.round(
    volumeScore * weights.volume +
    rsiScore * weights.rsi +
    mfiScore * weights.mfi +
    obScore * weights.orderBook +
    momentumScore * weights.momentum
  );

  const sellPressure = 100 - buyPressure;

  // Tighter thresholds — 55/45 instead of 58/42
  let trend: PressureData["trend"] = "neutral";
  if (buyPressure >= 55) trend = "bullish";
  else if (buyPressure <= 45) trend = "bearish";

  const strength = Math.abs(buyPressure - 50) * 2;

  const totalVolume = processedCandles.reduce((sum, c) => sum + c.volume, 0);

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
