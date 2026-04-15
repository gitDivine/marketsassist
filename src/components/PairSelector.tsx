"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, TrendingUp, TrendingDown, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PairInfo, AssetClass } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

interface Props {
  selected: PairInfo | null;
  onSelect: (pair: PairInfo) => void;
  classFilter?: AssetClass;
}

export default function PairSelector({ selected, onSelect, classFilter }: Props) {
  const [allPairs, setAllPairs] = useState<PairInfo[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/pairs")
      .then((r) => r.json())
      .then((d) => {
        setAllPairs(d.pairs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter by asset class
  const pairs = useMemo(() => {
    if (!classFilter) return allPairs;
    return allPairs.filter((p) => p.class === classFilter);
  }, [allPairs, classFilter]);

  // Close on outside click (desktop only — mobile has explicit close button)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pairs.slice(0, 50);
    const q = search.toUpperCase();
    return pairs.filter((p) => p.symbol.includes(q) || p.base.includes(q)).slice(0, 50);
  }, [pairs, search]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm transition-all hover:border-accent/50 hover:bg-card-hover active:scale-[0.98]",
          open && "border-accent/50 ring-1 ring-accent/20"
        )}
      >
        {loading ? (
          <span className="skeleton h-5 w-28 rounded" />
        ) : selected ? (
          <>
            {selected.class === "indices" || selected.class === "stocks" || selected.class === "funds" || selected.class === "bonds" ? (
              <span className="font-semibold">{selected.name}</span>
            ) : (
              <>
                <span className="font-semibold">{selected.base}</span>
                <span className="text-muted">/{selected.quote}</span>
              </>
            )}
            {selected.price && (
              <span className="ml-1 hidden text-xs text-muted xs:inline">${formatPrice(selected.price)}</span>
            )}
            {selected.change24h !== undefined && (
              <span
                className={cn(
                  "ml-1 flex items-center gap-0.5 text-xs font-medium",
                  selected.change24h >= 0 ? "text-green" : "text-red"
                )}
              >
                {selected.change24h >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {selected.change24h.toFixed(2)}%
              </span>
            )}
          </>
        ) : (
          <span className="text-muted">Select pair...</span>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile: full-screen bottom sheet */}
            {/* Desktop: positioned dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "z-50 overflow-hidden border border-border bg-card shadow-2xl shadow-black/40",
                // Mobile: fixed bottom sheet
                "fixed inset-x-0 bottom-0 top-auto max-h-[85vh] rounded-t-2xl",
                // Desktop: absolute dropdown
                "sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-1.5 sm:w-96 sm:rounded-xl sm:max-h-[420px]"
              )}
            >
              {/* Header with search + close */}
              <div className="flex items-center gap-2 border-b border-border p-3">
                <div className="flex flex-1 items-center gap-2 rounded-lg bg-background px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search pairs..."
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/50 sm:text-sm"
                    inputMode="search"
                  />
                </div>
                <button
                  onClick={() => { setOpen(false); setSearch(""); }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-hover active:scale-95 sm:hidden"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search hint */}
              {!search.trim() && (
                <div className="px-3 py-1.5 text-[10px] text-accent/70 bg-accent/5 border-b border-border">
                  Not all pairs are shown — type to search 500+ assets
                </div>
              )}

              {/* Pair list */}
              <div className="overflow-y-auto overscroll-contain p-1.5" style={{ maxHeight: "calc(85vh - 60px)" }}>
                {filtered.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted">No pairs found</p>
                ) : (
                  filtered.map((pair) => (
                    <button
                      key={pair.symbol}
                      onClick={() => {
                        onSelect(pair);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex min-h-[48px] w-full items-center justify-between rounded-lg px-3 py-3 text-sm transition-all hover:bg-card-hover active:bg-card-hover active:scale-[0.98] sm:min-h-[40px] sm:py-2",
                        selected?.symbol === pair.symbol && "bg-accent/10 text-accent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {pair.class === "indices" || pair.class === "stocks" || pair.class === "funds" || pair.class === "bonds" ? (
                          <span className="font-medium">{pair.name}</span>
                        ) : (
                          <>
                            <span className="font-medium">{pair.base}</span>
                            <span className="text-xs text-muted">/{pair.quote}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {pair.price && (
                          <span className="text-xs text-muted">${formatPrice(pair.price)}</span>
                        )}
                        {pair.change24h !== undefined && (
                          <span
                            className={cn(
                              "min-w-[52px] text-right text-xs font-medium",
                              pair.change24h >= 0 ? "text-green" : "text-red"
                            )}
                          >
                            {pair.change24h >= 0 ? "+" : ""}
                            {pair.change24h.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Mobile drag hint */}
              <div className="flex justify-center pb-2 pt-1 sm:hidden">
                <div className="h-1 w-10 rounded-full bg-muted/30" />
              </div>
            </motion.div>

            {/* Backdrop on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setOpen(false); setSearch(""); }}
              className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
