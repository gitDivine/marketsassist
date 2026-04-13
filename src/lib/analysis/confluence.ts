import type { Timeframe, ConfluenceResult, PressureData } from "../types";

// Base weights — higher TFs naturally stronger
const BASE_WEIGHTS: Record<Timeframe, number> = {
  "1m": 0.04,
  "5m": 0.06,
  "15m": 0.10,
  "1h": 0.15,
  "4h": 0.20,
  "1d": 0.25,
  "1w": 0.20,
};

// Timeframe tiers for divergence detection
const LOWER_TFS: Timeframe[] = ["1m", "5m", "15m"];
const HIGHER_TFS: Timeframe[] = ["1d", "1w"];

function getTrend(pressure: PressureData): "bullish" | "bearish" | "neutral" {
  if (pressure.buyPressure >= 55) return "bullish";
  if (pressure.buyPressure <= 45) return "bearish";
  return "neutral";
}

function isExtremePressure(pressure: PressureData): boolean {
  return pressure.buyPressure > 75 || pressure.buyPressure < 25;
}

interface DivergenceInfo {
  detected: boolean;
  type: "potential_reversal" | "momentum_shift" | "early_breakout" | "none";
  description: string;
  ltfDirection: "bullish" | "bearish" | "neutral";
  htfDirection: "bullish" | "bearish" | "neutral";
  weightAdjustment: number; // multiplier for LTF weights (1 = no change)
}

function detectDivergence(
  timeframePressures: { timeframe: Timeframe; pressure: PressureData }[]
): DivergenceInfo {
  const ltfEntries = timeframePressures.filter((t) => LOWER_TFS.includes(t.timeframe));
  const htfEntries = timeframePressures.filter((t) => HIGHER_TFS.includes(t.timeframe));

  if (ltfEntries.length === 0 || htfEntries.length === 0) {
    return { detected: false, type: "none", description: "", ltfDirection: "neutral", htfDirection: "neutral", weightAdjustment: 1 };
  }

  // Average pressure per tier
  const ltfAvgBuy = ltfEntries.reduce((s, t) => s + t.pressure.buyPressure, 0) / ltfEntries.length;
  const htfAvgBuy = htfEntries.reduce((s, t) => s + t.pressure.buyPressure, 0) / htfEntries.length;

  const ltfTrend: "bullish" | "bearish" | "neutral" =
    ltfAvgBuy >= 55 ? "bullish" : ltfAvgBuy <= 45 ? "bearish" : "neutral";
  const htfTrend: "bullish" | "bearish" | "neutral" =
    htfAvgBuy >= 55 ? "bullish" : htfAvgBuy <= 45 ? "bearish" : "neutral";

  // No divergence if same direction or either neutral
  if (ltfTrend === htfTrend || ltfTrend === "neutral" || htfTrend === "neutral") {
    return { detected: false, type: "none", description: "", ltfDirection: ltfTrend, htfDirection: htfTrend, weightAdjustment: 1 };
  }

  // Divergence detected — LTF opposes HTF
  const ltfExtreme = ltfEntries.some((t) => isExtremePressure(t.pressure));
  const ltfStrength = Math.abs(ltfAvgBuy - 50);
  const htfStrength = Math.abs(htfAvgBuy - 50);

  // Count how many LTFs agree on opposing direction
  const opposingCount = ltfEntries.filter((t) => getTrend(t.pressure) === ltfTrend).length;

  let type: DivergenceInfo["type"] = "potential_reversal";
  let weightAdjustment = 1;
  let description = "";

  if (ltfExtreme && opposingCount >= 2) {
    // Extreme LTF pressure opposing HTF with volume — possible early breakout
    type = "early_breakout";
    weightAdjustment = 1.8; // Boost LTF weight significantly
    description = `⚡ ${ltfTrend === "bullish" ? "Buying" : "Selling"} pressure surging on lower timeframes against the ${htfTrend} higher timeframe trend. Extreme momentum detected — potential early ${ltfTrend === "bullish" ? "breakout" : "breakdown"}.`;
  } else if (ltfStrength > htfStrength) {
    // LTF momentum exceeds HTF — momentum shift
    type = "momentum_shift";
    weightAdjustment = 1.4; // Moderate LTF boost
    description = `🔄 Lower timeframes showing stronger ${ltfTrend} pressure (${Math.round(ltfAvgBuy)}%) than the ${htfTrend} higher timeframe trend (${Math.round(htfAvgBuy)}%). Momentum shifting — HTF trend may be weakening.`;
  } else {
    // Standard divergence — LTF opposing but weaker
    type = "potential_reversal";
    weightAdjustment = 1.15; // Slight LTF boost
    description = `📊 Divergence: Lower timeframes are ${ltfTrend} while higher timeframes remain ${htfTrend}. Could be early reversal signal or noise — watch for confirmation.`;
  }

  return {
    detected: true,
    type,
    description,
    ltfDirection: ltfTrend,
    htfDirection: htfTrend,
    weightAdjustment,
  };
}

// newsSentiment: -100 to 100 (from news API), 0 = neutral/no news
export function calculateConfluence(
  timeframePressures: { timeframe: Timeframe; pressure: PressureData }[],
  newsSentiment = 0
): ConfluenceResult {
  if (timeframePressures.length === 0) {
    return {
      overallTrend: "neutral",
      confidence: 0,
      timeframes: [],
      summary: "No data available.",
    };
  }

  // Detect divergence between LTF and HTF
  const divergence = detectDivergence(timeframePressures);

  let weightedScore = 0;
  let totalWeight = 0;
  let bullishCount = 0;
  let bearishCount = 0;

  const timeframes = timeframePressures.map(({ timeframe, pressure }) => {
    let weight = BASE_WEIGHTS[timeframe] || 0.1;

    if (divergence.detected && LOWER_TFS.includes(timeframe)) {
      weight *= divergence.weightAdjustment;
    }

    if (HIGHER_TFS.includes(timeframe) && Math.abs(pressure.buyPressure - 50) < 10) {
      weight *= 0.7;
    }

    const score = (pressure.buyPressure - 50) / 50;
    weightedScore += score * weight;
    totalWeight += weight;

    const trend = getTrend(pressure);
    if (trend === "bullish") bullishCount++;
    else if (trend === "bearish") bearishCount++;

    return { timeframe, trend, pressure, weight: Math.round(weight * 100) / 100 };
  });

  // Factor in news sentiment (weight: 0.15 of total signal)
  // newsSentiment is -100..100, normalize to -1..1
  const NEWS_WEIGHT = 0.15;
  if (newsSentiment !== 0) {
    const newsScore = newsSentiment / 100; // -1 to 1
    weightedScore += newsScore * NEWS_WEIGHT;
    totalWeight += NEWS_WEIGHT;
  }

  const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  let overallTrend: ConfluenceResult["overallTrend"] = "neutral";
  if (normalizedScore > 0.25) overallTrend = "strong_bullish";
  else if (normalizedScore > 0.08) overallTrend = "bullish";
  else if (normalizedScore < -0.25) overallTrend = "strong_bearish";
  else if (normalizedScore < -0.08) overallTrend = "bearish";

  const total = timeframePressures.length;
  const maxAlignment = Math.max(bullishCount, bearishCount);
  const alignment = total > 0 ? maxAlignment / total : 0;
  const rawConfidence = alignment * Math.abs(normalizedScore) * 150;
  const confidence = Math.min(95, Math.round(rawConfidence));

  const summary = generateSummary(overallTrend, confidence, bullishCount, bearishCount, total, divergence, newsSentiment);

  return {
    overallTrend,
    confidence,
    timeframes,
    summary,
  };
}

function generateSummary(
  trend: ConfluenceResult["overallTrend"],
  confidence: number,
  bullish: number,
  bearish: number,
  total: number,
  divergence: DivergenceInfo,
  newsSentiment = 0
): string {
  const trendLabels = {
    strong_bullish: "Strong Bullish",
    bullish: "Bullish",
    neutral: "Neutral / Consolidation",
    bearish: "Bearish",
    strong_bearish: "Strong Bearish",
  };

  const neutral = total - bullish - bearish;
  let summary = `${trendLabels[trend]} across ${total} timeframes (${confidence}% confidence). `;
  summary += `${bullish} bullish, ${bearish} bearish, ${neutral} neutral. `;

  if (divergence.detected) {
    summary += "\n\n" + divergence.description;
  } else if (trend === "neutral") {
    summary += "Mixed signals suggest consolidation — wait for clearer direction.";
  } else if (confidence > 70) {
    summary += "High confluence — most timeframes agree on direction.";
  } else if (confidence > 40) {
    summary += "Moderate confluence — some conflicting signals on lower timeframes.";
  } else {
    summary += "Low confluence — trend is weak and may reverse.";
  }

  // News sentiment note
  if (newsSentiment > 30) {
    summary += `\n\n📰 News sentiment is bullish (+${newsSentiment}%) — media coverage supports the trend.`;
  } else if (newsSentiment < -30) {
    summary += `\n\n📰 News sentiment is bearish (${newsSentiment}%) — negative media pressure detected.`;
  } else if (newsSentiment !== 0) {
    summary += `\n\n📰 News sentiment is mixed (${newsSentiment > 0 ? "+" : ""}${newsSentiment}%) — no strong media bias.`;
  }

  summary += "\n\n⚠️ Not financial advice. Always do your own research.";

  return summary;
}
