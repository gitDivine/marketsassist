"use client";

import { memo } from "react";
import { ExternalLink } from "lucide-react";
import type { PairInfo } from "@/lib/types";

interface Props {
  pair: PairInfo;
}

// Build a clean pair symbol for external links
export function getExternalSymbol(pair: PairInfo): string {
  switch (pair.class) {
    case "crypto": {
      const base = pair.base.toUpperCase();
      return `${base}USD`;
    }
    case "forex": {
      const sym = pair.symbol.replace("=X", "");
      if (pair.base === "XAU") return "XAUUSD";
      if (pair.base === "XAG") return "XAGUSD";
      if (pair.base === "XPT") return "XPTUSD";
      if (pair.base === "OIL") return "USOIL";
      if (pair.base === "BRENT") return "UKOIL";
      return sym;
    }
    case "stocks":
      return pair.symbol.replace("^", "");
    case "indices": {
      const map: Record<string, string> = {
        "^GSPC": "SPX500",
        "^DJI": "DJI",
        "^IXIC": "NASDAQ",
        "^RUT": "RUSSELL2000",
        "^FTSE": "FTSE100",
        "^GDAXI": "DAX",
        "^FCHI": "CAC40",
        "^N225": "NIKKEI225",
        "^HSI": "HSI",
        "^STOXX50E": "STOXX50",
      };
      return map[pair.symbol] || pair.base;
    }
    default:
      return pair.base;
  }
}

function getTradingViewSymbol(pair: PairInfo): string {
  switch (pair.class) {
    case "crypto":
      return `${pair.base.toUpperCase()}USD`;
    case "forex": {
      const sym = pair.symbol.replace("=X", "");
      if (pair.base === "XAU") return "XAUUSD";
      if (pair.base === "XAG") return "XAGUSD";
      return sym;
    }
    default:
      return getExternalSymbol(pair);
  }
}

function TradeIdeas({ pair }: Props) {
  const sym = getExternalSymbol(pair);
  const tvSym = getTradingViewSymbol(pair);

  const ideasLinks = [
    {
      name: "TradingView Ideas",
      icon: "📊",
      color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/50",
      textColor: "text-blue-400",
      url: `https://www.tradingview.com/symbols/${tvSym}/ideas/`,
    },
    {
      name: "Twitter / X",
      icon: "𝕏",
      color: "from-zinc-500/20 to-zinc-600/10 border-zinc-500/30 hover:border-zinc-400/50",
      textColor: "text-zinc-300",
      url: `https://twitter.com/search?q=${encodeURIComponent(sym)}&f=live`,
    },
    {
      name: "YouTube",
      icon: "▶",
      color: "from-red-500/20 to-red-600/10 border-red-500/30 hover:border-red-400/50",
      textColor: "text-red-400",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(sym)}`,
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Ideas & Community */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-foreground">Ideas & Community</h3>
        <p className="mb-3 text-[10px] text-muted sm:text-[11px]">
          Click to explore trade ideas and community sentiment
        </p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {ideasLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex flex-col items-center gap-1.5 rounded-xl border bg-gradient-to-b p-3 transition-all active:scale-95 sm:p-4 ${link.color}`}
            >
              <span className="text-xl sm:text-2xl">{link.icon}</span>
              <span className={`text-center text-[10px] font-medium leading-tight sm:text-xs ${link.textColor}`}>
                {link.name}
              </span>
              <ExternalLink className="h-3 w-3 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          ))}
        </div>
      </div>

      {/* Economic Calendar */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-foreground">Economic Calendar</h3>
        <p className="mb-3 text-[10px] text-muted sm:text-[11px]">
          Click to see upcoming news events for this pair
        </p>
        <a
          href={`https://www.forexfactory.com/market/${sym.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 to-amber-600/5 p-3 transition-all hover:border-amber-400/50 active:scale-[0.98] sm:p-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl">📅</span>
            <div>
              <span className="text-xs font-medium text-amber-400 sm:text-sm">
                ForexFactory Calendar
              </span>
              <p className="text-[10px] text-muted">{sym} events & news impact</p>
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted opacity-50 transition-opacity group-hover:opacity-100" />
        </a>
      </div>
    </div>
  );
}

export default memo(TradeIdeas);
