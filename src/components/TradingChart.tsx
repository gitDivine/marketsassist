"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
} from "react";
import { Maximize2, Minimize2, Eye, EyeOff, Loader2 } from "lucide-react";
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers } from "lightweight-charts";
import type { IChartApi, ISeriesApi, SeriesMarker, Time } from "lightweight-charts";
import type { PairInfo, Timeframe } from "@/lib/types";
import {
  detectAllKeyZones,
  filterActiveZones,
  type Candle,
  type KeyZone,
} from "@/lib/analysis/keyzones";
import { cn, formatPrice } from "@/lib/utils";

interface Props {
  pair: PairInfo;
  timeframe: Timeframe;
}

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeData {
  time: Time;
  value: number;
  color: string;
}

const ZONE_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  fvg_bull: { bg: "rgba(147, 51, 234, 0.12)", border: "rgba(147, 51, 234, 0.45)", label: "FVG" },
  fvg_bear: { bg: "rgba(147, 51, 234, 0.12)", border: "rgba(147, 51, 234, 0.45)", label: "FVG" },
  ob_bull: { bg: "rgba(34, 197, 94, 0.10)", border: "rgba(34, 197, 94, 0.40)", label: "OB" },
  ob_bear: { bg: "rgba(239, 68, 68, 0.10)", border: "rgba(239, 68, 68, 0.40)", label: "OB" },
  liquidity_sweep_high: { bg: "rgba(251, 146, 60, 0.10)", border: "rgba(251, 146, 60, 0.40)", label: "LIQ" },
  liquidity_sweep_low: { bg: "rgba(251, 146, 60, 0.10)", border: "rgba(251, 146, 60, 0.40)", label: "LIQ" },
  support: { bg: "rgba(34, 197, 94, 0.06)", border: "rgba(34, 197, 94, 0.25)", label: "S" },
  resistance: { bg: "rgba(239, 68, 68, 0.06)", border: "rgba(239, 68, 68, 0.25)", label: "R" },
  demand: { bg: "rgba(34, 197, 94, 0.14)", border: "rgba(34, 197, 94, 0.50)", label: "D" },
  supply: { bg: "rgba(239, 68, 68, 0.14)", border: "rgba(239, 68, 68, 0.50)", label: "S" },
};

function TradingChart({ pair, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeSeriesRef = useRef<any>(null);
  const zonesRef = useRef<KeyZone[]>([]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeyZones, setShowKeyZones] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | "flat">("flat");

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Escape to close fullscreen
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

  // Draw key zones overlay
  const drawZones = useCallback(() => {
    const canvas = overlayRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const container = containerRef.current;
    if (!canvas || !chart || !series || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas to match the chart container exactly
    const ratio = window.devicePixelRatio || 1;
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width * ratio;
    canvas.height = containerRect.height * ratio;
    canvas.style.width = containerRect.width + "px";
    canvas.style.height = containerRect.height + "px";
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, containerRect.width, containerRect.height);

    if (!showKeyZones || zonesRef.current.length === 0) return;

    const zones = filterActiveZones(
      zonesRef.current,
      lastPrice || 0
    );

    for (const zone of zones) {
      const topY = series.priceToCoordinate(zone.top);
      const bottomY = series.priceToCoordinate(zone.bottom);
      if (topY === null || bottomY === null) continue;

      // Draw from left edge to right edge (full width) for simplicity
      // since timeToCoordinate can be unreliable for old timestamps
      const colors = ZONE_COLORS[zone.type] || ZONE_COLORS.support;
      const strengthMult = Math.max(0.5, zone.strength / 100);

      const zoneHeight = Math.max(Math.abs(bottomY - topY), 3);
      const y = Math.min(topY, bottomY);

      // Full-width zone (from 0 to chart width minus price scale ~60px)
      const chartWidth = containerRect.width - 60;

      // Fill
      ctx.globalAlpha = strengthMult;
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, y, chartWidth, zoneHeight);

      // Borders (top and bottom lines)
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.moveTo(0, y + zoneHeight);
      ctx.lineTo(chartWidth, y + zoneHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label on the right side
      ctx.globalAlpha = 0.9;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillStyle = colors.border;
      if (zoneHeight > 10) {
        const labelText = colors.label;
        const labelWidth = ctx.measureText(labelText).width;
        ctx.fillText(labelText, chartWidth - labelWidth - 8, y + Math.min(13, zoneHeight - 2));
      }
    }

    ctx.globalAlpha = 1;
  }, [showKeyZones, lastPrice]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    // Dispose previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#0a0b0f" },
        textColor: "#9ca3af",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 32, 48, 0.5)" },
        horzLines: { color: "rgba(30, 32, 48, 0.5)" },
      },
      crosshair: {
        vertLine: { color: "rgba(99, 102, 241, 0.3)", width: 1, style: 2, labelBackgroundColor: "#6366f1" },
        horzLine: { color: "rgba(99, 102, 241, 0.3)", width: 1, style: 2, labelBackgroundColor: "#6366f1" },
      },
      rightPriceScale: {
        borderColor: "rgba(30, 32, 48, 0.8)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(30, 32, 48, 0.8)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Redraw zones on visible range change
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(drawZones);
    });
    chart.subscribeCrosshairMove(() => {
      requestAnimationFrame(drawZones);
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [isFullscreen]); // recreate on fullscreen toggle since container changes size

  // Fetch and render candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    let cancelled = false;
    setIsLoading(true);

    const fetchCandles = async () => {
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(pair.symbol)}&timeframe=${timeframe}&class=${pair.class}`
        );
        if (!res.ok) throw new Error("API error");
        const data = await res.json();

        if (cancelled || !data.candles?.length) {
          setIsLoading(false);
          return;
        }

        const candles: Candle[] = data.candles;

        // Format for lightweight-charts
        const candleData: CandleData[] = candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumeData: VolumeData[] = candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
        }));

        candleSeriesRef.current?.setData(candleData);
        volumeSeriesRef.current?.setData(volumeData);

        // Set last price
        const last = candles[candles.length - 1];
        const prev = candles.length > 1 ? candles[candles.length - 2] : last;
        setLastPrice(last.close);
        setPriceDirection(
          last.close > prev.close ? "up" : last.close < prev.close ? "down" : "flat"
        );

        // Detect key zones
        const { zones, swings } = detectAllKeyZones(candles);
        zonesRef.current = zones;

        // Add swing point markers — only recent significant ones
        const markers: SeriesMarker<Time>[] = swings
          .filter((s) => ["HH", "HL", "LH", "LL"].includes(s.label))
          .slice(-12) // only last 12 swings to avoid spam
          .map((s) => ({
            time: s.time as Time,
            position: s.type === "high" ? ("aboveBar" as const) : ("belowBar" as const),
            shape: s.type === "high" ? ("arrowDown" as const) : ("arrowUp" as const),
            color:
              s.label === "HH" || s.label === "HL"
                ? "#22c55e"
                : "#ef4444",
            text: s.label,
            size: 0.5,
          }));

        // Sort markers by time (required by lightweight-charts)
        markers.sort((a, b) => (a.time as number) - (b.time as number));
        if (candleSeriesRef.current) {
          createSeriesMarkers(candleSeriesRef.current, markers);
        }

        // Fit content
        chartRef.current?.timeScale().fitContent();

        // Draw zones after a tick
        requestAnimationFrame(drawZones);
      } catch (err) {
        console.error("Failed to fetch candles:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchCandles();

    // Auto-refresh every 30 seconds for near-realtime updates
    const interval = setInterval(fetchCandles, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pair, timeframe, drawZones]);

  // Redraw zones when toggle changes
  useEffect(() => {
    drawZones();
  }, [showKeyZones, drawZones]);

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
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-muted">{pair.name}</h3>
          {lastPrice !== null && (
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                priceDirection === "up" && "text-green",
                priceDirection === "down" && "text-red",
                priceDirection === "flat" && "text-foreground"
              )}
            >
              {formatPrice(lastPrice)}
            </span>
          )}
          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowKeyZones((v) => !v)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all active:scale-95",
              showKeyZones
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-foreground hover:bg-card-hover"
            )}
            title={showKeyZones ? "Hide key zones" : "Show key zones"}
          >
            {showKeyZones ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Key Zones</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-hover active:scale-95"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Chart + Overlay */}
      <div
        className={cn(
          "relative w-full",
          isFullscreen ? "flex-1" : "h-[350px] sm:h-[420px] lg:h-[480px]"
        )}
      >
        <div ref={containerRef} className="absolute inset-0" />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ zIndex: 2 }}
        />
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <span className="text-xs text-muted">Loading chart...</span>
            </div>
          </div>
        )}
      </div>

      {/* Zone legend */}
      {showKeyZones && !isLoading && zonesRef.current.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-1.5 sm:px-4">
          <span className="text-[10px] font-medium text-muted">Zones:</span>
          {[
            { label: "OB", color: "#22c55e", desc: "Order Block" },
            { label: "FVG", color: "#9333ea", desc: "Fair Value Gap" },
            { label: "D/S", color: "#22c55e", desc: "Demand/Supply" },
            { label: "S/R", color: "#6b7280", desc: "Support/Resistance" },
            { label: "LIQ", color: "#fb923c", desc: "Liquidity Sweep" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1" title={item.desc}>
              <div
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: item.color, opacity: 0.7 }}
              />
              <span className="text-[10px] text-muted">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(TradingChart);
