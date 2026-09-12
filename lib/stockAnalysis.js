import YahooFinance from 'yahoo-finance2';
import { currencyPrefix } from './currency';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const SMA_SHORT_WINDOW = 50;
const SMA_LONG_WINDOW = 200;
const RSI_WINDOW = 14;

const VERDICT_THRESHOLDS = [
  [75, 'Strong Buy'],
  [60, 'Buy'],
  [40, 'Hold'],
  [25, 'Sell'],
];
const VERDICT_FLOOR = 'Avoid';
const MIN_DATA_COVERAGE_PCT = 40;

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// earningsHistory only reports the fiscal quarter-END date, not the actual
// report date — companies typically report 3-11 weeks after quarter end, so
// this window covers that range and the biggest single-day move inside it is
// treated as a proxy for the earnings-day reaction.
const REPORT_WINDOW_START_DAYS = 15;
const REPORT_WINDOW_END_DAYS = 75;

function estimateEarningsMovePct(quotes, quarterEndDate) {
  const windowStart = new Date(quarterEndDate);
  windowStart.setDate(windowStart.getDate() + REPORT_WINDOW_START_DAYS);
  const windowEnd = new Date(quarterEndDate);
  windowEnd.setDate(windowEnd.getDate() + REPORT_WINDOW_END_DAYS);

  let biggestMove = null;
  for (let i = 1; i < quotes.length; i++) {
    const d = new Date(quotes[i].date);
    if (d < windowStart || d > windowEnd) continue;
    const prevClose = quotes[i - 1].close;
    if (!(prevClose > 0)) continue;
    const pctChange = ((quotes[i].close - prevClose) / prevClose) * 100;
    if (biggestMove === null || Math.abs(pctChange) > Math.abs(biggestMove)) biggestMove = pctChange;
  }
  return biggestMove;
}

// ----------------------------------------------------------------------
// Scoring helpers (mirrors stock_analyzer.py exactly)
// ----------------------------------------------------------------------

function scoreLowerIsBetter(value, breakpoints, points) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  let idx = 0;
  for (const bp of breakpoints) {
    if (value >= bp) idx += 1;
    else break;
  }
  return points[idx];
}

function scoreHigherIsBetter(value, breakpoints, points) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  let idx = 0;
  for (const bp of breakpoints) {
    if (value > bp) idx += 1;
    else break;
  }
  return points[idx];
}

function sma(values, window) {
  if (values.length < window) return null;
  const slice = values.slice(values.length - window);
  return slice.reduce((a, b) => a + b, 0) / window;
}

// Classic Wilder's-smoothing RSI
function calculateRSI(closes, window = RSI_WINDOW) {
  if (closes.length < window + 1) return null;

  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    gains.push(Math.max(delta, 0));
    losses.push(Math.max(-delta, 0));
  }

  let avgGain = gains.slice(0, window).reduce((a, b) => a + b, 0) / window;
  let avgLoss = losses.slice(0, window).reduce((a, b) => a + b, 0) / window;

  for (let i = window; i < gains.length; i++) {
    avgGain = (avgGain * (window - 1) + gains[i]) / window;
    avgLoss = (avgLoss * (window - 1) + losses[i]) / window;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function addMetric(metrics, category, label, valueDisplay, points, maxPoints, rawValue = null) {
  metrics.push({ category, label, valueDisplay, points, maxPoints, rawValue });
}

function getMetric(metrics, label) {
  return metrics.find((m) => m.label === label && m.rawValue != null) || null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ----------------------------------------------------------------------
// Per-category narrative generators. Each one branches on the actual
// values/combinations present for that stock, so two stocks rarely read
// the same way even when they land on the same verdict.
// ----------------------------------------------------------------------

function describeValuation(metrics) {
  const pe = getMetric(metrics, 'Trailing P/E');
  const peg = getMetric(metrics, 'PEG Ratio');
  const pb = getMetric(metrics, 'Price/Book');
  const ev = getMetric(metrics, 'EV/EBITDA');
  const present = [pe, peg, pb, ev].filter(Boolean);
  if (present.length === 0) return null;

  const avg = present.reduce((s, m) => s + m.points, 0) / present.length;
  const worst = [...present].sort((a, b) => a.points - b.points)[0];
  const best = [...present].sort((a, b) => b.points - a.points)[0];

  let lead;
  if (avg <= -1.3) lead = 'Valuation is the biggest red flag here';
  else if (avg <= -0.4) lead = 'Shares look richly valued';
  else if (avg < 0.4) lead = 'Valuation sits close to fair value';
  else if (avg < 1.3) lead = 'Valuation looks reasonably attractive';
  else lead = 'Shares look cheap on most valuation measures';

  const detailParts = [];
  if (pe) detailParts.push(`a trailing P/E of ${pe.rawValue.toFixed(1)}x`);
  if (peg) detailParts.push(`a PEG of ${peg.rawValue.toFixed(2)}`);
  if (!pe && ev) detailParts.push(`EV/EBITDA of ${ev.rawValue.toFixed(1)}x`);

  let sentence = detailParts.length ? `${lead}, with ${detailParts.slice(0, 2).join(' and ')}` : lead;
  if (worst.points < 0 && best.points > 0 && worst.label !== best.label) {
    sentence += ` — ${worst.label} is the weak link even as ${best.label} looks comparatively fine`;
  }
  return `${sentence}.`;
}

function describeGrowth(metrics) {
  const rev = getMetric(metrics, 'Revenue Growth (YoY)');
  const earn = getMetric(metrics, 'Earnings Growth (YoY)');
  const margin = getMetric(metrics, 'Net Profit Margin');
  const roe = getMetric(metrics, 'Return on Equity');
  const growthSide = [rev, earn].filter(Boolean);
  const profitSide = [margin, roe].filter(Boolean);
  if (growthSide.length === 0 && profitSide.length === 0) return null;

  const growthAvg = growthSide.length ? growthSide.reduce((s, m) => s + m.points, 0) / growthSide.length : null;
  const profitAvg = profitSide.length ? profitSide.reduce((s, m) => s + m.points, 0) / profitSide.length : null;

  let sentence;
  if (growthAvg != null && profitAvg != null) {
    if (growthAvg >= 1 && profitAvg >= 1) sentence = 'Growth and profitability are both clear strengths';
    else if (growthAvg >= 1 && profitAvg < 0) sentence = "Top-line growth is strong, but it hasn't translated into strong margins or returns on equity yet";
    else if (growthAvg < 0 && profitAvg >= 1) sentence = 'Growth has slowed, but the business is still highly profitable';
    else if (growthAvg < 0 && profitAvg < 0) sentence = 'Both growth and profitability are soft spots right now';
    else sentence = 'Growth and profitability are mixed — some good signs, some weak ones';
  } else if (growthAvg != null) {
    sentence = growthAvg >= 0 ? 'Top-line growth is holding up' : 'Growth has cooled off';
  } else {
    sentence = profitAvg >= 0 ? 'Profitability metrics look solid' : 'Profitability is under pressure';
  }

  const bits = [];
  if (rev) bits.push(`revenue ${rev.rawValue >= 0 ? '+' : ''}${rev.rawValue.toFixed(1)}% YoY`);
  if (margin) bits.push(`${margin.rawValue.toFixed(1)}% net margin`);
  if (roe) bits.push(`${roe.rawValue.toFixed(1)}% ROE`);

  return bits.length ? `${sentence} (${bits.join(', ')}).` : `${sentence}.`;
}

function describeFinancialHealth(metrics) {
  const debt = getMetric(metrics, 'Debt/Equity');
  const ratio = getMetric(metrics, 'Current Ratio');
  const fcf = getMetric(metrics, 'Free Cash Flow');
  const present = [debt, ratio, fcf].filter(Boolean);
  if (present.length === 0) return null;

  const avg = present.reduce((s, m) => s + m.points / m.maxPoints, 0) / present.length;

  let sentence;
  if (avg >= 0.5) sentence = 'The balance sheet is a clear strength';
  else if (avg >= 0) sentence = 'The balance sheet looks solid overall';
  else if (avg >= -0.5) sentence = 'The balance sheet has a few soft spots';
  else sentence = 'Balance sheet risk is a real concern here';

  const bits = [];
  if (debt) bits.push(`debt/equity of ${debt.rawValue.toFixed(0)}%`);
  if (ratio) bits.push(`a current ratio of ${ratio.rawValue.toFixed(2)}`);
  if (fcf) bits.push(fcf.rawValue > 0 ? `positive free cash flow (${fcf.valueDisplay})` : `negative free cash flow (${fcf.valueDisplay})`);

  return bits.length ? `${sentence}, with ${bits.join(', ')}.` : `${sentence}.`;
}

function describeMomentum(metrics) {
  const s50 = getMetric(metrics, 'Price vs 50-day SMA');
  const s200 = getMetric(metrics, 'Price vs 200-day SMA');
  const rsi = getMetric(metrics, 'RSI (14-day)');
  const offHigh = getMetric(metrics, 'Distance from 52-wk high');
  if (!s50 && !s200 && !rsi && !offHigh) return null;

  const bits = [];
  if (s50 && s200) {
    if (s50.points > 0 && s200.points > 0) bits.push('trading above both its 50- and 200-day averages in a confirmed uptrend');
    else if (s50.points < 0 && s200.points < 0) bits.push('trading below both its 50- and 200-day averages in a clear downtrend');
    else bits.push('showing mixed short- vs long-term trend signals');
  }
  if (rsi) {
    if (rsi.rawValue > 70) bits.push(`RSI is overbought at ${rsi.rawValue.toFixed(0)}`);
    else if (rsi.rawValue < 30) bits.push(`RSI is oversold at ${rsi.rawValue.toFixed(0)}`);
  }
  if (offHigh) {
    if (offHigh.rawValue < 5) bits.push(`trading within ${offHigh.rawValue.toFixed(1)}% of its 52-week high`);
    else if (offHigh.rawValue > 30) bits.push(`still ${offHigh.rawValue.toFixed(0)}% below its 52-week high`);
  }

  if (bits.length === 0) return 'Momentum signals are largely neutral right now.';
  return `${capitalize(bits.join(', and '))}.`;
}

function describeAnalystSentiment(metrics) {
  const rating = getMetric(metrics, 'Consensus Rating');
  const upside = getMetric(metrics, 'Upside to Price Target');
  const bits = [];
  if (rating && rating.valueDisplay !== 'N/A') bits.push(`Wall Street's consensus rating is ${rating.valueDisplay}`);
  if (upside) {
    bits.push(
      upside.rawValue > 0
        ? `the average analyst price target of ${upside.valueDisplay.split(' (')[0]} implies ${upside.rawValue.toFixed(1)}% upside from here`
        : `the stock already trades ${Math.abs(upside.rawValue).toFixed(1)}% above the average analyst price target of ${upside.valueDisplay.split(' (')[0]}`
    );
  }
  if (bits.length === 0) return null;
  return `${capitalize(bits.join(', and '))}.`;
}

const RECOMMENDATION_BASE = {
  'Strong Buy': 'The data supports a strong buy case — still confirm with your own research before sizing a position.',
  Buy: 'The data leans bullish overall, making this a reasonable candidate to research further as a buy.',
  Hold: 'The data is mixed — better suited to holding or watching than initiating a new position right now.',
  Sell: 'The data leans bearish here — caution is warranted, and trimming exposure may be reasonable.',
  Avoid: 'The data raises significant red flags across multiple categories — best avoided at current levels.',
};

// Builds a stock-specific narrative from the same scored metrics used for
// the composite score — never a black box, always traceable back to a
// specific number shown above. Deterministic (same inputs, same output),
// but the actual sentences depend on each stock's real metric combination.
function buildSummary(metrics, verdict) {
  const scored = metrics.filter((m) => m.points !== null);
  if (scored.length === 0) {
    return { keyTakeaways: [], recommendationText: 'Not enough data was available to form a recommendation.' };
  }

  const keyTakeaways = [
    describeValuation(metrics),
    describeGrowth(metrics),
    describeFinancialHealth(metrics),
    describeMomentum(metrics),
    describeAnalystSentiment(metrics),
  ].filter(Boolean);

  const byCategory = {};
  for (const m of scored) {
    if (!byCategory[m.category]) byCategory[m.category] = { points: 0, max: 0 };
    byCategory[m.category].points += m.points;
    byCategory[m.category].max += m.maxPoints;
  }
  const categoryScores = Object.entries(byCategory).map(([category, { points, max }]) => ({
    category,
    scorePct: max > 0 ? Math.round(((points / max + 1) / 2) * 100) : 50,
  }));
  categoryScores.sort((a, b) => b.scorePct - a.scorePct);
  const best = categoryScores[0];
  const worst = categoryScores[categoryScores.length - 1];

  const base = RECOMMENDATION_BASE[verdict] || 'Not enough reliable data to form a confident recommendation.';
  const recommendationText =
    best && worst && best.category !== worst.category
      ? `${base} ${best.category} is the strongest pillar (${best.scorePct}/100), while ${worst.category} (${worst.scorePct}/100) is the main risk to watch.`
      : base;

  return { keyTakeaways, recommendationText };
}

/**
 * Analyzes a single ticker: fetches price history + fundamentals from
 * Yahoo Finance, scores Valuation / Growth & Profitability / Financial
 * Health / Momentum / Analyst Sentiment, and returns a composite score,
 * verdict, and upcoming catalysts. Mirrors the scoring rules in
 * stock_analyzer.py so both stay in sync.
 */
export async function analyzeTicker(ticker) {
  const result = {
    ticker,
    name: '',
    price: null,
    currency: null,
    targetPrice: null,
    sector: null,
    metrics: [],
    compositeScorePct: null,
    dataCoveragePct: 0,
    verdict: 'N/A',
    keyTakeaways: [],
    recommendationText: null,
    nextEarningsDate: null,
    daysToEarnings: null,
    earningsEstimate: null,
    exDividendDate: null,
    dividendRate: null,
    dividendYield: null,
    dividendMonths: [],
    avgEarningsMovePct: null,
    error: null,
  };

  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - 400); // buffer for a 200-day SMA, ~1yr of dividend history, and earnings-move lookback

    const [chart, summary] = await Promise.all([
      yahooFinance.chart(ticker, { period1, interval: '1d', events: 'div' }),
      yahooFinance.quoteSummary(
        ticker,
        {
          modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'calendarEvents', 'assetProfile', 'earningsHistory'],
        },
        { validateResult: false }
      ),
    ]);

    const quotes = (chart.quotes || []).filter((q) => q.close !== null && q.close !== undefined);
    if (quotes.length === 0) {
      result.error = `No price history returned for '${ticker}' (invalid or delisted ticker).`;
      return result;
    }

    const closes = quotes.map((q) => q.close);
    const price = closes[closes.length - 1];
    result.price = Math.round(price * 100) / 100;

    const sma50 = sma(closes, SMA_SHORT_WINDOW);
    const sma200 = sma(closes, SMA_LONG_WINDOW);
    const rsi = calculateRSI(closes);

    const trailingYear = closes.slice(-252);
    const high52w = Math.max(...trailingYear);
    const pctOffHigh = high52w ? ((high52w - price) / high52w) * 100 : null;

    const priceInfo = summary.price || {};
    const summaryDetail = summary.summaryDetail || {};
    const keyStats = summary.defaultKeyStatistics || {};
    const financialData = summary.financialData || {};
    const calendarEvents = summary.calendarEvents || {};
    const assetProfile = summary.assetProfile || {};

    result.name = priceInfo.shortName || priceInfo.longName || ticker;
    result.sector = assetProfile.sector || null;
    result.currency = priceInfo.currency || null;
    const cur = currencyPrefix(result.currency);

    // ---- Catalysts ----
    const earningsDates = calendarEvents.earnings?.earningsDate;
    if (earningsDates && earningsDates.length > 0) {
      const nextEarnings = new Date(earningsDates[0]);
      result.nextEarningsDate = nextEarnings.toISOString().slice(0, 10);
      result.daysToEarnings = Math.round((nextEarnings - new Date()) / (1000 * 60 * 60 * 24));
    }
    result.earningsEstimate = calendarEvents.earnings?.earningsAverage ?? null;
    if (calendarEvents.exDividendDate) {
      result.exDividendDate = new Date(calendarEvents.exDividendDate).toISOString().slice(0, 10);
    }
    result.dividendRate = summaryDetail.dividendRate ?? null;
    result.dividendYield = summaryDetail.dividendYield != null ? summaryDetail.dividendYield * 100 : null;

    const dividendEvents = chart.events?.dividends || [];
    if (dividendEvents.length > 0) {
      const monthsPaid = new Set(dividendEvents.map((d) => new Date(d.date).getMonth()));
      result.dividendMonths = MONTH_ABBR.filter((_, i) => monthsPaid.has(i));
    }

    const earningsHistory = summary.earningsHistory?.history || [];
    const moves = earningsHistory
      .map((h) => (h.quarter ? estimateEarningsMovePct(quotes, new Date(h.quarter)) : null))
      .filter((m) => m != null);
    if (moves.length > 0) {
      result.avgEarningsMovePct = moves.reduce((s, m) => s + Math.abs(m), 0) / moves.length;
    }

    const metrics = [];

    // ---- 1. Valuation ("is the price worth it?") ----
    const pe = summaryDetail.trailingPE ?? null;
    addMetric(
      metrics,
      'Valuation',
      'Trailing P/E',
      pe ? pe.toFixed(1) : 'N/A',
      scoreLowerIsBetter(pe, [15, 25, 35, 50], [2, 1, 0, -1, -2]),
      2,
      pe
    );

    const peg = keyStats.pegRatio ?? null;
    addMetric(
      metrics,
      'Valuation',
      'PEG Ratio',
      peg ? peg.toFixed(2) : 'N/A',
      scoreLowerIsBetter(peg, [1, 1.5, 2, 3], [2, 1, 0, -1, -2]),
      2,
      peg
    );

    const pb = keyStats.priceToBook ?? null;
    addMetric(
      metrics,
      'Valuation',
      'Price/Book',
      pb ? pb.toFixed(2) : 'N/A',
      scoreLowerIsBetter(pb, [1, 3, 5, 10], [2, 1, 0, -1, -2]),
      2,
      pb
    );

    const evEbitda = keyStats.enterpriseToEbitda ?? null;
    addMetric(
      metrics,
      'Valuation',
      'EV/EBITDA',
      evEbitda ? evEbitda.toFixed(1) : 'N/A',
      scoreLowerIsBetter(evEbitda, [8, 12, 18, 25], [2, 1, 0, -1, -2]),
      2,
      evEbitda
    );

    // ---- 2. Growth & Profitability ("will it earn?") ----
    const revGrowthPct = financialData.revenueGrowth != null ? financialData.revenueGrowth * 100 : null;
    addMetric(
      metrics,
      'Growth',
      'Revenue Growth (YoY)',
      revGrowthPct != null ? `${revGrowthPct.toFixed(1)}%` : 'N/A',
      scoreHigherIsBetter(revGrowthPct, [0, 10, 20, 30], [-2, -1, 0, 1, 2]),
      2,
      revGrowthPct
    );

    const earnGrowthPct = financialData.earningsGrowth != null ? financialData.earningsGrowth * 100 : null;
    addMetric(
      metrics,
      'Growth',
      'Earnings Growth (YoY)',
      earnGrowthPct != null ? `${earnGrowthPct.toFixed(1)}%` : 'N/A',
      scoreHigherIsBetter(earnGrowthPct, [0, 10, 20, 30], [-2, -1, 0, 1, 2]),
      2,
      earnGrowthPct
    );

    const netMarginPct = financialData.profitMargins != null ? financialData.profitMargins * 100 : null;
    addMetric(
      metrics,
      'Growth',
      'Net Profit Margin',
      netMarginPct != null ? `${netMarginPct.toFixed(1)}%` : 'N/A',
      scoreHigherIsBetter(netMarginPct, [0, 5, 10, 20], [-2, -1, 0, 1, 2]),
      2,
      netMarginPct
    );

    const roePct = financialData.returnOnEquity != null ? financialData.returnOnEquity * 100 : null;
    addMetric(
      metrics,
      'Growth',
      'Return on Equity',
      roePct != null ? `${roePct.toFixed(1)}%` : 'N/A',
      scoreHigherIsBetter(roePct, [0, 10, 15, 20], [-2, -1, 0, 1, 2]),
      2,
      roePct
    );

    // ---- 3. Financial Health ("can it survive a downturn?") ----
    const debtToEquity = financialData.debtToEquity ?? null;
    addMetric(
      metrics,
      'Financial Health',
      'Debt/Equity',
      debtToEquity != null ? `${debtToEquity.toFixed(0)}%` : 'N/A',
      scoreLowerIsBetter(debtToEquity, [50, 100, 150, 250], [2, 1, 0, -1, -2]),
      2,
      debtToEquity
    );

    const currentRatio = financialData.currentRatio ?? null;
    addMetric(
      metrics,
      'Financial Health',
      'Current Ratio',
      currentRatio != null ? currentRatio.toFixed(2) : 'N/A',
      scoreHigherIsBetter(currentRatio, [1, 1.5, 2, 3], [-2, -1, 0, 1, 2]),
      2,
      currentRatio
    );

    const freeCashflow = financialData.freeCashflow ?? null;
    let fcfPts = null;
    let fcfDisplay = 'N/A';
    if (freeCashflow != null) {
      fcfPts = freeCashflow > 0 ? 1 : -1;
      fcfDisplay =
        Math.abs(freeCashflow) >= 1e9
          ? `${cur}${(freeCashflow / 1e9).toFixed(2)}B`
          : `${cur}${(freeCashflow / 1e6).toFixed(1)}M`;
    }
    addMetric(metrics, 'Financial Health', 'Free Cash Flow', fcfDisplay, fcfPts, 1, freeCashflow);

    // ---- 4. Technical Momentum ("is now a good entry?") ----
    if (sma50 != null) {
      addMetric(
        metrics,
        'Momentum',
        'Price vs 50-day SMA',
        `${cur}${price.toFixed(2)} vs ${cur}${sma50.toFixed(2)}`,
        price > sma50 ? 1 : -1,
        1,
        ((price / sma50 - 1) * 100)
      );
    } else {
      addMetric(metrics, 'Momentum', 'Price vs 50-day SMA', 'N/A', null, 1);
    }

    if (sma200 != null) {
      addMetric(
        metrics,
        'Momentum',
        'Price vs 200-day SMA',
        `${cur}${price.toFixed(2)} vs ${cur}${sma200.toFixed(2)}`,
        price > sma200 ? 2 : -2,
        2,
        ((price / sma200 - 1) * 100)
      );
    } else {
      addMetric(metrics, 'Momentum', 'Price vs 200-day SMA', 'N/A', null, 2);
    }

    if (rsi != null) {
      let rsiPts;
      let rsiNote;
      if (rsi > 70) [rsiPts, rsiNote] = [-2, 'overbought'];
      else if (rsi > 55) [rsiPts, rsiNote] = [1, 'strong'];
      else if (rsi >= 45) [rsiPts, rsiNote] = [0, 'neutral'];
      else if (rsi >= 30) [rsiPts, rsiNote] = [-1, 'weak'];
      else [rsiPts, rsiNote] = [-2, 'oversold'];
      addMetric(metrics, 'Momentum', 'RSI (14-day)', `${rsi.toFixed(1)} (${rsiNote})`, rsiPts, 2, rsi);
    } else {
      addMetric(metrics, 'Momentum', 'RSI (14-day)', 'N/A', null, 2);
    }

    addMetric(
      metrics,
      'Momentum',
      'Distance from 52-wk high',
      pctOffHigh != null ? `${pctOffHigh.toFixed(1)}%` : 'N/A',
      scoreLowerIsBetter(pctOffHigh, [5, 20, 40], [1, 0, -1, -2]),
      1,
      pctOffHigh
    );

    // ---- 5. Analyst Sentiment (bonus, forward-looking) ----
    const recKey = (financialData.recommendationKey || '').toLowerCase();
    const recMap = { strong_buy: 1, buy: 1, hold: 0, sell: -1, strong_sell: -1, underperform: -1 };
    addMetric(
      metrics,
      'Analyst Sentiment',
      'Consensus Rating',
      recKey ? recKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'N/A',
      recKey in recMap ? recMap[recKey] : null,
      1,
      recKey || null
    );

    const targetPrice = financialData.targetMeanPrice ?? null;
    result.targetPrice = targetPrice;
    const upsidePct = targetPrice && price ? (targetPrice / price - 1) * 100 : null;
    addMetric(
      metrics,
      'Analyst Sentiment',
      'Upside to Price Target',
      upsidePct != null
        ? `${cur}${targetPrice.toFixed(2)} (${upsidePct >= 0 ? '+' : ''}${upsidePct.toFixed(1)}%)`
        : 'N/A',
      scoreHigherIsBetter(upsidePct, [-10, 15], [-1, 0, 1]),
      1,
      upsidePct
    );

    result.metrics = metrics;

    const scored = metrics.filter((m) => m.points !== null);
    const totalScore = scored.reduce((sum, m) => sum + m.points, 0);
    const maxPossible = scored.reduce((sum, m) => sum + m.maxPoints, 0);
    const totalPossibleIfComplete = metrics.reduce((sum, m) => sum + m.maxPoints, 0);

    result.dataCoveragePct = totalPossibleIfComplete ? Math.round((maxPossible / totalPossibleIfComplete) * 1000) / 10 : 0;

    if (maxPossible > 0) {
      result.compositeScorePct = Math.round((((totalScore / maxPossible + 1) / 2) * 100) * 10) / 10;
      if (result.dataCoveragePct < MIN_DATA_COVERAGE_PCT) {
        result.verdict = 'Low Confidence (insufficient data)';
      } else {
        result.verdict = VERDICT_FLOOR;
        for (const [threshold, label] of VERDICT_THRESHOLDS) {
          if (result.compositeScorePct >= threshold) {
            result.verdict = label;
            break;
          }
        }
      }
    } else {
      result.verdict = 'N/A (no data)';
    }

    const { keyTakeaways, recommendationText } = buildSummary(metrics, result.verdict);
    result.keyTakeaways = keyTakeaways;
    result.recommendationText = recommendationText;
  } catch (exc) {
    result.error = `Unexpected error: ${exc.message}`;
  }

  return result;
}
