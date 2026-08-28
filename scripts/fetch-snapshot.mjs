// Fetches everything NewsDash displays and writes a single JSON snapshot to
// public/data/snapshot.json. Runs server-side (GitHub Actions), so there's
// no CORS/proxy involved at all — this is the "free database" backstop:
// git + a scheduled Action, instead of a live client-side fetch on every
// page load. The static site reads this file directly (same-origin,
// instant) and only falls back to live client-side fetches for things the
// snapshot can't anticipate (custom feed URLs, arbitrary portfolio symbols).
import Parser from 'rss-parser';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEED_BUNDLES, MARKET_GROUPS, DEFAULT_PORTFOLIO, EXTRA_SNAPSHOT_SYMBOLS, STATUS_SERVICES, YOUTUBE_CHANNELS, normalizeStooqSymbol, toYahooSymbol } from '../public/shared-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../public/data/snapshot.json');

// Swapping this to a browser UA was tried and reverted: it didn't fix
// Reddit's 403s (see fetchFeedItems below) and broke WDWNT, which had been
// working fine with this bot-identifying UA. Keep it as-is for everything
// except Reddit.
const parser = new Parser({
  timeout: 12000,
  headers: { 'User-Agent': 'NewsDash-Snapshot/1.0 (+https://github.com/ikcerog/NewsDash)' },
});

async function safe(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[warn] ${label}: ${err.message}`);
    return null;
  }
}

// rss-parser's own `timeout` option doesn't reliably cover every hang case
// (e.g. a server that accepts the connection but drips data forever without
// closing it) — this is a hard backstop so a single bad feed can never stall
// the whole run indefinitely, regardless of what the library does internally.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Not every feed reliably returns items in reverse-chronological order —
// direct site RSS sometimes mixes in "most read"/pinned items ahead of
// newer ones. Sort explicitly so the client always shows newest-first
// regardless of source order (mirrors sortFeedItemsByDate in app.js).
function sortFeedItemsByDate(items) {
  return [...items].sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : NaN;
    const tb = b.pubDate ? Date.parse(b.pubDate) : NaN;
    return (isNaN(tb) ? -Infinity : tb) - (isNaN(ta) ? -Infinity : ta);
  });
}

function mapFeedItems(feed) {
  const items = (feed.items || []).map((it) => ({
    title: it.title || '(untitled)',
    link: it.link || '#',
    pubDate: it.pubDate || it.isoDate || null,
  }));
  return sortFeedItemsByDate(items).slice(0, 25); // mirrors FEED_ITEM_FETCH_CAP in app.js
}

// Hitting the free codetabs proxy with several concurrent reddit fallback
// requests at once got it 503ing/timing out (observed in production).
// Full serialization plus a retry-with-backoff (tried and reverted) made a
// run hang well past its own timeout budgets — a hard outer withTimeout
// races via setTimeout so it should never do that, but it did, so keep this
// simple instead: a small concurrency cap (2 at a time), single attempt, no
// retry. A feed that still misses just comes back empty for this cycle;
// the 20-minute cron picks it up again next time.
const REDDIT_PROXY_CONCURRENCY = 2;
let activeReddit = 0;
const redditWaiters = [];
function acquireRedditSlot() {
  if (activeReddit < REDDIT_PROXY_CONCURRENCY) {
    activeReddit++;
    return Promise.resolve();
  }
  return new Promise((resolve) => redditWaiters.push(resolve)).then(() => {
    activeReddit++;
  });
}
function releaseRedditSlot() {
  activeReddit--;
  const next = redditWaiters.shift();
  if (next) next();
}

async function fetchViaRedditProxy(url) {
  await acquireRedditSlot();
  try {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`reddit proxy ${res.status}`);
    return mapFeedItems(await parser.parseString(await res.text()));
  } finally {
    releaseRedditSlot();
  }
}

// Some Reddit subs (not all — r/news works fine direct) 403/429 direct
// requests from GitHub Actions' shared IP ranges, independent of host or
// User-Agent. Try direct first (fast, and most subs are fine) and only
// fall back to the client's CORS proxy when blocked — routing everything
// through the proxy unconditionally turned out to add enough latency that
// even the previously-fine subs started timing out under concurrent load.
async function fetchRedditItems(url) {
  try {
    return mapFeedItems(await parser.parseURL(url));
  } catch (err) {
    if (!/status code (403|429)/i.test(err.message)) throw err;
    return fetchViaRedditProxy(url);
  }
}

async function fetchFeedItems(url) {
  // Reddit feeds needing the proxy fallback share a small concurrency cap
  // (see acquireRedditSlot above), so a feed waiting for a slot needs a
  // bit more room than a normal single-feed budget, but it's bounded —
  // at most 2 feeds deep in the queue ahead of it, ~10s each.
  const feed = url.includes('reddit.com')
    ? await withTimeout(fetchRedditItems(url), 35000, 'parseURL')
    : mapFeedItems(await withTimeout(parser.parseURL(url), 15000, 'parseURL'));
  return feed;
}

async function fetchAllBundles() {
  const out = {};
  // Bundles run in parallel (not just the feeds within each one) — with
  // ~10 bundles and a hard per-feed timeout, this bounds total feed-fetch
  // time to ~15s worst case instead of up to 10x that run sequentially.
  // "youtube" is excluded here — its feeds have no static url (see
  // fetchYouTubeBundle below, which resolves each channel's real feed URL
  // first) and is fetched separately, merged into the same `feeds` object.
  const bundleEntries = Object.entries(FEED_BUNDLES).filter(([key]) => key !== 'youtube');
  const bundleResults = await Promise.all(
    bundleEntries.map(async ([key, bundle]) => {
      const results = await Promise.allSettled(bundle.feeds.map((f) => fetchFeedItems(f.url)));
      const rows = bundle.feeds.map((f, i) => ({
        name: f.name,
        items: results[i].status === 'fulfilled' ? results[i].value : [],
        error: results[i].status === 'rejected' ? results[i].reason.message : null,
      }));
      console.log(`bundle ${key}: ${rows.filter((f) => !f.error).length}/${rows.length} feeds ok`);
      return [key, rows];
    })
  );
  bundleResults.forEach(([key, rows]) => (out[key] = rows));
  return out;
}

// YouTube's RSS feed only exists per numeric channel ID (videos.xml?
// channel_id=UC...), not per @handle, and there's no key-free API to
// resolve one to the other — so this fetches the channel's public "about"
// page and regexes the ID out of it (a standard, widely-used technique),
// then feeds the resulting URL through the same rss-parser pipeline as
// every other feed.
async function resolveYouTubeChannelId(handle) {
  const res = await fetch(`https://www.youtube.com/@${handle}`, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  });
  if (!res.ok) throw new Error(`channel page ${res.status}`);
  const html = await res.text();
  const match = html.match(/"channelId":"(UC[0-9A-Za-z_-]{22})"/);
  if (!match) throw new Error('channel id not found');
  return match[1];
}

async function fetchYouTubeChannel(handle) {
  const channelId = await resolveYouTubeChannelId(handle);
  const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  return mapFeedItems(feed);
}

async function fetchYouTubeBundle() {
  const results = await Promise.allSettled(
    YOUTUBE_CHANNELS.map((c) => withTimeout(fetchYouTubeChannel(c.handle), 20000, 'youtube'))
  );
  const rows = YOUTUBE_CHANNELS.map((c, i) => ({
    name: c.name,
    items: results[i].status === 'fulfilled' ? results[i].value : [],
    error: results[i].status === 'rejected' ? results[i].reason.message : null,
  }));
  console.log(`bundle youtube: ${rows.filter((f) => !f.error).length}/${rows.length} channels ok`);
  return rows;
}

async function fetchPolymarket() {
  const url = new URL('https://gamma-api.polymarket.com/markets');
  url.searchParams.set('closed', 'false');
  // Polymarket's /markets response never populates category/tags, so
  // client-side category matching relies on question text — sports/esports
  // dominate the top of the volume-sorted list, so store a much bigger
  // pool so a category like politics has real matches to search through.
  url.searchParams.set('limit', '500');
  url.searchParams.set('order', 'volume24hr');
  url.searchParams.set('ascending', 'false');
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Polymarket ${res.status}`);
  const data = await res.json();
  const markets = Array.isArray(data) ? data : data.markets || [];
  return markets.map((m) => {
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
      category: m.category || null,
      tags: m.tags || [],
      outcomes,
      prices,
    };
  });
}

async function fetchQuotesStooq(rawSymbols) {
  const stooqSymbols = rawSymbols.map(normalizeStooqSymbol).join(',');
  const url = `https://stooq.com/q/l/?s=${stooqSymbols}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  const header = lines[0].split(',');
  const rows = {};
  let any = false;
  lines.slice(1).forEach((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => (row[h.trim()] = cells[i]));
    const symbol = (row.Symbol || '').toUpperCase();
    const close = parseFloat(row.Close);
    if (!isNaN(close)) any = true;
    rows[symbol] = { close, open: parseFloat(row.Open) };
  });
  if (!any) throw new Error('Stooq returned no usable quotes');
  return rows;
}

async function fetchQuotesYahoo(rawSymbols) {
  const yahooSymbols = rawSymbols.map(toYahooSymbol);
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols.map(encodeURIComponent).join(',')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const data = await res.json();
  const results = data.quoteResponse?.result || [];
  const byYahooSymbol = Object.fromEntries(results.map((r) => [r.symbol, r]));
  const rows = {};
  rawSymbols.forEach((raw, i) => {
    const q = byYahooSymbol[yahooSymbols[i]];
    const key = normalizeStooqSymbol(raw).toUpperCase();
    rows[key] = { close: q ? q.regularMarketPrice : NaN, open: q ? q.regularMarketPreviousClose ?? q.regularMarketOpen : NaN };
  });
  return rows;
}

async function fetchQuotes(rawSymbols) {
  try {
    return await fetchQuotesStooq(rawSymbols);
  } catch {
    return fetchQuotesYahoo(rawSymbols);
  }
}

async function fetchSparklineStooq(rawSymbol) {
  const sym = normalizeStooqSymbol(rawSymbol);
  const url = `https://stooq.com/q/d/l/?s=${sym}&i=d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Stooq history ${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  const values = lines
    .slice(1)
    .slice(-25)
    .map((line) => parseFloat(line.split(',')[4]))
    .filter((n) => !isNaN(n));
  if (!values.length) throw new Error('Stooq returned no history');
  return values;
}

async function fetchSparklineYahoo(rawSymbol) {
  const ysym = toYahooSymbol(rawSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?range=1mo&interval=1d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);
  const data = await res.json();
  const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  return closes.filter((n) => n != null).slice(-25);
}

async function fetchSparkline(rawSymbol) {
  try {
    return await fetchSparklineStooq(rawSymbol);
  } catch {
    return fetchSparklineYahoo(rawSymbol);
  }
}

// Wikimedia's top-pageviews data can lag more than a day behind, so
// "yesterday" sometimes 404s — fall back to the day before that.
async function fetchWikiTrending() {
  let lastErr;
  for (const daysAgo of [1, 2]) {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${day}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
      const data = await res.json();
      const articles = data.items?.[0]?.articles || [];
      const skip = new Set(['Main_Page', 'Special:Search', 'Special:SpecialPages']);
      const trending = articles
        .filter((a) => !skip.has(a.article) && !a.article.startsWith('Special:'))
        .slice(0, 15)
        .map((a) => ({ title: a.article.replace(/_/g, ' '), views: a.views, link: `https://en.wikipedia.org/wiki/${a.article}` }));
      await attachWikidataDescriptions(trending);
      return trending;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// One-line "what is this" context from Wikidata for each trending article —
// mirrors attachWikidataDescriptions in app.js. Non-fatal: trending still
// ships without the subtitle if this fails.
async function attachWikidataDescriptions(articles) {
  if (!articles.length) return;
  try {
    const titles = articles.map((a) => a.title).join('|');
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(titles)}&props=descriptions%7Csitelinks&sitefilter=enwiki&languages=en&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return;
    const data = await res.json();
    const byTitle = new Map();
    Object.values(data.entities || {}).forEach((ent) => {
      const title = ent.sitelinks?.enwiki?.title;
      const desc = ent.descriptions?.en?.value;
      if (title && desc) byTitle.set(title, desc);
    });
    articles.forEach((a) => {
      a.description = byTitle.get(a.title) || null;
    });
  } catch {
    // descriptions are a nice-to-have, not worth failing the fetch over
  }
}

// Wikipedia's "featured content" REST API — free, keyless, CORS-enabled.
// The .image field rotates daily and surfaces a notable Wikimedia Commons
// image (often classical art, also photography/science/nature).
async function fetchWikiPOTD() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${day}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Wikipedia featured feed ${res.status}`);
  const data = await res.json();
  const img = data.image;
  if (!img) return null;
  return {
    title: img.title?.replace(/^File:/, '').replace(/\.\w+$/, '') || 'Picture of the day',
    thumb: img.thumbnail?.source || img.image?.source,
    filePage: img.file_page || img.wikipedia || 'https://commons.wikimedia.org/wiki/Main_Page',
    description: img.description?.text || '',
    artist: img.artist?.text || '',
  };
}

async function fetchTreasuryYields() {
  const year = new Date().getFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Treasury ${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { date: null, rates: [] };
  const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  // Treasury's CSV isn't guaranteed ascending or descending — pick the row
  // with the latest actual date instead of assuming first/last (their
  // year-to-date file lists newest-first, so "last line" was grabbing the
  // oldest entry in the file).
  const dataRows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim().replace(/"/g, '')));
  const latestRow = dataRows.reduce((best, row) => {
    const d = new Date(row[0]);
    return !isNaN(d) && (!best || d > new Date(best[0])) ? row : best;
  }, null);
  if (!latestRow) return { date: null, rates: [] };
  const rates = header.slice(1).map((label, i) => ({ label, value: parseFloat(latestRow[i + 1]) })).filter((r) => !isNaN(r.value));
  return { date: latestRow[0], rates };
}

async function fetchEarthquakes() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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
}

function polygonCentroid(geometry) {
  if (!geometry) return null;
  const coords = geometry.type === 'Polygon' ? geometry.coordinates?.[0] : geometry.type === 'Point' ? [geometry.coordinates] : null;
  if (!coords || !coords.length) return null;
  const [sumLon, sumLat] = coords.reduce(([lo, la], [lon, lat]) => [lo + lon, la + lat], [0, 0]);
  return { lon: sumLon / coords.length, lat: sumLat / coords.length };
}

async function fetchNationalAlerts() {
  const url = 'https://api.weather.gov/alerts/active?severity=Extreme,Severe';
  const res = await fetch(url, { headers: { Accept: 'application/geo+json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`NWS ${res.status}`);
  const data = await res.json();
  return (data.features || []).slice(0, 40).map((f) => ({
    event: f.properties.event,
    severity: f.properties.severity,
    areaDesc: f.properties.areaDesc,
    link: `https://alerts.weather.gov/search?id=${f.properties.id || ''}`,
    centroid: polygonCentroid(f.geometry),
  }));
}

async function fetchServiceStatus() {
  const results = await Promise.allSettled(
    STATUS_SERVICES.map(async (s) => {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      return { name: s.name, indicator: data.status?.indicator || 'unknown', description: data.status?.description || 'Unknown' };
    })
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.log(`[warn] service status: ${STATUS_SERVICES[i].name} — ${r.reason?.message || r.reason}`);
  });
  return STATUS_SERVICES.map((s, i) => (results[i].status === 'fulfilled' ? results[i].value : { name: s.name, indicator: null, description: null }));
}

// NASA EONET (Earth Observatory Natural Event Tracker), free/keyless.
// Replaces ReliefWeb, whose v1 API started returning 410 Gone.
async function fetchGlobalDisasters() {
  const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=25';
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`EONET ${res.status}`);
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
}

// ---------------------------------------------------------------------------
// Carry-forward: a single flaky cycle (a proxy hiccup, a source
// rate-limiting the runner's IP, a transient timeout) shouldn't blank out a
// widget that had perfectly good data 20-30 minutes ago. Load the snapshot
// this run is about to overwrite and use it to backfill anything this
// cycle's fetches came back empty for. The next successful cycle for that
// item naturally replaces the carried-forward value, so staleness never
// compounds past a couple of cycles in practice.
// ---------------------------------------------------------------------------
async function loadPreviousSnapshot() {
  try {
    return JSON.parse(await readFile(OUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function nonEmpty(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return Boolean(v);
}

function carryForward(prev, next) {
  return nonEmpty(next) ? next : prev ?? next;
}

// Per-feed (not just per-bundle) so one broken feed in an otherwise-fine
// bundle still gets its last-known items instead of the whole bundle being
// judged fresh-or-stale as a unit.
function mergeFeedBundles(prevFeeds, newFeeds) {
  const out = {};
  for (const [key, rows] of Object.entries(newFeeds)) {
    const prevRows = prevFeeds?.[key] || [];
    out[key] = rows.map((row, i) => {
      if (row.items?.length) return row;
      const prevRow = prevRows.find((r) => r.name === row.name) || prevRows[i];
      return prevRow?.items?.length ? { ...row, items: prevRow.items, error: null } : row;
    });
  }
  return out;
}

// Per-symbol, so a quote endpoint that only partially fails doesn't lose
// the symbols it did get.
function mergeKeyedMap(prev, next, isGood) {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(next || {})) {
    if (isGood(v)) out[k] = v;
  }
  return out;
}

async function main() {
  const previous = await loadPreviousSnapshot();
  const allMarketSymbols = Object.values(MARKET_GROUPS).flatMap((g) => g.symbols.map((s) => s.sym));
  const sparklineSymbols = [...new Set([...allMarketSymbols, ...DEFAULT_PORTFOLIO, ...EXTRA_SNAPSHOT_SYMBOLS])];

  const [feeds, youtube, polymarket, quotes, wikiTrending, wikiPotd, treasury, earthquakes, nationalAlerts, serviceStatus, globalDisasters] = await Promise.all([
    safe('feed bundles', fetchAllBundles),
    safe('youtube', fetchYouTubeBundle),
    safe('polymarket', fetchPolymarket),
    safe('quotes', () => fetchQuotes(sparklineSymbols)),
    safe('wiki trending', fetchWikiTrending),
    safe('wiki potd', fetchWikiPOTD),
    safe('treasury yields', fetchTreasuryYields),
    safe('earthquakes', fetchEarthquakes),
    safe('national alerts', fetchNationalAlerts),
    safe('service status', fetchServiceStatus),
    safe('global disasters', fetchGlobalDisasters),
  ]);
  const feedsWithYoutube = { ...(feeds || {}) };
  if (youtube) feedsWithYoutube.youtube = youtube;

  const sparklineResults = await Promise.allSettled(sparklineSymbols.map((s) => fetchSparkline(s)));
  const sparklines = {};
  sparklineSymbols.forEach((s, i) => {
    // Keyed the same way fetchQuotes keys quotes (normalized Stooq symbol,
    // uppercased) so the client can look both up with one function.
    sparklines[normalizeStooqSymbol(s).toUpperCase()] = sparklineResults[i].status === 'fulfilled' ? sparklineResults[i].value : [];
  });

  // The dedicated quote endpoints (Stooq /q/l/, Yahoo v7/quote) can fail
  // wholesale even when the per-symbol history endpoints they share
  // infrastructure with succeed (observed: 0/43 quotes but 43/43
  // sparklines in one run) — derive a quote from each sparkline's last two
  // closes for any symbol the quote fetch didn't cover.
  const finalQuotes = { ...(quotes || {}) };
  for (const [key, values] of Object.entries(sparklines)) {
    const existing = finalQuotes[key];
    if ((!existing || isNaN(existing.close)) && values.length >= 2) {
      finalQuotes[key] = { close: values[values.length - 1], open: values[values.length - 2] };
    }
  }
  if (!quotes || Object.keys(quotes).length === 0) {
    console.log(`quotes: derived ${Object.keys(finalQuotes).length} from sparkline history (direct quote fetch returned nothing)`);
  }

  const mergedFeeds = mergeFeedBundles(previous?.feeds, feedsWithYoutube);
  const mergedQuotes = mergeKeyedMap(previous?.quotes, finalQuotes, (v) => v && !isNaN(v.close));
  const mergedSparklines = mergeKeyedMap(previous?.sparklines, sparklines, (v) => Array.isArray(v) && v.length > 0);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    feeds: mergedFeeds,
    polymarket: carryForward(previous?.polymarket, polymarket || []),
    quotes: mergedQuotes,
    sparklines: mergedSparklines,
    wikiTrending: carryForward(previous?.wikiTrending, wikiTrending || []),
    wikiPotd: carryForward(previous?.wikiPotd, wikiPotd || null),
    treasury: carryForward(previous?.treasury, treasury?.rates?.length ? treasury : null) || { date: null, rates: [] },
    earthquakes: carryForward(previous?.earthquakes, earthquakes || []),
    nationalAlerts: carryForward(previous?.nationalAlerts, nationalAlerts || []),
    serviceStatus: carryForward(previous?.serviceStatus, serviceStatus || []),
    globalDisasters: carryForward(previous?.globalDisasters, globalDisasters || []),
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 0));
  console.log(`Wrote snapshot to ${OUT_PATH} (${JSON.stringify(snapshot).length} bytes)`);
}

main()
  .then(() => {
    // withTimeout() abandons slow requests at the promise level but can't
    // actually cancel rss-parser's underlying HTTP request (it doesn't
    // expose an AbortSignal). A straggling connection can keep Node's
    // event loop alive well after our real work is done, so the process
    // never exits and the Action step hangs even though the file was
    // already written successfully. Force a clean exit once we're done.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
