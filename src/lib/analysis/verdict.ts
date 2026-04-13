import type { Timeframe, PressureData } from "../types";
import type { StructureResult } from "./structure";
import type { TrendResult, ShiftResult } from "./trend";

// ─── Verdict types ───────────────────────────────────────────────────────────

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  structure: StructureResult;
  trend: TrendResult;
  pressure: PressureData;
  shift: ShiftResult;
}

export interface VerdictResult {
  verdict:
    | "strong_bullish"
    | "bullish"
    | "neutral"
    | "bearish"
    | "strong_bearish";
  confidence: number; // 0-100
  timeframes: TimeframeAnalysis[];
  dimensions: {
    structure: number; // -100 to +100
    trend: number;
    pressure: number;
    sentiment: number;
  };
  shifts: { timeframe: Timeframe; shift: ShiftResult }[];
  summary: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIMEFRAME_WEIGHTS: Record<Timeframe, number> = {
  "1m": 0.03,
  "5m": 0.05,
  "15m": 0.08,
  "1h": 0.14,
  "4h": 0.20,
  "1d": 0.27,
  "1w": 0.23,
};

const DIMENSION_WEIGHTS = {
  structure: 0.35,
  trend: 0.25,
  pressure: 0.25,
  sentiment: 0.15,
};

const HIGHER_TFS: Timeframe[] = ["1d", "1w"];

// ─── Scoring helpers ─────────────────────────────────────────────────────────

/** Convert structure result to -100..+100 score */
function scoreStructure(s: StructureResult): number {
  switch (s.structure) {
    case "uptrend":
      return s.strength;
    case "downtrend":
      return -s.strength;
    case "ranging":
    default:
      return 0;
  }
}

/** Convert trend result to -100..+100 score */
function scoreTrend(t: TrendResult): number {
  switch (t.trend) {
    case "bullish":
      return t.strength;
    case "bearish":
      return -t.strength;
    case "neutral":
    default:
      return 0;
  }
}

/** Convert pressure data to -100..+100 score */
function scorePressure(p: PressureData): number {
  // 70% buy → +40, 30% buy → -40, 50% buy → 0
  return (p.buyPressure - 50) * 2;
}

/** Weighted average of per-timeframe scores for a single dimension */
function weightedDimensionScore(
  analyses: TimeframeAnalysis[],
  scoreFn: (a: TimeframeAnalysis) => number
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const a of analyses) {
    const w = TIMEFRAME_WEIGHTS[a.timeframe] ?? 0.05;
    weightedSum += scoreFn(a) * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export function calculateVerdict(
  timeframeAnalyses: TimeframeAnalysis[],
  sentimentScore = 0 // -100 to +100 from news/social
): VerdictResult {
  if (timeframeAnalyses.length === 0) {
    return {
      verdict: "neutral",
      confidence: 0,
      timeframes: [],
      dimensions: { structure: 0, trend: 0, pressure: 0, sentiment: 0 },
      shifts: [],
      summary: "No data available for analysis.",
    };
  }

  // ── 1. Per-dimension weighted scores ────────────────────────────────────

  const structureScore = clamp(
    weightedDimensionScore(timeframeAnalyses, (a) => scoreStructure(a.structure)),
    -100,
    100
  );

  const trendScore = clamp(
    weightedDimensionScore(timeframeAnalyses, (a) => scoreTrend(a.trend)),
    -100,
    100
  );

  const pressureScore = clamp(
    weightedDimensionScore(timeframeAnalyses, (a) => scorePressure(a.pressure)),
    -100,
    100
  );

  const sentiment = clamp(sentimentScore, -100, 100);

  // ── 2. Structure is king override ───────────────────────────────────────
  // If 1D and 1W both show downtrend, apply bearish gravity.
  // If both show uptrend, apply bullish gravity.

  const htfStructures = timeframeAnalyses.filter((a) =>
    HIGHER_TFS.includes(a.timeframe)
  );

  let htfOverride = 0;
  if (htfStructures.length >= 2) {
    const allDown = htfStructures.every((a) => a.structure.structure === "downtrend");
    const allUp = htfStructures.every((a) => a.structure.structure === "uptrend");

    if (allDown) {
      // Average strength of higher TF downtrends — pull final score toward bearish
      const avgStrength =
        htfStructures.reduce((s, a) => s + a.structure.strength, 0) /
        htfStructures.length;
      htfOverride = -(avgStrength * 0.3); // up to -30 bias
    } else if (allUp) {
      const avgStrength =
        htfStructures.reduce((s, a) => s + a.structure.strength, 0) /
        htfStructures.length;
      htfOverride = avgStrength * 0.3;
    }
  }

  // ── 3. Combine dimensions into final score ─────────────────────────────

  const rawScore =
    structureScore * DIMENSION_WEIGHTS.structure +
    trendScore * DIMENSION_WEIGHTS.trend +
    pressureScore * DIMENSION_WEIGHTS.pressure +
    sentiment * DIMENSION_WEIGHTS.sentiment +
    htfOverride;

  const finalScore = clamp(rawScore, -100, 100);

  // ── 4. Verdict from thresholds ──────────────────────────────────────────

  let verdict: VerdictResult["verdict"];
  if (finalScore > 35) verdict = "strong_bullish";
  else if (finalScore > 12) verdict = "bullish";
  else if (finalScore < -35) verdict = "strong_bearish";
  else if (finalScore < -12) verdict = "bearish";
  else verdict = "neutral";

  // ── 5. Confidence from dimensional alignment ───────────────────────────
  // All dimensions same sign = high confidence, mixed = low.

  const dimensionScores = [structureScore, trendScore, pressureScore, sentiment];
  const signs = dimensionScores.map((d) => (d > 5 ? 1 : d < -5 ? -1 : 0));
  const nonZeroSigns = signs.filter((s) => s !== 0);
  const agreeing = nonZeroSigns.length > 0
    ? nonZeroSigns.filter((s) => s === Math.sign(finalScore || 1)).length
    : 0;

  // Base alignment ratio (how many dimensions agree with the verdict direction)
  const alignmentRatio =
    nonZeroSigns.length > 0 ? agreeing / nonZeroSigns.length : 0;

  // Factor in magnitude — strong scores are more confident
  const magnitudeFactor = Math.abs(finalScore) / 100;

  const rawConfidence = (alignmentRatio * 0.6 + magnitudeFactor * 0.4) * 100;
  const confidence = Math.min(95, Math.max(5, Math.round(rawConfidence)));

  // ── 6. Collect active shifts ────────────────────────────────────────────

  const shifts = timeframeAnalyses
    .filter((a) => a.shift.severity !== "none")
    .map((a) => ({ timeframe: a.timeframe, shift: a.shift }));

  // ── 7. Build summary ───────────────────────────────────────────────────

  const summary = buildSummary(
    verdict,
    confidence,
    finalScore,
    structureScore,
    trendScore,
    pressureScore,
    sentiment,
    shifts,
    timeframeAnalyses
  );

  return {
    verdict,
    confidence,
    timeframes: timeframeAnalyses,
    dimensions: {
      structure: Math.round(structureScore),
      trend: Math.round(trendScore),
      pressure: Math.round(pressureScore),
      sentiment: Math.round(sentiment),
    },
    shifts,
    summary,
  };
}

// ─── Summary generator ───────────────────────────────────────────────────────

const VERDICT_LABELS: Record<VerdictResult["verdict"], string> = {
  strong_bullish: "Strong Bullish",
  bullish: "Bullish",
  neutral: "Neutral",
  bearish: "Bearish",
  strong_bearish: "Strong Bearish",
};

function buildSummary(
  verdict: VerdictResult["verdict"],
  confidence: number,
  finalScore: number,
  structureScore: number,
  trendScore: number,
  pressureScore: number,
  sentimentScore: number,
  shifts: { timeframe: Timeframe; shift: ShiftResult }[],
  analyses: TimeframeAnalysis[]
): string {
  const parts: string[] = [];

  // Opening line
  parts.push(
    `${VERDICT_LABELS[verdict]} verdict (${confidence}% confidence).`
  );

  // Structure commentary
  if (structureScore > 25) {
    parts.push(
      "Market structure showing higher highs and higher lows on higher timeframes."
    );
  } else if (structureScore < -25) {
    parts.push(
      "Market structure showing lower highs and lower lows on higher timeframes."
    );
  } else {
    parts.push("Market structure is ranging with no clear directional bias.");
  }

  // Pressure commentary
  const dominantPressure = pressureScore > 0 ? "Buying" : "Selling";
  const pressurePct = Math.round(50 + pressureScore / 2);
  if (Math.abs(pressureScore) > 10) {
    parts.push(`${dominantPressure} pressure dominant at ${pressurePct}%.`);
  }

  // Look for LTF divergence from verdict
  const lowerTfs: Timeframe[] = ["1m", "5m", "15m"];
  const divergentLtf = analyses.find((a) => {
    if (!lowerTfs.includes(a.timeframe)) return false;
    const isBullishLtf = a.pressure.buyPressure > 55;
    const isBearishLtf = a.pressure.buyPressure < 45;
    if (verdict.includes("bearish") && isBullishLtf) return true;
    if (verdict.includes("bullish") && isBearishLtf) return true;
    return false;
  });

  if (divergentLtf) {
    const ltfDirection =
      divergentLtf.pressure.buyPressure > 55 ? "bullish" : "bearish";
    parts.push(
      `Short-term ${ltfDirection} pressure on ${divergentLtf.timeframe} may indicate a pullback opportunity.`
    );
  }

  // Sentiment note
  if (sentimentScore > 20) {
    parts.push(`News/social sentiment is bullish (+${Math.round(sentimentScore)}).`);
  } else if (sentimentScore < -20) {
    parts.push(`News/social sentiment is bearish (${Math.round(sentimentScore)}).`);
  }

  // Shift warnings
  if (shifts.length > 0) {
    const shiftDescs = shifts
      .map((s) => `${s.timeframe}: ${s.shift.description}`)
      .join("; ");
    parts.push(`Shifts detected — ${shiftDescs}.`);
  }

  // Disclaimer
  parts.push("⚠️ Not financial advice.");

  return parts.join(" ");
}
