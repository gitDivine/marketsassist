"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PressureData } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

interface Props {
  data: PressureData | null;
  loading?: boolean;
}

export default function PressureGauge({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="skeleton mb-4 h-5 w-32 rounded" />
        <div className="skeleton mb-6 h-10 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const trendConfig = {
    bullish: { icon: TrendingUp, color: "text-green", bg: "bg-green-glow", label: "Bullish" },
    bearish: { icon: TrendingDown, color: "text-red", bg: "bg-red-glow", label: "Bearish" },
    neutral: { icon: Minus, color: "text-yellow", bg: "bg-yellow/10", label: "Neutral" },
  };
  const trend = trendConfig[data.trend];
  const TrendIcon = trend.icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted">Buy / Sell Pressure</h3>
        <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", trend.bg, trend.color)}>
          <TrendIcon className="h-3 w-3" />
          {trend.label} · {data.strength}%
        </div>
      </div>

      {/* Main Pressure Bar */}
      <div className="mb-2 flex items-center justify-between text-xs font-medium">
        <span className="text-green">Buyers {data.buyPressure}%</span>
        <span className="text-red">Sellers {data.sellPressure}%</span>
      </div>
      <div className="relative mb-6 h-10 overflow-hidden rounded-full bg-red/20">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${data.buyPressure}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green/80 to-green"
        />
        {/* Center marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
        {/* Percentage label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-background/60 px-2 py-0.5 text-xs font-bold backdrop-blur-sm">
            {data.buyPressure > data.sellPressure ? "+" : ""}{data.buyPressure - data.sellPressure}%
          </span>
        </div>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <IndicatorCard label="RSI" value={data.rsi.toFixed(1)} signal={data.rsi > 60 ? "buy" : data.rsi < 40 ? "sell" : "neutral"} />
        <IndicatorCard label="MFI" value={data.mfi.toFixed(1)} signal={data.mfi > 60 ? "buy" : data.mfi < 40 ? "sell" : "neutral"} />
        <IndicatorCard
          label="Buy Vol"
          value={formatNumber(data.buyVolume)}
          signal={data.buyVolume > data.sellVolume ? "buy" : "sell"}
        />
        <IndicatorCard
          label="Sell Vol"
          value={formatNumber(data.sellVolume)}
          signal={data.sellVolume > data.buyVolume ? "sell" : "buy"}
        />
      </div>
    </div>
  );
}

function IndicatorCard({ label, value, signal }: { label: string; value: string; signal: "buy" | "sell" | "neutral" }) {
  const colors = {
    buy: "border-green/20 bg-green-glow",
    sell: "border-red/20 bg-red-glow",
    neutral: "border-border bg-card-hover",
  };
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", colors[signal])}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
