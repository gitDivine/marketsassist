"use client";

import { useEffect, useRef, memo } from "react";
import type { PairInfo, Timeframe } from "@/lib/types";

interface Props {
  pair: PairInfo;
  timeframe: Timeframe;
}

// Map our timeframes to TradingView intervals
const TV_INTERVALS: Record<Timeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

// Map our pair symbols to TradingView symbols
function getTradingViewSymbol(pair: PairInfo): string {
  switch (pair.class) {
    case "crypto": {
      // CoinGecko IDs → TradingView: use CRYPTO exchange
      const base = pair.base.toUpperCase();
      return `CRYPTO:${base}USD`;
    }
    case "forex": {
      const sym = pair.symbol.replace("=X", "");
      // Commodities use different exchanges
      if (sym === "GC=F" || pair.base === "XAU") return "TVC:GOLD";
      if (sym === "SI=F" || pair.base === "XAG") return "TVC:SILVER";
      if (sym === "PL=F" || pair.base === "XPT") return "TVC:PLATINUM";
      if (sym === "CL=F" || pair.base === "OIL") return "NYMEX:CL1!";
      if (sym === "BZ=F" || pair.base === "BRENT") return "NYMEX:BZ1!";
      if (sym === "NG=F" || pair.base === "NATGAS") return "NYMEX:NG1!";
      if (sym === "HG=F" || pair.base === "COPPER") return "COMEX:HG1!";
      // Regular forex
      return `FX:${sym}`;
    }
    case "stocks":
      return pair.symbol;
    case "indices": {
      const indexMap: Record<string, string> = {
        "^GSPC": "SP:SPX",
        "^DJI": "DJ:DJI",
        "^IXIC": "NASDAQ:IXIC",
        "^RUT": "RUSSELL:RUT",
        "^FTSE": "FTSE:UKX",
        "^GDAXI": "XETR:DAX",
        "^FCHI": "EURONEXT:PX1",
        "^N225": "TVC:NI225",
        "^HSI": "HSI:HSI",
        "^STOXX50E": "TVC:SX5E",
      };
      return indexMap[pair.symbol] || `TVC:${pair.base}`;
    }
    default:
      return pair.symbol;
  }
}

function TradingChart({ pair, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    if (widgetRef.current) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    const tvSymbol = getTradingViewSymbol(pair);
    const interval = TV_INTERVALS[timeframe];

    // Create container for the widget
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    widgetContainer.appendChild(widgetDiv);

    containerRef.current.appendChild(widgetContainer);
    widgetRef.current = widgetContainer;

    // Load TradingView widget script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1", // Candlestick
      locale: "en",
      backgroundColor: "rgba(10, 11, 15, 1)",
      gridColor: "rgba(30, 32, 48, 0.6)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: [
        "RSI@tv-basicstudies",
      ],
    });

    widgetContainer.appendChild(script);

    return () => {
      if (widgetRef.current && containerRef.current) {
        try { containerRef.current.removeChild(widgetRef.current); } catch {}
        widgetRef.current = null;
      }
    };
  }, [pair, timeframe]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-medium text-muted">Chart — {pair.name}</h3>
        <span className="text-[10px] text-muted/60">Powered by TradingView</span>
      </div>
      <div
        ref={containerRef}
        className="h-[350px] sm:h-[420px] lg:h-[480px] w-full"
      />
    </div>
  );
}

export default memo(TradingChart);
