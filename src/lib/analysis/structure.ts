import type { Candle } from "./indicators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwingPoint {
  type: "high" | "low";
  price: number;
  index: number;
  timestamp: number;
}

export interface StructureResult {
  /** Current structure classification */
  structure: "uptrend" | "downtrend" | "ranging";
  /** Most recent structure event */
  lastEvent:
    | "hh"
    | "hl"
    | "lh"
    | "ll"
    | "bos_bullish"
    | "bos_bearish"
    | "choch_bullish"
    | "choch_bearish"
    | "none";
  /** How clean / consistent the structure is (0-100) */
  strength: number;
  /** Detected swing points */
  swingPoints: SwingPoint[];
  /** Human-readable summary */
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOOKBACK = 3;
const MIN_CANDLES = 10;
const CLASSIFICATION_WINDOW = 6; // look at last N swing points

/**
 * Detect swing highs and lows using a fixed lookback on each side.
 * A swing high at index i means candle[i].high is strictly greater than the
 * highs of the `LOOKBACK` candles before AND after it. Analogous for lows.
 */
function detectSwingPoints(candles: Candle[]): SwingPoint[] {
  const points: SwingPoint[] = [];

  for (let i = LOOKBACK; i < candles.length - LOOKBACK; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= LOOKBACK; j++) {
      if (candles[i].high <= candles[i - j].high) isSwingHigh = false;
      if (candles[i].high <= candles[i + j].high) isSwingHigh = false;
      if (candles[i].low >= candles[i - j].low) isSwingLow = false;
      if (candles[i].low >= candles[i + j].low) isSwingLow = false;
    }

    if (isSwingHigh) {
      points.push({
        type: "high",
        price: candles[i].high,
        index: i,
        timestamp: candles[i].timestamp,
      });
    }

    if (isSwingLow) {
      points.push({
        type: "low",
        price: candles[i].low,
        index: i,
        timestamp: candles[i].timestamp,
      });
    }
  }

  // Sort by index (should already be, but guarantee it)
  points.sort((a, b) => a.index - b.index);
  return points;
}

type SwingLabel = "hh" | "hl" | "lh" | "ll";

/**
 * Label each swing point relative to its most recent predecessor of the same
 * type (high vs high, low vs low).
 */
function labelSwingPoints(points: SwingPoint[]): SwingLabel[] {
  const labels: SwingLabel[] = [];
  let lastHigh: number | null = null;
  let lastLow: number | null = null;

  for (const p of points) {
    if (p.type === "high") {
      if (lastHigh === null) {
        // First swing high — default to HH (neutral start)
        labels.push("hh");
      } else {
        labels.push(p.price > lastHigh ? "hh" : "lh");
      }
      lastHigh = p.price;
    } else {
      if (lastLow === null) {
        labels.push("hl");
      } else {
        labels.push(p.price > lastLow ? "hl" : "ll");
      }
      lastLow = p.price;
    }
  }

  return labels;
}

/**
 * Classify structure from the recent swing labels.
 * Returns structure type, strength (0-100), and the raw label window used.
 */
function classifyStructure(
  labels: SwingLabel[],
): { structure: "uptrend" | "downtrend" | "ranging"; strength: number; window: SwingLabel[] } {
  const window = labels.slice(-CLASSIFICATION_WINDOW);

  if (window.length < 2) {
    return { structure: "ranging", strength: 0, window };
  }

  const bullish = window.filter((l) => l === "hh" || l === "hl").length;
  const bearish = window.filter((l) => l === "lh" || l === "ll").length;
  const total = window.length;

  const bullishRatio = bullish / total;
  const bearishRatio = bearish / total;

  let structure: "uptrend" | "downtrend" | "ranging";

  if (bullishRatio >= 0.65) {
    structure = "uptrend";
  } else if (bearishRatio >= 0.65) {
    structure = "downtrend";
  } else {
    structure = "ranging";
  }

  // Strength: 100 when all labels agree, lower when mixed
  const dominantRatio = Math.max(bullishRatio, bearishRatio);
  const strength = Math.round(dominantRatio * 100);

  return { structure, strength, window };
}

type StructureEvent = StructureResult["lastEvent"];

/**
 * Detect BOS / CHoCH by comparing the latest candle close against the last
 * swing high and swing low, taking the current structure into account.
 */
function detectBreakEvents(
  candles: Candle[],
  points: SwingPoint[],
  structure: "uptrend" | "downtrend" | "ranging",
): StructureEvent {
  if (points.length < 2) return "none";

  const latestClose = candles[candles.length - 1].close;

  // Find the most recent swing high and swing low
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;

  for (let i = points.length - 1; i >= 0; i--) {
    if (!lastSwingHigh && points[i].type === "high") lastSwingHigh = points[i];
    if (!lastSwingLow && points[i].type === "low") lastSwingLow = points[i];
    if (lastSwingHigh && lastSwingLow) break;
  }

  if (!lastSwingHigh || !lastSwingLow) return "none";

  // BOS: break in the direction of the trend (continuation)
  // CHoCH: break against the trend (reversal signal)

  if (latestClose > lastSwingHigh.price) {
    // Broke above last swing high
    if (structure === "uptrend" || structure === "ranging") {
      return "bos_bullish";
    }
    // In a downtrend, breaking above swing high = character change
    return "choch_bullish";
  }

  if (latestClose < lastSwingLow.price) {
    // Broke below last swing low
    if (structure === "downtrend" || structure === "ranging") {
      return "bos_bearish";
    }
    // In an uptrend, breaking below swing low = character change
    return "choch_bearish";
  }

  return "none";
}

/**
 * If there's no BOS/CHoCH, fall back to the most recent swing label so the
 * caller still gets useful information.
 */
function fallbackEvent(labels: SwingLabel[]): StructureEvent {
  if (labels.length === 0) return "none";
  return labels[labels.length - 1];
}

// ---------------------------------------------------------------------------
// Human-readable helpers
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<StructureEvent, string> = {
  hh: "Higher High",
  hl: "Higher Low",
  lh: "Lower High",
  ll: "Lower Low",
  bos_bullish: "BOS bullish",
  bos_bearish: "BOS bearish",
  choch_bullish: "CHoCH bullish",
  choch_bearish: "CHoCH bearish",
  none: "None",
};

const STRUCTURE_LABELS: Record<StructureResult["structure"], string> = {
  uptrend: "Uptrend",
  downtrend: "Downtrend",
  ranging: "Ranging",
};

function buildDescription(
  structure: StructureResult["structure"],
  lastEvent: StructureEvent,
): string {
  const structureText = STRUCTURE_LABELS[structure];
  const eventText = EVENT_LABELS[lastEvent];

  switch (structure) {
    case "uptrend":
      return `${structureText} — making higher highs and higher lows. Last event: ${eventText}.`;
    case "downtrend":
      return `${structureText} — making lower highs and lower lows. Last event: ${eventText}.`;
    default:
      return `${structureText} — no clear directional bias. Last event: ${eventText}.`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeStructure(candles: Candle[]): StructureResult {
  // Edge case: not enough data
  if (candles.length < MIN_CANDLES) {
    return {
      structure: "ranging",
      lastEvent: "none",
      strength: 0,
      swingPoints: [],
      description: "Insufficient data — need at least 10 candles for structure analysis.",
    };
  }

  const swingPoints = detectSwingPoints(candles);

  // Not enough swing points to classify
  if (swingPoints.length < 2) {
    return {
      structure: "ranging",
      lastEvent: "none",
      strength: 0,
      swingPoints,
      description: "Ranging — too few swing points detected to classify structure.",
    };
  }

  const labels = labelSwingPoints(swingPoints);
  const { structure, strength } = classifyStructure(labels);

  // Detect BOS / CHoCH first; fall back to last swing label
  let lastEvent = detectBreakEvents(candles, swingPoints, structure);
  if (lastEvent === "none") {
    lastEvent = fallbackEvent(labels);
  }

  return {
    structure,
    lastEvent,
    strength,
    swingPoints,
    description: buildDescription(structure, lastEvent),
  };
}
