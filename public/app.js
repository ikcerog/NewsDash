// NewsDash — client-side app.
// Runs entirely static (GitHub Pages friendly). Primary data source is a
// pre-fetched JSON snapshot (data/snapshot.json) built server-side every
// ~20 minutes by a GitHub Action (scripts/fetch-snapshot.mjs) — no CORS
// proxy involved, so it's fast and reliable. Anything not covered by the
// snapshot (a custom feed URL, an arbitrary portfolio symbol, a custom
// Polymarket search) still fetches live from the browser, routed through a
// free CORS proxy chain as a fallback.
import {
  MARKET_GROUPS,
  FEED_BUNDLES,
  DEFAULT_PORTFOLIO,
  MOVERS_UNIVERSE,
  WIDGET_CATEGORIES,
  BUNDLE_CATEGORY_OVERRIDES,
  CATEGORY_LABELS,
  STATUS_SERVICES,
  POLYMARKET_CATEGORY_KEYWORDS,
  normalizeStooqSymbol,
  toYahooSymbol,
} from './shared-config.js?v=0.5.1';

const APP_VERSION = '0.5.1';
const PATCH_NOTES = [
  {
    version: '0.5.1',
    date: '2026-08-22',
    notes: [
      'The load-time chip is now clickable: shows time-to-first-byte, first contentful paint, full load time, total bytes transferred, and hosting (GitHub Pages) in a small popover.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-22',
    notes: [
      'Added a load-time chip next to the version chip showing how long the page took to load.',
      'Added a Sciences module: Nature, Scientific American, IEEE Spectrum, arXiv (cs.AI and astro-ph), Project Gutenberg new releases, and the Internet Archive blog.',
      'Added a YouTube Channels module: WDWNT, Soul So Breezy, Watch It For Days, Magical Escapes, and National Geographic. Resolved server-side (channel handle → feed) in the snapshot script since YouTube only serves RSS per numeric channel ID, not by handle — this module relies on the snapshot and refreshes every ~20 minutes.',
    ],
  },
  {
    version: '0.2.14',
    date: '2026-08-22',
    notes: [
      'Fixed Reddit r/worldnews, r/politics, r/comicbooks, r/ActionFigures for real: they were 403ing from GitHub Actions\' shared IPs regardless of host (old.reddit.com vs www) or User-Agent — the snapshot script now routes just those feeds through the same CORS proxy the client uses.',
      'Themed the scrollbars (slimmer, matching the paper/terracotta palette) instead of the OS default track/thumb.',
      'Moved the sidebar collapse toggle from the header into the sidebar itself, next to what it controls.',
    ],
  },
  {
    version: '0.2.13',
    date: '2026-08-22',
    notes: [
      'Fixed AP/Reuters Google News search: the `allinurl:` operator was silently matching nothing — switched to `site:`, the operator used successfully everywhere else in the app.',
      'Replaced Global Disasters\' ReliefWeb backend (its v1 API started returning 410 Gone) with NASA EONET — also gives the widget a real map, since EONET carries per-event coordinates.',
      'Styled the CrypTrack outbound link as a proper button instead of a plain inline link.',
      'Added a widget scroll-lock button (next to Scroll to Top): freezes every widget\'s internal scrolling so a mobile swipe always scrolls the page instead of a widget list stealing it.',
      'Added a collapsible sidebar (desktop) via a new header toggle button.',
      'Added a per-widget "double-wide" toggle (desktop): a widget can take two grid columns; a wide widget that doesn\'t fit the current row reflows to the next one automatically.',
    ],
  },
  {
    version: '0.2.12',
    date: '2026-08-22',
    notes: [
      'Widened the AP/Reuters Google News search window from 1 hour to 6 — 1h rarely had an indexed match for a specific domain, so Breaking News Alerts came back empty most of the time.',
      'Expanded the default portfolio to a 27-stock Fortune 500 sampler across tech, finance, healthcare, energy, consumer, industrials, telecom, and auto (was 10 mega-cap tech/finance names).',
      'Added a Big Movers widget: today\'s (or the last available session\'s, on weekends) biggest gainers/losers, computed from quotes already being fetched — no new API needed.',
      'Added a scroll-to-top button that appears once you scroll past the header.',
      'Replaced the Global Disaster Map (RSOE EDIS link-out, which couldn\'t be embedded or reached from here) with a real Global Disasters widget backed by ReliefWeb (UN OCHA), a free public API.',
      'Added Disney coverage to Pop Culture: WDWNT, Disney Food Blog, AllEars.net, plus official Disney and Disney movie/cinema news.',
    ],
  },
  {
    version: '0.2.11',
    date: '2026-08-22',
    notes: [
      'Fixed Polymarket · politics coming back empty: the /markets endpoint never populates category/tags at all, and question text rarely contains the literal word "politics" — added real keyword expansion (Trump, Fed, election, senate, etc.) and a much larger search pool (500 markets instead of 100, which was dominated by sports by volume).',
      'Fixed Treasury Yields showing a stale date: the source CSV lists newest-first, not oldest-first, so grabbing the "last line" was picking the oldest entry in the file. Now picks the row with the actual latest date.',
      'Fixed empty Markets Overview/Portfolio quotes: when the direct quote endpoints fail but per-symbol price history succeeds (observed in production), quotes are now derived from the last two closes in that history instead of just giving up.',
      'Redesigned the ticker speed controls: moved out of an overlay-with-gradient hack into real layout space, so they no longer cover scrolling headline text.',
      'Fixed the version chip being hidden on mobile — now shown at a smaller size instead of removed.',
      'Added a CrypTrack widget (embeds ikcerog/cryptrack, a live Bigfoot/UFO sightings map).',
      'Added a Pop Culture feed bundle: Comic Book Resources, Bleeding Cool, ScreenRant, Polygon, Kotaku, r/comicbooks, r/ActionFigures.',
      'Added a Trending Topics bar: pure client-side word-frequency analysis across every currently-loaded headline/market, no network call — click a word to filter by it.',
    ],
  },
  {
    version: '0.2.10',
    date: '2026-08-22',
    notes: [
      'Fixed the snapshot Action hanging indefinitely: rss-parser\'s own timeout didn\'t reliably cover every hang case, so a single unresponsive feed could stall the whole run. Added a hard 15s outer timeout on every feed fetch.',
      'Parallelized feed bundles in the snapshot script (was sequential) — cuts total feed-fetch time from up to ~10x a single bundle\'s worst case down to about 1x.',
    ],
  },
  {
    version: '0.2.9',
    date: '2026-08-22',
    notes: ['Added a favicon.'],
  },
  {
    version: '0.2.8',
    date: '2026-08-22',
    notes: [
      'Added rss2json.com as a distinct RSS fallback path — separate infrastructure from the generic CORS proxy chain, tried only if all of those fail outright.',
      'Added a 4th general-purpose CORS proxy (thingproxy) to the race.',
      'Added CNBC, Bloomberg, and Fox Business to Tier 1 Headlines.',
    ],
  },
  {
    version: '0.2.7',
    date: '2026-08-22',
    notes: [
      'Added a Yahoo Finance fallback for quotes/sparklines — Stooq appears to block the free CORS proxies wholesale, which was why Markets Overview, Portfolio, and the secondary ticker were consistently empty. Both are now captured server-side by the snapshot too.',
      'Fixed a real bug: forex/crypto symbols (EUR/USD, Bitcoin, etc.) were getting an incorrect ".us" suffix appended, silently breaking those specific quotes even when Stooq worked.',
      'Expanded the default symbol set: 11-sector SPDR breakdown, a new Bonds group (TLT, IEF, HYG, LQD, AGG, SHY), Copper added to commodities, USD/CAD and Ethereum added to currencies, and a diversified 10-stock default portfolio (was 4 mega-cap tech names).',
      'Consolidated quote-symbol logic (Stooq/Yahoo mapping) into shared-config.js so the browser and the snapshot script can\'t drift apart.',
      'Made the Google Fonts stylesheet non-render-blocking (loads async, swaps in once ready) so a slow or unreachable font CDN can never delay first paint.',
    ],
  },
  {
    version: '0.2.6',
    date: '2026-08-22',
    notes: [
      'Fixed a stale-cache bug: styles.css/app.js/shared-config.js had no cache-busting, so a deploy could leave browsers/CDN edges serving old CSS against new HTML (the cause of the broken hybrid mobile-header rendering some users saw). All are now versioned (?v=) and bumped on every release.',
      'New visual design: warm editorial color palette (paper tones + terracotta accent) instead of generic SaaS blue.',
      'New typography: Science Gothic for headers/UI chrome, IBM Plex Serif for body copy — a sans/serif split for a cleaner, more contemporary feel.',
    ],
  },
  {
    version: '0.2.5',
    date: '2026-08-22',
    notes: [
      'Added Focus mode: an ⤢ button on every widget opens a modal with the full story list instead of the compact preview.',
      'Mobile redesign: compact hamburger menu (search/add-widget/theme moved off the main bar) and flatter, edge-to-edge widget cards instead of heavy shadowed blocks.',
      'Added new sources: The Verge, Smashing Magazine, web.dev, W3C Blog, Techdirt, TechRadar (Web & Dev); Krebs on Security, The Hacker News, BleepingComputer, IEEE Spectrum, SC Media (Security & Deep Wire); Anthropic, OpenAI, DeepMind (AI News); AWS, Cloudflare, GitHub, Netlify (Cloud & Infra).',
      'Added Service Status widget — live incident status for Cloudflare, GitHub, OpenAI, Anthropic, Netlify, Reddit, Discord, Slack via their free public Statuspage APIs.',
      'Added US Weather Alerts Map — nationwide severe/extreme NWS alerts plotted on a map (no ZIP needed), complementing the existing ZIP-based Local Alerts widget.',
    ],
  },
  {
    version: '0.2.4',
    date: '2026-08-22',
    notes: [
      'Added a "free DB backstop": a GitHub Action fetches all feeds/quotes/APIs server-side every ~20 min (no CORS/proxy needed there) and commits a JSON snapshot the site reads instantly instead of live-fetching on every load — the real fix for both speed and reliability.',
      'Existing saved layouts now auto-migrate: newly introduced widgets are added automatically instead of requiring manual "+ Add Widget".',
      'Fixed a bug where a successful-but-empty feed result (e.g. a quiet news day) was shown as "unavailable" instead of "no recent items".',
      'Fixed a bug where one failed live top-up request could wipe out portfolio quotes that were already available from the snapshot.',
      'Replaced the still-stale WSJ RSS feeds and remaining flaky Detroit-local feeds (WXYZ, Fox 2) with Google News fallbacks.',
      'Added a left-rail sidebar that groups widgets into modules (News, Markets, Forecasting, Trends, Safety & Alerts) with counts and filtering.',
    ],
  },
  {
    version: '0.2.3',
    date: '2026-08-22',
    notes: [
      'Major performance fix: CORS proxies are now raced in parallel instead of tried one-by-one (was up to 30s/feed on failure).',
      'Added a response cache (with TTL) so the ticker and widgets stop duplicating identical feed/quote requests.',
      'Staggered initial widget loads to avoid bursting dozens of simultaneous proxy requests at once.',
      'Added a live search box in the header that filters headlines/markets across all widgets as you type.',
      'Added a Leaflet + OpenStreetMap mini-map to the Significant Earthquakes widget.',
      'Added Local Weather Alerts widget: enter a ZIP code (saved to localStorage) for active NWS alerts near you.',
      'Added a Global Disaster Map widget linking out to RSOE EDIS (their feed isn\'t publicly documented/reachable from here, so this is a link-out rather than embedded data).',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-08-22',
    notes: [
      'Fixed stale/wrong headline dates — proxy responses were being cached; requests are now cache-busted.',
      'Fixed stock quotes 404 — Stooq bulk-quote requests need comma-separated symbols, not "+".',
      'Replaced dead Detroit-local and Wowhead/ESO feeds with reliable Google News fallbacks.',
      'Added Trending Now bundle (Google Trends + Reddit r/all).',
      'Added Trending on Wikipedia, Treasury Yields, and Significant Earthquakes widgets — all free, keyless APIs.',
      'Added a secondary markets ticker and +/- speed controls for the headline ticker.',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-08-22',
    notes: [
      'Fixed "all widgets unavailable" bug caused by relying on a single, unreliable CORS proxy.',
      'Added a fallback chain across multiple free CORS proxies (codetabs, allorigins, corsproxy.io) for RSS and quote fetches.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-22',
    notes: [
      'Rebuilt as a fully static, client-side app for GitHub Pages (no backend required).',
      'Added Markets Overview widget: dense, color-coded indices/sectors/commodities/currencies table.',
      'Added 25-day sparklines to the stock portfolio widget.',
      'Added GitHub Actions workflow to auto-deploy to GitHub Pages.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-22',
    notes: [
      'Initial release: Tier 1 headlines ticker, widgetized customizable grid.',
      'Free RSS aggregation: WSJ, BBC, NPR, NYT, Al Jazeera, Guardian, CNBC, Detroit locals, Hacker News, Reddit, Politico, and more.',
      'Polymarket integration for politics/markets/forecasting.',
      'Stock portfolio widget with localStorage persistence (via Stooq free quotes).',
      'Gaming section: WoWhead, Elder Scrolls Online, Reddit gaming, IGN, PC Gamer.',
      'Light/dark theme toggle, drag-to-reorder widgets, mobile-responsive layout.',
      'Version chip with patch notes modal.',
    ],
  },
];

// Multiple free CORS proxies, tried in order — any single one of these can
// go down or rate-limit independently, so we fall back through the list
// rather than depending on one.
const CORS_PROXIES = [
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// MARKET_GROUPS and FEED_BUNDLES now live in shared-config.js (imported above).

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const STORE_KEY = 'newsdash.state.v1';

function widgetSignature(w) {
  return `${w.type}:${JSON.stringify(w.config || {})}`;
}

// Existing users' saved layouts predate widgets introduced in later
// versions and would otherwise never see them. On every load, any default
// widget whose (type, config) signature isn't already present gets
// appended — additive only, never touches the user's own customizations
// or ordering.
function migrateWidgets(saved) {
  const existing = new Set((saved.widgets || []).map(widgetSignature));
  const additions = defaultState().widgets.filter((w) => !existing.has(widgetSignature(w)));
  if (additions.length) saved.widgets = [...(saved.widgets || []), ...additions];
  return saved;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== APP_VERSION) {
        migrateWidgets(saved);
        saved.version = APP_VERSION;
      }
      return saved;
    }
  } catch (e) {
    console.warn('Failed to parse stored state', e);
  }
  const fresh = defaultState();
  fresh.version = APP_VERSION;
  return fresh;
}

function defaultState() {
  return {
    theme: 'dark',
    tickerSpeed: 60,
    localZip: null,
    portfolio: [...DEFAULT_PORTFOLIO],
    widgets: [
      { id: uid(), type: 'feed-bundle', config: { bundle: 'tier1' } },
      { id: uid(), type: 'markets-overview', config: {} },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'breaking' } },
      { id: uid(), type: 'polymarket', config: { category: 'politics' } },
      { id: uid(), type: 'portfolio', config: {} },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'detroit' } },
      { id: uid(), type: 'polymarket', config: { category: '' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'deepwire' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'gaming' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'trending' } },
      { id: uid(), type: 'wiki-trending', config: {} },
      { id: uid(), type: 'bonds', config: {} },
      { id: uid(), type: 'earthquakes', config: {} },
      { id: uid(), type: 'local-alerts', config: {} },
      { id: uid(), type: 'us-alerts-map', config: {} },
      { id: uid(), type: 'disaster-map', config: {} },
      { id: uid(), type: 'service-status', config: {} },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'webdev' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'security' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'ainews' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'cloudops' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'popculture' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'science' } },
      { id: uid(), type: 'feed-bundle', config: { bundle: 'youtube' } },
      { id: uid(), type: 'cryptrack', config: {} },
      { id: uid(), type: 'movers', config: {} },
    ],
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

let state = loadState();
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Data snapshot — the "free DB backstop". A GitHub Action
// (scripts/fetch-snapshot.mjs) fetches everything server-side every ~20
// minutes (no CORS/proxy needed there) and commits the result here. The
// site reads this same-origin file directly — instant, no proxy chain —
// and only falls back to live client-side fetches when the snapshot is
// missing, stale, or doesn't cover the specific thing requested (a custom
// feed URL, a portfolio symbol outside the default set, etc.).
// ---------------------------------------------------------------------------
let SNAPSHOT = null;

async function loadSnapshot() {
  try {
    const res = await fetch('./data/snapshot.json', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (res.ok) SNAPSHOT = await res.json();
  } catch (e) {
    console.warn('Snapshot unavailable, falling back to live fetches:', e.message);
  }
}

function snapshotFresh() {
  if (!SNAPSHOT || !SNAPSHOT.generatedAt) return false;
  return Date.now() - new Date(SNAPSHOT.generatedAt).getTime() < 2 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

// In-flight/response cache with TTL. This both speeds up repeat loads and
// de-duplicates identical requests fired close together (e.g. the ticker
// and a widget both fetching the same feed URL on page load).
const _respCache = new Map(); // key -> { expires, promise }
function withCache(key, ttlMs, fn) {
  const hit = _respCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = fn().catch((err) => {
    _respCache.delete(key);
    throw err;
  });
  _respCache.set(key, { expires: Date.now() + ttlMs, promise });
  return promise;
}

async function raceRequests(builders, timeoutMs) {
  const attempts = builders.map(async (build) => {
    const res = await fetch(build(), { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`Responded ${res.status}`);
    return res;
  });
  try {
    return await Promise.any(attempts);
  } catch (aggErr) {
    const first = aggErr?.errors?.[0];
    throw first || new Error('All requests failed');
  }
}

async function proxiedFetch(url, { direct = true } = {}) {
  if (direct) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (res.ok) return res;
    } catch (e) {
      /* fall through to proxy chain */
    }
  }
  // Cache-bust the *target* URL so a proxy (which often caches by exact
  // request URL) doesn't hand back a stale capture of the feed from weeks
  // or months ago — this was previously causing headlines to show wildly
  // wrong dates. All proxies are raced in parallel (first success wins)
  // instead of tried one-by-one, which was the main source of lag.
  const bustUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();
  return raceRequests(
    CORS_PROXIES.map((build) => () => build(bustUrl)),
    9000
  );
}

function parseFeedXML(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Feed parse error');

  const isAtom = doc.documentElement.nodeName === 'feed';
  const itemNodes = isAtom ? doc.querySelectorAll('entry') : doc.querySelectorAll('item');
  const items = [];
  itemNodes.forEach((node) => {
    if (items.length >= 12) return;
    const title = node.querySelector('title')?.textContent?.trim() || '(untitled)';
    let link = node.querySelector('link')?.textContent?.trim();
    if (!link) {
      const linkEl = node.querySelector('link');
      link = linkEl?.getAttribute?.('href') || '#';
    }
    const pubDate =
      node.querySelector('pubDate')?.textContent ||
      node.querySelector('published')?.textContent ||
      node.querySelector('updated')?.textContent ||
      null;
    items.push({ title, link, pubDate });
  });
  return items;
}

// rss2json.com is a free, keyless, purpose-built RSS-to-JSON service with
// its own CORS-enabled infrastructure — a genuinely different path from
// the generic CORS_PROXIES chain (which shares congested, often-throttled
// infrastructure across every kind of request). Tried only after the
// generic chain fails outright.
async function fetchFeedViaRss2Json(url) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&_cb=${Date.now()}`;
  const res = await fetch(api, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'rss2json failed');
  return (data.items || []).slice(0, 12).map((it) => ({
    title: it.title || '(untitled)',
    link: it.link || '#',
    pubDate: it.pubDate || null,
  }));
}

async function fetchFeed(url) {
  return withCache(`feed:${url}`, 4 * 60 * 1000, async () => {
    try {
      const res = await proxiedFetch(url, { direct: false });
      const text = await res.text();
      return parseFeedXML(text);
    } catch (err) {
      return fetchFeedViaRss2Json(url);
    }
  });
}

// Returns [{ name, items, error }] aligned with FEED_BUNDLES[bundleKey].feeds.
// Prefers the snapshot (instant); falls back to live per-feed fetches.
async function fetchBundle(bundleKey) {
  const bundle = FEED_BUNDLES[bundleKey];
  if (snapshotFresh() && SNAPSHOT.feeds?.[bundleKey]) {
    return SNAPSHOT.feeds[bundleKey];
  }
  // "youtube" feeds have no static url (see the YOUTUBE_CHANNELS comment
  // in shared-config.js) — they only exist via the snapshot, resolved
  // server-side. If the snapshot is stale/missing, there's nothing to
  // live-fetch; skip straight to a clear per-row "unavailable" instead of
  // wasting a network round trip on a null URL.
  if (bundleKey === 'youtube') {
    return bundle.feeds.map((f) => ({ name: f.name, items: [], error: 'Refreshes with the next data snapshot' }));
  }
  const results = await Promise.allSettled(bundle.feeds.map((f) => fetchFeed(f.url)));
  return bundle.feeds.map((f, i) => ({
    name: f.name,
    items: results[i].status === 'fulfilled' ? results[i].value : [],
    error: results[i].status === 'rejected' ? results[i].reason.message : null,
  }));
}

function polymarketCategoryMatch(m, category) {
  const cat = category.toLowerCase();
  const hay = `${m.question || ''} ${m.category || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
  const keywords = POLYMARKET_CATEGORY_KEYWORDS[cat];
  if (keywords) return keywords.some((kw) => hay.includes(kw));
  return hay.includes(cat);
}

function filterPolymarketList(markets, category, limit = 15) {
  let filtered = markets;
  if (category) {
    filtered = filtered.filter((m) => polymarketCategoryMatch(m, category));
  }
  return filtered.slice(0, limit).map((m) => ({
    question: m.question,
    url: m.url || `https://polymarket.com/event/${m.slug || m.eventSlug || ''}`,
    volume24hr: m.volume24hr || m.volume || 0,
    outcomes: m.outcomes || [],
    prices: m.prices || [],
  }));
}

async function fetchPolymarket(category, limit = 15) {
  if (snapshotFresh() && SNAPSHOT.polymarket?.length) {
    return filterPolymarketList(SNAPSHOT.polymarket, category, limit);
  }
  return withCache(`poly:${category || ''}:${limit}`, 60 * 1000, () => fetchPolymarketUncached(category, limit));
}

async function fetchPolymarketUncached(category, limit = 15) {
  const url = new URL('https://gamma-api.polymarket.com/markets');
  url.searchParams.set('closed', 'false');
  // Polymarket's /markets response never populates category/tags, so
  // matching relies on question text — sports/esports dominate the top of
  // the volume-sorted list, so a larger pool is needed for a category like
  // politics to have real matches to search through.
  url.searchParams.set('limit', '500');
  url.searchParams.set('order', 'volume24hr');
  url.searchParams.set('ascending', 'false');

  const res = await proxiedFetch(url.toString(), { direct: true });
  const data = await res.json();
  let markets = Array.isArray(data) ? data : data.markets || [];

  if (category) {
    markets = markets.filter((m) => polymarketCategoryMatch(m, category));
  }

  return markets.slice(0, limit).map((m) => {
    let outcomes = [];
    let prices = [];
    try {
      outcomes = JSON.parse(m.outcomes || '[]');
      prices = JSON.parse(m.outcomePrices || '[]');
    } catch {
      /* ignore */
    }
    return {
      question: m.question,
      url: `https://polymarket.com/event/${m.slug || m.eventSlug || ''}`,
      volume24hr: m.volume24hr || m.volume || 0,
      outcomes,
      prices,
    };
  });
}

// Stooq's free quote endpoint appears to be blocked/throttled for the CORS
// proxies this app relies on (it fails wholesale even when other proxied
// requests succeed) — Yahoo Finance's unofficial-but-widely-used quote API
// is the fallback so quotes still have a real second path, not just a
// retry of the same blocked one. normalizeStooqSymbol/toYahooSymbol live in
// shared-config.js so the snapshot script uses identical logic.

async function fetchQuotesStooq(rawSymbols) {
  const stooqSymbols = rawSymbols.map(normalizeStooqSymbol).join(',');
  const url = `https://stooq.com/q/l/?s=${stooqSymbols}&f=sd2t2ohlcv&h&e=csv`;
  const res = await proxiedFetch(url, { direct: false });
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => (row[h.trim()] = cells[i]));
    return {
      symbol: (row.Symbol || '').toUpperCase(),
      close: parseFloat(row.Close),
      open: parseFloat(row.Open),
    };
  });
  if (!rows.some((r) => !isNaN(r.close))) throw new Error('Stooq returned no usable quotes');
  return rows;
}

async function fetchQuotesYahoo(rawSymbols) {
  const yahooSymbols = rawSymbols.map(toYahooSymbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols.map(encodeURIComponent).join(',')}`;
  const res = await proxiedFetch(url, { direct: false });
  const data = await res.json();
  const results = data.quoteResponse?.result || [];
  const byYahooSymbol = Object.fromEntries(results.map((r) => [r.symbol, r]));
  return rawSymbols.map((raw, i) => {
    const q = byYahooSymbol[yahooSymbols[i]];
    return {
      symbol: normalizeStooqSymbol(raw).toUpperCase(),
      close: q ? q.regularMarketPrice : NaN,
      open: q ? q.regularMarketPreviousClose ?? q.regularMarketOpen : NaN,
    };
  });
}

async function fetchQuotesLive(rawSymbols) {
  try {
    return await fetchQuotesStooq(rawSymbols);
  } catch (err) {
    return fetchQuotesYahoo(rawSymbols);
  }
}

async function fetchQuotesRaw(rawSymbols) {
  // Prefer the pre-fetched snapshot (instant, no proxy) for any symbol it
  // covers; only live-fetch the ones it doesn't (e.g. a custom portfolio
  // symbol outside the default set).
  const fromSnapshot = [];
  const missing = [];
  if (snapshotFresh() && SNAPSHOT.quotes) {
    for (const s of rawSymbols) {
      const key = normalizeStooqSymbol(s).toUpperCase();
      const q = SNAPSHOT.quotes[key];
      if (q && !isNaN(q.close)) fromSnapshot.push({ symbol: key, close: q.close, open: q.open });
      else missing.push(s);
    }
  } else {
    missing.push(...rawSymbols);
  }
  if (!missing.length) return fromSnapshot;

  const key = `quotes:${[...missing].sort().join(',')}`;
  try {
    const live = await withCache(key, 60 * 1000, () => fetchQuotesLive(missing));
    return [...fromSnapshot, ...live];
  } catch (err) {
    // A failed live top-up shouldn't discard quotes we already have cached.
    if (fromSnapshot.length) return fromSnapshot;
    throw err;
  }
}

async function fetchQuotes(symbols) {
  const rows = await fetchQuotesRaw(symbols);
  return rows.map((r) => ({ ...r, symbol: r.symbol.replace(/\.US$/i, '') }));
}

async function fetchSparkline(rawSymbol) {
  if (snapshotFresh() && SNAPSHOT.sparklines) {
    const key = normalizeStooqSymbol(rawSymbol).toUpperCase();
    const cached = SNAPSHOT.sparklines[key] || SNAPSHOT.sparklines[rawSymbol.toUpperCase()];
    if (cached && cached.length) return cached;
  }
  return withCache(`spark:${rawSymbol}`, 15 * 60 * 1000, async () => {
    try {
      const sym = normalizeStooqSymbol(rawSymbol);
      const url = `https://stooq.com/q/d/l/?s=${sym}&i=d`;
      const res = await proxiedFetch(url, { direct: false });
      const csv = await res.text();
      const lines = csv.trim().split('\n');
      const values = lines
        .slice(1)
        .slice(-25)
        .map((line) => parseFloat(line.split(',')[4]))
        .filter((n) => !isNaN(n));
      if (!values.length) throw new Error('Stooq returned no history');
      return values;
    } catch {
      // Same Stooq-blocking issue as quotes — fall back to Yahoo's chart API.
      const ysym = toYahooSymbol(rawSymbol);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?range=1mo&interval=1d`;
      const res = await proxiedFetch(url, { direct: false });
      const data = await res.json();
      const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      return closes.filter((n) => n != null).slice(-25);
    }
  });
}

function sparklineSVG(values, cls) {
  if (!values || values.length < 2) return '';
  const w = 72;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(' ');
  return `<svg class="sparkline ${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>`;
}

// ---------------------------------------------------------------------------
// Wikipedia trending — Wikimedia's REST pageviews API is free, keyless,
// and CORS-enabled, so it's fetched directly (no proxy needed).
// ---------------------------------------------------------------------------
async function fetchWikiTrending() {
  if (snapshotFresh() && SNAPSHOT.wikiTrending?.length) return SNAPSHOT.wikiTrending;
  return withCache('wiki-trending', 30 * 60 * 1000, async () => {
    // Top-articles data for "today" usually isn't published yet; use yesterday.
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${day}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
    const data = await res.json();
    const articles = data.items?.[0]?.articles || [];
    const skip = new Set(['Main_Page', 'Special:Search', 'Special:SpecialPages']);
    return articles
      .filter((a) => !skip.has(a.article) && !a.article.startsWith('Special:'))
      .slice(0, 15)
      .map((a) => ({
        title: a.article.replace(/_/g, ' '),
        views: a.views,
        link: `https://en.wikipedia.org/wiki/${a.article}`,
      }));
  });
}

// ---------------------------------------------------------------------------
// US Treasury daily par yield curve — free, keyless, no CORS headers so
// routed through the proxy chain.
// ---------------------------------------------------------------------------
async function fetchTreasuryYields() {
  if (snapshotFresh() && SNAPSHOT.treasury?.rates?.length) return SNAPSHOT.treasury;
  return withCache('treasury-yields', 60 * 60 * 1000, async () => {
    const year = new Date().getFullYear();
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
    const res = await proxiedFetch(url, { direct: false });
    const csv = await res.text();
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return { date: null, rates: [] };
    const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    // Treasury's CSV isn't guaranteed ascending or descending — pick the
    // row with the latest actual date instead of assuming first/last.
    const dataRows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim().replace(/"/g, '')));
    const latestRow = dataRows.reduce((best, row) => {
      const d = new Date(row[0]);
      return !isNaN(d) && (!best || d > new Date(best[0])) ? row : best;
    }, null);
    if (!latestRow) return { date: null, rates: [] };
    const rates = header.slice(1).map((label, i) => ({ label, value: parseFloat(latestRow[i + 1]) })).filter((r) => !isNaN(r.value));
    return { date: latestRow[0], rates };
  });
}

// ---------------------------------------------------------------------------
// USGS earthquakes — free, keyless, CORS-enabled GeoJSON feed.
// ---------------------------------------------------------------------------
async function fetchEarthquakes() {
  if (snapshotFresh() && SNAPSHOT.earthquakes?.length) return SNAPSHOT.earthquakes;
  return withCache('earthquakes', 5 * 60 * 1000, async () => {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const data = await res.json();
    return (data.features || [])
      .sort((a, b) => b.properties.time - a.properties.time)
      .slice(0, 20)
      .map((f) => ({
        place: f.properties.place,
        mag: f.properties.mag,
        time: f.properties.time,
        link: f.properties.url,
        lon: f.geometry?.coordinates?.[0],
        lat: f.geometry?.coordinates?.[1],
      }));
  });
}

// ---------------------------------------------------------------------------
// Local weather alerts by ZIP code — Zippopotam.us (free, keyless zip ->
// lat/lon geocoder) feeding the National Weather Service's free, keyless,
// CORS-enabled active-alerts API. NWS only covers US locations.
// ---------------------------------------------------------------------------
async function geocodeZip(zip) {
  return withCache(`geocode:${zip}`, 24 * 60 * 60 * 1000, async () => {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('ZIP not found');
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) throw new Error('ZIP not found');
    return {
      label: `${place['place name']}, ${place['state abbreviation']}`,
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
    };
  });
}

async function fetchLocalAlerts(zip) {
  const loc = await geocodeZip(zip);
  return withCache(`alerts:${zip}`, 3 * 60 * 1000, async () => {
    const url = `https://api.weather.gov/alerts/active?point=${loc.lat},${loc.lon}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(`NWS ${res.status}`);
    const data = await res.json();
    const alerts = (data.features || []).map((f) => ({
      event: f.properties.event,
      headline: f.properties.headline,
      severity: f.properties.severity,
      areaDesc: f.properties.areaDesc,
      link: `https://alerts.weather.gov/search?zone=${f.properties.geocode?.SAME?.[0] || ''}`,
    }));
    return { location: loc.label, alerts };
  });
}

// ---------------------------------------------------------------------------
// Nationwide US weather alerts map — same free NWS API as Local Alerts, but
// unscoped (no ZIP/point) so it covers the whole country, with polygon
// geometry plotted on a Leaflet map where NWS provides it.
// ---------------------------------------------------------------------------
async function fetchNationalAlerts() {
  if (snapshotFresh() && SNAPSHOT.nationalAlerts?.length) return SNAPSHOT.nationalAlerts;
  return withCache('national-alerts', 5 * 60 * 1000, async () => {
    const url = 'https://api.weather.gov/alerts/active?severity=Extreme,Severe';
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`NWS ${res.status}`);
    const data = await res.json();
    return (data.features || []).slice(0, 40).map((f) => ({
      event: f.properties.event,
      severity: f.properties.severity,
      areaDesc: f.properties.areaDesc,
      link: `https://alerts.weather.gov/search?id=${f.properties.id || ''}`,
      // NWS gives a polygon in most cases; approximate with its centroid for the map marker.
      centroid: polygonCentroid(f.geometry),
    }));
  });
}

function polygonCentroid(geometry) {
  if (!geometry) return null;
  const coords = geometry.type === 'Polygon' ? geometry.coordinates?.[0] : geometry.type === 'Point' ? [geometry.coordinates] : null;
  if (!coords || !coords.length) return null;
  const [sumLon, sumLat] = coords.reduce(([lo, la], [lon, lat]) => [lo + lon, la + lat], [0, 0]);
  return { lon: sumLon / coords.length, lat: sumLat / coords.length };
}

// ---------------------------------------------------------------------------
// Service status — free, keyless Statuspage.io (Atlassian) v2 summary API,
// used by hundreds of companies in an identical JSON shape.
// ---------------------------------------------------------------------------
async function fetchServiceStatus() {
  if (snapshotFresh() && SNAPSHOT.serviceStatus?.length) return SNAPSHOT.serviceStatus;
  const results = await Promise.allSettled(
    STATUS_SERVICES.map((s) =>
      withCache(`status:${s.name}`, 2 * 60 * 1000, async () => {
        const res = await fetch(s.url, { cache: 'no-store', signal: AbortSignal.timeout(7000) });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        return { name: s.name, indicator: data.status?.indicator || 'unknown', description: data.status?.description || 'Unknown' };
      })
    )
  );
  return STATUS_SERVICES.map((s, i) => (results[i].status === 'fulfilled' ? results[i].value : { name: s.name, indicator: null, description: null }));
}

// ---------------------------------------------------------------------------
// Big Movers — today's (or the last available session's, when markets are
// closed) biggest gainers/losers, computed from quotes we already fetch.
// No dedicated "movers" API needed — Stooq/Yahoo quotes naturally show the
// last available close on weekends, so this just works then too.
// ---------------------------------------------------------------------------
async function fetchMovers() {
  const rows = await fetchQuotesRaw(MOVERS_UNIVERSE);
  const bySymbol = Object.fromEntries(rows.map((r) => [r.symbol, r]));
  const withChange = MOVERS_UNIVERSE.map((sym) => {
    const q = bySymbol[normalizeStooqSymbol(sym).toUpperCase()];
    if (!q || isNaN(q.close) || isNaN(q.open) || !q.open) return null;
    const pct = ((q.close - q.open) / q.open) * 100;
    return { symbol: sym, close: q.close, pct };
  }).filter(Boolean);
  const gainers = [...withChange].sort((a, b) => b.pct - a.pct).slice(0, 5);
  const losers = [...withChange].sort((a, b) => a.pct - b.pct).slice(0, 5);
  return { gainers, losers };
}

// ---------------------------------------------------------------------------
// Global Disasters — NASA EONET (Earth Observatory Natural Event Tracker),
// free/keyless. Replaces ReliefWeb, whose v1 API started returning 410 Gone.
// EONET also carries per-event lat/lon, so this widget gets a real map.
// ---------------------------------------------------------------------------
async function fetchGlobalDisasters() {
  if (snapshotFresh() && SNAPSHOT.globalDisasters?.length) return SNAPSHOT.globalDisasters;
  return withCache('global-disasters', 15 * 60 * 1000, async () => {
    const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25';
    const res = await proxiedFetch(url, { direct: true });
    const data = await res.json();
    return (data.events || []).map((e) => {
      const geom = e.geometry?.[e.geometry.length - 1];
      const coords = geom?.type === 'Point' ? geom.coordinates : geom?.coordinates?.[0]?.[0];
      return {
        name: e.title,
        type: (e.categories || []).map((c) => c.title).join(', '),
        date: geom?.date,
        url: e.sources?.[0]?.url || `https://eonet.gsfc.nasa.gov/api/v3/events/${e.id}`,
        centroid: Array.isArray(coords) ? { lon: coords[0], lat: coords[1] } : null,
      };
    });
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const grid = document.getElementById('widgetGrid');

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function widgetTitle(widget) {
  if (widget.type === 'feed-bundle') return FEED_BUNDLES[widget.config.bundle]?.label || 'Feed';
  if (widget.type === 'feed-custom') return widget.config.name || 'Custom Feed';
  if (widget.type === 'polymarket') return widget.config.category ? `Polymarket · ${widget.config.category}` : 'Polymarket · All';
  if (widget.type === 'portfolio') return 'Stock Portfolio';
  if (widget.type === 'markets-overview') return 'Markets Overview';
  if (widget.type === 'wiki-trending') return 'Trending on Wikipedia';
  if (widget.type === 'bonds') return 'Treasury Yields';
  if (widget.type === 'earthquakes') return 'Significant Earthquakes';
  if (widget.type === 'local-alerts') return 'Local Weather Alerts';
  if (widget.type === 'disaster-map') return 'Global Disasters';
  if (widget.type === 'us-alerts-map') return 'US Weather Alerts Map';
  if (widget.type === 'service-status') return 'Service Status';
  if (widget.type === 'cryptrack') return 'CrypTrack';
  if (widget.type === 'movers') return 'Big Movers';
  return 'Widget';
}

function widgetIcon(widget) {
  return {
    'feed-bundle': '📰',
    'feed-custom': '📡',
    polymarket: '📊',
    portfolio: '💼',
    'markets-overview': '📈',
    'wiki-trending': '📚',
    bonds: '🏛️',
    earthquakes: '🌎',
    'local-alerts': '🚨',
    'disaster-map': '🌍',
    'us-alerts-map': '⚠️',
    'service-status': '🟢',
    cryptrack: '🛸',
    movers: '🚀',
  }[widget.type] || '▫';
}

function getWidgetCategory(widget) {
  if (widget.type === 'feed-bundle' && BUNDLE_CATEGORY_OVERRIDES[widget.config.bundle]) {
    return BUNDLE_CATEGORY_OVERRIDES[widget.config.bundle];
  }
  return WIDGET_CATEGORIES[widget.type] || 'other';
}

function renderGrid() {
  grid.innerHTML = '';
  state.widgets.forEach((widget, i) => grid.appendChild(renderWidget(widget, i)));
  initSidebar();
  applyCategoryFilter();
}

function renderWidget(widget, index = 0) {
  const el = document.createElement('section');
  el.className = 'widget';
  el.draggable = true;
  el.dataset.id = widget.id;
  el.dataset.category = getWidgetCategory(widget);

  if (widget.wide) el.classList.add('wide');

  el.innerHTML = `
    <div class="widget-header">
      <h3>${widgetIcon(widget)} ${escapeHtml(widgetTitle(widget))}</h3>
      <div class="controls">
        <button class="wide-btn${widget.wide ? ' active' : ''}" title="Toggle double-width">⬌</button>
        <button class="focus-btn" title="Focus — view all">⤢</button>
        <button class="refresh-btn" title="Refresh">⟳</button>
        <button class="remove-btn" title="Remove">✕</button>
      </div>
    </div>
    <div class="widget-body"><div class="loading-state">Loading…</div></div>
  `;

  el.querySelector('.remove-btn').addEventListener('click', () => {
    state.widgets = state.widgets.filter((w) => w.id !== widget.id);
    saveState();
    renderGrid();
  });
  el.querySelector('.refresh-btn').addEventListener('click', () => loadWidgetData(widget, el));
  el.querySelector('.focus-btn').addEventListener('click', () => openFocusModal(widget));
  el.querySelector('.wide-btn').addEventListener('click', (e) => {
    widget.wide = !widget.wide;
    el.classList.toggle('wide', widget.wide);
    e.currentTarget.classList.toggle('active', widget.wide);
    saveState();
  });

  el.addEventListener('dragstart', () => el.classList.add('dragging'));
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    persistOrder();
  });

  // Stagger initial loads so a big default grid doesn't fire dozens of
  // simultaneous proxy requests at once (which was a major source of lag
  // and induced proxy-side rate limiting).
  setTimeout(() => loadWidgetData(widget, el), index * 90);
  return el;
}

function persistOrder() {
  const ids = [...grid.querySelectorAll('.widget')].map((w) => w.dataset.id);
  state.widgets.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  saveState();
}

grid.addEventListener('dragover', (e) => {
  e.preventDefault();
  const dragging = grid.querySelector('.dragging');
  if (!dragging) return;
  const after = getDragAfterElement(grid, e.clientY, e.clientX);
  if (after == null) grid.appendChild(dragging);
  else grid.insertBefore(dragging, after);
});

function getDragAfterElement(container, y, x) {
  const els = [...container.querySelectorAll('.widget:not(.dragging)')];
  return els.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

// Renders a widget's content into `body`. `focus: true` (used by the Focus
// modal) requests higher item limits than the compact card view.
async function renderWidgetInto(widget, body, { focus = false } = {}) {
  const feedLimit = focus ? 20 : 5;
  const marketLimit = focus ? 50 : 15;
  const listLimit = focus ? 20 : 8;

  if (widget.type === 'feed-bundle') {
    const results = await fetchBundle(widget.config.bundle);
    body.innerHTML = '';
    let any = false;
    results.forEach((r) => {
      const group = document.createElement('div');
      group.className = 'feed-source-group';
      const h4 = document.createElement('h4');
      h4.textContent = r.name;
      group.appendChild(h4);
      if (!r.error) {
        any = true;
        if (r.items.length) {
          r.items.slice(0, feedLimit).forEach((item) => group.appendChild(renderFeedItem(item)));
        } else {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.textContent = 'No recent items';
          group.appendChild(empty);
        }
      } else {
        const err = document.createElement('div');
        err.className = 'error-state';
        err.textContent = 'Unavailable right now';
        group.appendChild(err);
      }
      body.appendChild(group);
    });
    if (!any) body.insertAdjacentHTML('afterbegin', '<div class="error-state">All sources unavailable — try refresh.</div>');
  } else if (widget.type === 'feed-custom') {
    const items = await fetchFeed(widget.config.url);
    body.innerHTML = '';
    if (!items.length) body.innerHTML = '<div class="empty-state">No items found.</div>';
    items.slice(0, feedLimit * 2).forEach((item) => body.appendChild(renderFeedItem(item)));
  } else if (widget.type === 'polymarket') {
    const markets = await fetchPolymarket(widget.config.category, marketLimit);
    body.innerHTML = '';
    if (!markets.length) body.innerHTML = '<div class="empty-state">No matching markets.</div>';
    markets.forEach((m) => body.appendChild(renderMarketItem(m)));
  } else if (widget.type === 'portfolio') {
    body.innerHTML = renderPortfolioShell();
    wirePortfolio(body);
    await refreshPortfolioQuotes(body);
  } else if (widget.type === 'markets-overview') {
    body.innerHTML = '';
    body.appendChild(await renderMarketsOverview());
  } else if (widget.type === 'wiki-trending') {
    const articles = await fetchWikiTrending();
    body.innerHTML = '';
    if (!articles.length) body.innerHTML = '<div class="empty-state">No data yet for today.</div>';
    articles.slice(0, listLimit).forEach((a, i) => {
      const div = document.createElement('div');
      div.className = 'feed-item';
      div.innerHTML = `
        <a href="${escapeAttr(a.link)}" target="_blank" rel="noopener noreferrer">#${i + 1} ${escapeHtml(a.title)}</a>
        <div class="meta">${a.views.toLocaleString()} views</div>
      `;
      body.appendChild(div);
    });
  } else if (widget.type === 'bonds') {
    const { date, rates } = await fetchTreasuryYields();
    body.innerHTML = '';
    if (!rates.length) {
      body.innerHTML = '<div class="empty-state">No yield data available.</div>';
    } else {
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.style.marginBottom = '0.5rem';
      meta.textContent = `As of ${escapeHtml(date || '')}`;
      body.appendChild(meta);
      const table = document.createElement('table');
      table.className = 'markets-table';
      table.innerHTML = `<tbody>${rates
        .map((r) => `<tr><td class="mo-name">${escapeHtml(r.label)}</td><td class="mo-price">${r.value.toFixed(2)}%</td></tr>`)
        .join('')}</tbody>`;
      body.appendChild(table);
    }
  } else if (widget.type === 'earthquakes') {
    const quakes = (await fetchEarthquakes()).slice(0, listLimit);
    body.innerHTML = '';
    if (!quakes.length) {
      body.innerHTML = '<div class="empty-state">No significant earthquakes this week.</div>';
    } else {
      const mapEl = document.createElement('div');
      mapEl.className = focus ? 'widget-map widget-map-large' : 'widget-map';
      body.appendChild(mapEl);
      initLeafletMap(mapEl, quakes.filter((q) => q.lat != null && q.lon != null).map((q) => ({
        lat: q.lat,
        lon: q.lon,
        label: `M${q.mag?.toFixed(1) ?? '?'} — ${q.place}`,
        radius: Math.max(4, (q.mag || 1) * 3),
      })));
      quakes.forEach((q) => {
        const div = document.createElement('div');
        div.className = 'feed-item';
        div.innerHTML = `
          <a href="${escapeAttr(q.link)}" target="_blank" rel="noopener noreferrer">M${q.mag?.toFixed(1) ?? '?'} — ${escapeHtml(q.place)}</a>
          <div class="meta">${escapeHtml(timeAgo(q.time))}</div>
        `;
        body.appendChild(div);
      });
    }
  } else if (widget.type === 'local-alerts') {
    body.innerHTML = renderLocalAlertsShell();
    wireLocalAlerts(body, widget);
    if (state.localZip) await refreshLocalAlerts(body, state.localZip);
  } else if (widget.type === 'disaster-map') {
    const disasters = (await fetchGlobalDisasters()).slice(0, listLimit);
    body.innerHTML = '';
    if (!disasters.length) {
      body.innerHTML = '<div class="empty-state">No active disasters reported right now.</div>';
    } else {
      const mapEl = document.createElement('div');
      mapEl.className = focus ? 'widget-map widget-map-large' : 'widget-map';
      body.appendChild(mapEl);
      initLeafletMap(
        mapEl,
        disasters
          .filter((d) => d.centroid)
          .map((d) => ({ lat: d.centroid.lat, lon: d.centroid.lon, label: `${d.name} — ${d.type}`, radius: 7 }))
      );
      disasters.forEach((d) => {
        const div = document.createElement('div');
        div.className = 'feed-item';
        div.innerHTML = `
          <a href="${escapeAttr(d.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.name || 'Untitled')}</a>
          <div class="meta">${escapeHtml(d.type || '')}</div>
        `;
        body.appendChild(div);
      });
    }
  } else if (widget.type === 'movers') {
    const { gainers, losers } = await fetchMovers();
    body.innerHTML = '';
    if (!gainers.length && !losers.length) {
      body.innerHTML = '<div class="error-state">Movers unavailable right now.</div>';
    } else {
      const section = (label, list, cls) => `
        <h4>${label}</h4>
        ${list
          .map(
            (m) => `<div class="mover-row">
              <span class="mover-symbol">${escapeHtml(m.symbol)}</span>
              <span>$${m.close.toFixed(2)}</span>
              <span class="${cls}">${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%</span>
            </div>`
          )
          .join('')}
      `;
      body.innerHTML = `
        <div class="feed-source-group">${section('🚀 Gainers', gainers, 'pos')}</div>
        <div class="feed-source-group">${section('📉 Losers', losers, 'neg')}</div>
      `;
    }
  } else if (widget.type === 'us-alerts-map') {
    const alerts = (await fetchNationalAlerts()).slice(0, listLimit);
    body.innerHTML = '';
    if (!alerts.length) {
      body.innerHTML = '<div class="empty-state">No severe/extreme alerts active right now.</div>';
    } else {
      const mapEl = document.createElement('div');
      mapEl.className = focus ? 'widget-map widget-map-large' : 'widget-map';
      body.appendChild(mapEl);
      initLeafletMap(
        mapEl,
        alerts
          .filter((a) => a.centroid)
          .map((a) => ({ lat: a.centroid.lat, lon: a.centroid.lon, label: `${a.event} — ${a.areaDesc}`, radius: 7 }))
      );
      alerts.forEach((a) => {
        const div = document.createElement('div');
        div.className = 'feed-item';
        div.innerHTML = `
          <a href="${escapeAttr(a.link)}" target="_blank" rel="noopener noreferrer">⚠️ ${escapeHtml(a.event)}</a>
          <div class="meta">${escapeHtml(a.areaDesc || '')}</div>
        `;
        body.appendChild(div);
      });
    }
  } else if (widget.type === 'service-status') {
    const statuses = await fetchServiceStatus();
    body.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'status-table';
    table.innerHTML = `<tbody>${statuses
      .map((s) => {
        const dotClass = s.indicator === 'none' ? 'ok' : s.indicator === 'minor' ? 'minor' : s.indicator ? 'major' : 'unknown';
        const label = s.description || 'Unavailable';
        return `<tr><td><span class="status-dot ${dotClass}"></span>${escapeHtml(s.name)}</td><td class="status-desc">${escapeHtml(label)}</td></tr>`;
      })
      .join('')}</tbody>`;
    body.appendChild(table);
  } else if (widget.type === 'cryptrack') {
    body.innerHTML = `
      <iframe class="${focus ? 'widget-iframe widget-iframe-large' : 'widget-iframe'}"
        src="https://ikcerog.github.io/cryptrack/" loading="lazy"
        title="CrypTrack — global cryptid sightings atlas"></iframe>
      <div class="outbound-row">
        <span class="meta">Live Bigfoot/UFO sightings map &amp; charts</span>
        <a class="btn btn-primary outbound-btn" href="https://ikcerog.github.io/cryptrack/" target="_blank" rel="noopener noreferrer">Open full site ↗</a>
      </div>
    `;
  }
}

async function loadWidgetData(widget, el) {
  const body = el.querySelector('.widget-body');
  try {
    await renderWidgetInto(widget, body, { focus: false });
  } catch (err) {
    body.innerHTML = `<div class="error-state">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

async function openFocusModal(widget) {
  document.getElementById('focusModalTitle').textContent = `${widgetIcon(widget)} ${widgetTitle(widget)}`;
  const body = document.getElementById('focusModalBody');
  body.innerHTML = '<div class="loading-state">Loading…</div>';
  openModal('focusModal');
  try {
    await renderWidgetInto(widget, body, { focus: true });
  } catch (err) {
    body.innerHTML = `<div class="error-state">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

function renderFeedItem(item) {
  const div = document.createElement('div');
  div.className = 'feed-item';
  div.innerHTML = `
    <a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
    <div class="meta">${escapeHtml(timeAgo(item.pubDate))}</div>
  `;
  return div;
}

function renderMarketItem(m) {
  const div = document.createElement('div');
  div.className = 'market-item';
  const oddsHtml = (m.outcomes || [])
    .map((o, i) => {
      const p = m.prices?.[i];
      const pct = p ? `${Math.round(parseFloat(p) * 100)}%` : '?';
      return `<span class="odds-chip">${escapeHtml(o)}: ${pct}</span>`;
    })
    .join('');
  div.innerHTML = `
    <a class="q" href="${escapeAttr(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.question)}</a>
    <div class="odds">${oddsHtml}</div>
    <div class="stats">24h volume: $${Math.round(m.volume24hr).toLocaleString()}</div>
  `;
  return div;
}

// Leaflet (loaded via CDN in index.html) + free OpenStreetMap tiles.
function initLeafletMap(container, points) {
  if (typeof L === 'undefined' || !points.length) {
    container.remove();
    return;
  }
  const map = L.map(container, { scrollWheelZoom: false, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);
  const markers = points.map((p) =>
    L.circleMarker([p.lat, p.lon], { radius: p.radius || 6, color: '#ff5c5c', fillColor: '#ff5c5c', fillOpacity: 0.6 })
      .bindTooltip(p.label)
      .addTo(map)
  );
  if (markers.length === 1) {
    map.setView([points[0].lat, points[0].lon], 5);
  } else {
    map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
  }
}

function renderLocalAlertsShell() {
  return `
    <div class="portfolio-controls">
      <input type="text" id="zipInput" placeholder="ZIP code (e.g. 48226)" maxlength="5" value="${escapeAttr(state.localZip || '')}" />
      <button class="btn btn-primary" id="zipSaveBtn">Set</button>
    </div>
    <div id="localAlertsBody">
      ${state.localZip ? '<div class="loading-state">Loading…</div>' : '<div class="empty-state">Enter a US ZIP code to see active weather alerts for your area.</div>'}
    </div>
  `;
}

function wireLocalAlerts(body, widget) {
  const input = body.querySelector('#zipInput');
  const saveBtn = body.querySelector('#zipSaveBtn');
  const save = () => {
    const zip = input.value.trim();
    if (!/^\d{5}$/.test(zip)) return;
    state.localZip = zip;
    saveState();
    refreshLocalAlerts(body, zip);
  };
  saveBtn.addEventListener('click', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });
}

async function refreshLocalAlerts(body, zip) {
  const out = body.querySelector('#localAlertsBody');
  out.innerHTML = '<div class="loading-state">Loading…</div>';
  try {
    const { location, alerts } = await fetchLocalAlerts(zip);
    if (!alerts.length) {
      out.innerHTML = `<div class="empty-state">No active alerts for ${escapeHtml(location)}.</div>`;
      return;
    }
    out.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'meta';
    label.style.marginBottom = '0.4rem';
    label.textContent = `Active alerts for ${location}`;
    out.appendChild(label);
    alerts.forEach((a) => {
      const div = document.createElement('div');
      div.className = 'feed-item';
      div.innerHTML = `
        <a href="${escapeAttr(a.link)}" target="_blank" rel="noopener noreferrer">⚠️ ${escapeHtml(a.event)}</a>
        <div class="meta">${escapeHtml(a.areaDesc || '')}</div>
      `;
      out.appendChild(div);
    });
  } catch (err) {
    out.innerHTML = `<div class="error-state">${escapeHtml(err.message)}</div>`;
  }
}

async function renderMarketsOverview() {
  const wrap = document.createElement('div');
  wrap.className = 'markets-overview';

  const groupResults = await Promise.allSettled(
    Object.entries(MARKET_GROUPS).map(async ([key, group]) => {
      const rows = await fetchQuotesRaw(group.symbols.map((s) => s.sym));
      const bySymbol = Object.fromEntries(rows.map((r) => [r.symbol, r]));
      return { key, group, bySymbol };
    })
  );

  groupResults.forEach((res) => {
    if (res.status !== 'fulfilled') return;
    const { group, bySymbol } = res.value;
    const section = document.createElement('div');
    section.className = 'mo-group';
    const table = document.createElement('table');
    table.className = 'markets-table';
    table.innerHTML = `<thead><tr><th colspan="4">${escapeHtml(group.label)}</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    group.symbols.forEach((s) => {
      const q = bySymbol[normalizeStooqSymbol(s.sym).toUpperCase()];
      const tr = document.createElement('tr');
      if (q && !isNaN(q.close)) {
        const chg = q.close - q.open;
        const pct = q.open ? (chg / q.open) * 100 : 0;
        const cls = chg >= 0 ? 'pos' : 'neg';
        const arrow = chg >= 0 ? '▲' : '▼';
        tr.innerHTML = `
          <td class="mo-name">${escapeHtml(s.name)}</td>
          <td class="mo-price">${q.close.toFixed(2)}</td>
          <td class="${cls}">${arrow} ${Math.abs(chg).toFixed(2)}</td>
          <td class="${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</td>
        `;
      } else {
        tr.innerHTML = `<td class="mo-name">${escapeHtml(s.name)}</td><td colspan="3" class="error-state">n/a</td>`;
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    section.appendChild(table);
    wrap.appendChild(section);
  });

  if (!wrap.children.length) wrap.innerHTML = '<div class="error-state">Market data unavailable right now.</div>';
  return wrap;
}

function renderPortfolioShell() {
  return `
    <div class="portfolio-controls">
      <input type="text" id="portfolioInput" placeholder="Add symbol (e.g. AAPL)" />
      <button class="btn btn-primary" id="portfolioAddBtn">Add</button>
    </div>
    <table class="portfolio-table">
      <thead><tr><th>Symbol</th><th>Price</th><th>Chg</th><th>25d</th><th></th></tr></thead>
      <tbody id="portfolioBody"><tr><td colspan="5" class="loading-state">Loading…</td></tr></tbody>
    </table>
  `;
}

function wirePortfolio(body) {
  const input = body.querySelector('#portfolioInput');
  const addBtn = body.querySelector('#portfolioAddBtn');
  const add = () => {
    const sym = input.value.trim().toUpperCase();
    if (!sym) return;
    if (!state.portfolio.includes(sym)) {
      state.portfolio.push(sym);
      saveState();
      refreshPortfolioQuotes(body);
    }
    input.value = '';
  };
  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });
}

async function refreshPortfolioQuotes(body) {
  const tbody = body.querySelector('#portfolioBody');
  if (!state.portfolio.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No symbols yet — add one above.</td></tr>';
    return;
  }
  try {
    const [quotes, sparkResults] = await Promise.all([
      fetchQuotes(state.portfolio),
      Promise.allSettled(state.portfolio.map((s) => fetchSparkline(s))),
    ]);
    const bySymbol = Object.fromEntries(quotes.map((q) => [q.symbol, q]));
    tbody.innerHTML = '';
    state.portfolio.forEach((sym, idx) => {
      const q = bySymbol[sym];
      const spark = sparkResults[idx]?.status === 'fulfilled' ? sparkResults[idx].value : [];
      const tr = document.createElement('tr');
      if (q && !isNaN(q.close)) {
        const chg = q.close - q.open;
        const pct = q.open ? (chg / q.open) * 100 : 0;
        const cls = chg >= 0 ? 'pos' : 'neg';
        tr.innerHTML = `
          <td>${escapeHtml(sym)}</td>
          <td>$${q.close.toFixed(2)}</td>
          <td class="${cls}">${chg >= 0 ? '+' : ''}${pct.toFixed(2)}%</td>
          <td>${sparklineSVG(spark, cls)}</td>
          <td><button class="remove-symbol" data-sym="${escapeAttr(sym)}">✕</button></td>
        `;
      } else {
        tr.innerHTML = `
          <td>${escapeHtml(sym)}</td>
          <td colspan="3" class="error-state">n/a</td>
          <td><button class="remove-symbol" data-sym="${escapeAttr(sym)}">✕</button></td>
        `;
      }
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.remove-symbol').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.portfolio = state.portfolio.filter((s) => s !== btn.dataset.sym);
        saveState();
        refreshPortfolioQuotes(body);
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-state">Quotes unavailable: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------
async function loadTicker() {
  const track = document.getElementById('tickerTrack');
  try {
    const bundles = ['tier1', 'breaking'];
    const allItems = [];
    for (const b of bundles) {
      const results = (await fetchBundle(b)).slice(0, 4);
      results.forEach((r) => {
        if (!r.error) r.items.slice(0, 3).forEach((item) => allItems.push({ ...item, tag: r.name }));
      });
    }
    if (!allItems.length) {
      track.textContent = 'Headlines unavailable right now — check back soon.';
      return;
    }
    track.innerHTML = allItems
      .map(
        (item) =>
          `<a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer"><span class="tag">${escapeHtml(item.tag)}</span>${escapeHtml(item.title)}</a>`
      )
      .join('');
  } catch (err) {
    track.textContent = 'Headlines unavailable right now — check back soon.';
  }
}

async function loadSecondaryTicker() {
  const track = document.getElementById('tickerTrack2');
  try {
    const allSymbols = Object.values(MARKET_GROUPS).flatMap((g) => g.symbols);
    const rows = await fetchQuotesRaw(allSymbols.map((s) => s.sym));
    const bySymbol = Object.fromEntries(rows.map((r) => [r.symbol, r]));
    const items = allSymbols
      .map((s) => {
        const q = bySymbol[normalizeStooqSymbol(s.sym).toUpperCase()];
        if (!q || isNaN(q.close)) return null;
        const chg = q.close - q.open;
        const pct = q.open ? (chg / q.open) * 100 : 0;
        const cls = chg >= 0 ? 'pos' : 'neg';
        const arrow = chg >= 0 ? '▲' : '▼';
        return `<span class="tag">${escapeHtml(s.name)}</span><span class="${cls}">${q.close.toFixed(2)} ${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>`;
      })
      .filter(Boolean);
    if (!items.length) {
      track.textContent = 'Market data unavailable right now.';
      return;
    }
    track.innerHTML = items.map((html) => `<span style="margin-right:2.5rem;display:inline-block;">${html}</span>`).join('');
  } catch (err) {
    track.textContent = 'Market data unavailable right now.';
  }
}

function applyTickerSpeed() {
  const seconds = state.tickerSpeed || 60;
  document.getElementById('tickerTrack').style.animationDuration = `${seconds}s`;
  document.getElementById('tickerTrack2').style.animationDuration = `${seconds * 1.3}s`;
}
document.getElementById('tickerSlower').addEventListener('click', () => {
  state.tickerSpeed = Math.min(150, (state.tickerSpeed || 60) + 15);
  saveState();
  applyTickerSpeed();
});
document.getElementById('tickerFaster').addEventListener('click', () => {
  state.tickerSpeed = Math.max(20, (state.tickerSpeed || 60) - 15);
  saveState();
  applyTickerSpeed();
});

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
document.querySelectorAll('.modal-close').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.add('hidden');
  });
});

document.getElementById('versionChip').addEventListener('click', () => {
  const body = document.getElementById('patchNotesBody');
  body.innerHTML = PATCH_NOTES.map(
    (p) => `
    <div class="patch-entry">
      <span class="ver">v${p.version}</span><span class="date">${p.date}</span>
      <ul>${p.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
    </div>`
  ).join('');
  openModal('patchNotesModal');
});

// Add widget modal
const widgetTypeSelect = document.getElementById('widgetTypeSelect');
const fieldGroups = {
  'feed-bundle': document.getElementById('bundleFields'),
  'feed-custom': document.getElementById('customFields'),
  polymarket: document.getElementById('polymarketFields'),
  portfolio: document.getElementById('portfolioFields'),
};
function updateFieldVisibility() {
  Object.entries(fieldGroups).forEach(([type, elx]) => {
    elx.classList.toggle('hidden', type !== widgetTypeSelect.value);
  });
}
widgetTypeSelect.addEventListener('change', updateFieldVisibility);
updateFieldVisibility();

document.getElementById('addWidgetBtn').addEventListener('click', () => openModal('addWidgetModal'));

document.getElementById('confirmAddWidget').addEventListener('click', () => {
  const type = widgetTypeSelect.value;
  let config = {};
  if (type === 'feed-bundle') {
    config = { bundle: document.getElementById('bundleSelect').value };
  } else if (type === 'feed-custom') {
    const name = document.getElementById('customName').value.trim() || 'Custom Feed';
    const url = document.getElementById('customUrl').value.trim();
    if (!url) return;
    config = { name, url };
  } else if (type === 'polymarket') {
    config = { category: document.getElementById('polyCategory').value.trim() };
  } else if (type === 'portfolio') {
    const syms = document
      .getElementById('portfolioSymbols')
      .value.split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (syms.length) state.portfolio = [...new Set([...state.portfolio, ...syms])];
  }
  state.widgets.push({ id: uid(), type, config });
  saveState();
  renderGrid();
  closeModal('addWidgetModal');
});

// ---------------------------------------------------------------------------
// Left-rail modules sidebar — filters the widget grid by category.
// ---------------------------------------------------------------------------
let activeCategory = 'all';

function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const counts = {};
  state.widgets.forEach((w) => {
    const cat = getWidgetCategory(w);
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const cats = ['all', ...Object.keys(CATEGORY_LABELS).filter((c) => counts[c])];
  const toggleHtml = `<button id="sidebarToggleBtn" class="sidebar-toggle-btn" title="${state.sidebarCollapsed ? 'Show sidebar' : 'Collapse sidebar'}" aria-label="Toggle sidebar">${state.sidebarCollapsed ? '⇥' : '⇤'}</button>`;
  const catsHtml = cats
    .map((c) => {
      const label = c === 'all' ? 'All Widgets' : CATEGORY_LABELS[c];
      const count = c === 'all' ? state.widgets.length : counts[c];
      return `<button class="sidebar-btn${c === activeCategory ? ' active' : ''}" data-cat="${c}">${escapeHtml(label)}<span class="count">${count}</span></button>`;
    })
    .join('');
  sidebar.innerHTML = toggleHtml + catsHtml;
  sidebar.querySelectorAll('.sidebar-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      initSidebar();
      applyCategoryFilter();
    });
  });
  sidebar.querySelector('#sidebarToggleBtn').addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    saveState();
    applySidebarCollapsed();
  });
}

function applyCategoryFilter() {
  document.querySelectorAll('.widget').forEach((el) => {
    const matches = activeCategory === 'all' || el.dataset.category === activeCategory;
    el.classList.toggle('category-hidden', !matches);
  });
}

// ---------------------------------------------------------------------------
// Live search filter — filters already-rendered items across all widgets
// as you type, no network requests involved.
// ---------------------------------------------------------------------------
document.getElementById('globalSearch').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.feed-item, .market-item').forEach((el) => {
    const matches = !q || el.textContent.toLowerCase().includes(q);
    el.classList.toggle('search-hidden', !matches);
  });
  document.querySelectorAll('.feed-source-group').forEach((group) => {
    if (!q) {
      group.classList.remove('search-hidden');
      return;
    }
    const anyVisible = [...group.querySelectorAll('.feed-item')].some((el) => !el.classList.contains('search-hidden'));
    group.classList.toggle('search-hidden', !anyVisible);
  });
});

// ---------------------------------------------------------------------------
// Trending Topics — pure client-side word-frequency analysis over whatever
// headlines/markets are currently loaded across all widgets. No API, no
// network call; it's just counting words already on the page. Clicking a
// chip feeds it into the existing search filter.
// ---------------------------------------------------------------------------
const TRENDING_STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'in', 'on', 'and', 'for', 'is', 'are', 'was',
  'were', 'with', 'at', 'by', 'from', 'as', 'that', 'this', 'it', 'its', 'be',
  'has', 'have', 'had', 'will', 'would', 'can', 'could', 'after', 'before',
  'over', 'under', 'says', 'say', 'said', 'new', 'who', 'what', 'when',
  'where', 'why', 'how', 'but', 'not', 'you', 'your', 'our', 'their', 'his',
  'her', 'they', 'them', 'we', 'if', 'than', 'then', 'more', 'most', 'some',
  'all', 'one', 'two', 'three', 'now', 'still', 'also', 'just', 'like',
  'get', 'gets', 'got', 'into', 'out', 'off', 'about', 'amid', 'per', 'via',
  'vs', 'game', 'day', 'week', 'first', 'top', 'best', 'here', 'there',
]);

function extractTrendingTopics(limit = 15) {
  const texts = [
    ...document.querySelectorAll('.feed-item a'),
    ...document.querySelectorAll('.market-item .q'),
  ].map((el) => el.textContent || '');
  const counts = new Map();
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    const seenInThisHeadline = new Set();
    for (const w of words) {
      if (w.length < 3 || TRENDING_STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
      if (seenInThisHeadline.has(w)) continue; // one repetitive title shouldn't dominate
      seenInThisHeadline.add(w);
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function updateTrendingTopics() {
  const container = document.getElementById('trendingTopicsChips');
  if (!container) return;
  const topics = extractTrendingTopics();
  if (!topics.length) {
    container.innerHTML = '<span class="meta">Not enough loaded yet…</span>';
    return;
  }
  container.innerHTML = topics
    .map(([word, count]) => `<button class="trend-chip" data-word="${escapeAttr(word)}">${escapeHtml(word)}<span class="trend-count">${count}</span></button>`)
    .join('');
  container.querySelectorAll('.trend-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const search = document.getElementById('globalSearch');
      search.value = btn.dataset.word;
      search.dispatchEvent(new Event('input'));
      search.focus();
    });
  });
}

// ---------------------------------------------------------------------------
// Scroll to top
// ---------------------------------------------------------------------------
const scrollTopBtn = document.getElementById('scrollTopBtn');
const headerEl = document.querySelector('.app-header');
window.addEventListener(
  'scroll',
  () => {
    const threshold = (headerEl?.offsetHeight || 60) + 40;
    scrollTopBtn.classList.toggle('visible', window.scrollY > threshold);
  },
  { passive: true }
);
scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ---------------------------------------------------------------------------
// Load time chip — how long this page took to load, next to the version
// chip. Click it for a breakdown (TTFB, first paint, transfer size, host).
// ---------------------------------------------------------------------------
let loadMetrics = null;

function computeLoadMetrics() {
  const nav = performance.getEntriesByType('navigation')[0];
  const paints = performance.getEntriesByType('paint');
  const fcp = paints.find((p) => p.name === 'first-contentful-paint');
  const resources = performance.getEntriesByType('resource');
  // transferSize is 0 for any cross-origin resource without a
  // Timing-Allow-Origin header (fonts.googleapis.com, unpkg.com, etc.) —
  // this total is a floor, not exact, for anything not same-origin.
  const transferBytes =
    (nav?.transferSize || 0) + resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  return {
    total: (nav ? nav.loadEventEnd : performance.now()) / 1000,
    ttfb: nav ? Math.max(0, nav.responseStart - nav.startTime) / 1000 : null,
    fcp: fcp ? fcp.startTime / 1000 : null,
    transferKB: transferBytes / 1024,
    resourceCount: resources.length + (nav ? 1 : 0),
  };
}

window.addEventListener('load', () => {
  const chip = document.getElementById('loadTimeChip');
  if (!chip) return;
  loadMetrics = computeLoadMetrics();
  chip.textContent = `⏱ ${loadMetrics.total.toFixed(2)}s`;
});

const loadTimeChip = document.getElementById('loadTimeChip');
const loadTimeTooltip = document.getElementById('loadTimeTooltip');
loadTimeChip?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!loadTimeTooltip.classList.contains('hidden')) {
    loadTimeTooltip.classList.add('hidden');
    return;
  }
  const m = loadMetrics || computeLoadMetrics();
  const fmt = (v) => (v == null ? '—' : `${v.toFixed(2)}s`);
  loadTimeTooltip.innerHTML = `
    <div class="loadtime-row"><span>Time to first byte</span><b>${fmt(m.ttfb)}</b></div>
    <div class="loadtime-row"><span>First contentful paint</span><b>${fmt(m.fcp)}</b></div>
    <div class="loadtime-row"><span>Full load</span><b>${fmt(m.total)}</b></div>
    <div class="loadtime-row"><span>Transferred</span><b>${m.transferKB.toFixed(0)} KB · ${m.resourceCount} requests</b></div>
    <div class="loadtime-row"><span>Hosted on</span><b>GitHub Pages</b></div>
  `;
  loadTimeTooltip.classList.remove('hidden');
});
document.addEventListener('click', (e) => {
  if (loadTimeTooltip && !loadTimeTooltip.classList.contains('hidden') && !loadTimeTooltip.contains(e.target)) {
    loadTimeTooltip.classList.add('hidden');
  }
});

// ---------------------------------------------------------------------------
// Scroll lock — freezes each widget's internal scroll so a touch drag always
// scrolls the page (mobile: widget lists otherwise steal the swipe).
// ---------------------------------------------------------------------------
const scrollLockBtn = document.getElementById('scrollLockBtn');
function applyScrollLock() {
  document.body.classList.toggle('widgets-locked', !!state.widgetsLocked);
  scrollLockBtn.classList.toggle('active', !!state.widgetsLocked);
  scrollLockBtn.textContent = state.widgetsLocked ? '🔒' : '🔓';
  scrollLockBtn.title = state.widgetsLocked ? 'Unlock widget scrolling' : 'Lock widget scrolling (page-only scroll)';
}
scrollLockBtn.addEventListener('click', () => {
  state.widgetsLocked = !state.widgetsLocked;
  saveState();
  applyScrollLock();
});
applyScrollLock();

// ---------------------------------------------------------------------------
// Sidebar collapse (desktop) — the toggle button itself lives inside
// initSidebar() (rebuilt with the rest of the sidebar), so this only
// touches the body-level class and refreshes whichever button is current.
// ---------------------------------------------------------------------------
function applySidebarCollapsed() {
  document.body.classList.toggle('sidebar-collapsed', !!state.sidebarCollapsed);
  const btn = document.getElementById('sidebarToggleBtn');
  if (btn) {
    btn.textContent = state.sidebarCollapsed ? '⇥' : '⇤';
    btn.title = state.sidebarCollapsed ? 'Show sidebar' : 'Collapse sidebar';
  }
}
applySidebarCollapsed();

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeToggle').textContent = state.theme === 'dark' ? '🌙' : '☀️';
}
document.getElementById('themeToggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  saveState();
  applyTheme();
});

// ---------------------------------------------------------------------------
// Mobile hamburger menu
// ---------------------------------------------------------------------------
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const headerControls = document.getElementById('headerControls');
mobileMenuBtn.addEventListener('click', () => {
  const open = headerControls.classList.toggle('open');
  mobileMenuBtn.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', (e) => {
  if (!headerControls.classList.contains('open')) return;
  if (headerControls.contains(e.target) || mobileMenuBtn.contains(e.target)) return;
  headerControls.classList.remove('open');
  mobileMenuBtn.setAttribute('aria-expanded', 'false');
});

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
applyTheme();
applyTickerSpeed();

(async () => {
  // Load the snapshot before rendering anything that depends on it — once
  // this resolves, every fetch* function above transparently prefers the
  // cached snapshot data over a live proxied fetch.
  await loadSnapshot();
  renderGrid();
  loadTicker();
  loadSecondaryTicker();
  setTimeout(updateTrendingTopics, 4000); // give widgets a moment to populate
})();

setInterval(loadTicker, 5 * 60 * 1000);
setInterval(loadSecondaryTicker, 2 * 60 * 1000);
setInterval(loadSnapshot, 10 * 60 * 1000);
setInterval(updateTrendingTopics, 60 * 1000);
