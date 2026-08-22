// Fetches everything NewsDash displays and writes a single JSON snapshot to
// public/data/snapshot.json. Runs server-side (GitHub Actions), so there's
// no CORS/proxy involved at all — this is the "free database" backstop:
// git + a scheduled Action, instead of a live client-side fetch on every
// page load. The static site reads this file directly (same-origin,
// instant) and only falls back to live client-side fetches for things the
// snapshot can't anticipate (custom feed URLs, arbitrary portfolio symbols).
import Parser from 'rss-parser';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEED_BUNDLES, MARKET_GROUPS, DEFAULT_PORTFOLIO } from '../public/shared-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../public/data/snapshot.json');

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

async function fetchFeedItems(url) {
  const feed = await parser.parseURL(url);
  return (feed.items || []).slice(0, 12).map((it) => ({
    title: it.title || '(untitled)',
    link: it.link || '#',
    pubDate: it.pubDate || it.isoDate || null,
  }));
}

async function fetchAllBundles() {
  const out = {};
  for (const [key, bundle] of Object.entries(FEED_BUNDLES)) {
    const results = await Promise.allSettled(bundle.feeds.map((f) => fetchFeedItems(f.url)));
    out[key] = bundle.feeds.map((f, i) => ({
      name: f.name,
      items: results[i].status === 'fulfilled' ? results[i].value : [],
      error: results[i].status === 'rejected' ? results[i].reason.message : null,
    }));
    console.log(`bundle ${key}: ${out[key].filter((f) => !f.error).length}/${out[key].length} feeds ok`);
  }
  return out;
}

async function fetchPolymarket() {
  const url = new URL('https://gamma-api.polymarket.com/markets');
  url.searchParams.set('closed', 'false');
  url.searchParams.set('limit', '150');
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

function normalizeStooqSymbol(s) {
  const lower = s.toLowerCase();
  if (lower.startsWith('^') || lower.includes('.')) return lower;
  return `${lower}.us`;
}

async function fetchQuotes(rawSymbols) {
  const stooqSymbols = rawSymbols.map(normalizeStooqSymbol).join(',');
  const url = `https://stooq.com/q/l/?s=${stooqSymbols}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Stooq ${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  const header = lines[0].split(',');
  const rows = {};
  lines.slice(1).forEach((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => (row[h.trim()] = cells[i]));
    const symbol = (row.Symbol || '').toUpperCase();
    rows[symbol] = { close: parseFloat(row.Close), open: parseFloat(row.Open) };
  });
  return rows;
}

async function fetchSparkline(rawSymbol) {
  const sym = normalizeStooqSymbol(rawSymbol);
  const url = `https://stooq.com/q/d/l/?s=${sym}&i=d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Stooq history ${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  return lines
    .slice(1)
    .slice(-25)
    .map((line) => parseFloat(line.split(',')[4]))
    .filter((n) => !isNaN(n));
}

async function fetchWikiTrending() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${day}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Wikimedia ${res.status}`);
  const data = await res.json();
  const articles = data.items?.[0]?.articles || [];
  const skip = new Set(['Main_Page', 'Special:Search', 'Special:SpecialPages']);
  return articles
    .filter((a) => !skip.has(a.article) && !a.article.startsWith('Special:'))
    .slice(0, 15)
    .map((a) => ({ title: a.article.replace(/_/g, ' '), views: a.views, link: `https://en.wikipedia.org/wiki/${a.article}` }));
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
  const lastLine = lines[lines.length - 1].split(',').map((c) => c.trim().replace(/"/g, ''));
  const rates = header.slice(1).map((label, i) => ({ label, value: parseFloat(lastLine[i + 1]) })).filter((r) => !isNaN(r.value));
  return { date: lastLine[0], rates };
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

async function main() {
  const allMarketSymbols = Object.values(MARKET_GROUPS).flatMap((g) => g.symbols.map((s) => s.sym));
  const sparklineSymbols = [...new Set([...allMarketSymbols, ...DEFAULT_PORTFOLIO])];

  const [feeds, polymarket, quotes, wikiTrending, treasury, earthquakes] = await Promise.all([
    safe('feed bundles', fetchAllBundles),
    safe('polymarket', fetchPolymarket),
    safe('quotes', () => fetchQuotes(sparklineSymbols)),
    safe('wiki trending', fetchWikiTrending),
    safe('treasury yields', fetchTreasuryYields),
    safe('earthquakes', fetchEarthquakes),
  ]);

  const sparklineResults = await Promise.allSettled(sparklineSymbols.map((s) => fetchSparkline(s)));
  const sparklines = {};
  sparklineSymbols.forEach((s, i) => {
    // Keyed the same way fetchQuotes keys quotes (normalized Stooq symbol,
    // uppercased) so the client can look both up with one function.
    sparklines[normalizeStooqSymbol(s).toUpperCase()] = sparklineResults[i].status === 'fulfilled' ? sparklineResults[i].value : [];
  });

  const snapshot = {
    generatedAt: new Date().toISOString(),
    feeds: feeds || {},
    polymarket: polymarket || [],
    quotes: quotes || {},
    sparklines,
    wikiTrending: wikiTrending || [],
    treasury: treasury || { date: null, rates: [] },
    earthquakes: earthquakes || [],
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 0));
  console.log(`Wrote snapshot to ${OUT_PATH} (${JSON.stringify(snapshot).length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
