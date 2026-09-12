import YahooFinance from 'yahoo-finance2';
import { currencyPrefix } from './currency';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const CONSENSUS_LABELS = {
  strong_buy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strong_sell: 'Strong Sell',
  underperform: 'Underperform',
};

const ACTION_VERBS = {
  up: 'upgraded to',
  down: 'downgraded to',
  main: 'maintained at',
  reit: 'reiterated at',
  init: 'initiated at',
};

const PRICE_TARGET_VERBS = {
  Lowers: 'lowered',
  Raises: 'raised',
  Maintains: 'maintained',
  Announces: 'announced',
  Adjusts: 'adjusted',
};

function fmtPct(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return null;
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

function timeAgo(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const hours = (Date.now() - d.getTime()) / 36e5;
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.round(days)}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function toIsoDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function buildFundamentalsNarrative({ revGrowthPct, earnGrowthPct, netMarginPct, roePct, nextYearEpsGrowthPct, guidanceDirection, lastEarnings }) {
  const parts = [];

  const growthBits = [];
  if (revGrowthPct != null) growthBits.push(`revenue growing ${fmtPct(revGrowthPct)} year-over-year`);
  if (earnGrowthPct != null) growthBits.push(`earnings ${fmtPct(earnGrowthPct)} year-over-year`);
  if (growthBits.length) parts.push(`The business is posting ${growthBits.join(' and ')}.`);

  const profitBits = [];
  if (netMarginPct != null) profitBits.push(`${netMarginPct.toFixed(1)}% net margins`);
  if (roePct != null) profitBits.push(`${roePct.toFixed(1)}% return on equity`);
  if (profitBits.length) parts.push(`Profitability sits at ${profitBits.join(' and ')}.`);

  if (nextYearEpsGrowthPct != null) {
    parts.push(`Analysts currently model ${fmtPct(nextYearEpsGrowthPct)} EPS growth for next year.`);
  }

  if (guidanceDirection === 'raised') {
    parts.push('Estimate revisions have trended higher over the past quarter — a sign analysts are growing more confident.');
  } else if (guidanceDirection === 'lowered') {
    parts.push('Estimate revisions have trended lower over the past quarter — worth watching for further cuts.');
  }

  if (lastEarnings && lastEarnings.surprisePercent != null) {
    parts.push(
      `Last quarter's EPS ${lastEarnings.beat ? 'beat' : 'missed'} estimates by ${Math.abs(lastEarnings.surprisePercent).toFixed(1)}%.`
    );
  }

  if (parts.length === 0) return 'Fundamental data was limited for this name this week.';
  return parts.join(' ');
}

function describeAnalystAction(h) {
  const cur = currencyPrefix(h.currency);
  const verb = ACTION_VERBS[h.action] || 'updated to';
  let text = `${h.firm} ${verb} ${h.toGrade}`;
  if (h.action === 'up' || h.action === 'down') {
    if (h.fromGrade && h.fromGrade !== h.toGrade) text += ` from ${h.fromGrade}`;
  }
  if (h.priceTargetAction && h.priceTargetAction !== '' && h.currentPriceTarget != null) {
    const pastTense = PRICE_TARGET_VERBS[h.priceTargetAction] || h.priceTargetAction.toLowerCase();
    if (h.priorPriceTarget != null && h.priorPriceTarget > 0 && h.priorPriceTarget !== h.currentPriceTarget) {
      text += `, price target ${pastTense} to ${cur}${h.currentPriceTarget} from ${cur}${h.priorPriceTarget}`;
    } else {
      text += `, price target ${cur}${h.currentPriceTarget}`;
    }
  }
  return text;
}

/**
 * Fetches fundamentals + news + analyst-activity for a ticker — the
 * newsletter's own lens, deliberately separate from Stock Analyzer's
 * technical/momentum scoring engine (lib/stockAnalysis.js).
 */
export async function getFundamentalsAndNews(ticker) {
  const result = {
    ticker,
    name: '',
    price: null,
    currency: null,
    sector: null,
    consensusRating: null,
    fundamentalsNarrative: '',
    analystActions: [],
    recommendationShift: null,
    earningsTrack: [],
    news: [],
    nextEarningsDate: null,
    daysToEarnings: null,
    error: null,
  };

  try {
    const [summary, searchRes] = await Promise.all([
      yahooFinance.quoteSummary(
        ticker,
        {
          modules: [
            'price',
            'summaryDetail',
            'financialData',
            'assetProfile',
            'calendarEvents',
            'earningsHistory',
            'earningsTrend',
            'recommendationTrend',
            'upgradeDowngradeHistory',
          ],
        },
        // Some tickers return module shapes that don't perfectly match yahoo-finance2's
        // strict schema (e.g. sparse earningsTrend entries) — validating would throw and
        // drop an otherwise-usable result, so coerce best-effort instead.
        { validateResult: false }
      ),
      yahooFinance.search(ticker, { newsCount: 4, quotesCount: 0 }).catch(() => ({ news: [] })),
    ]);

    const priceInfo = summary.price || {};
    const financialData = summary.financialData || {};
    const assetProfile = summary.assetProfile || {};
    const calendarEvents = summary.calendarEvents || {};

    result.name = priceInfo.shortName || priceInfo.longName || ticker;
    result.price = priceInfo.regularMarketPrice ?? null;
    result.currency = priceInfo.currency || null;
    result.sector = assetProfile.sector || null;
    result.consensusRating = CONSENSUS_LABELS[(financialData.recommendationKey || '').toLowerCase()] || null;

    const earningsDates = calendarEvents.earnings?.earningsDate;
    if (earningsDates && earningsDates.length > 0) {
      const nextEarnings = new Date(earningsDates[0]);
      result.nextEarningsDate = toIsoDate(nextEarnings);
      result.daysToEarnings = Math.round((nextEarnings - new Date()) / (1000 * 60 * 60 * 24));
    }

    // ---- Earnings track record (most recent quarters first) ----
    const earningsHistory = (summary.earningsHistory?.history || []).slice(-4).reverse();
    result.earningsTrack = earningsHistory.map((h) => {
      const surprisePercent = h.surprisePercent != null ? h.surprisePercent * 100 : null;
      return {
        quarter: toIsoDate(h.quarter),
        epsActual: h.epsActual ?? null,
        epsEstimate: h.epsEstimate ?? null,
        surprisePercent,
        beat: surprisePercent != null ? surprisePercent >= 0 : null,
      };
    });
    const lastEarnings = result.earningsTrack[0] || null;

    // ---- Forward estimates / guidance direction ----
    const trend = summary.earningsTrend?.trend || [];
    const nextYear = trend.find((t) => t.period === '+1y');
    const currentYear = trend.find((t) => t.period === '0y');
    const nextYearEpsGrowthPct = nextYear?.growth != null ? nextYear.growth * 100 : null;

    let guidanceDirection = null;
    const epsTrend = currentYear?.epsTrend;
    const ninetyAgo = epsTrend?.['90daysAgo'];
    if (epsTrend && epsTrend.current != null && ninetyAgo != null && ninetyAgo !== 0) {
      const shift = ((epsTrend.current - ninetyAgo) / Math.abs(ninetyAgo)) * 100;
      if (shift >= 2) guidanceDirection = 'raised';
      else if (shift <= -2) guidanceDirection = 'lowered';
      else guidanceDirection = 'steady';
    }

    result.fundamentalsNarrative = buildFundamentalsNarrative({
      revGrowthPct: financialData.revenueGrowth != null ? financialData.revenueGrowth * 100 : null,
      earnGrowthPct: financialData.earningsGrowth != null ? financialData.earningsGrowth * 100 : null,
      netMarginPct: financialData.profitMargins != null ? financialData.profitMargins * 100 : null,
      roePct: financialData.returnOnEquity != null ? financialData.returnOnEquity * 100 : null,
      nextYearEpsGrowthPct,
      guidanceDirection,
      lastEarnings,
    });

    // ---- Recent analyst actions (upgrades/downgrades/price targets) ----
    const history = summary.upgradeDowngradeHistory?.history || [];
    const ninetyDaysAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
    result.analystActions = history
      .filter((h) => h.epochGradeDate && new Date(h.epochGradeDate).getTime() >= ninetyDaysAgoMs)
      .sort((a, b) => new Date(b.epochGradeDate) - new Date(a.epochGradeDate))
      .slice(0, 3)
      .map((h) => ({
        firm: h.firm,
        action: h.action,
        fromGrade: h.fromGrade || null,
        toGrade: h.toGrade || null,
        date: toIsoDate(h.epochGradeDate),
        text: describeAnalystAction({ ...h, currency: result.currency }),
      }));

    // ---- Recommendation trend shift (this month vs. one month ago) ----
    const recTrend = summary.recommendationTrend?.trend || [];
    const now = recTrend.find((t) => t.period === '0m');
    const monthAgo = recTrend.find((t) => t.period === '-1m');
    if (now && monthAgo) {
      const buyPct = (t) => {
        const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
        return total > 0 ? ((t.strongBuy + t.buy) / total) * 100 : null;
      };
      const nowPct = buyPct(now);
      const agoPct = buyPct(monthAgo);
      if (nowPct != null && agoPct != null) {
        result.recommendationShift = {
          nowPct: Math.round(nowPct),
          diff: Math.round(nowPct - agoPct),
        };
      }
    }

    // ---- News ----
    result.news = (searchRes.news || []).slice(0, 4).map((n) => ({
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      timeAgo: timeAgo(n.providerPublishTime),
    }));
  } catch (exc) {
    result.error = `Unexpected error: ${exc.message}`;
  }

  return result;
}
