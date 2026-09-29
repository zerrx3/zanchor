export const CURRENT_VERSION = 'V1.4';

export const CHANGELOG = [
  {
    version: 'V1.4',
    date: '2026-09-27',
    title: 'New tool: Options Strategy',
    changes: [
      'Swing Strategy — added the same "Strong Support / Resistance" section, surfacing levels tested 2+ times over the past year as a reference independent of the confluence entry zone',
      'Screener — expanded rows also link to Options Strategy with the ticker pre-filled',
      'Options Strategy — new tool: pick a ticker and get its options chain, implied-vs-realized volatility read, earnings-proximity risk flag, and rules-based candidate strategies (credit/debit spreads, cash-secured puts, iron condors, straddles)',
      'Options Strategy — added a Strategy Guide page (linked from Suggested Strategies) covering all 12 strategies — mechanics, max gain/loss, best-fit investor profile, and watch-outs — grouped into Long Options, Covered & Cash-Secured, Credit Spreads, Debit Spreads, Naked, and Volatility Plays',
      'Top menu bar reworked — the 7 tools now live under a single "Tools" dropdown next to Home, with a breadcrumb showing the current tool; added a "Guides" shortcut on the right, currently pointing to the Options Strategy guide',
    ],
  },
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
