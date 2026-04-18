# Markets Assist — PROJECT BRAIN

## Project Summary
Real-time buying vs selling pressure dashboard for crypto pairs (expandable to forex/stocks). Multi-timeframe confluence engine with LTF/HTF divergence detection, news sentiment, and auto-generated analysis notes.

## Current State
- **Status**: MVP complete, deploying to Vercel
- **Stack**: Next.js 15 (App Router), Tailwind CSS 4, Framer Motion, TypeScript
- **Data sources**: Binance API (free), CryptoCompare (free), Google News RSS (free)
- **Repo**: https://github.com/gitDivine/marketsassist

## Architecture
```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/
│   │   ├── pairs/          # GET — list 200 top USDT pairs from Binance
│   │   ├── pressure/       # GET — buy/sell pressure for symbol+timeframe
│   │   ├── confluence/     # GET — multi-TF confluence with divergence
│   │   └── news/           # GET — crypto news + sentiment scoring
│   └── page.tsx            # Main dashboard (client component)
├── components/             # UI components
│   ├── Header.tsx
│   ├── PairSelector.tsx    # Searchable dropdown, 200+ pairs
│   ├── TimeframeSelector.tsx
│   ├── PressureGauge.tsx   # Main buy/sell bar + RSI/MFI/volume cards
│   ├── ConfluencePanel.tsx # Multi-TF grid + divergence alerts
│   ├── NewsPanel.tsx       # News feed + sentiment bar
│   └── AnalysisNotes.tsx   # Auto-generated trading observations
└── lib/
    ├── analysis/
    │   ├── indicators.ts   # RSI, MFI, OBV, EMA, volume profile
    │   ├── pressure.ts     # Weighted pressure calculation
    │   └── confluence.ts   # Multi-TF confluence + divergence detection
    ├── api/
    │   ├── binance.ts      # Klines, order book, ticker data
    │   └── news.ts         # CryptoCompare + Google News RSS
    ├── types.ts
    └── utils.ts
```

## Key Decisions
- **Divergence detection**: LTF opposing HTF gets weight boost (1.15x–1.8x) based on extremity + volume, not simple override
- **HTF staleness penalty**: Weak HTF trends get 0.7x weight reduction
- **Pressure formula**: 35% volume ratio + 20% RSI + 20% MFI + 25% order book imbalance
- **No API keys required**: All data sources are free tier / keyless
- **Crypto-first**: Forex/stocks deferred to future iteration (rate limit constraints)

## Active Tasks
- [x] Core analysis engine (indicators, pressure, confluence)
- [x] Binance data integration
- [x] News + sentiment
- [x] UI components
- [x] Build passes (zero errors)
- [x] GitHub repo created
- [x] Vercel deployment completed (marketsassist.vercel.app & dev0xdivine-marketsassist.vercel.app)
- [ ] Forex/stocks expansion (future)

## Blockers
None currently.

## Session Log
### Session 1 — 2026-04-13
- Built full MVP from scratch
- Implemented divergence detection system per user's insight about LTF vs HTF pressure conflicts
- Three divergence types: early_breakout (1.8x boost), momentum_shift (1.4x), potential_reversal (1.15x)
- Deployed to GitHub: gitDivine/marketsassist
- Next: Vercel deployment

### Session 2 — 2026-04-18
- Successfully added the Forex.com news button functionality below the ForexFactory Calendar in the `TradeIdeas` component.
- Dynamically injected the selected market pair into the Forex.com search query.
- Deployed to the dev Vercel environment (`dev0xdivine-marketsassist.vercel.app`).
- Deployed to production (`marketsassist.vercel.app`).
- Code pushed to GitHub repository master branch.
