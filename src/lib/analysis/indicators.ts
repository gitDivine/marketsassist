// Technical indicators calculated from OHLCV data

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume: number; // volume from buy orders
  timestamp: number;
}

export function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateMFI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;

  const typicalPrices = candles.map((c) => (c.high + c.low + c.close) / 3);
  const moneyFlows = typicalPrices.map((tp, i) => tp * candles[i].volume);

  let positiveFlow = 0;
  let negativeFlow = 0;

  const start = candles.length - period;
  for (let i = start; i < candles.length; i++) {
    if (typicalPrices[i] > typicalPrices[i - 1]) {
      positiveFlow += moneyFlows[i];
    } else {
      negativeFlow += moneyFlows[i];
    }
  }

  if (negativeFlow === 0) return 100;
  const mfr = positiveFlow / negativeFlow;
  return 100 - 100 / (1 + mfr);
}

export function calculateVolumeProfile(candles: Candle[]): {
  buyVolume: number;
  sellVolume: number;
  ratio: number;
} {
  let buyVolume = 0;
  let sellVolume = 0;

  for (const c of candles) {
    buyVolume += c.takerBuyVolume;
    sellVolume += c.volume - c.takerBuyVolume;
  }

  const total = buyVolume + sellVolume;
  return {
    buyVolume,
    sellVolume,
    ratio: total > 0 ? buyVolume / total : 0.5,
  };
}

export function calculateOBV(candles: Candle[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      obv.push(obv[i - 1] + candles[i].volume);
    } else if (candles[i].close < candles[i - 1].close) {
      obv.push(obv[i - 1] - candles[i].volume);
    } else {
      obv.push(obv[i - 1]);
    }
  }
  return obv;
}

export function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// Momentum score: where is price relative to its moving averages?
// Returns -100 (strongly bearish) to +100 (strongly bullish)
export function calculateMomentumScore(candles: Candle[]): number {
  if (candles.length < 20) return 0;

  const closes = candles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  const lastClose = closes[closes.length - 1];
  const lastEma9 = ema9[ema9.length - 1];
  const lastEma21 = ema21[ema21.length - 1];

  let score = 0;

  // Price vs EMA9: +/- 25
  if (lastClose > lastEma9) score += 25;
  else if (lastClose < lastEma9) score -= 25;

  // Price vs EMA21: +/- 25
  if (lastClose > lastEma21) score += 25;
  else if (lastClose < lastEma21) score -= 25;

  // EMA9 vs EMA21 (trend direction): +/- 30
  if (lastEma9 > lastEma21) score += 30;
  else if (lastEma9 < lastEma21) score -= 30;

  // Recent price change (last 5 candles direction): +/- 20
  const recentStart = closes[closes.length - 6] || closes[0];
  const recentChange = (lastClose - recentStart) / recentStart;
  if (recentChange > 0.005) score += 20;
  else if (recentChange < -0.005) score -= 20;
  else score += Math.round(recentChange * 4000); // proportional for small changes

  return Math.max(-100, Math.min(100, score));
}
