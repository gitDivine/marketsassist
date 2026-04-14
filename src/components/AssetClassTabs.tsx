"use client";

import { BarChart3, DollarSign, TrendingUp, Layers, PieChart, Landmark } from "lucide-react";
import type { AssetClass } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  selected: AssetClass | "all";
  onSelect: (cls: AssetClass | "all") => void;
}

const TABS: { value: AssetClass | "all"; label: string; icon: typeof BarChart3 }[] = [
  { value: "all", label: "All", icon: Layers },
  { value: "crypto", label: "Crypto", icon: BarChart3 },
  { value: "forex", label: "Forex", icon: DollarSign },
  { value: "stocks", label: "Stocks", icon: TrendingUp },
  { value: "indices", label: "Indices", icon: BarChart3 },
  { value: "funds", label: "Funds", icon: PieChart },
  { value: "bonds", label: "Bonds", icon: Landmark },
];

export default function AssetClassTabs({ selected, onSelect }: Props) {
  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-auto">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            onClick={() => onSelect(tab.value)}
            className={cn(
              "flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 sm:min-h-[32px]",
              selected === tab.value
                ? "bg-accent text-white shadow-md shadow-accent/25"
                : "text-muted hover:text-foreground hover:bg-card-hover"
            )}
          >
            <Icon className="h-3 w-3" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
