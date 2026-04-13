export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ZoneType =
  | "fvg_bull"
  | "fvg_bear"
  | "ob_bull"
  | "ob_bear"
  | "liquidity_sweep_high"
  | "liquidity_sweep_low"
  | "support"
  | "resistance"
  | "demand"
  | "supply";

export interface KeyZone {
  type: ZoneType;
  top: number;
  bottom: number;
  startTime: number;
  endTime: number;
  strength: number; // 0-100
  timeframe?: string;
  tested: number;
  broken: boolean;
}

export interface SwingPoint {
  time: number;
  price: number;
  type: "high" | "low";
  label: "HH" | "HL" | "LH" | "LL" | "EH" | "EL";
  index: number;
}

// ─── Swing Point Detection ─────────────────────────────────────────

export function detectSwingPoints(
  candles: Candle[],
  lookback = 5
): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  const minDistance = Math.max(3, Math.floor(candles.length / 30)); // min candles between swings

  // Find swing highs and lows
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high) isSwingHigh = false;
      if (candles[i].high <= candles[i + j].high) isSwingHigh = false;
      if (candles[i].low >= candles[i - j].low) isSwingLow = false;
      if (candles[i].low >= candles[i + j].low) isSwingLow = false;
    }

    if (isSwingHigh) {
      // Check minimum distance from last swing high
      const lastHigh = swings.filter(s => s.type === "high").at(-1);
      if (!lastHigh || i - lastHigh.index >= minDistance) {
        swings.push({
          time: candles[i].time,
          price: candles[i].high,
          type: "high",
          label: "HH",
          index: i,
        });
      }
    }
    if (isSwingLow) {
      const lastLow = swings.filter(s => s.type === "low").at(-1);
      if (!lastLow || i - lastLow.index >= minDistance) {
        swings.push({
          time: candles[i].time,
          price: candles[i].low,
          type: "low",
          label: "HL",
          index: i,
        });
      }
    }
  }

  // Label swing points relative to previous same-type swing
  const threshold = 0.001; // 0.1% tolerance for equal highs/lows
  let prevHigh: SwingPoint | null = null;
  let prevLow: SwingPoint | null = null;

  for (const swing of swings) {
    if (swing.type === "high") {
      if (prevHigh) {
        const diff = (swing.price - prevHigh.price) / prevHigh.price;
        if (Math.abs(diff) < threshold) swing.label = "EH";
        else if (diff > 0) swing.label = "HH";
        else swing.label = "LH";
      }
      prevHigh = swing;
    } else {
      if (prevLow) {
        const diff = (swing.price - prevLow.price) / prevLow.price;
        if (Math.abs(diff) < threshold) swing.label = "EL";
        else if (diff > 0) swing.label = "HL";
        else swing.label = "LL";
      }
      prevLow = swing;
    }
  }

  return swings;
}

// ─── Fair Value Gaps ────────────────────────────────────────────────

export function detectFVGs(candles: Candle[]): KeyZone[] {
  const zones: KeyZone[] = [];
  if (candles.length < 3) return zones;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    // Bullish FVG: candle 1 high < candle 3 low (gap up)
    if (c1.high < c3.low) {
      const gapSize = c3.low - c1.high;
      const avgBody = Math.abs(c2.close - c2.open);
      if (gapSize > avgBody * 0.3) {
        zones.push({
          type: "fvg_bull",
          top: c3.low,
          bottom: c1.high,
          startTime: c2.time,
          endTime: candles[candles.length - 1].time,
          strength: Math.min(80, 40 + (gapSize / c2.close) * 5000),
          tested: 0,
          broken: false,
        });
      }
    }

    // Bearish FVG: candle 1 low > candle 3 high (gap down)
    if (c1.low > c3.high) {
      const gapSize = c1.low - c3.high;
      const avgBody = Math.abs(c2.close - c2.open);
      if (gapSize > avgBody * 0.3) {
        zones.push({
          type: "fvg_bear",
          top: c1.low,
          bottom: c3.high,
          startTime: c2.time,
          endTime: candles[candles.length - 1].time,
          strength: Math.min(80, 40 + (gapSize / c2.close) * 5000),
          tested: 0,
          broken: false,
        });
      }
    }
  }

  return zones;
}

// ─── Order Blocks ───────────────────────────────────────────────────

export function detectOrderBlocks(candles: Candle[]): KeyZone[] {
  const zones: KeyZone[] = [];
  if (candles.length < 5) return zones;

  // Calculate average body size
  let totalBody = 0;
  for (const c of candles) totalBody += Math.abs(c.close - c.open);
  const avgBody = totalBody / candles.length;
  const impulseThreshold = avgBody * 1.5;

  for (let i = 1; i < candles.length - 1; i++) {
    const curr = candles[i];
    const next = candles[i + 1];

    const nextBody = Math.abs(next.close - next.open);

    // Bullish OB: bearish candle followed by strong bullish impulse
    if (
      curr.close < curr.open && // current is bearish
      next.close > next.open && // next is bullish
      nextBody > impulseThreshold && // strong impulse
      next.close > curr.high // closes above the bearish candle
    ) {
      zones.push({
        type: "ob_bull",
        top: curr.open,
        bottom: curr.low,
        startTime: curr.time,
        endTime: candles[candles.length - 1].time,
        strength: Math.min(90, 50 + (nextBody / avgBody) * 10),
        tested: 0,
        broken: false,
      });
    }

    // Bearish OB: bullish candle followed by strong bearish impulse
    if (
      curr.close > curr.open && // current is bullish
      next.close < next.open && // next is bearish
      nextBody > impulseThreshold && // strong impulse
      next.close < curr.low // closes below the bullish candle
    ) {
      zones.push({
        type: "ob_bear",
        top: curr.high,
        bottom: curr.close,
        startTime: curr.time,
        endTime: candles[candles.length - 1].time,
        strength: Math.min(90, 50 + (nextBody / avgBody) * 10),
        tested: 0,
        broken: false,
      });
    }
  }

  return zones;
}

// ─── Liquidity Sweeps ───────────────────────────────────────────────

export function detectLiquiditySweeps(
  candles: Candle[],
  swings: SwingPoint[]
): KeyZone[] {
  const zones: KeyZone[] = [];

  for (const swing of swings) {
    // Find candles after this swing point that wick past it then close back
    for (let i = swing.index + 3; i < candles.length; i++) {
      const c = candles[i];

      if (swing.type === "high") {
        // Price wicks above swing high but closes below it
        if (c.high > swing.price && c.close < swing.price) {
          zones.push({
            type: "liquidity_sweep_high",
            top: c.high,
            bottom: swing.price,
            startTime: c.time,
            endTime: candles[candles.length - 1].time,
            strength: 65,
            tested: 0,
            broken: false,
          });
          break; // only first sweep per swing
        }
      } else {
        // Price wicks below swing low but closes above it
        if (c.low < swing.price && c.close > swing.price) {
          zones.push({
            type: "liquidity_sweep_low",
            top: swing.price,
            bottom: c.low,
            startTime: c.time,
            endTime: candles[candles.length - 1].time,
            strength: 65,
            tested: 0,
            broken: false,
          });
          break;
        }
      }
    }
  }

  return zones;
}

// ─── Support / Resistance ───────────────────────────────────────────

export function detectSupportResistance(
  candles: Candle[],
  swings: SwingPoint[]
): KeyZone[] {
  if (swings.length < 2) return [];

  const zones: KeyZone[] = [];
  const priceRange =
    Math.max(...candles.map((c) => c.high)) -
    Math.min(...candles.map((c) => c.low));
  const clusterThreshold = priceRange * 0.015; // 1.5% of range

  // Group nearby swing highs for resistance
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  const clustered = new Set<number>();

  for (let i = 0; i < highs.length; i++) {
    if (clustered.has(i)) continue;
    const cluster = [highs[i]];
    for (let j = i + 1; j < highs.length; j++) {
      if (clustered.has(j)) continue;
      if (Math.abs(highs[j].price - highs[i].price) < clusterThreshold) {
        cluster.push(highs[j]);
        clustered.add(j);
      }
    }
    if (cluster.length >= 2) {
      const avg = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;
      zones.push({
        type: "resistance",
        top: avg + clusterThreshold * 0.3,
        bottom: avg - clusterThreshold * 0.3,
        startTime: Math.min(...cluster.map((c) => c.time)),
        endTime: candles[candles.length - 1].time,
        strength: Math.min(95, 40 + cluster.length * 15),
        tested: cluster.length,
        broken: false,
      });
    }
  }

  clustered.clear();

  for (let i = 0; i < lows.length; i++) {
    if (clustered.has(i)) continue;
    const cluster = [lows[i]];
    for (let j = i + 1; j < lows.length; j++) {
      if (clustered.has(j)) continue;
      if (Math.abs(lows[j].price - lows[i].price) < clusterThreshold) {
        cluster.push(lows[j]);
        clustered.add(j);
      }
    }
    if (cluster.length >= 2) {
      const avg = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;
      zones.push({
        type: "support",
        top: avg + clusterThreshold * 0.3,
        bottom: avg - clusterThreshold * 0.3,
        startTime: Math.min(...cluster.map((c) => c.time)),
        endTime: candles[candles.length - 1].time,
        strength: Math.min(95, 40 + cluster.length * 15),
        tested: cluster.length,
        broken: false,
      });
    }
  }

  return zones;
}

// ─── Demand / Supply Zones ──────────────────────────────────────────

export function detectDemandSupply(candles: Candle[]): KeyZone[] {
  const zones: KeyZone[] = [];
  if (candles.length < 5) return zones;

  let totalBody = 0;
  for (const c of candles) totalBody += Math.abs(c.close - c.open);
  const avgBody = totalBody / candles.length;
  const impulseThreshold = avgBody * 2;

  for (let i = 3; i < candles.length; i++) {
    const curr = candles[i];
    const currBody = Math.abs(curr.close - curr.open);

    if (currBody <= impulseThreshold) continue;

    // Look back 2-3 candles for the consolidation zone
    const baseStart = Math.max(0, i - 3);
    const baseCandless = candles.slice(baseStart, i);

    // Check if base candles were consolidating (small bodies)
    const avgBaseBody =
      baseCandless.reduce((s, c) => s + Math.abs(c.close - c.open), 0) /
      baseCandless.length;
    if (avgBaseBody > avgBody * 1.2) continue; // not consolidation

    const baseHigh = Math.max(...baseCandless.map((c) => c.high));
    const baseLow = Math.min(...baseCandless.map((c) => c.low));

    // Bullish demand: consolidation then strong up move
    if (curr.close > curr.open && curr.close > baseHigh) {
      zones.push({
        type: "demand",
        top: baseHigh,
        bottom: baseLow,
        startTime: candles[baseStart].time,
        endTime: candles[candles.length - 1].time,
        strength: Math.min(90, 55 + (currBody / avgBody) * 8),
        tested: 0,
        broken: false,
      });
    }

    // Bearish supply: consolidation then strong down move
    if (curr.close < curr.open && curr.close < baseLow) {
      zones.push({
        type: "supply",
        top: baseHigh,
        bottom: baseLow,
        startTime: candles[baseStart].time,
        endTime: candles[candles.length - 1].time,
        strength: Math.min(90, 55 + (currBody / avgBody) * 8),
        tested: 0,
        broken: false,
      });
    }
  }

  return zones;
}

// ─── Zone Testing & Validation ──────────────────────────────────────

function evaluateZones(zones: KeyZone[], candles: Candle[]): KeyZone[] {
  for (const zone of zones) {
    let tested = 0;
    let broken = false;

    for (const c of candles) {
      if (c.time <= zone.startTime) continue;

      // Test: price touches zone but doesn't close through
      const touchesZone =
        (c.low <= zone.top && c.low >= zone.bottom) ||
        (c.high >= zone.bottom && c.high <= zone.top);

      if (touchesZone) {
        // Broken if price closes through the zone
        if (
          zone.type.includes("bull") ||
          zone.type === "support" ||
          zone.type === "demand"
        ) {
          if (c.close < zone.bottom) {
            broken = true;
            break;
          }
          tested++;
        } else {
          if (c.close > zone.top) {
            broken = true;
            break;
          }
          tested++;
        }
      }
    }

    zone.tested = tested;
    zone.broken = broken;
    // More tests = stronger (up to a point, then it's likely to break)
    if (tested > 0 && tested <= 3) {
      zone.strength = Math.min(100, zone.strength + tested * 5);
    } else if (tested > 3) {
      zone.strength = Math.max(30, zone.strength - (tested - 3) * 5);
    }
  }

  return zones;
}

// ─── Main Detector ──────────────────────────────────────────────────

export function detectAllKeyZones(candles: Candle[]): {
  zones: KeyZone[];
  swings: SwingPoint[];
} {
  if (candles.length < 10) return { zones: [], swings: [] };

  const swings = detectSwingPoints(candles, 3);
  const fvgs = detectFVGs(candles);
  const obs = detectOrderBlocks(candles);
  const sweeps = detectLiquiditySweeps(candles, swings);
  const sr = detectSupportResistance(candles, swings);
  const ds = detectDemandSupply(candles);

  let allZones = [...fvgs, ...obs, ...sweeps, ...sr, ...ds];

  // Evaluate: count tests, mark broken
  allZones = evaluateZones(allZones, candles);

  // Remove broken zones
  allZones = allZones.filter((z) => !z.broken);

  // Remove overlapping zones of same type (keep stronger)
  allZones = deduplicateZones(allZones);

  // Sort by strength, keep top 20
  allZones.sort((a, b) => b.strength - a.strength);
  allZones = allZones.slice(0, 20);

  return { zones: allZones, swings };
}

function deduplicateZones(zones: KeyZone[]): KeyZone[] {
  const result: KeyZone[] = [];
  const sorted = [...zones].sort((a, b) => b.strength - a.strength);

  for (const zone of sorted) {
    const overlaps = result.some(
      (existing) =>
        existing.type === zone.type &&
        zone.bottom < existing.top &&
        zone.top > existing.bottom
    );
    if (!overlaps) result.push(zone);
  }

  return result;
}

export function filterActiveZones(
  zones: KeyZone[],
  currentPrice: number
): KeyZone[] {
  const range = currentPrice * 0.15; // 15% range from current price
  return zones.filter(
    (z) =>
      !z.broken &&
      z.top >= currentPrice - range &&
      z.bottom <= currentPrice + range
  );
}
