import YahooFinance from 'yahoo-finance2';
import { analyzeTicker } from './stockAnalysis';
import { analyzeSwingSetup } from './swingAnalysis';
import { currencyPrefix } from './currency';
import { findPivots, findClusterLevel } from './priceLevels';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Preferred expiration window: the classic theta-decay/gamma-risk tradeoff
// for premium-selling strategies. Falls back to the closest available
// expiration if none fall inside this window.
const TARGET_DTE_MIN = 25;
const TARGET_DTE_MAX = 45;
const TARGET_DTE_MID = 35;

const HV_LOOKBACK_DAYS = 30;
// Also the window computeStructuralLevel and findClusterLevel search for
// levels (there's no Swing Strategy equivalent for the short side, so this
// is the only data those get). Bumped to just over a year specifically so
// multi-touch cluster detection (see findClusterLevel) has enough history
// to find levels tested more than once — a 90-150 day window was too thin
// to ever see a level get retested months apart.
const HV_FETCH_DAYS = 400;

// Structural support/resistance detection for strike selection — a lighter
// version of Swing Strategy's structural analysis (lib/swingAnalysis.js:
// pivot swing points + volume-profile high-volume nodes), reusing the daily
// bars already fetched for the historical-vol calc instead of a second fetch.
const STRUCTURE_PIVOT_LOOKBACK = 2;
const STRUCTURE_NEARBY_PCT = 0.15;
const STRUCTURE_HVN_MULT = 1.3;
const STRUCTURE_CLUSTER_MERGE_PCT = 0.03;
const STRUCTURE_VOLUME_BINS = 24;
// A "support" a few tenths of a percent below price is just this week's
// noise, not a real level — require at least this much separation before
// treating a pivot/HVN as meaningfully different from the at-the-money strike.
const STRUCTURE_MIN_DISTANCE_PCT = 0.02;

function toIsoDate(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function mapContract(c) {
  return {
    strike: c.strike,
    bid: c.bid ?? null,
    ask: c.ask ?? null,
    lastPrice: c.lastPrice ?? null,
    volume: c.volume ?? null,
    openInterest: c.openInterest ?? null,
    impliedVolatilityPct: c.impliedVolatility != null ? c.impliedVolatility * 100 : null,
    inTheMoney: !!c.inTheMoney,
  };
}

function closestByStrike(contracts, price) {
  if (!contracts.length) return null;
  return contracts.reduce((best, c) => (Math.abs(c.strike - price) < Math.abs(best.strike - price) ? c : best));
}

function normalizeDailyBars(chart) {
  return (chart?.quotes || [])
    .filter((q) => q.close != null && q.high != null && q.low != null)
    .map((q) => ({ date: q.date, high: q.high, low: q.low, close: q.close, volume: q.volume || 0 }));
}

function buildVolumeProfile(bars, bins = STRUCTURE_VOLUME_BINS) {
  const lo = Math.min(...bars.map((b) => b.low));
  const hi = Math.max(...bars.map((b) => b.high));
  if (!(hi > lo)) return null;
  const binSize = (hi - lo) / bins;
  const vols = new Array(bins).fill(0);
  for (const b of bars) {
    const startBin = Math.min(bins - 1, Math.max(0, Math.floor((b.low - lo) / binSize)));
    const endBin = Math.min(bins - 1, Math.max(0, Math.floor((b.high - lo) / binSize)));
    const span = endBin - startBin + 1;
    const volPerBin = (b.volume || 0) / span;
    for (let i = startBin; i <= endBin; i++) vols[i] += volPerBin;
  }
  return { lo, binSize, vols };
}

function nearestHvn(profile, currentPrice, direction) {
  if (!profile) return null;
  const { lo, binSize, vols } = profile;
  const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
  let best = null;
  for (let i = 0; i < vols.length; i++) {
    const binPrice = lo + (i + 0.5) * binSize;
    if (direction === 'below' ? binPrice >= currentPrice : binPrice <= currentPrice) continue;
    if (vols[i] > avg * STRUCTURE_HVN_MULT) {
      const better = direction === 'below' ? !best || binPrice > best.price : !best || binPrice < best.price;
      if (better) best = { price: binPrice };
    }
  }
  return best;
}

// Nearest support ('below') or resistance ('above') level within
// STRUCTURE_NEARBY_PCT of price — a swing pivot and/or a high-volume node,
// whichever is nearer when they don't roughly agree. Returns null when
// nothing structural is nearby (caller falls back to the at-the-money strike).
function computeStructuralLevel(bars, currentPrice, direction) {
  if (!bars.length || currentPrice == null) return null;
  const pivots = findPivots(bars, STRUCTURE_PIVOT_LOOKBACK, direction)
    .filter((p) =>
      direction === 'below'
        ? p.price < currentPrice && p.price >= currentPrice * (1 - STRUCTURE_NEARBY_PCT)
        : p.price > currentPrice && p.price <= currentPrice * (1 + STRUCTURE_NEARBY_PCT)
    )
    .sort((a, b) => (direction === 'below' ? b.price - a.price : a.price - b.price));
  const nearestPivot = pivots[0] || null;

  const profile = buildVolumeProfile(bars);
  const hvn = nearestHvn(profile, currentPrice, direction);

  let price = null;
  if (nearestPivot && hvn) {
    const closeEnough = Math.abs(nearestPivot.price - hvn.price) / currentPrice <= STRUCTURE_CLUSTER_MERGE_PCT;
    price = closeEnough
      ? (nearestPivot.price + hvn.price) / 2
      : direction === 'below'
        ? Math.max(nearestPivot.price, hvn.price)
        : Math.min(nearestPivot.price, hvn.price);
  } else if (nearestPivot || hvn) {
    price = (nearestPivot || hvn).price;
  }
  if (price == null || Math.abs(price - currentPrice) / currentPrice < STRUCTURE_MIN_DISTANCE_PCT) return null;
  return { price };
}

// Annualized close-to-close historical volatility from daily log returns —
// used as a stand-in for true IV Rank, which needs a year of historical IV
// that Yahoo doesn't expose. This compares current implied vol against
// *realized* vol instead, which is the same underlying question (is options
// premium rich or cheap right now) via a metric we can actually compute.
function computeHistoricalVolatilityPct(closes) {
  if (closes.length < 10) return null;
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (returns.length < 5) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

// Rationale copy for premium-selling / premium-buying candidates used to
// unconditionally claim "implied vol is elevated" or "running low" — true
// only in the ideal case, and silently wrong the rest of the time (e.g. a
// "Normal" regime, which covers a wide middle band and is a common result).
// These phrase the same idea honestly against whatever the actual regime is.
function sellPremiumNote(volRegime) {
  if (volRegime === 'Elevated') return 'implied vol is running elevated right now, so premium is rich';
  if (volRegime === 'Low')
    return "implied vol is actually running low right now, so premium is cheaper than this trade's elevated-vol ideal";
  return "implied vol is roughly in line with its recent realized moves right now — no strong premium edge either way";
}

function buyPremiumNote(volRegime) {
  if (volRegime === 'Low') return 'implied vol is running low right now, keeping the cost down';
  if (volRegime === 'Elevated')
    return "implied vol is running elevated right now, so this costs more than this trade's low-vol ideal";
  return "implied vol is roughly in line with its recent realized moves right now — no strong cost edge either way";
}

// Standalone sentences (not sentence fragments) so the UI can box these
// separately from the general trade rationale — the confidence read is a
// distinct claim from "here's what this strategy does," worth its own
// green/red callout rather than being buried mid-paragraph.
// Describes whichever level source won — a multi-touch cluster (the
// strongest signal: this price has actually been retested) beats a
// Swing Strategy confluence zone, which beats a single nearby pivot.
function levelSourceDescription(level) {
  if (level.touches) return `a level retested ${level.touches}× over the past year`;
  if (level.confidence) return `Swing Strategy's ${level.confidence.toLowerCase()}-confidence entry zone`;
  return 'a nearby structural level';
}

function putLevelNote(ticker, supportLevel) {
  if (!supportLevel) {
    return `No confident support level was found for ${ticker} right now — selling at-the-money isn't a substitute, since it carries a much higher assignment probability than this trade is meant to. Worth waiting for a pullback that establishes a clearer level.`;
  }
  return `Sold near ${levelSourceDescription(supportLevel)} (~$${supportLevel.price.toFixed(2)}) rather than at-the-money, for a meaningfully lower assignment probability.`;
}

function callLevelNote(ticker, resistanceLevel) {
  if (!resistanceLevel) {
    return `No confident resistance level was found for ${ticker} right now — selling at-the-money isn't a substitute, since it carries a much higher assignment probability than this trade is meant to. Worth waiting for a rally that establishes a clearer level.`;
  }
  return `Sold near ${levelSourceDescription(resistanceLevel)} (~$${resistanceLevel.price.toFixed(2)}) rather than at-the-money, for a meaningfully lower assignment probability.`;
}

// Capital-note copy used to just say "1 ATM contract" / "strike × 100
// shares" without ever naming the actual strike or premium behind that
// dollar figure — leaving the reader unable to check the math. These spell
// out the specific strike and price so the figure above is traceable.
function longContractNote(contract, currency) {
  if (!contract || contract.ask == null) {
    return '= the premium paid for 1 ATM contract (100 shares) — this is the entire max loss too.';
  }
  return `= premium paid for 1 contract at the ${currencyPrefix(currency)}${contract.strike} strike (ask ${currencyPrefix(currency)}${contract.ask.toFixed(2)} × 100 shares) — this is the entire max loss too.`;
}

function straddleContractNote(call, put, currency) {
  if (!call?.ask || !put?.ask) {
    return '= the combined premium for 1 ATM call + 1 ATM put — this is the entire max loss too.';
  }
  return `= combined premium for 1 ${currencyPrefix(currency)}${call.strike} call (ask ${currencyPrefix(currency)}${call.ask.toFixed(2)}) + 1 ${currencyPrefix(currency)}${put.strike} put (ask ${currencyPrefix(currency)}${put.ask.toFixed(2)}) — this is the entire max loss too.`;
}

function shortPutCapitalNote(contract, currency) {
  return `≈ ${currencyPrefix(currency)}${contract.strike} strike × 100 shares — the full cash needed to secure 1 contract.`;
}

function marginNote(contract, currency) {
  return `≈20% Reg-T estimate on the ${currencyPrefix(currency)}${contract.strike} strike — actual margin varies by broker.`;
}

// Seeds the client's "Your View" picker from Stock Analyzer's own 5-tier
// verdict — a reasonable starting point, not the final word. The client can
// override it; buildCandidates below builds every bucket regardless of
// verdict so that override doesn't need a re-fetch.
function impliedViewFromVerdict(verdict) {
  const map = {
    'Strong Buy': 'Bullish',
    Buy: 'Mildly Bullish',
    Hold: 'Neutral',
    Sell: 'Mildly Bearish',
    Avoid: 'Bearish',
  };
  return map[verdict] || 'Neutral';
}

const SPREAD_CAPITAL_NOTE =
  'Depends on the strikes you choose — a defined-risk spread typically needs a fraction of a single-leg position. Exact figure comes once strike selection is added.';

// Deliberately simple and explainable, matching this app's rules-based
// (not black-box) approach elsewhere. Directional bias (reused from Stock
// Analyzer's own scoring) determines the candidate pool; each candidate is
// tagged with its risk type, the vol regime it best fits, and which stated
// goal(s) it serves — ranking against those tags happens client-side
// (rankSuggestions) so adjusting the questionnaire re-sorts instantly
// without a new fetch.
//
// Capital required is only computed for single-leg strategies (cash-secured
// put, naked put/call, long call/put, straddle) since those use real chain
// data already fetched. Multi-leg strategies (spreads, iron condor) don't
// have chosen strikes yet, so their capital requirement is honestly deferred
// rather than estimated from a made-up spread width — that's strike/
// expiration optimization, a later phase.
//
// Strike choice: premium-selling single-leg puts/calls (cash-secured put,
// naked put/call) use a nearby support/resistance level instead of
// at-the-money, since selling exactly ATM carries a much higher assignment
// probability than the strikes traders actually use for these trades. The
// put side reuses Swing Strategy's own confluence entry zone (see
// analyzeSwingSetup in swingAnalysis.js) gated on Medium/High confidence —
// a stronger, multi-timeframe read than anything worth duplicating here.
// There's no bearish/resistance equivalent in Swing Strategy, so the call
// side falls back to a lighter local pivot/volume-node check instead (see
// computeStructuralLevel). Either way, when nothing confident is found
// nearby, the strategy is left out of the pool entirely rather than
// silently falling back to an ATM strike nobody would actually suggest
// selling. Directional/volatility strategies (long call/put, straddle)
// keep the at-the-money strike, which is the normal choice there.
function buildCandidates(r, { atmCall, atmPut, supportPut, resistanceCall, supportLevel, resistanceLevel } = {}) {
  const candidates = [];

  // Bullish bucket — shown when the client's stated view is Bullish or
  // Mildly Bullish, regardless of what Stock Analyzer's own verdict says.
  // Cash-Secured Put and Covered Call always appear (rather than being left
  // out) when no confident support/resistance level exists — but honestly
  // say so and suggest waiting, instead of quietly picking an ATM strike
  // nobody would actually sell at.
  candidates.push({
    strategy: 'Cash-Secured Put',
    biasBucket: 'bullish',
    convictionLevel: 'mild',
    direction: 'Neutral to Mildly Bullish',
    riskType: 'defined',
    idealVolRegime: 'Elevated',
    goalFit: ['income'],
    rationale: `Selling a put on a bullish-to-neutral view collects premium, and ${sellPremiumNote(r.volRegime)}, at a price you'd be comfortable owning the stock at.`,
    levelNote: putLevelNote(r.ticker, supportLevel),
    capitalRequired: supportPut ? supportPut.strike * 100 : null,
    capitalNote: supportPut ? shortPutCapitalNote(supportPut, r.currency) : null,
    strikeBadges: supportPut ? [{ price: supportPut.strike, optionType: 'put' }] : [],
    levelFound: !!supportPut,
  });
  candidates.push({
    strategy: 'Covered Call',
    biasBucket: 'bullish',
    convictionLevel: 'mild',
    direction: 'Neutral to Mildly Bullish',
    riskType: 'defined',
    idealVolRegime: 'Elevated',
    goalFit: ['income'],
    rationale: `Sell a call against 100 shares you already own (or are willing to buy), and ${sellPremiumNote(r.volRegime)}.`,
    levelNote: callLevelNote(r.ticker, resistanceLevel),
    capitalRequired: null,
    capitalNote: resistanceCall
      ? 'No new cash required beyond the shares you already hold — this only reduces your effective cost basis on them.'
      : null,
    strikeBadges: resistanceCall ? [{ price: resistanceCall.strike, optionType: 'call' }] : [],
    levelFound: !!resistanceCall,
  });
  candidates.push(
    {
      strategy: 'Bull Put Credit Spread',
      biasBucket: 'bullish',
      convictionLevel: 'mild',
      direction: 'Neutral to Mildly Bullish',
      riskType: 'defined',
      idealVolRegime: 'Elevated',
      goalFit: ['income', 'protection'],
      rationale: `A bullish, premium-selling trade — ${sellPremiumNote(r.volRegime)} — where a long put underneath caps the loss if the stock drops sharply instead of being assigned the full position.`,
      capitalRequired: null,
      capitalNote: SPREAD_CAPITAL_NOTE,
    },
    {
      strategy: 'Bull Call Debit Spread',
      biasBucket: 'bullish',
      convictionLevel: 'strong',
      direction: 'Bullish',
      riskType: 'defined',
      idealVolRegime: 'Low',
      goalFit: ['speculative', 'protection'],
      rationale: `Buying a call spread — ${buyPremiumNote(r.volRegime)} — caps the max loss to the debit paid.`,
      capitalRequired: null,
      capitalNote: SPREAD_CAPITAL_NOTE,
    },
    {
      strategy: 'Long Call',
      biasBucket: 'bullish',
      convictionLevel: 'strong',
      direction: 'Bullish',
      riskType: 'defined',
      idealVolRegime: 'Low',
      goalFit: ['speculative'],
      rationale: `A simple, undiluted bullish bet — max loss is the premium paid, upside uncapped; ${buyPremiumNote(r.volRegime)}.`,
      capitalRequired: atmCall?.ask != null ? atmCall.ask * 100 : null,
      capitalNote: longContractNote(atmCall, r.currency),
      strikeBadges: atmCall ? [{ price: atmCall.strike, optionType: 'call' }] : [],
    }
  );
  candidates.push({
    strategy: 'Naked Put',
    biasBucket: 'bullish',
    convictionLevel: 'mild',
    direction: 'Neutral to Mildly Bullish',
    riskType: 'undefined',
    idealVolRegime: 'Elevated',
    goalFit: ['income'],
    rationale: `Same idea as the cash-secured put — ${sellPremiumNote(r.volRegime)} — but without setting aside the full cash to buy the shares, at the cost of margin/assignment risk if the position is not fully funded.`,
    levelNote: putLevelNote(r.ticker, supportLevel),
    capitalRequired: supportPut ? supportPut.strike * 100 * 0.2 : null,
    capitalNote: supportPut ? marginNote(supportPut, r.currency) : null,
    strikeBadges: supportPut ? [{ price: supportPut.strike, optionType: 'put' }] : [],
    levelFound: !!supportPut,
  });

  // Bearish bucket — shown for Bearish / Mildly Bearish views.
  candidates.push(
    {
      strategy: 'Bear Call Credit Spread',
      biasBucket: 'bearish',
      convictionLevel: 'mild',
      direction: 'Neutral to Mildly Bearish',
      riskType: 'defined',
      idealVolRegime: 'Elevated',
      goalFit: ['income', 'protection'],
      rationale: `Selling a call spread collects premium on a bearish-to-neutral view — ${sellPremiumNote(r.volRegime)} — while capping the risk if the stock rallies instead.`,
      capitalRequired: null,
      capitalNote: SPREAD_CAPITAL_NOTE,
    },
    {
      strategy: 'Bear Put Debit Spread',
      biasBucket: 'bearish',
      convictionLevel: 'strong',
      direction: 'Bearish',
      riskType: 'defined',
      idealVolRegime: 'Low',
      goalFit: ['speculative', 'protection'],
      rationale: `Buying a put spread — ${buyPremiumNote(r.volRegime)} — caps the max loss to the debit paid.`,
      capitalRequired: null,
      capitalNote: SPREAD_CAPITAL_NOTE,
    },
    {
      strategy: 'Long Put',
      biasBucket: 'bearish',
      convictionLevel: 'strong',
      direction: 'Bearish',
      riskType: 'defined',
      idealVolRegime: 'Low',
      goalFit: ['speculative', 'protection'],
      rationale: `A simple, undiluted bearish bet — max loss is the premium paid; ${buyPremiumNote(r.volRegime)}. Works equally as portfolio insurance against an existing long position, not just a fresh bearish bet.`,
      capitalRequired: atmPut?.ask != null ? atmPut.ask * 100 : null,
      capitalNote: longContractNote(atmPut, r.currency),
      strikeBadges: atmPut ? [{ price: atmPut.strike, optionType: 'put' }] : [],
    }
  );
  candidates.push({
    strategy: 'Naked Call',
    biasBucket: 'bearish',
    convictionLevel: 'mild',
    direction: 'Neutral to Mildly Bearish',
    riskType: 'undefined',
    idealVolRegime: 'Elevated',
    goalFit: ['income'],
    rationale: `Selling a call without owning the stock collects premium on a bearish-to-neutral view — ${sellPremiumNote(r.volRegime)} — but carries theoretically unlimited loss if the stock rallies hard instead.`,
    levelNote: callLevelNote(r.ticker, resistanceLevel),
    capitalRequired: resistanceCall ? resistanceCall.strike * 100 * 0.2 : null,
    capitalNote: resistanceCall ? marginNote(resistanceCall, r.currency) : null,
    strikeBadges: resistanceCall ? [{ price: resistanceCall.strike, optionType: 'call' }] : [],
    levelFound: !!resistanceCall,
  });

  // Neutral bucket — shown for a Neutral view: Iron Condor bets price stays
  // inside the range, the straddle/strangle bets it breaks out of it.
  candidates.push(
    {
      strategy: 'Iron Condor',
      biasBucket: 'neutral',
      direction: 'Neutral',
      riskType: 'defined',
      idealVolRegime: 'Elevated',
      goalFit: ['income', 'protection'],
      rationale: `No strong directional edge, and ${sellPremiumNote(r.volRegime)} — an iron condor sells that premium on both sides with the risk capped.`,
      capitalRequired: null,
      capitalNote: SPREAD_CAPITAL_NOTE,
    },
    {
      strategy: 'Long Straddle / Strangle',
      biasBucket: 'neutral',
      direction: 'Neutral (volatility play)',
      riskType: 'defined',
      // A straddle is a premium-buying strategy — it should compete like
      // one (favoring Low vol) rather than get a baseline "Any" score in
      // every scenario, UNLESS there's a genuine catalyst (earnings) that
      // justifies paying elevated premium for the expected move anyway.
      idealVolRegime: r.earningsWithinExpiration ? 'Any' : 'Low',
      goalFit: ['speculative'],
      rationale: r.earningsWithinExpiration
        ? 'Earnings fall inside this expiration — if the goal is to play the earnings move itself rather than a direction, this profits from a big move either way.'
        : `For betting purely on a big move without a directional view, regardless of which way it breaks — ${buyPremiumNote(r.volRegime)}.`,
      capitalRequired: atmCall?.ask != null && atmPut?.ask != null ? (atmCall.ask + atmPut.ask) * 100 : null,
      capitalNote: straddleContractNote(atmCall, atmPut, r.currency),
      strikeBadges: [
        ...(atmCall ? [{ price: atmCall.strike, optionType: 'call' }] : []),
        ...(atmPut ? [{ price: atmPut.strike, optionType: 'put' }] : []),
      ],
    }
  );

  candidates.push({
    strategy: 'No Clear Edge',
    biasBucket: null,
    direction: 'Neutral',
    riskType: 'n/a',
    idealVolRegime: 'Any',
    goalFit: [],
    isFallback: true,
    rationale: "If none of the above line up with your volatility read or stated goal, it may be worth waiting for a cleaner setup rather than forcing a trade.",
    capitalRequired: null,
    capitalNote: null,
  });

  return candidates;
}

function buildEarningsWarning(r) {
  if (!r.earningsWithinExpiration) return null;
  return {
    strategy: 'Earnings Falls Inside This Expiration',
    direction: 'Risk flag',
    riskType: 'warning',
    rationale: `This expiration includes an earnings report on ${r.nextEarningsDate} — a single-day move here can blow past the strikes chosen above regardless of the setup. Consider a shorter expiration that avoids the report, or size down.`,
  };
}

export async function analyzeOptionsStrategy(ticker) {
  const result = {
    ticker,
    name: '',
    currency: null,
    currentPrice: null,
    compositeScorePct: null,
    verdict: null,
    impliedView: null,
    nextEarningsDate: null,
    daysToEarnings: null,
    expirations: [],
    selectedExpiration: null,
    daysToExpiration: null,
    earningsWithinExpiration: false,
    historicalVolatilityPct: null,
    atmImpliedVolatilityPct: null,
    volRegime: null,
    supportCluster: null,
    resistanceCluster: null,
    chain: { calls: [], puts: [] },
    suggestions: [],
    earningsWarning: null,
    error: null,
  };

  try {
    const dailyPeriod1 = new Date();
    dailyPeriod1.setDate(dailyPeriod1.getDate() - HV_FETCH_DAYS);

    const [optionsInit, analysis, dailyChart, swingSetup] = await Promise.all([
      yahooFinance.options(ticker),
      analyzeTicker(ticker),
      yahooFinance.chart(ticker, { period1: dailyPeriod1, interval: '1d' }).catch(() => null),
      analyzeSwingSetup(ticker).catch(() => null),
    ]);

    if (analysis.error) {
      result.error = analysis.error;
      return result;
    }

    const expirationDates = optionsInit.expirationDates || [];
    if (expirationDates.length === 0) {
      result.error = `No options chain is available for '${ticker}'.`;
      return result;
    }

    result.name = analysis.name;
    result.currency = analysis.currency;
    result.currentPrice = optionsInit.quote?.regularMarketPrice ?? analysis.price;
    result.compositeScorePct = analysis.compositeScorePct;
    result.verdict = analysis.verdict;
    result.impliedView = impliedViewFromVerdict(analysis.verdict);
    result.nextEarningsDate = analysis.nextEarningsDate;
    result.daysToEarnings = analysis.daysToEarnings;
    result.expirations = expirationDates.map((d) => toIsoDate(d));

    const now = Date.now();
    const withDte = expirationDates.map((d) => ({ date: d, dte: Math.round((new Date(d) - now) / 86400000) }));
    const inRange = withDte.filter((e) => e.dte >= TARGET_DTE_MIN && e.dte <= TARGET_DTE_MAX);
    const pool = inRange.length > 0 ? inRange : withDte;
    const target = pool.reduce((best, e) =>
      Math.abs(e.dte - TARGET_DTE_MID) < Math.abs(best.dte - TARGET_DTE_MID) ? e : best
    );

    const chainRes = await yahooFinance.options(ticker, { date: target.date });
    const chain = chainRes.options?.[0];
    if (!chain) {
      result.error = `Could not load the options chain for '${ticker}'.`;
      return result;
    }

    result.selectedExpiration = toIsoDate(target.date);
    result.daysToExpiration = target.dte;
    result.earningsWithinExpiration =
      result.daysToEarnings != null && result.daysToEarnings >= 0 && result.daysToEarnings <= target.dte;

    result.chain = {
      calls: (chain.calls || []).map(mapContract).sort((a, b) => a.strike - b.strike),
      puts: (chain.puts || []).map(mapContract).sort((a, b) => a.strike - b.strike),
    };

    const price = result.currentPrice;
    let atmCall = null;
    let atmPut = null;
    if (price != null) {
      atmCall = closestByStrike(result.chain.calls, price);
      atmPut = closestByStrike(result.chain.puts, price);
      const ivSamples = [atmCall?.impliedVolatilityPct, atmPut?.impliedVolatilityPct].filter(
        (v) => v != null && v > 0
      );
      result.atmImpliedVolatilityPct = ivSamples.length
        ? ivSamples.reduce((a, b) => a + b, 0) / ivSamples.length
        : null;
    }

    const closes = (dailyChart?.quotes || []).map((q) => q.close).filter((c) => c != null);
    result.historicalVolatilityPct = computeHistoricalVolatilityPct(closes.slice(-HV_LOOKBACK_DAYS));

    if (
      result.atmImpliedVolatilityPct != null &&
      result.historicalVolatilityPct != null &&
      result.historicalVolatilityPct > 0
    ) {
      const ratio = result.atmImpliedVolatilityPct / result.historicalVolatilityPct;
      result.volRegime = ratio >= 1.25 ? 'Elevated' : ratio <= 0.8 ? 'Low' : 'Normal';
    }

    const dailyBars = normalizeDailyBars(dailyChart);
    result.supportCluster = findClusterLevel(dailyBars, price, 'below');
    result.resistanceCluster = findClusterLevel(dailyBars, price, 'above');

    // Strike selection prefers the strongest available signal: a level
    // that's actually been retested multiple times beats a Swing Strategy
    // confluence zone (its confidence tier measures agreement on a precise
    // pullback BUY entry — a higher, differently-aimed bar than a put
    // strike needs), which beats a single nearby pivot. Swing Strategy's
    // confidence tier is used at ANY level (not gated to Medium/High) —
    // gating it meant a stock in a clean, uninterrupted uptrend (no
    // pullback yet to measure) got excluded most often, which is backwards
    // for exactly the Bullish view that uptrend would produce.
    const singleTouchSupport =
      !swingSetup?.error && swingSetup?.confluence
        ? { price: swingSetup.confluence.midpoint, confidence: swingSetup.confluence.confidence }
        : computeStructuralLevel(dailyBars, price, 'below');
    const supportLevel = result.supportCluster || singleTouchSupport;
    const resistanceLevel = result.resistanceCluster || computeStructuralLevel(dailyBars, price, 'above');
    const supportPut = supportLevel ? closestByStrike(result.chain.puts, supportLevel.price) : null;
    const resistanceCall = resistanceLevel ? closestByStrike(result.chain.calls, resistanceLevel.price) : null;

    result.suggestions = buildCandidates(result, { atmCall, atmPut, supportPut, resistanceCall, supportLevel, resistanceLevel });
    result.earningsWarning = buildEarningsWarning(result);
  } catch (exc) {
    result.error = `Unexpected error: ${exc.message}`;
  }

  return result;
}

export async function fetchExpirationChain(ticker, expirationDate) {
  const chainRes = await yahooFinance.options(ticker, { date: new Date(expirationDate) });
  const chain = chainRes.options?.[0];
  if (!chain) return null;
  return {
    calls: (chain.calls || []).map(mapContract).sort((a, b) => a.strike - b.strike),
    puts: (chain.puts || []).map(mapContract).sort((a, b) => a.strike - b.strike),
  };
}
