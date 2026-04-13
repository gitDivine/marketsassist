"use client";

import { motion } from "framer-motion";
import { FileText, AlertCircle, TrendingUp, Newspaper, Layers } from "lucide-react";
import type { ConfluenceResult, PressureData, NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  pair: string;
  pressure: PressureData | null;
  confluence: ConfluenceResult | null;
  newsSentiment: number;
  loading?: boolean;
}

interface Note {
  type: "technical" | "sentiment" | "news" | "confluence";
  content: string;
  importance: "high" | "medium" | "low";
}

function generateNotes(
  pair: string,
  pressure: PressureData | null,
  confluence: ConfluenceResult | null,
  newsSentiment: number
): Note[] {
  const notes: Note[] = [];
  if (!pressure || !confluence) return notes;

  const base = pair.replace("USDT", "").replace("/USDT", "");

  // Technical notes
  if (pressure.rsi > 70) {
    notes.push({
      type: "technical",
      content: `${base} RSI at ${pressure.rsi.toFixed(1)} — overbought territory. Potential pullback.`,
      importance: "high",
    });
  } else if (pressure.rsi < 30) {
    notes.push({
      type: "technical",
      content: `${base} RSI at ${pressure.rsi.toFixed(1)} — oversold territory. Potential bounce.`,
      importance: "high",
    });
  }

  if (pressure.mfi > 80) {
    notes.push({
      type: "technical",
      content: `Money Flow Index at ${pressure.mfi.toFixed(1)} — heavy money inflow, but may indicate exhaustion.`,
      importance: "medium",
    });
  } else if (pressure.mfi < 20) {
    notes.push({
      type: "technical",
      content: `Money Flow Index at ${pressure.mfi.toFixed(1)} — money flowing out heavily. Capitulation possible.`,
      importance: "medium",
    });
  }

  if (Math.abs(pressure.orderBookImbalance) > 0.3) {
    const side = pressure.orderBookImbalance > 0 ? "bids" : "asks";
    notes.push({
      type: "technical",
      content: `Order book heavily skewed toward ${side} (${(Math.abs(pressure.orderBookImbalance) * 100).toFixed(0)}% imbalance).`,
      importance: "medium",
    });
  }

  // Volume note
  if (pressure.buyVolume > pressure.sellVolume * 1.5) {
    notes.push({
      type: "technical",
      content: `Buy volume is ${(pressure.buyVolume / pressure.sellVolume).toFixed(1)}x sell volume — aggressive buying.`,
      importance: "high",
    });
  } else if (pressure.sellVolume > pressure.buyVolume * 1.5) {
    notes.push({
      type: "technical",
      content: `Sell volume is ${(pressure.sellVolume / pressure.buyVolume).toFixed(1)}x buy volume — aggressive selling.`,
      importance: "high",
    });
  }

  // Confluence notes
  if (confluence.confidence > 70) {
    notes.push({
      type: "confluence",
      content: `High confluence (${confluence.confidence}%) — ${confluence.overallTrend.replace("_", " ")} across most timeframes.`,
      importance: "high",
    });
  } else if (confluence.confidence < 30) {
    notes.push({
      type: "confluence",
      content: `Low confluence (${confluence.confidence}%) — mixed signals, market likely consolidating.`,
      importance: "medium",
    });
  }

  // Divergence notes from confluence summary
  if (confluence.summary.includes("surging") || confluence.summary.includes("Divergence")) {
    notes.push({
      type: "confluence",
      content: "Timeframe divergence detected — lower timeframes opposing higher timeframe trend.",
      importance: "high",
    });
  }

  // News sentiment
  if (newsSentiment > 30) {
    notes.push({
      type: "news",
      content: `News sentiment is strongly positive (+${newsSentiment}%) — bullish bias from media coverage.`,
      importance: "medium",
    });
  } else if (newsSentiment < -30) {
    notes.push({
      type: "news",
      content: `News sentiment is strongly negative (${newsSentiment}%) — bearish bias from media coverage.`,
      importance: "medium",
    });
  }

  // Always add disclaimer
  notes.push({
    type: "sentiment",
    content: "This is algorithmic analysis based on publicly available data. Not financial advice — always DYOR.",
    importance: "low",
  });

  return notes;
}

const NOTE_ICONS = {
  technical: TrendingUp,
  sentiment: AlertCircle,
  news: Newspaper,
  confluence: Layers,
};

const IMPORTANCE_COLORS = {
  high: "border-accent/30 bg-accent-glow",
  medium: "border-border bg-card-hover",
  low: "border-border/50 bg-background/30",
};

export default function AnalysisNotes({ pair, pressure, confluence, newsSentiment, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="skeleton mb-4 h-5 w-40 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton mb-2 h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const notes = generateNotes(pair, pressure, confluence, newsSentiment);

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium text-muted">Auto Analysis Notes</h3>
      </div>

      <div className="space-y-2">
        {notes.map((note, i) => {
          const Icon = NOTE_ICONS[note.type];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn("flex items-start gap-2.5 rounded-xl border p-3", IMPORTANCE_COLORS[note.importance])}
            >
              <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0",
                note.importance === "high" ? "text-accent" : "text-muted"
              )} />
              <p className="text-xs leading-relaxed">{note.content}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
