import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { getFundamentalsAndNews } from '@/lib/newsAndFundamentals';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const BULLISH_RATINGS = new Set(['Strong Buy', 'Buy']);
const BEARISH_RATINGS = new Set(['Sell', 'Strong Sell', 'Underperform']);

async function getWeeklyChangePct(symbol) {
  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - 9); // buffer past weekends/holidays for ~5 trading days
    const chart = await yahooFinance.chart(symbol, { period1, interval: '1d' });
    const closes = (chart.quotes || []).filter((q) => q.close !== null && q.close !== undefined).map((q) => q.close);
    if (closes.length < 2) return null;
    const first = closes[0];
    const last = closes[closes.length - 1];
    return ((last - first) / first) * 100;
  } catch {
    return null;
  }
}

function fmtPct(pct) {
  if (pct == null) return 'flat';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function vixMood(vix) {
  if (vix < 15) return 'unusually calm';
  if (vix < 20) return 'calm';
  if (vix < 30) return 'elevated';
  return 'showing real fear';
}

function buildMarketOverview({ spxPct, stiPct, vix, tenYear }) {
  const parts = [];

  let lead = `US equities were mixed this week`;
  if (spxPct != null) lead = spxPct >= 0 ? `US equities advanced this week` : `US equities pulled back this week`;
  let sentence = spxPct != null ? `${lead}, with the S&P 500 ${fmtPct(spxPct)}` : lead;
  if (stiPct != null) sentence += `, while Singapore's Straits Times Index moved ${fmtPct(stiPct)}`;
  parts.push(`${sentence}.`);

  if (vix != null) parts.push(`Volatility is ${vixMood(vix)}, with the VIX at ${vix.toFixed(1)}.`);
  if (tenYear != null) {
    parts.push(
      `The 10-year Treasury yield sits at ${tenYear.toFixed(2)}%, still the key reference rate for how richly growth names get valued.`
    );
  }
  parts.push('None of this changes the long-term fundamentals of a well-run business — but it sets the backdrop for the names below.');

  return parts.join(' ');
}

// The headline text itself is shown separately as a link (see the `news`
// field on each watchlist item), so this leads with fundamentals/analyst
// context instead of repeating the same headline as plain text.
function oneLineRationale(item) {
  const moveText = item.weeklyChangePct == null ? 'is on the radar this week' : `moved ${fmtPct(item.weeklyChangePct)} this week`;

  const firstSentence = (item.fundamentalsNarrative || '').split('. ')[0];
  if (firstSentence) {
    return `${item.name} ${moveText} — ${firstSentence}${firstSentence.endsWith('.') ? '' : '.'}`;
  }
  if (item.analystActions[0]) {
    return `${item.name} ${moveText} — ${item.analystActions[0].text}.`;
  }
  if (item.news[0]) {
    return `${item.name} ${moveText} — "${item.news[0].title}" (${item.news[0].publisher}).`;
  }
  return `${item.name} ${moveText}; not much fresh news or fundamental data to report.`;
}

function buildSubjectLines(spotlight) {
  const t = spotlight.ticker;
  const n = spotlight.name;
  const pct = spotlight.weeklyChangePct;
  const dir = pct != null && pct < 0 ? 'down' : 'up';
  const pctText = pct != null ? `${Math.abs(pct).toFixed(1)}%` : null;

  return [
    {
      type: 'curiosity',
      label: 'Curiosity-driven',
      text: `Why ${n} could be the trade everyone's watching this week`,
      preview: 'Plus a few more names quietly making moves...',
    },
    {
      type: 'data',
      label: 'Data-focused',
      text: pctText ? `${t} ${dir} ${pctText} this week — here's what the fundamentals and news say` : `${t}: a fundamentals-driven read on this week's move`,
      preview: 'Earnings trends, analyst activity, and headlines inside.',
    },
    {
      type: 'direct',
      label: 'Direct',
      text: `This Week in Markets: ${t} Spotlight + What Else Is Moving`,
      preview: 'Your fundamentals-and-news weekly market briefing.',
    },
  ];
}

function buildKeyTakeaway(items) {
  const total = items.length;
  if (total === 0) return 'Not enough data this week to form a confident takeaway — worth revisiting once more names are added.';

  const bullish = items.filter((i) => BULLISH_RATINGS.has(i.consensusRating)).length;
  const bearish = items.filter((i) => BEARISH_RATINGS.has(i.consensusRating)).length;
  const upgrades = items.reduce((n, i) => n + i.analystActions.filter((a) => a.action === 'up').length, 0);
  const downgrades = items.reduce((n, i) => n + i.analystActions.filter((a) => a.action === 'down').length, 0);

  const parts = [];
  if (bullish / total >= 0.6) parts.push("Wall Street's consensus leans bullish across this week's names.");
  else if (bearish / total >= 0.6) parts.push("Wall Street's consensus leans cautious across this week's names.");
  else parts.push("It's a mixed week on consensus ratings — some names score well, others don't.");

  if (upgrades > downgrades) {
    parts.push(`Analyst activity skewed positive, with ${upgrades} upgrade${upgrades === 1 ? '' : 's'} vs. ${downgrades} downgrade${downgrades === 1 ? '' : 's'} in the past 90 days.`);
  } else if (downgrades > upgrades) {
    parts.push(`Analyst activity skewed cautious, with ${downgrades} downgrade${downgrades === 1 ? '' : 's'} vs. ${upgrades} upgrade${upgrades === 1 ? '' : 's'} in the past 90 days.`);
  }

  parts.push('Use the fundamentals and news behind each name to decide what deserves a closer look, not the ticker symbol alone.');

  return parts.join(' ');
}

function buildCta() {
  return "That's this week's read. If it helped, forward it to a fellow investor — and hit reply with the ticker you want in next week's spotlight.";
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tickers = Array.isArray(body?.tickers)
    ? [...new Set(body.tickers.map((t) => String(t).trim().toUpperCase()).filter(Boolean))].slice(0, 4)
    : [];

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'Provide at least one ticker' }, { status: 400 });
  }

  const [fundamentals, weeklyChanges, macroQuotes, spxWeekly, stiWeekly] = await Promise.all([
    Promise.all(tickers.map((t) => getFundamentalsAndNews(t))),
    Promise.all(tickers.map((t) => getWeeklyChangePct(t))),
    yahooFinance.quote(['^GSPC', '^STI', '^VIX', '^TNX']).catch(() => []),
    getWeeklyChangePct('^GSPC'),
    getWeeklyChangePct('^STI'),
  ]);

  const macroBySymbol = new Map((macroQuotes || []).map((q) => [q.symbol, q]));
  const vix = macroBySymbol.get('^VIX')?.regularMarketPrice ?? null;
  const tenYear = macroBySymbol.get('^TNX')?.regularMarketPrice ?? null;

  const marketOverview = buildMarketOverview({ spxPct: spxWeekly, stiPct: stiWeekly, vix, tenYear });

  const enriched = fundamentals.map((r, i) => ({ ...r, weeklyChangePct: weeklyChanges[i] }));
  const valid = enriched.filter((r) => !r.error);
  const failedTickers = enriched.filter((r) => r.error).map((r) => r.ticker);

  if (valid.length === 0) {
    return NextResponse.json({ error: 'None of the provided tickers returned usable data.' }, { status: 422 });
  }

  const spotlightResult = valid[0];
  const watchlistResults = valid.slice(1);

  const spotlight = {
    ticker: spotlightResult.ticker,
    name: spotlightResult.name,
    price: spotlightResult.price,
    currency: spotlightResult.currency,
    sector: spotlightResult.sector,
    weeklyChangePct: spotlightResult.weeklyChangePct,
    consensusRating: spotlightResult.consensusRating,
    nextEarningsDate: spotlightResult.nextEarningsDate,
    daysToEarnings: spotlightResult.daysToEarnings,
    fundamentalsNarrative: spotlightResult.fundamentalsNarrative,
    analystActions: spotlightResult.analystActions,
    recommendationShift: spotlightResult.recommendationShift,
    earningsTrack: spotlightResult.earningsTrack,
    news: spotlightResult.news,
  };

  const watchlist = watchlistResults.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    price: r.price,
    currency: r.currency,
    weeklyChangePct: r.weeklyChangePct,
    consensusRating: r.consensusRating,
    nextEarningsDate: r.nextEarningsDate,
    daysToEarnings: r.daysToEarnings,
    recommendationShift: r.recommendationShift,
    earningsTrack: r.earningsTrack.slice(0, 2),
    rationale: oneLineRationale(r),
    news: r.news.slice(0, 2),
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    marketOverview,
    subjectLines: buildSubjectLines(spotlight),
    spotlight,
    watchlist,
    keyTakeaway: buildKeyTakeaway(valid),
    cta: buildCta(),
    failedTickers,
  });
}
