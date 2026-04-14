"use client";

import { useEffect, useRef, useState, memo, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { PairInfo, Timeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  pair: PairInfo;
  timeframe: Timeframe;
}

// Map our pair symbols to TradingView symbols
function getTradingViewSymbol(pair: PairInfo): string {
  switch (pair.class) {
    case "crypto": {
      const base = pair.base.toUpperCase();
      return `CRYPTO:${base}USD`;
    }
    case "forex": {
      const sym = pair.symbol.replace("=X", "");
      if (sym === "GC=F" || pair.base === "XAU") return "TVC:GOLD";
      if (sym === "SI=F" || pair.base === "XAG") return "TVC:SILVER";
      if (sym === "PL=F" || pair.base === "XPT") return "TVC:PLATINUM";
      if (sym === "CL=F" || pair.base === "OIL") return "NYMEX:CL1!";
      if (sym === "BZ=F" || pair.base === "BRENT") return "NYMEX:BZ1!";
      if (sym === "NG=F" || pair.base === "NATGAS") return "NYMEX:NG1!";
      if (sym === "HG=F" || pair.base === "COPPER") return "COMEX:HG1!";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    if (widgetRef.current) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    const tvSymbol = getTradingViewSymbol(pair);

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
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(10, 11, 15, 1)",
      gridColor: "rgba(30, 32, 48, 0.6)",
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      withdateranges: true,
      details: false,
      support_host: "https://www.tradingview.com",
      studies: ["RSI@tv-basicstudies"],
    });

    widgetContainer.appendChild(script);

    return () => {
      if (widgetRef.current && containerRef.current) {
        try { containerRef.current.removeChild(widgetRef.current); } catch {}
        widgetRef.current = null;
      }
    };
    // Only reload when PAIR changes — preserves drawings on TF switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "overflow-hidden bg-card",
        isFullscreen
          ? "fixed inset-0 z-[100] flex flex-col"
          : "rounded-2xl border border-border"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-medium text-muted">Chart — {pair.name}</h3>
        <button
          onClick={toggleFullscreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-hover active:scale-95"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>
      <div
        ref={containerRef}
        className={cn(
          "w-full",
          isFullscreen ? "flex-1" : "h-[350px] sm:h-[420px] lg:h-[480px]"
        )}
      />
    </div>
  );
}

export default memo(TradingChart);
