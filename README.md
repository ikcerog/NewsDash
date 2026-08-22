# NewsDash

A robust, customizable, widgetized news dashboard. 100% free/open sources — public RSS feeds, the free Polymarket Gamma API, and free Stooq quotes. No API keys, no paid tiers.

## Architecture: the "free DB backstop"

The site is a static page (GitHub Pages), but it doesn't hit live, CORS-proxied APIs on every load — that was slow and flaky. Instead:

1. A GitHub Action (`.github/workflows/fetch-snapshot.yml`, running `scripts/fetch-snapshot.mjs`) runs every ~20 minutes, fetches every feed/quote/API **server-side** (no CORS/proxy needed at all in a GitHub Actions runner), and commits the result to `public/data/snapshot.json`.
2. That commit auto-triggers the Pages redeploy, so the live site always serves a recent snapshot.
3. The browser reads `data/snapshot.json` directly (same-origin, instant, no network round-trips to third parties) and renders from it immediately.
4. Anything the snapshot doesn't cover — a custom RSS feed URL you add, a portfolio symbol outside the default set, a custom Polymarket search — still fetches live from the browser, routed through a chain of free CORS proxies as a fallback.

This is effectively "git + a scheduled Action" acting as a free, zero-maintenance database, instead of a paid service or a Google Sheet.

## Features

- **Tier 1 headlines ticker** — scrolling breaking-news strip (WSJ, BBC, NPR, NYT, Al Jazeera, Guardian, and more), plus a secondary scrolling markets ticker. Both have +/- speed controls.
- **Left-rail modules sidebar** — widgets are grouped into News / Markets / Forecasting / Trends / Safety & Alerts, with counts and one-click filtering.
- **Widgetized, customizable grid** — add/remove/drag-to-reorder widgets. Existing saved layouts auto-migrate to include newly added widget types.
- **Live search** — filters headlines/markets across all widgets as you type (client-side, no network calls).
- **Polymarket integration** — live prediction-market odds for politics, markets, and general forecasting, filterable by category/keyword.
- **Markets Overview** — dense, color-coded table of indices, sector ETFs, commodities, and currencies.
- **Stock portfolio** — add symbols, persisted in `localStorage`, with live price/change and a 25-day sparkline.
- **Significant Earthquakes** — USGS feed with a Leaflet + OpenStreetMap mini-map.
- **Local Weather Alerts** — enter a US ZIP code (saved to `localStorage`) for active NWS alerts near you (via Zippopotam.us geocoding).
- **Global Disaster Map** — link-out to RSOE EDIS's live event map (their feed format isn't reachable/documented from this dev environment, so it's a link rather than embedded data).
- **Gaming section** — Wowhead, Elder Scrolls Online, Reddit gaming communities, IGN, PC Gamer.
- **Deep wire** — Hacker News, Reddit, ProPublica, Politico, Ars Technica — a `brutalist.report`-style dense link aggregator.
- **Detroit local**, **Trending Now** (Google Trends + Reddit r/all), **Trending on Wikipedia**, **Treasury Yields**.
- **Light/dark theme toggle**, mobile-responsive layout, version chip with patch notes.

## Running it

### Option A — Static / GitHub Pages (recommended)

1. Push to `main`.
2. In the repo's **Settings → Pages**, set Source to **GitHub Actions**.
3. `.github/workflows/deploy-pages.yml` publishes `public/` on every push to `main`.
4. `.github/workflows/fetch-snapshot.yml` keeps `public/data/snapshot.json` fresh on its own schedule (also triggers a redeploy when it changes). You can also run it manually from the Actions tab (`workflow_dispatch`).

No server, no build step, no secrets required. The map on the Earthquakes widget loads Leaflet + its CSS from the free unpkg CDN (open source, no key/account needed).

### Generating a snapshot locally

```bash
npm install
node scripts/fetch-snapshot.mjs
# writes public/data/snapshot.json
```

### Option B — Local Node server (optional, legacy)

`server.js` is an optional Express backend that proxies sources server-side for local dev. The static frontend doesn't call it by default.

```bash
npm install
npm start
# open http://localhost:3000
```

## Customizing sources

- Feed bundles and market watchlist symbols live in `public/shared-config.js` — a single source of truth imported by both the browser (`public/app.js`) and the snapshot script (`scripts/fetch-snapshot.mjs`), so they can't drift apart. Add/remove/edit RSS URLs or symbols there.
- Add a one-off custom RSS feed from the UI via **+ Add Widget → Custom RSS Feed**.

## Roadmap ideas

- Discord integration (requires a bot token/webhook — free but needs setup, intentionally left out of the zero-config default).
- Wire up RSOE EDIS with real embedded event data if their feed endpoint can be confirmed.
- Security hardening pass (CSP, input sanitization audit, rate limiting) — planned as a follow-up.
