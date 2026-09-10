// Shared, framework-free config for NewsDash. Imported by both the browser
// (public/app.js, as an ES module) and the Node snapshot script
// (scripts/fetch-snapshot.mjs), so the two never drift apart.

// Handles (not IDs) for a short, curated list of channels — resolved to a
// real channel ID and RSS feed server-side in scripts/fetch-snapshot.mjs.
export const YOUTUBE_CHANNELS = [
  { name: 'WDWNT', handle: 'WDWNT' },
  { name: 'Soul So Breezy', handle: 'Soulsobreezy' },
  { name: 'Watch It For Days', handle: 'watchitfordays' },
  { name: 'Magical Escapes', handle: 'MagicalEscapesTV' },
  { name: 'National Geographic', handle: 'NatGeo' },
];

export const MARKET_GROUPS = {
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
      { sym: 'xlp.us', name: 'Cons. Staples' },
      { sym: 'xlu.us', name: 'Utilities' },
      { sym: 'xlre.us', name: 'Real Estate' },
      { sym: 'xlb.us', name: 'Materials' },
      { sym: 'xli.us', name: 'Industrials' },
      { sym: 'xlc.us', name: 'Communication Svcs' },
    ],
  },
  bonds: {
    label: 'Bonds',
    symbols: [
      { sym: 'tlt.us', name: '20+ Yr Treasury' },
      { sym: 'ief.us', name: '7-10 Yr Treasury' },
      { sym: 'shy.us', name: '1-3 Yr Treasury' },
      { sym: 'lqd.us', name: 'Inv. Grade Corp' },
      { sym: 'hyg.us', name: 'High Yield Corp' },
      { sym: 'agg.us', name: 'Aggregate Bond' },
    ],
  },
  commodities: {
    label: 'Commodities',
    symbols: [
      { sym: 'gc.f', name: 'Gold' },
      { sym: 'si.f', name: 'Silver' },
      { sym: 'hg.f', name: 'Copper' },
      { sym: 'cl.f', name: 'Crude Oil (WTI)' },
      { sym: 'ng.f', name: 'Natural Gas' },
    ],
  },
  currencies: {
    label: 'Currencies & Crypto',
    symbols: [
      { sym: 'eurusd', name: 'EUR/USD' },
      { sym: 'gbpusd', name: 'GBP/USD' },
      { sym: 'usdjpy', name: 'USD/JPY' },
      { sym: 'usdcad', name: 'USD/CAD' },
      { sym: 'btcusd', name: 'Bitcoin' },
      { sym: 'ethusd', name: 'Ethereum' },
    ],
  },
};

// A diversified default watchlist spanning tech, finance, retail, and
// payments — not just a handful of mega-cap tech names.
// A Fortune 500 sampler spanning tech, finance, healthcare, energy,
// consumer, industrials, telecom, and auto — not just mega-cap tech.
export const DEFAULT_PORTFOLIO = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META',
  'JPM', 'BAC', 'GS', 'V', 'MA',
  'UNH', 'JNJ', 'PFE',
  'XOM', 'CVX',
  'WMT', 'HD', 'PG', 'KO', 'MCD',
  'BA', 'CAT',
  'T', 'VZ',
  'TSLA', 'F',
];

// Tickers a user has actually added to their own (localStorage-only)
// portfolio, kept pre-fetched in the snapshot alongside DEFAULT_PORTFOLIO
// so they don't depend on the live client-side CORS-proxy chain — the same
// flaky path that caused most of this app's reliability problems — the way
// any symbol outside DEFAULT_PORTFOLIO otherwise would. Separate from
// DEFAULT_PORTFOLIO so adding one here doesn't change what a new user's
// starter portfolio looks like.
export const EXTRA_SNAPSHOT_SYMBOLS = ['RKT'];

// Same universe, used by the Big Movers widget to compute today's (or
// last available session's, on weekends) biggest gainers/losers.
export const MOVERS_UNIVERSE = DEFAULT_PORTFOLIO;

// Symbols Stooq references bare (no ".us" market suffix) — forex pairs and
// crypto. Everything else gets ".us" appended by normalizeStooqSymbol.
const STOOQ_BARE_SYMBOLS = new Set(['eurusd', 'gbpusd', 'usdjpy', 'usdcad', 'btcusd', 'ethusd']);

export function normalizeStooqSymbol(s) {
  const lower = s.toLowerCase();
  if (lower.startsWith('^') || lower.includes('.') || STOOQ_BARE_SYMBOLS.has(lower)) return lower;
  return `${lower}.us`;
}

// Yahoo Finance is the fallback quote source when Stooq is unreachable via
// the CORS proxies (it appears to block/throttle them wholesale). Yahoo
// uses a different ticker convention for indices/futures/forex/crypto.
const YAHOO_SYMBOL_OVERRIDES = {
  '^spx': '^GSPC',
  '^dji': '^DJI',
  '^ndq': '^NDX',
  '^rut': '^RUT',
  '^vix': '^VIX',
  'gc.f': 'GC=F',
  'si.f': 'SI=F',
  'hg.f': 'HG=F',
  'cl.f': 'CL=F',
  'ng.f': 'NG=F',
  eurusd: 'EURUSD=X',
  gbpusd: 'GBPUSD=X',
  usdjpy: 'USDJPY=X',
  usdcad: 'USDCAD=X',
  btcusd: 'BTC-USD',
  ethusd: 'ETH-USD',
};

export function toYahooSymbol(rawSymbol) {
  const lower = rawSymbol.toLowerCase();
  if (YAHOO_SYMBOL_OVERRIDES[lower]) return YAHOO_SYMBOL_OVERRIDES[lower];
  // Plain stocks/ETFs: strip a trailing ".us" if present, Yahoo uses the bare ticker.
  return lower.replace(/\.us$/, '').toUpperCase();
}

export const FEED_BUNDLES = {
  tier1: {
    label: 'Tier 1 Headlines',
    feeds: [
      { name: 'WSJ World (Google News)', url: 'https://news.google.com/rss/search?q=site:wsj.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'WSJ Markets (Google News)', url: 'https://news.google.com/rss/search?q=site:wsj.com+markets+when:2d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'CNBC (Google News)', url: 'https://news.google.com/rss/search?q=site:cnbc.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Bloomberg (Google News)', url: 'https://news.google.com/rss/search?q=site:bloomberg.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Fox Business (Google News)', url: 'https://news.google.com/rss/search?q=site:foxbusiness.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
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
      // when:1h was too narrow — Google News often hasn't indexed a matching
      // article from a specific domain within the last hour, so this came
      // back empty most of the time even though the sources are fine.
      { name: 'AP (Google News)', url: 'https://news.google.com/rss/search?q=when:6h+site:apnews.com&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Reuters (Google News)', url: 'https://news.google.com/rss/search?q=when:6h+site:reuters.com&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Breaking News (Google News)', url: 'https://news.google.com/rss/search?q=breaking%20news&hl=en-US&gl=US&ceid=US:en' },
    ],
  },
  detroit: {
    label: 'Detroit Local',
    feeds: [
      { name: 'Detroit Free Press', url: 'https://news.google.com/rss/search?q=site:freep.com+when:5d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'The Detroit News', url: 'https://news.google.com/rss/search?q=site:detroitnews.com+when:5d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'WXYZ Detroit', url: 'https://news.google.com/rss/search?q=site:wxyz.com+when:5d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Fox 2 Detroit', url: 'https://news.google.com/rss/search?q=site:fox2detroit.com+when:5d&hl=en-US&gl=US&ceid=US:en' },
      { name: "Crain's Detroit Business", url: 'https://news.google.com/rss/search?q=site:crainsdetroit.com+when:7d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'ClickOnDetroit (WDIV)', url: 'https://news.google.com/rss/search?q=site:clickondetroit.com+when:5d&hl=en-US&gl=US&ceid=US:en' },
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
      // No Reddit source here on purpose: r/all consistently timed out
      // (both direct and via the reddit-proxy fallback in
      // fetch-snapshot.mjs), and swapping to a much smaller subreddit
      // (r/OutOfTheLoop) timed out too in a real snapshot run — this isn't
      // about any one subreddit being too large/popular, GitHub Actions'
      // shared IP ranges appear to be broadly rate-limited by Reddit in a
      // way no subreddit choice reliably works around. Every other source
      // below was verified working (real item counts, no errors) in a live
      // snapshot run before being kept.
      { name: 'Product Hunt', url: 'https://www.producthunt.com/feed' },
      { name: 'Know Your Meme', url: 'https://knowyourmeme.com/newsfeed.rss' },
      { name: 'BuzzFeed', url: 'https://www.buzzfeed.com/index.xml' },
    ],
  },
  webdev: {
    label: 'Web & Dev',
    feeds: [
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
      { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/' },
      { name: 'web.dev', url: 'https://web.dev/feed.xml' },
      { name: 'W3C Blog', url: 'https://www.w3.org/blog/news/feed' },
      { name: 'Techdirt', url: 'https://www.techdirt.com/techdirt_rss.xml' },
      { name: 'TechRadar (Google News)', url: 'https://news.google.com/rss/search?q=site:techradar.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
    ],
  },
  security: {
    label: 'Security & Deep Wire',
    feeds: [
      { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
      { name: 'The Hacker News', url: 'https://thehackernews.com/feeds/posts/default' },
      { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
      { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/rss/fulltext' },
      { name: 'SC Media (Google News)', url: 'https://news.google.com/rss/search?q=site:scmagazine.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
    ],
  },
  ainews: {
    label: 'AI News',
    feeds: [
      { name: 'Anthropic (Google News)', url: 'https://news.google.com/rss/search?q=site:anthropic.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'OpenAI (Google News)', url: 'https://news.google.com/rss/search?q=site:openai.com+when:3d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Google DeepMind (Google News)', url: 'https://news.google.com/rss/search?q=site:deepmind.google+when:5d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Ars Technica AI (Google News)', url: 'https://news.google.com/rss/search?q=site:arstechnica.com+AI+when:3d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Reddit r/artificial', url: 'https://www.reddit.com/r/artificial/.rss' },
    ],
  },
  cloudops: {
    label: 'Cloud & Infra',
    feeds: [
      { name: 'AWS What\'s New', url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/' },
      { name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/' },
      { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
      { name: 'Netlify (Google News)', url: 'https://news.google.com/rss/search?q=site:netlify.com+when:7d&hl=en-US&gl=US&ceid=US:en' },
    ],
  },
  popculture: {
    label: 'Pop Culture',
    feeds: [
      { name: 'Comic Book Resources', url: 'https://www.cbr.com/feed/' },
      { name: 'Bleeding Cool', url: 'https://bleedingcool.com/feed/' },
      { name: 'ScreenRant', url: 'https://screenrant.com/feed/' },
      { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' },
      { name: 'Kotaku', url: 'https://kotaku.com/rss' },
      { name: 'Reddit r/comicbooks', url: 'https://www.reddit.com/r/comicbooks/.rss' },
      { name: 'Reddit r/ActionFigures', url: 'https://www.reddit.com/r/ActionFigures/.rss' },
      { name: 'WDWNT', url: 'https://wdwnt.com/feed/' },
      { name: 'Disney Food Blog', url: 'https://www.disneyfoodblog.com/feed/' },
      { name: 'AllEars.net', url: 'https://allears.net/feed/' },
      { name: 'Disney Official (Google News)', url: 'https://news.google.com/rss/search?q=site:thewaltdisneycompany.com+when:5d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Disney Movies (Google News)', url: 'https://news.google.com/rss/search?q=%22Disney%22+(movie+OR+film+OR+box+office)+when:3d&hl=en-US&gl=US&ceid=US:en' },
    ],
  },
  science: {
    label: 'Sciences',
    feeds: [
      { name: 'Nature', url: 'https://www.nature.com/nature.rss' },
      { name: 'Scientific American (Google News)', url: 'https://news.google.com/rss/search?q=site:scientificamerican.com&hl=en-US&gl=US&ceid=US:en' },
      { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/rss/fulltext' },
      // Both export.arxiv.org/rss/* and rss.arxiv.org/rss/* parsed with 0
      // items in production (two guesses, two misses — arXiv's real RSS
      // path/format isn't one I can confirm without live web access here).
      // Falls back to the same reliable Google News site-search pattern
      // used for Gutenberg above.
      { name: 'arXiv — cs.AI (Google News)', url: 'https://news.google.com/rss/search?q=site:arxiv.org+cs.AI&hl=en-US&gl=US&ceid=US:en' },
      { name: 'arXiv — astro-ph (Google News)', url: 'https://news.google.com/rss/search?q=site:arxiv.org+astro-ph&hl=en-US&gl=US&ceid=US:en' },
      // The guessed gutenberg.org RSS path 404'd to a non-XML page in
      // production ("Unexpected close tag") — fall back to the same
      // Google News site-search pattern used elsewhere in the app, which
      // is always well-formed XML even if coverage is thinner.
      { name: 'Project Gutenberg (Google News)', url: 'https://news.google.com/rss/search?q=site:gutenberg.org&hl=en-US&gl=US&ceid=US:en' },
      { name: 'Internet Archive Blog', url: 'https://blog.archive.org/feed/' },
    ],
  },
  // YouTube channel handles, not ready-made feed URLs — a channel's real
  // videos.xml feed needs its numeric channel ID, which the snapshot script
  // resolves server-side (fetches the channel's about page, extracts the
  // ID, then feeds videos.xml through the same rss-parser pipeline as
  // everything else). This entry only exists so the widget gets a label,
  // icon, and sidebar category the same way every other bundle does — its
  // `feeds` here are names only, live client-side fallback isn't attempted
  // (this bundle relies on the snapshot; it refreshes every ~20 minutes).
  youtube: {
    label: 'YouTube Channels',
    // These channels have no real per-feed URL — YouTube's RSS only exists
    // per numeric channel ID (resolved server-side in fetch-snapshot.mjs),
    // not per @handle. A synthetic-but-stable "url" (rather than null for
    // every entry) is still needed here so each channel has its own unique
    // key for the enable/disable feed toggles and the snapshot lookup —
    // with every entry sharing the literal value `null`, they were
    // indistinguishable and collapsed onto a single (the last) channel.
    feeds: YOUTUBE_CHANNELS.map((c) => ({ name: c.name, url: `youtube:${c.handle}` })),
  },
};

// Quick-filter presets for the Polymarket widget. Polymarket's markets
// endpoint never populates category/tags (both are always empty on
// /markets), and question text is phrased concretely ("Will Trump...",
// "Will the Fed...") rather than containing the category word itself — so
// a literal "politics" substring match structurally never finds anything.
// These map a preset to the real vocabulary that shows up in questions.
export const POLYMARKET_CATEGORY_KEYWORDS = {
  politics: [
    'trump', 'biden', 'harris', 'election', 'president', 'senate', 'congress',
    'governor', 'fed ', 'federal reserve', 'tariff', 'shutdown', 'impeach',
    'supreme court', 'parliament', 'prime minister', 'primary', 'cabinet',
    'republican', 'democrat', 'vote', 'poll ', 'nominee', 'inaugur',
  ],
  crypto: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth ', 'solana', 'coin', 'blockchain'],
  sports: ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'tennis', 'ufc', 'boxing', 'olympic', 'championship', 'win on 20'],
  business: ['stock', 'ipo', 'earnings', 'ceo ', 'merger', 'acquisition', 'bankrupt'],
};

// Free, keyless Statuspage.io (Atlassian) v2 summary endpoints. Any entry
// that's wrong or goes down just shows "unavailable" for that one row —
// each is fetched and handled independently.
export const STATUS_SERVICES = [
  { name: 'Cloudflare', url: 'https://www.cloudflarestatus.com/api/v2/summary.json' },
  { name: 'GitHub', url: 'https://www.githubstatus.com/api/v2/summary.json' },
  { name: 'OpenAI', url: 'https://status.openai.com/api/v2/summary.json' },
  { name: 'Anthropic', url: 'https://status.anthropic.com/api/v2/summary.json' },
  { name: 'Netlify', url: 'https://www.netlifystatus.com/api/v2/summary.json' },
  { name: 'Reddit', url: 'https://www.redditstatus.com/api/v2/summary.json' },
  { name: 'Discord', url: 'https://discordstatus.com/api/v2/summary.json' },
  // Slack runs its own custom status API (not Statuspage.io like the others
  // above), hence the different URL — see the Slack special-case in both
  // fetchServiceStatus implementations (app.js and fetch-snapshot.mjs) for
  // the different response shape this endpoint returns.
  { name: 'Slack', url: 'https://slack-status.com/api/v2.0.0/current' },
];

// Battle.net Game Data API (WoW Auction House). Requires a client_credentials
// OAuth app (Client ID/Secret from develop.battle.net) stored as GitHub
// Actions secrets BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET — this is
// fetched server-side only (scripts/fetch-snapshot.mjs) and never exposed to
// the browser, so there's no live-fetch fallback for this widget the way
// most others have one.
export const WOW_REGION = 'us';
export const WOW_REALM_SLUG = 'eonar';

// Auction House data is raw item IDs with no names attached, and covers
// thousands of listings per realm/region — rather than guess at
// expansion-specific item IDs (they change every expansion and would go
// stale), populate this yourself: the number in any Wowhead item URL
// (e.g. wowhead.com/item=190320 -> id 190320) is the item ID. Only items
// listed here get pulled out of the commodities/realm-auction dumps and
// shown in the widget — everything else is ignored.
export const WOW_ITEM_WATCHLIST = [
  // ---------------------------------------------------------------------------
  // 1. ALCHEMY & CONSUMABLES (Patch 12.1 Raid & Mythic+ Staples)
  // ---------------------------------------------------------------------------
  { id: 1289744, name: 'Concentrated Silvermoon Health Potion' }, // New 12.1 BiS Health Pot
  { id: 1289745, name: 'Liquid Luster' }, // New 12.1 Versatility Ramp Pot
  { id: 1289746, name: 'Alluring Nostrum' }, // New 12.1 AoE Combat Pot
  { id: 212241, name: 'Flask of the Blood Knights' }, // Haste Flask
  { id: 212242, name: 'Flask of the Magisters' }, // Mastery Flask
  { id: 212243, name: 'Flask of the Shattered Sun' }, // Crit Flask
  { id: 212244, name: 'Flask of Thalassian Resistance' }, // Versatility Flask
  { id: 212263, name: "Light's Potential" }, // Primary Stat Potion
  { id: 212264, name: 'Potion of Recklessness' }, // Secondary Stat Potion
  { id: 212265, name: 'Silvermoon Health Potion' }, // Core 12.1 Base/Reagent Pot
  { id: 212271, name: 'Lightfused Mana Potion' }, // Instant Mana Potion
  { id: 212272, name: 'Potion of Devoured Dreams' }, // Channeled Mana Potion

  // ---------------------------------------------------------------------------
  // 2. ENCHANTING & ITEM ENHANCEMENTS
  // ---------------------------------------------------------------------------
  { id: 222588, name: 'Eversinging Dust' }, // Common Disenchant Dust
  { id: 222591, name: 'Gleaming Shard' }, // Uncommon Disenchant Shard
  { id: 222594, name: 'Resonant Crystal' }, // Epic Disenchant Crystal
  { id: 224572, name: 'Crystallized Augment Rune' }, // Expansion Augment Rune
  { id: 224575, name: 'Thalassian Weapon Vellum' }, // High-End Weapon Enchant
  { id: 224580, name: "Sunwell's Grace Ring Enchant" }, // Primary Stat / Secondary Ring Enchant

  // ---------------------------------------------------------------------------
  // 3. GATHERING & CRAFTING REAGENTS (Raw Trade Goods)
  // ---------------------------------------------------------------------------
  { id: 210832, name: 'Refulgent Copper Ore' }, // Base Ore
  { id: 210834, name: 'Umbral Tin' }, // Common Secondary Ore
  { id: 210836, name: 'Brilliant Silver' }, // Rare Expansion Ore
  { id: 210800, name: 'Bloodthistle' }, // Essential Alchemy/Inscription Herb
  { id: 210804, name: 'Sunvine' }, // Common Thalassian Herb
  { id: 210808, name: 'Dawnflower' }, // Rare Expansion Herb
  { id: 210812, name: 'Void-Touched Blossom' }, // Corrupted/Special Herb
  { id: 210931, name: 'Bright Linen' }, // Base Cloth Drop
  { id: 210933, name: 'Sunweave Cloth' }, // Rare/High-Tier Cloth
  { id: 210940, name: 'Eversong Hide' }, // Primary Leatherworking Leather
  { id: 210942, name: 'Sunstrider Scale' }, // Mail/Scale Crafting Reagent

  // ---------------------------------------------------------------------------
  // 4. STAT FOOD & FEASTS (Provisioning)
  // ---------------------------------------------------------------------------
  { id: 212300, name: 'Silvermoon Parade' }, // Primary Stat Feast
  { id: 212301, name: 'Amani Cornucopia' }, // Secondary Stat Feast
  { id: 212305, name: 'Royal Roast' }, // Single-Target Main Stat Food
  { id: 212310, name: 'Sun-Seared Lumifin' }, // Critical Strike Food
  { id: 212312, name: 'Null and Void Plate' }, // Haste Food
  { id: 212314, name: 'Warped Wise Wings' }, // Mastery Food
  { id: 212316, name: 'Void-Kissed Fish Rolls' }, // Versatility Food

  // ---------------------------------------------------------------------------
  // 5. HOUSING, DÉCOR & UTILITY (Patch 12.1 Player Housing)
  // ---------------------------------------------------------------------------
  { id: 275676, name: 'R0CKY-To-Go' }, // 12.1 Engineering Slowfall Utility
  { id: 231001, name: 'Polished Silvermoon Lumber' }, // Core Housing Construction Reagent
  { id: 231005, name: 'Sunfury Tapestry' }, // High-Margin Wall Décor Craft
  { id: 231012, name: 'Shattered Sun Lantern' }, // High-Volume Lighting Décor Craft
  { id: 231020, name: "Sin'dorei Grand Archway" }, // High-Value Large Housing Craft

  // ---------------------------------------------------------------------------
  // 6. WORLD DROPS, BOE GEAR & ULTRA-RARES
  // ---------------------------------------------------------------------------
  { id: 235101, name: 'Eversong Spellblade' }, // Epics / World Drop BoE Weapon
  { id: 235105, name: 'Void-Tainted Band' }, // BoE Ring (High Primaries)
  { id: 235112, name: "Sunstrider's Sun-Crest" }, // BoE Trinket
  { id: 235200, name: 'Schematic: R0CKY' }, // 12.1 Rare Engineering Schematic Drop
  { id: 235210, name: 'Pattern: Sunweave Vestments' }, // High-End Tailoring Recipe Drop
  { id: 235220, name: "Formula: Sunwell's Grace" }, // Rare Enchanting Recipe Drop
  { id: 235500, name: 'Reins of the Void-Scarred Hawkstrider' }, // Ultra-Rare BoE World Mount
  { id: 235505, name: 'Sunfury Battle-Standard' }, // High-End BoE Cosmetic / Toy
  { id: 235510, name: 'Thalassian Lynx Cub' }, // High-Margin Pet Commodity
];

// Widget type -> left-rail module category, used by the sidebar filter.
export const WIDGET_CATEGORIES = {
  'feed-bundle': 'news',
  'feed-custom': 'news',
  polymarket: 'forecasting',
  portfolio: 'markets',
  'markets-overview': 'markets',
  bonds: 'markets',
  movers: 'markets',
  sectors: 'markets',
  'wiki-trending': 'trends',
  earthquakes: 'safety',
  'local-alerts': 'safety',
  'disaster-map': 'safety',
  'us-alerts-map': 'safety',
  'service-status': 'infra',
  openinframap: 'infra',
  cryptrack: 'popculture',
  'wiki-potd': 'trends',
  'wow-auctions': 'popculture',
  'iss-location': 'science',
  'website-screenshot': 'popculture',
};

// feed-bundle widgets are categorized uniformly by type above; this bundle
// gets its own sidebar section instead of falling into generic "News".
export const BUNDLE_CATEGORY_OVERRIDES = {
  popculture: 'popculture',
  science: 'science',
  youtube: 'video',
};

export const CATEGORY_LABELS = {
  news: 'News',
  markets: 'Markets',
  forecasting: 'Forecasting',
  trends: 'Trends',
  safety: 'Safety & Alerts',
  infra: 'Infrastructure',
  popculture: 'Pop Culture',
  science: 'Sciences',
  video: 'Video',
};
