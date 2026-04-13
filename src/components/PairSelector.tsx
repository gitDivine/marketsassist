"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import type { PairInfo } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

interface Props {
  selected: PairInfo | null;
  onSelect: (pair: PairInfo) => void;
}

export default function PairSelector({ selected, onSelect }: Props) {
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/pairs")
      .then((r) => r.json())
      .then((d) => {
        setPairs(d.pairs || []);
        if (!selected && d.pairs?.length) onSelect(d.pairs[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
          "flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm transition-all hover:border-accent/50 hover:bg-card-hover",
          open && "border-accent/50 ring-1 ring-accent/20"
        )}
      >
        {loading ? (
          <span className="skeleton h-5 w-28 rounded" />
        ) : selected ? (
          <>
            <span className="font-semibold">{selected.base}</span>
            <span className="text-muted">/{selected.quote}</span>
            {selected.price && (
              <span className="ml-1 text-xs text-muted">${formatPrice(selected.price)}</span>
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

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40">
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pairs..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/50"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">No pairs found</p>
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
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-card-hover",
                    selected?.symbol === pair.symbol && "bg-accent/10 text-accent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pair.base}</span>
                    <span className="text-xs text-muted">/{pair.quote}</span>
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
        </div>
      )}
    </div>
  );
}
