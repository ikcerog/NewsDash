// Shared, framework-free config for NewsDash. Imported by both the browser
// (public/app.js, as an ES module) and the Node snapshot script
// (scripts/fetch-snapshot.mjs), so the two never drift apart.

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

export const DEFAULT_PORTFOLIO = ['AAPL', 'MSFT', 'TSLA', 'NVDA'];

export const FEED_BUNDLES = {
  tier1: {
    label: 'Tier 1 Headlines',
    feeds: [
      { name: 'WSJ World (Google News)', url: 'https://news.google.com/rss/search?q=site:wsj.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
      { name: 'WSJ Markets (Google News)', url: 'https://news.google.com/rss/search?q=site:wsj.com+markets+when:2d&hl=en-US&gl=US&ceid=US:en' },
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
      { name: 'Reddit r/all', url: 'https://www.reddit.com/r/all/top/.rss?t=day' },
    ],
  },
};

// Widget type -> left-rail module category, used by the sidebar filter.
export const WIDGET_CATEGORIES = {
  'feed-bundle': 'news',
  'feed-custom': 'news',
  polymarket: 'forecasting',
  portfolio: 'markets',
  'markets-overview': 'markets',
  bonds: 'markets',
  'wiki-trending': 'trends',
  earthquakes: 'safety',
  'local-alerts': 'safety',
  'disaster-map': 'safety',
};

export const CATEGORY_LABELS = {
  news: 'News',
  markets: 'Markets',
  forecasting: 'Forecasting',
  trends: 'Trends',
  safety: 'Safety & Alerts',
};
