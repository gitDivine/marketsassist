"use client";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="bg-accent/10 text-center text-[11px] font-medium text-accent py-1.5 px-3 sm:text-xs">
        This site is currently in beta testing — features and data may be incomplete or change without notice.
      </div>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          {/* MA Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="MA" className="h-9 w-9 rounded-lg shadow-md shadow-accent/25" />
          <div>
            <h1 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">Markets Assist <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent">Beta</span></h1>
            <p className="text-[10px] text-muted">Buy vs Sell Pressure — Multi-TF Confluence</p>
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
