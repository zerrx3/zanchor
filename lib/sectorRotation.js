import YahooFinance from 'yahoo-finance2';
import { TICKER_DIRECTORY, getSectorsForRegion } from './tickerDirectory';
import { mapWithConcurrency } from './concurrency';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const CHART_FETCH_DAYS = 150; // buffer past ~63 trading days (3 months) for the longest window
const CONCURRENCY = 8;

function getRegion(t) {
  return t.region || 'US';
}

function pctChangeOverBars(closes, barsBack) {
  if (closes.length < barsBack + 1) return null;
  const start = closes[closes.length - 1 - barsBack];
  const end = closes[closes.length - 1];
  if (!(start > 0)) return null;
  return ((end - start) / start) * 100;
}

async function getTickerPerformance(symbol) {
  try {
    const period1 = new Date();
    period1.setDate(period1.getDate() - CHART_FETCH_DAYS);
    const chart = await yahooFinance.chart(symbol, { period1, interval: '1d' });
    const closes = (chart.quotes || []).filter((q) => q.close != null).map((q) => q.close);
    if (closes.length < 6) return null; // not enough history to be useful even for the 1W window

    return {
      oneWeekPct: pctChangeOverBars(closes, 5),
      oneMonthPct: pctChangeOverBars(closes, 21),
      threeMonthPct: pctChangeOverBars(closes, 63),
    };
  } catch {
    return null;
  }
}

/**
 * Averages each curated sector's member tickers' price performance over
 * 1W/1M/3M windows — the "what's leading/lagging" heatmap data. Fetches one
 * daily chart per ticker in the region, capped at CONCURRENCY in flight.
 */
export async function getSectorPerformance(region) {
  const sectors = getSectorsForRegion(region);
  const tickersInRegion = TICKER_DIRECTORY.filter((t) => getRegion(t) === region);
  const symbols = tickersInRegion.map((t) => t.symbol);

  const perfResults = await mapWithConcurrency(symbols, CONCURRENCY, (symbol) => getTickerPerformance(symbol));
  const perfBySymbol = {};
  symbols.forEach((symbol, i) => {
    perfBySymbol[symbol] = perfResults[i];
  });

  const bySector = sectors.map((sector) => {
    const members = tickersInRegion.filter((t) => t.sector === sector);
    const perfs = members.map((t) => perfBySymbol[t.symbol]).filter(Boolean);

    const avg = (key) => {
      const vals = perfs.map((p) => p[key]).filter((v) => v != null);
      return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    };

    return {
      sector,
      tickerCount: members.length,
      coveredCount: perfs.length,
      oneWeekPct: avg('oneWeekPct'),
      oneMonthPct: avg('oneMonthPct'),
      threeMonthPct: avg('threeMonthPct'),
    };
  });

  return bySector
    .filter((s) => s.coveredCount > 0)
    .sort((a, b) => (b.oneMonthPct ?? -Infinity) - (a.oneMonthPct ?? -Infinity));
}
