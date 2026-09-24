export const CURRENT_VERSION = 'V1.3';

export const CHANGELOG = [
  {
    version: 'V1.3',
    date: '2026-09-24',
    title: 'Cross-Tool Links & Position Sizing',
    changes: [
      'Screener — expanded rows now link straight to Stock Analyzer and Swing Strategy with the ticker pre-filled',
      'Swing Strategy — Total Cost, Total Stop Loss, and Total Take Profit amounts shown live as you fill in shares, entry, stop, and target',
      'Portfolio Analyzer — dividend rows with an upcoming ex-dividend date are now highlighted with a green border',
      'Ticker directory — added NOK, GLW, GLOO, HNGE, ZETA, GRAL; switched Alphabet from GOOGL to GOOG',
    ],
  },
  {
    version: 'V1.2',
    date: '2026-09-15',
    title: 'Ranking Quick Jump',
    changes: [
      'Stock Analyzer — expanding a ticker in the ranking now has a "Jump to metrics" button that scrolls straight to its score breakdown card',
      'Portfolio Analyzer — holdings can now be edited in place (quantity and average price) instead of removing and re-adding them',
      'Portfolio Analyzer — export your holdings to a CSV file, and dividend income rows now show the ticker icon and company name',
    ],
  },
  {
    version: 'V1.1',
    date: '2026-09-14',
    title: 'Screener & Directory Expansion',
    changes: [
      'Screener — pick up to 5 sectors and rank every curated ticker in them at once, sortable by score, price, yield, and days to earnings',
      'Sector Rotation — cache extended to 24h with a one-time manual Refresh button per page load',
      'Market Newsletter — fixed unrelated news showing up under some tickers; Quick Watchlist now shows current price and next earnings date',
      'Ticker directory expanded to ~150 curated tickers, with new AI Infra and Space sectors, a cleaner US/SG split, and delisting cleanup',
    ],
  },
  {
    version: 'V1',
    date: '2026-09-13',
    title: 'Initial Release',
    changes: [
      'Portfolio Analyzer — holdings tracking, sector allocation, and dividend income breakdown',
      'Stock Analyzer — fundamentals and technical scoring with a curated sector directory and earnings calendar',
      'Swing Strategy — confluence-based entries with stop-loss, targets, and risk/reward analysis',
      'Market Newsletter — fundamentals and news-driven weekly briefing draft',
      'Sector Rotation — heatmap comparing sector performance across 1W/1M/3M, US and SG',
      'Installable as a home screen app (PWA) on iOS and Android',
    ],
  },
];
