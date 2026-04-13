"use client";

import { motion } from "framer-motion";
import { Layers, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { ConfluenceResult, Timeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  data: ConfluenceResult | null;
  loading?: boolean;
}

const TREND_CONFIG = {
  strong_bullish: { label: "Strong Bullish", color: "text-green", bg: "bg-green", icon: TrendingUp },
  bullish: { label: "Bullish", color: "text-green", bg: "bg-green/70", icon: TrendingUp },
  neutral: { label: "Neutral", color: "text-yellow", bg: "bg-yellow/70", icon: Minus },
  bearish: { label: "Bearish", color: "text-red", bg: "bg-red/70", icon: TrendingDown },
  strong_bearish: { label: "Strong Bearish", color: "text-red", bg: "bg-red", icon: TrendingDown },
};

const TF_LABELS: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
  "1w": "1W",
};

export default function ConfluencePanel({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="skeleton mb-4 h-5 w-48 rounded" />
        <div className="skeleton mb-4 h-20 w-full rounded-xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="skeleton h-16 flex-1 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const trendCfg = TREND_CONFIG[data.overallTrend];
  const TrendIcon = trendCfg.icon;
  const hasDivergence = data.summary.includes("Divergence") || data.summary.includes("surging") || data.summary.includes("shifting");

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium text-muted">Multi-Timeframe Confluence</h3>
      </div>

      {/* Overall Trend Card */}
      <div className={cn(
        "mb-5 rounded-xl border p-4",
        data.overallTrend.includes("bullish") ? "border-green/20 bg-green-glow" :
        data.overallTrend.includes("bearish") ? "border-red/20 bg-red-glow" :
        "border-yellow/20 bg-yellow/5"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TrendIcon className={cn("h-5 w-5", trendCfg.color)} />
            <div>
              <p className={cn("text-lg font-bold", trendCfg.color)}>{trendCfg.label}</p>
              <p className="text-xs text-muted">Overall Confluence</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{data.confidence}%</p>
            <p className="text-xs text-muted">Confidence</p>
          </div>
        </div>
      </div>

      {/* Divergence Alert */}
      {hasDivergence && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-yellow/30 bg-yellow/5 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow" />
          <p className="text-xs leading-relaxed text-yellow/90">
            {data.summary.split("\n\n").find((s) => s.includes("Divergence") || s.includes("surging") || s.includes("shifting")) || ""}
          </p>
        </motion.div>
      )}

      {/* Timeframe Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {data.timeframes.map((tf, i) => {
          const bp = tf.pressure.buyPressure;
          return (
            <motion.div
              key={tf.timeframe}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center",
                tf.trend === "bullish" ? "border-green/20 bg-green-glow" :
                tf.trend === "bearish" ? "border-red/20 bg-red-glow" :
                "border-border bg-card-hover"
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {TF_LABELS[tf.timeframe]}
              </span>
              {/* Mini bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-red/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${bp}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="h-full rounded-full bg-green"
                />
              </div>
              <span className={cn(
                "text-xs font-bold",
                tf.trend === "bullish" ? "text-green" : tf.trend === "bearish" ? "text-red" : "text-yellow"
              )}>
                {bp}%
              </span>
              <span className="text-[9px] text-muted">w: {tf.weight}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-5 rounded-xl bg-background/50 p-3.5">
        <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
          {data.summary}
        </p>
      </div>
    </div>
  );
}
