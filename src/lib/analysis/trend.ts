// Trend analysis and shift detection engine
// Determines market trend from EMA analysis and detects dimensional divergences

import { type Candle, calculateEMA } from "./indicators";

export interface TrendResult {
  /** Trend direction */
  trend: "bullish" | "bearish" | "neutral";
  /** How aligned are the EMAs (0-100) */
  strength: number;
  /** Price position relative to EMA9 */
  priceVsEma9: "above" | "below" | "at";
  /** Price position relative to EMA21 */
  priceVsEma21: "above" | "below" | "at";
  /** EMA9 vs EMA21 crossover state */
  emaCrossover: "bullish" | "bearish" | "none";
  /** Human-readable description */
  description: string;
}

export interface ShiftResult {
  /** Is there a divergence between dimensions? */
  detected: boolean;
  /** What type of divergence */
  type:
    | "trend_vs_pressure"
    | "structure_vs_pressure"
    | "structure_vs_trend"
    | "full_alignment"
    | "none";
  /** Severity level */
  severity: "warning" | "alert" | "none";
  /** Actionable description */
  description: string;
}

// Threshold as a proportion of price — below this, price is considered "at" the EMA
const AT_THRESHOLD = 0.001; // 0.1%

/**
 * Compare a value to a reference with a tolerance band.
 * Returns "above", "below", or "at".
 */
function compareToEma(
  price: number,
  ema: number
): "above" | "below" | "at" {
  if (price === 0 && ema === 0) return "at";
  const ref = Math.max(Math.abs(price), Math.abs(ema), 1e-10);
  const diff = (price - ema) / ref;
  if (diff > AT_THRESHOLD) return "above";
  if (diff < -AT_THRESHOLD) return "below";
  return "at";
}

/**
 * Analyze trend using EMA9 and EMA21.
 *
 * Bullish: price above both EMAs AND EMA9 > EMA21
 * Bearish: price below both EMAs AND EMA9 < EMA21
 * Neutral: mixed signals
 *
 * Strength measures how far price is from the EMAs proportionally (0-100).
 */
export function analyzeTrend(candles: Candle[]): TrendResult {
  // Edge case: not enough data
  if (candles.length < 2) {
    return {
      trend: "neutral",
      strength: 0,
      priceVsEma9: "at",
      priceVsEma21: "at",
      emaCrossover: "none",
      description: "Insufficient data for trend analysis.",
    };
  }

  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];

  // With fewer than 21 candles we can still compute EMAs (they just warm up
  // from the first value), but the 21-period EMA will be less reliable.
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  const lastEma9 = ema9[ema9.length - 1];
  const lastEma21 = ema21[ema21.length - 1];

  const priceVsEma9 = compareToEma(lastClose, lastEma9);
  const priceVsEma21 = compareToEma(lastClose, lastEma21);

  // EMA crossover
  let emaCrossover: "bullish" | "bearish" | "none" = "none";
  const emaDiff = lastEma9 - lastEma21;
  const emaRef = Math.max(Math.abs(lastEma9), Math.abs(lastEma21), 1e-10);
  if (Math.abs(emaDiff / emaRef) > AT_THRESHOLD) {
    emaCrossover = emaDiff > 0 ? "bullish" : "bearish";
  }

  // Determine trend
  let trend: "bullish" | "bearish" | "neutral" = "neutral";

  const bullishSignals =
    (priceVsEma9 === "above" ? 1 : 0) +
    (priceVsEma21 === "above" ? 1 : 0) +
    (emaCrossover === "bullish" ? 1 : 0);

  const bearishSignals =
    (priceVsEma9 === "below" ? 1 : 0) +
    (priceVsEma21 === "below" ? 1 : 0) +
    (emaCrossover === "bearish" ? 1 : 0);

  if (bullishSignals === 3) {
    trend = "bullish";
  } else if (bearishSignals === 3) {
    trend = "bearish";
  } else {
    trend = "neutral";
  }

  // Strength: proportional distance of price from both EMAs (0-100)
  // Uses the average percentage distance, capped for sanity
  const dist9 =
    emaRef > 0 ? ((lastClose - lastEma9) / emaRef) * 100 : 0;
  const dist21 =
    emaRef > 0 ? ((lastClose - lastEma21) / emaRef) * 100 : 0;

  let rawStrength: number;
  if (trend === "bullish") {
    // Both distances are positive — average them
    rawStrength = (dist9 + dist21) / 2;
  } else if (trend === "bearish") {
    // Both distances are negative — use absolute average
    rawStrength = (Math.abs(dist9) + Math.abs(dist21)) / 2;
  } else {
    // Mixed: strength is low — use the smaller absolute distance
    rawStrength = Math.min(Math.abs(dist9), Math.abs(dist21));
  }

  // Normalize: 0% distance → 0 strength, 2%+ distance → 100 strength
  const MAX_DISTANCE_PCT = 2;
  const strength = Math.round(
    Math.min(100, Math.max(0, (rawStrength / MAX_DISTANCE_PCT) * 100))
  );

  // Insufficient data caveat
  const caveat =
    candles.length < 21
      ? " (limited data — EMA21 still warming up)"
      : "";

  // Build description
  let description: string;
  if (trend === "bullish") {
    description =
      strength >= 70
        ? `Strong bullish trend — price well above EMA9 and EMA21 with bullish crossover${caveat}.`
        : strength >= 30
          ? `Bullish trend — price above both EMAs with EMA9 leading${caveat}.`
          : `Weak bullish trend — price slightly above EMAs${caveat}.`;
  } else if (trend === "bearish") {
    description =
      strength >= 70
        ? `Strong bearish trend — price well below EMA9 and EMA21 with bearish crossover${caveat}.`
        : strength >= 30
          ? `Bearish trend — price below both EMAs with EMA9 lagging${caveat}.`
          : `Weak bearish trend — price slightly below EMAs${caveat}.`;
  } else {
    description = `Neutral / mixed signals — EMAs and price are not aligned. No clear directional bias${caveat}.`;
  }

  return {
    trend,
    strength,
    priceVsEma9,
    priceVsEma21,
    emaCrossover,
    description,
  };
}

/**
 * Detect shift / divergence between the three analysis dimensions:
 *   - structure (higher highs/lows pattern)
 *   - trend (EMA-based direction)
 *   - pressureTrend (volume/order-flow direction)
 *
 * Returns the most severe divergence found.
 */
export function detectShift(
  structure: "uptrend" | "downtrend" | "ranging",
  trend: "bullish" | "bearish" | "neutral",
  pressureTrend: "bullish" | "bearish" | "neutral"
): ShiftResult {
  // Map structure to a comparable direction
  const structureDir = structureToDirection(structure);

  const structureMatchesTrend = directionsAgree(structureDir, trend);
  const structureMatchesPressure = directionsAgree(structureDir, pressureTrend);
  const trendMatchesPressure = directionsAgree(trend, pressureTrend);

  // All three agree → full alignment
  if (structureMatchesTrend && structureMatchesPressure && trendMatchesPressure) {
    const label =
      trend === "neutral"
        ? "All dimensions neutral — no directional conviction."
        : `Full alignment — structure, trend, and pressure all ${trend}. High-conviction setup.`;
    return {
      detected: false,
      type: "full_alignment",
      severity: "none",
      description: label,
    };
  }

  // Pressure opposes BOTH structure and trend → most dangerous
  if (!structureMatchesPressure && !trendMatchesPressure && structureMatchesTrend) {
    const pressureLabel = pressureTrend === "neutral" ? "fading" : pressureTrend;
    const trendLabel = trend === "neutral" ? "indeterminate" : trend;
    return {
      detected: true,
      type: "structure_vs_pressure",
      severity: "alert",
      description:
        `${capitalize(pressureLabel)} pressure building against ${trendLabel} structure and trend — potential reversal. Watch for break of structure.`,
    };
  }

  // Trend opposes structure (pressure may or may not agree with either)
  if (!structureMatchesTrend) {
    const trendLabel = trend === "neutral" ? "indeterminate" : trend;
    const structLabel = structure === "ranging" ? "ranging" : structure;
    return {
      detected: true,
      type: "structure_vs_trend",
      severity: "warning",
      description:
        `Trend (${trendLabel}) diverging from structure (${structLabel}) — trend may be shifting. Look for confirmation on next structure test.`,
    };
  }

  // Only pressure differs from trend (structure and trend agree)
  if (!trendMatchesPressure) {
    const pressureLabel = pressureTrend === "neutral" ? "fading" : pressureTrend;
    const trendLabel = trend === "neutral" ? "indeterminate" : trend;
    return {
      detected: true,
      type: "trend_vs_pressure",
      severity: "warning",
      description:
        `${capitalize(pressureLabel)} pressure emerging against ${trendLabel} trend — early divergence signal. Monitor volume and order flow for escalation.`,
    };
  }

  // Fallback: some combination of neutral + mismatch that doesn't fit neatly above
  return {
    detected: false,
    type: "none",
    severity: "none",
    description: "No significant dimensional shift detected.",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert structure labels to directional labels comparable with trend/pressure. */
function structureToDirection(
  structure: "uptrend" | "downtrend" | "ranging"
): "bullish" | "bearish" | "neutral" {
  switch (structure) {
    case "uptrend":
      return "bullish";
    case "downtrend":
      return "bearish";
    case "ranging":
      return "neutral";
  }
}

/**
 * Two directions "agree" if they are the same, or if either is neutral.
 * Neutral is treated as non-opposing — it doesn't conflict with a direction,
 * but two opposite directions (bullish vs bearish) always disagree.
 */
function directionsAgree(
  a: "bullish" | "bearish" | "neutral",
  b: "bullish" | "bearish" | "neutral"
): boolean {
  if (a === b) return true;
  if (a === "neutral" || b === "neutral") return true;
  return false; // bullish vs bearish
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
