import express from 'express';
import Parser from 'rss-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'NewsDash/0.1 (+https://github.com/) RSS Reader' },
});

// ---------------------------------------------------------------------------
// Simple in-memory TTL cache so we don't hammer upstream free sources.
// ---------------------------------------------------------------------------
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NewsDash/0.1', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Curated, free / open, no-API-key-required RSS bundles.
// Sources chosen for public RSS availability. If a feed goes stale or
// changes its ToS, remove it here — this list is meant to be edited freely.
// ---------------------------------------------------------------------------
const FEED_BUNDLES = {
  tier1: [
    { name: 'WSJ World News', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
    { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
    { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
    { name: 'NYT Home Page', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss' },
    { name: 'CNBC Top News', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114' },
  ],
  breaking: [
    { name: 'AP Top Headlines (Google News)', url: 'https://news.google.com/rss/search?q=when:1h+allinurl:apnews.com&hl=en-US&gl=US&ceid=US:en' },
    { name: 'Reuters (Google News)', url: 'https://news.google.com/rss/search?q=when:1h+allinurl:reuters.com&hl=en-US&gl=US&ceid=US:en' },
    { name: 'Breaking News (Google News)', url: 'https://news.google.com/rss/search?q=breaking%20news&hl=en-US&gl=US&ceid=US:en' },
  ],
  detroit: [
    { name: 'Detroit Free Press', url: 'https://www.freep.com/arc/outboundfeeds/rss/' },
    { name: 'The Detroit News', url: 'https://www.detroitnews.com/rss/' },
    { name: 'WXYZ Detroit', url: 'https://www.wxyz.com/rss' },
    { name: 'Fox 2 Detroit', url: 'https://www.fox2detroit.com/rss' },
    { name: 'Crain\'s Detroit Business', url: 'https://www.crainsdetroit.com/rss.xml' },
  ],
  deepwire: [
    { name: 'Hacker News Front Page', url: 'https://hnrss.org/frontpage' },
    { name: 'Reddit r/worldnews', url: 'https://www.reddit.com/r/worldnews/.rss' },
    { name: 'Reddit r/news', url: 'https://www.reddit.com/r/news/.rss' },
    { name: 'Reddit r/politics', url: 'https://www.reddit.com/r/politics/.rss' },
    { name: 'ProPublica', url: 'https://www.propublica.org/feeds/propublica/main' },
    { name: 'The Intercept', url: 'https://theintercept.com/feed/?rss' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
  ],
  gaming: [
    { name: 'Wowhead News', url: 'https://www.wowhead.com/news/rss' },
    { name: 'Elder Scrolls Online News', url: 'https://www.elderscrollsonline.com/en-us/rss.xml' },
    { name: 'Reddit r/wow', url: 'https://www.reddit.com/r/wow/.rss' },
    { name: 'Reddit r/elderscrollsonline', url: 'https://www.reddit.com/r/elderscrollsonline/.rss' },
    { name: 'Reddit r/Games', url: 'https://www.reddit.com/r/Games/.rss' },
    { name: 'IGN All', url: 'https://feeds.ign.com/ign/all' },
    { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
  ],
};

app.get('/api/bundles', (req, res) => {
  const out = {};
  for (const [key, feeds] of Object.entries(FEED_BUNDLES)) {
    out[key] = feeds.map((f) => ({ name: f.name, url: f.url }));
  }
  res.json(out);
});

// Fetch + parse a single feed URL (also used for user-custom feeds).
app.get('/api/feed', async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Missing or invalid url param' });
  }
  const cacheKey = `feed:${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items || []).slice(0, 25).map((it) => ({
      title: it.title || '(untitled)',
      link: it.link,
      pubDate: it.pubDate || it.isoDate || null,
      source: feed.title || url,
      contentSnippet: (it.contentSnippet || '').slice(0, 240),
    }));
    const payload = { source: feed.title || url, items };
    cacheSet(cacheKey, payload, 5 * 60 * 1000); // 5 min TTL
    res.json(payload);
  } catch (err) {
    res.status(502).json({ error: `Failed to fetch feed: ${err.message}`, url });
  }
});

// Fetch an entire named bundle in one request (parallel, partial-failure tolerant).
app.get('/api/bundle/:name', async (req, res) => {
  const bundle = FEED_BUNDLES[req.params.name];
  if (!bundle) return res.status(404).json({ error: 'Unknown bundle' });

  const cacheKey = `bundle:${req.params.name}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const results = await Promise.allSettled(
    bundle.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      const items = (feed.items || []).slice(0, 12).map((it) => ({
        title: it.title || '(untitled)',
        link: it.link,
        pubDate: it.pubDate || it.isoDate || null,
        contentSnippet: (it.contentSnippet || '').slice(0, 240),
      }));
      return { name: f.name, url: f.url, items };
    })
  );

  const payload = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: bundle[i].name, url: bundle[i].url, error: r.reason.message, items: [] }
  );
  cacheSet(cacheKey, payload, 5 * 60 * 1000);
  res.json(payload);
});

// ---------------------------------------------------------------------------
// Polymarket — free, public Gamma API, no key required.
// https://docs.polymarket.com/
// ---------------------------------------------------------------------------
app.get('/api/polymarket', async (req, res) => {
  const category = (req.query.category || '').toLowerCase(); // politics|crypto|business|sports|...
  const search = (req.query.q || '').toLowerCase();
  const cacheKey = `polymarket:${category}:${search}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = new URL('https://gamma-api.polymarket.com/markets');
    url.searchParams.set('closed', 'false');
    url.searchParams.set('limit', '100');
    url.searchParams.set('order', 'volume24hr');
    url.searchParams.set('ascending', 'false');
    const data = await fetchJson(url.toString());

    let markets = Array.isArray(data) ? data : data.markets || [];
    if (category) {
      markets = markets.filter((m) => {
        const hay = `${m.question || ''} ${m.category || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(category);
      });
    }
    if (search) {
      markets = markets.filter((m) => (m.question || '').toLowerCase().includes(search));
    }

    const simplified = markets.slice(0, 30).map((m) => {
      let outcomes = [];
      let prices = [];
      try {
        outcomes = JSON.parse(m.outcomes || '[]');
        prices = JSON.parse(m.outcomePrices || '[]');
      } catch {
        /* leave empty */
      }
      return {
        id: m.id,
        question: m.question,
        slug: m.slug,
        url: `https://polymarket.com/event/${m.slug || m.eventSlug || ''}`,
        volume24hr: m.volume24hr || m.volume || 0,
        liquidity: m.liquidity || 0,
        endDate: m.endDate,
        outcomes,
        prices,
        category: m.category || null,
      };
    });

    cacheSet(cacheKey, simplified, 3 * 60 * 1000); // 3 min TTL
    res.json(simplified);
  } catch (err) {
    res.status(502).json({ error: `Polymarket fetch failed: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// Stock quotes — Stooq CSV endpoint, free, no API key required.
// https://stooq.com
// ---------------------------------------------------------------------------
app.get('/api/quotes', async (req, res) => {
  const symbolsParam = (req.query.symbols || '').trim();
  if (!symbolsParam) return res.status(400).json({ error: 'symbols query param required' });

  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 40);

  const cacheKey = `quotes:${symbols.join(',')}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const stooqSymbols = symbols
      .map((s) => (s.includes('.') ? s : `${s}.us`))
      .join('+');
    const url = `https://stooq.com/q/l/?s=${stooqSymbols}&f=sd2t2ohlcv&h&e=csv`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`Stooq ${resp.status}`);
    const csv = await resp.text();

    const lines = csv.trim().split('\n');
    const header = lines[0].split(',');
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(',');
      const row = {};
      header.forEach((h, i) => (row[h.trim()] = cells[i]));
      return {
        symbol: (row.Symbol || '').replace(/\.US$/i, ''),
        date: row.Date,
        time: row.Time,
        open: parseFloat(row.Open),
        high: parseFloat(row.High),
        low: parseFloat(row.Low),
        close: parseFloat(row.Close),
        volume: parseFloat(row.Volume),
      };
    });

    cacheSet(cacheKey, rows, 60 * 1000); // 1 min TTL
    res.json(rows);
  } catch (err) {
    res.status(502).json({ error: `Quote fetch failed: ${err.message}` });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`NewsDash running on http://localhost:${PORT}`);
});
