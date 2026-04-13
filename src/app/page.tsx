"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import PairSelector from "@/components/PairSelector";
import TimeframeSelector from "@/components/TimeframeSelector";
import PressureGauge from "@/components/PressureGauge";
import ConfluencePanel from "@/components/ConfluencePanel";
import NewsPanel from "@/components/NewsPanel";
import AnalysisNotes from "@/components/AnalysisNotes";
import type { PairInfo, Timeframe, PressureData, ConfluenceResult, NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Home() {
  const [selectedPair, setSelectedPair] = useState<PairInfo | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [pressure, setPressure] = useState<PressureData | null>(null);
  const [confluence, setConfluence] = useState<ConfluenceResult | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsSentiment, setNewsSentiment] = useState<{
    overall: number;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState({ pressure: false, confluence: false, news: false });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPressure = useCallback(async (symbol: string, tf: Timeframe) => {
    setLoading((l) => ({ ...l, pressure: true }));
    try {
      const res = await fetch(`/api/pressure?symbol=${symbol}&timeframe=${tf}`);
      const data = await res.json();
      if (data.pressure) setPressure(data.pressure);
    } catch { /* ignore */ }
    setLoading((l) => ({ ...l, pressure: false }));
  }, []);

  const fetchConfluence = useCallback(async (symbol: string) => {
    setLoading((l) => ({ ...l, confluence: true }));
    try {
      const res = await fetch(`/api/confluence?symbol=${symbol}`);
      const data = await res.json();
      if (data.confluence) setConfluence(data.confluence);
    } catch { /* ignore */ }
    setLoading((l) => ({ ...l, confluence: false }));
  }, []);

  const fetchNews = useCallback(async (base: string) => {
    setLoading((l) => ({ ...l, news: true }));
    try {
      const res = await fetch(`/api/news?asset=${base}&query=${base} crypto`);
      const data = await res.json();
      setNews(data.news || []);
      setNewsSentiment(data.sentiment || null);
    } catch { /* ignore */ }
    setLoading((l) => ({ ...l, news: false }));
  }, []);

  const fetchAll = useCallback(() => {
    if (!selectedPair) return;
    fetchPressure(selectedPair.symbol, timeframe);
    fetchConfluence(selectedPair.symbol);
    fetchNews(selectedPair.base);
    setLastUpdate(new Date());
  }, [selectedPair, timeframe, fetchPressure, fetchConfluence, fetchNews]);

  // Fetch when pair or timeframe changes
  useEffect(() => {
    if (!selectedPair) return;
    fetchPressure(selectedPair.symbol, timeframe);
  }, [selectedPair, timeframe, fetchPressure]);

  useEffect(() => {
    if (!selectedPair) return;
    fetchConfluence(selectedPair.symbol);
    fetchNews(selectedPair.base);
    setLastUpdate(new Date());
  }, [selectedPair, fetchConfluence, fetchNews]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!selectedPair) return;
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [selectedPair, fetchAll]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <PairSelector selected={selectedPair} onSelect={setSelectedPair} />
          <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />

          <button
            onClick={fetchAll}
            disabled={!selectedPair}
            className={cn(
              "ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs transition-all hover:border-accent/50 hover:bg-card-hover disabled:opacity-40",
              (loading.pressure || loading.confluence) && "animate-pulse"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (loading.pressure || loading.confluence) && "animate-spin")} />
            Refresh
          </button>

          {lastUpdate && (
            <span className="text-[10px] text-muted">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>

        {!selectedPair ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
              <RefreshCw className="h-7 w-7 text-accent" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Select a pair to begin</h2>
            <p className="max-w-sm text-sm text-muted">
              Choose a crypto pair to see real-time buying vs selling pressure with multi-timeframe confluence analysis.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid gap-5 lg:grid-cols-3"
          >
            {/* Left: Pressure + Confluence */}
            <div className="space-y-5 lg:col-span-2">
              <PressureGauge data={pressure} loading={loading.pressure} />
              <ConfluencePanel data={confluence} loading={loading.confluence} />
              <AnalysisNotes
                pair={selectedPair.symbol}
                pressure={pressure}
                confluence={confluence}
                newsSentiment={newsSentiment?.overall || 0}
                loading={loading.pressure || loading.confluence}
              />
            </div>

            {/* Right: News */}
            <div>
              <div className="sticky top-20">
                <NewsPanel news={news} sentiment={newsSentiment} loading={loading.news} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <div className="mt-10 rounded-xl border border-yellow/20 bg-yellow/5 p-4 text-center">
          <p className="text-xs text-yellow/80">
            This tool provides algorithmic analysis for educational purposes only. Not financial advice.
            Always do your own research before making trading decisions. Past performance does not guarantee future results.
          </p>
        </div>
      </main>
    </div>
  );
}
