"use client";

import { Activity } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <Activity className="h-4.5 w-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Market Pressure</h1>
            <p className="text-[10px] text-muted">Buy vs Sell — Multi-TF Confluence</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="hidden sm:inline">Real-time analysis</span>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green glow-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
