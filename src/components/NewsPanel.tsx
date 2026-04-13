"use client";

import { motion } from "framer-motion";
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  news: NewsItem[];
  sentiment: { overall: number; positive: number; negative: number; neutral: number; total: number } | null;
  loading?: boolean;
}

export default function NewsPanel({ news, sentiment, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="skeleton mb-4 h-5 w-36 rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton mb-2 h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const sentimentColor = !sentiment ? "text-muted" :
    sentiment.overall > 20 ? "text-green" :
    sentiment.overall < -20 ? "text-red" : "text-yellow";

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium text-muted">News & Sentiment</h3>
        </div>
        {sentiment && (
          <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", sentimentColor,
            sentiment.overall > 20 ? "bg-green-glow" : sentiment.overall < -20 ? "bg-red-glow" : "bg-yellow/10"
          )}>
            {sentiment.overall > 20 ? <TrendingUp className="h-3 w-3" /> :
             sentiment.overall < -20 ? <TrendingDown className="h-3 w-3" /> :
             <Minus className="h-3 w-3" />}
            {sentiment.overall > 0 ? "+" : ""}{sentiment.overall}%
          </div>
        )}
      </div>

      {/* Sentiment bar */}
      {sentiment && sentiment.total > 0 && (
        <div className="mb-4 flex h-2 overflow-hidden rounded-full">
          <div className="bg-green" style={{ width: `${(sentiment.positive / sentiment.total) * 100}%` }} />
          <div className="bg-yellow/60" style={{ width: `${(sentiment.neutral / sentiment.total) * 100}%` }} />
          <div className="bg-red" style={{ width: `${(sentiment.negative / sentiment.total) * 100}%` }} />
        </div>
      )}

      {/* News list */}
      <div className="max-h-96 space-y-1.5 overflow-y-auto">
        {news.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">No news available</p>
        ) : (
          news.map((item, i) => (
            <motion.a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-start gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-card-hover"
            >
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                  item.sentiment === "positive" ? "bg-green" :
                  item.sentiment === "negative" ? "bg-red" : "bg-yellow"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {item.source} · {formatTimeAgo(item.publishedAt)}
                </p>
              </div>
              <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.a>
          ))
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
