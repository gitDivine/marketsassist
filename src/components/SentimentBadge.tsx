"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  sentiment: number | null; // -100 to +100
  loading?: boolean;
}

function SentimentBadge({ symbol, sentiment, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <div className="skeleton h-4 w-32 rounded" />
      </div>
    );
  }

  if (sentiment === null) return null;

  // Convert -100..+100 to percentage (0-100%)
  const pct = Math.round(Math.max(0, Math.min(100, (sentiment + 100) / 2)));
  const isBullish = sentiment > 10;
  const isBearish = sentiment < -10;
  const label = isBullish ? "Bullish" : isBearish ? "Bearish" : "Neutral";
  const dot = isBullish ? "🟢" : isBearish ? "🔴" : "🟡";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium sm:text-sm",
        isBullish && "border-green/30 bg-green/5 text-green",
        isBearish && "border-red/30 bg-red/5 text-red",
        !isBullish && !isBearish && "border-yellow/30 bg-yellow/5 text-yellow"
      )}
    >
      <span>{dot}</span>
      <span className="hidden sm:inline">{symbol} Sentiment:</span>
      <span className="sm:hidden">Sentiment:</span>
      <span className="font-semibold tabular-nums">
        {pct}% {label}
      </span>
    </div>
  );
}

export default memo(SentimentBadge);
