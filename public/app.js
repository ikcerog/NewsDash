// NewsDash — client-side app.
// Runs entirely static (GitHub Pages friendly): all data is fetched directly
// from the browser. Feeds/APIs without CORS headers are routed through a
// free, open CORS proxy (allorigins.win) as a fallback.

const APP_VERSION = '0.2.2';
const PATCH_NOTES = [
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
];

const MARKET_GROUPS = {
  indices: {
    label: 'Indices',
    symbols: [
      { sym: '^spx', name: 'S&P 500' },
      { sym: '^dji', name: 'Dow Jones' },
      { sym: '^ndq', name: 'Nasdaq 100' },
      { sym: '^rut', name: 'Russell 2000' },
      { sym: '^vix', name: 'VIX' },
    ],
  },
  sectors: {
    label: 'Sector ETFs',
    symbols: [
      { sym: 'xlk.us', name: 'Technology' },
      { sym: 'xlf.us', name: 'Financials' },
      { sym: 'xle.us', name: 'Energy' },
      { sym: 'xlv.us', name: 'Health Care' },
      { sym: 'xly.us', name: 'Cons. Discretionary' },
      { sym: 'xlu.us', name: 'Utilities' },
    ],
  },
  commodities: {
    label: 'Commodities',
    symbols: [
      { sym: 'gc.f', name: 'Gold' },
      { sym: 'cl.f', name: 'Crude Oil' },
      { sym: 'ng.f', name: 'Natural Gas' },
      { sym: 'si.f', name: 'Silver' },
    ],
  },
  currencies: {
    label: 'Currencies & Crypto',
    symbols: [
      { sym: 'eurusd', name: 'EUR/USD' },
      { sym: 'gbpusd', name: 'GBP/USD' },
      { sym: 'usdjpy', name: 'USD/JPY' },
      { sym: 'btcusd', name: 'Bitcoin' },
    ],
  },
};

const FEED_BUNDLES = {
  tier1: {
    label: 'Tier 1 Headlines',
    feeds: [
      { name: 'WSJ World News', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml' },
      { name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
      { name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
      { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
      { name: 'NYT Home Page', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
      { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss' },
    ],
  },
  breaking: {
    label: 'Breaking News Alerts',
    feeds: [
      { name: 'AP (Google News)', url: 'https://news.google.com/rss/search?q=when:1h+allinurl:apnews.com&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Reuters (Google News)', url: 'https://news.google.com/rss/search?q=when:1h+allinurl:reuters.com&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Breaking News (Google News)', url: 'https://news.google.com/rss/search?q=breaking%20news&hl=en-US&gl=US&ceid=US:en' },
    ],
  },
  detroit: {
    label: 'Detroit Local',
    feeds: [
      { name: 'Detroit Free Press', url: 'https://news.google.com/rss/search?q=site:freep.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'The Detroit News', url: 'https://news.google.com/rss/search?q=site:detroitnews.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'WXYZ Detroit', url: 'https://www.wxyz.com/rss' },
      { name: 'Fox 2 Detroit', url: 'https://www.fox2detroit.com/rss' },
      { name: "Crain's Detroit Business", url: 'https://news.google.com/rss/search?q=site:crainsdetroit.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'ClickOnDetroit (WDIV)', url: 'https://news.google.com/rss/search?q=site:clickondetroit.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
    ],
  },
  deepwire: {
    label: 'Deep Wire',
    feeds: [
      { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
      { name: 'Reddit r/worldnews', url: 'https://www.reddit.com/r/worldnews/.rss' },
      { name: 'Reddit r/news', url: 'https://www.reddit.com/r/news/.rss' },
      { name: 'Reddit r/politics', url: 'https://www.reddit.com/r/politics/.rss' },
      { name: 'ProPublica', url: 'https://www.propublica.org/feeds/propublica/main' },
      { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
      { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
    ],
  },
  gaming: {
    label: 'Gaming',
    feeds: [
      { name: 'Wowhead (Google News)', url: 'https://news.google.com/rss/search?q=site:wowhead.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Elder Scrolls Online (Google News)', url: 'https://news.google.com/rss/search?q=%22Elder+Scrolls+Online%22+when:7d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Reddit r/wow', url: 'https://www.reddit.com/r/wow/.rss' },
      { name: 'Reddit r/elderscrollsonline', url: 'https://www.reddit.com/r/elderscrollsonline/.rss' },
      { name: 'Reddit r/Games', url: 'https://www.reddit.com/r/Games/.rss' },
      { name: 'IGN', url: 'https://feeds.ign.com/ign/all' },
      { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
    ],
  },
  trending: {
    label: 'Trending Now',
    feeds: [
      { name: 'Google Trends (US)', url: 'https://trends.google.com/trending/rss?geo=US' },
      { name: 'Reddit r/all', url: 'https://www.reddit.com/r/all/top/.rss?t=day' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const STORE_KEY = 'newsdash.state.v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse stored state', e);
  }
  return defaultState();
}

function defaultState() {
  return {
    theme: 'dark',
    portfolio: ['AAPL', 'MSFT', 'TSLA', 'NVDA'],
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
// Fetch helpers
// ---------------------------------------------------------------------------
async function proxiedFetch(url, { direct = true } = {}) {
  if (direct) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
      if (res.ok) return res;
    } catch (e) {
      /* fall through to proxy chain */
    }
  }
  // Cache-bust the *target* URL so the proxy (which often caches by exact
  // request URL) doesn't hand back a stale capture of the feed from weeks
  // or months ago — this was causing headlines to show wildly wrong dates.
  const bustUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();
  let lastErr;
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const res = await fetch(buildProxyUrl(bustUrl), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (res.ok) return res;
      lastErr = new Error(`Proxy responded ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All CORS proxies failed');
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

async function fetchFeed(url) {
  const res = await proxiedFetch(url, { direct: false });
  const text = await res.text();
  return parseFeedXML(text);
}

async function fetchPolymarket(category) {
  const url = new URL('https://gamma-api.polymarket.com/markets');
  url.searchParams.set('closed', 'false');
  url.searchParams.set('limit', '100');
  url.searchParams.set('order', 'volume24hr');
  url.searchParams.set('ascending', 'false');

  const res = await proxiedFetch(url.toString(), { direct: true });
  const data = await res.json();
  let markets = Array.isArray(data) ? data : data.markets || [];

  if (category) {
    const cat = category.toLowerCase();
    markets = markets.filter((m) => {
      const hay = `${m.question || ''} ${m.category || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(cat);
    });
  }

  return markets.slice(0, 15).map((m) => {
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

function normalizeStooqSymbol(s) {
  const lower = s.toLowerCase();
  if (lower.startsWith('^') || lower.includes('.')) return lower;
  return `${lower}.us`;
}

async function fetchQuotesRaw(rawSymbols) {
  const stooqSymbols = rawSymbols.map(normalizeStooqSymbol).join(',');
  const url = `https://stooq.com/q/l/?s=${stooqSymbols}&f=sd2t2ohlcv&h&e=csv`;
  const res = await proxiedFetch(url, { direct: false });
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => (row[h.trim()] = cells[i]));
    return {
      symbol: (row.Symbol || '').toUpperCase(),
      close: parseFloat(row.Close),
      open: parseFloat(row.Open),
    };
  });
}

async function fetchQuotes(symbols) {
  const rows = await fetchQuotesRaw(symbols);
  return rows.map((r) => ({ ...r, symbol: r.symbol.replace(/\.US$/i, '') }));
}

async function fetchSparkline(rawSymbol) {
  const sym = normalizeStooqSymbol(rawSymbol);
  const url = `https://stooq.com/q/d/l/?s=${sym}&i=d`;
  const res = await proxiedFetch(url, { direct: false });
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  return lines
    .slice(1)
    .slice(-25)
    .map((line) => parseFloat(line.split(',')[4]))
    .filter((n) => !isNaN(n));
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
}

// ---------------------------------------------------------------------------
// US Treasury daily par yield curve — free, keyless, no CORS headers so
// routed through the proxy chain.
// ---------------------------------------------------------------------------
async function fetchTreasuryYields() {
  const year = new Date().getFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const res = await proxiedFetch(url, { direct: false });
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { date: null, rates: [] };
  const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const lastLine = lines[lines.length - 1].split(',').map((c) => c.trim().replace(/"/g, ''));
  const rates = header.slice(1).map((label, i) => ({ label, value: parseFloat(lastLine[i + 1]) })).filter((r) => !isNaN(r.value));
  return { date: lastLine[0], rates };
}

// ---------------------------------------------------------------------------
// USGS earthquakes — free, keyless, CORS-enabled GeoJSON feed.
// ---------------------------------------------------------------------------
async function fetchEarthquakes() {
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = await res.json();
  return (data.features || [])
    .sort((a, b) => b.properties.time - a.properties.time)
    .slice(0, 15)
    .map((f) => ({
      place: f.properties.place,
      mag: f.properties.mag,
      time: f.properties.time,
      link: f.properties.url,
    }));
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
  }[widget.type] || '▫';
}

function renderGrid() {
  grid.innerHTML = '';
  state.widgets.forEach((widget) => grid.appendChild(renderWidget(widget)));
}

function renderWidget(widget) {
  const el = document.createElement('section');
  el.className = 'widget';
  el.draggable = true;
  el.dataset.id = widget.id;

  el.innerHTML = `
    <div class="widget-header">
      <h3>${widgetIcon(widget)} ${escapeHtml(widgetTitle(widget))}</h3>
      <div class="controls">
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

  el.addEventListener('dragstart', () => el.classList.add('dragging'));
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    persistOrder();
  });

  loadWidgetData(widget, el);
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

async function loadWidgetData(widget, el) {
  const body = el.querySelector('.widget-body');
  try {
    if (widget.type === 'feed-bundle') {
      const bundle = FEED_BUNDLES[widget.config.bundle];
      const results = await Promise.allSettled(bundle.feeds.map((f) => fetchFeed(f.url)));
      body.innerHTML = '';
      let any = false;
      results.forEach((r, i) => {
        const group = document.createElement('div');
        group.className = 'feed-source-group';
        const h4 = document.createElement('h4');
        h4.textContent = bundle.feeds[i].name;
        group.appendChild(h4);
        if (r.status === 'fulfilled' && r.value.length) {
          any = true;
          r.value.slice(0, 5).forEach((item) => group.appendChild(renderFeedItem(item)));
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
      items.forEach((item) => body.appendChild(renderFeedItem(item)));
    } else if (widget.type === 'polymarket') {
      const markets = await fetchPolymarket(widget.config.category);
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
      articles.forEach((a, i) => {
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
      const quakes = await fetchEarthquakes();
      body.innerHTML = '';
      if (!quakes.length) body.innerHTML = '<div class="empty-state">No significant earthquakes this week.</div>';
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
      const feeds = FEED_BUNDLES[b].feeds.slice(0, 4);
      const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f.url)));
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          r.value.slice(0, 3).forEach((item) => allItems.push({ ...item, tag: feeds[i].name }));
        }
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
renderGrid();
loadTicker();
loadSecondaryTicker();
setInterval(loadTicker, 5 * 60 * 1000);
setInterval(loadSecondaryTicker, 2 * 60 * 1000);
