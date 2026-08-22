# NewsDash

A robust, customizable, widgetized news dashboard. 100% free/open sources — public RSS feeds, the free Polymarket Gamma API, and free Stooq quotes. No API keys, no paid tiers.

## Features

- **Tier 1 headlines ticker** — scrolling breaking-news strip (WSJ, BBC, NPR, NYT, Al Jazeera, Guardian, and more).
- **Widgetized, customizable grid** — add/remove/drag-to-reorder widgets: news feed bundles, custom RSS feeds, Polymarket forecasts, a Markets Overview terminal-style table, and a stock portfolio tracker.
- **Polymarket integration** — live prediction-market odds for politics, markets, and general forecasting, filterable by category/keyword.
- **Markets Overview** — dense, color-coded table of indices, sector ETFs, commodities, and currencies (via free Stooq quotes).
- **Stock portfolio** — add symbols, persisted in `localStorage`, with live price/change and a 25-day sparkline.
- **Gaming section** — Wowhead, Elder Scrolls Online, Reddit gaming communities, IGN, PC Gamer.
- **Deep wire** — Hacker News, Reddit (r/worldnews, r/news, r/politics), ProPublica, Politico, Ars Technica — a `brutalist.report`-style dense link aggregator.
- **Detroit local** — Free Press, Detroit News, WXYZ, Fox 2, Crain's Detroit.
- **Light/dark theme toggle**, mobile-responsive layout.
- **Version chip** in the header — click it for patch notes.

## Running it

### Option A — Static / GitHub Pages (recommended, zero backend)

The frontend in `public/` runs entirely client-side. It fetches RSS/Polymarket/quote data directly from the browser, using a free public CORS proxy ([allorigins.win](https://allorigins.win)) as a fallback for feeds that don't send CORS headers.

1. Push to `main`.
2. In the repo's **Settings → Pages**, set Source to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy-pages.yml`) publishes `public/` automatically on every push to `main`.

No server, no build step, no secrets required.

### Option B — Local Node server (optional)

`server.js` is an optional Express backend that proxies the same sources server-side (useful for local development or self-hosting where you'd rather not depend on a public CORS proxy).

```bash
npm install
npm start
# open http://localhost:3000
```

Note: the static frontend in `public/` does not call this backend by default (it's built for GitHub Pages). If you want the frontend to use `server.js`'s `/api/*` routes instead of direct/proxied fetches, point `app.js`'s fetch helpers at `/api/...`.

## Customizing sources

- Feed bundles are defined in `public/app.js` (`FEED_BUNDLES`) — add, remove, or edit RSS URLs directly.
- Market watchlist symbols are in `MARKET_GROUPS` (Stooq symbol format).
- Add a one-off custom RSS feed from the UI via **+ Add Widget → Custom RSS Feed**.

## Roadmap ideas

- Discord integration (requires a bot token / webhook — free but needs setup, intentionally left out of the zero-config default).
- Server-side caching layer for higher reliability at scale.
- Security hardening pass (CSP, input sanitization audit, rate limiting) — planned as a follow-up.
