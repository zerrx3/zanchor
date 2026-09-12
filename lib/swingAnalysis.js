import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const DAILY_FETCH_DAYS = 260;
const DAILY_WINDOW = 90;
const HOURLY_FETCH_DAYS = 60;
const WEEKLY_FETCH_DAYS = 1095;
const PIVOT_LOOKBACK = 3;
const VOLUME_PROFILE_BINS = 40;
const HVN_THRESHOLD_MULT = 1.3;
const NEARBY_PCT = 0.15;
const CLUSTER_MERGE_PCT = 0.03;
const BAND_BUFFER_PCT = 0.0075;
const VOLUME_CONFIRM_MULT = 1.3;
const VOLUME_AVG_WINDOW = 20;

function toIsoDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normalizeBars(chart) {
  return (chart?.quotes || [])
    .filter((q) => q.close != null && q.high != null && q.low != null && q.open != null)
    .map((q) => ({ date: q.date, open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume || 0 }));
}

// ----------------------------------------------------------------------
// Indicators
// ----------------------------------------------------------------------

function emaSeries(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = seed;
  for (let i = period; i < values.length; i++) {
    seed = values[i] * k + seed * (1 - k);
    out[i] = seed;
  }
  return out;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    gains.push(Math.max(delta, 0));
    losses.push(Math.max(-delta, 0));
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function atr(bars, period = 14) {
  if (bars.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let val = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) val = (val * (period - 1) + trs[i]) / period;
  return val;
}

// ----------------------------------------------------------------------
// Structure: pivots, volume profile, 4H resampling
// ----------------------------------------------------------------------

function findPivotLows(bars, lookback = PIVOT_LOOKBACK) {
  const out = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const low = bars[i].low;
    let isPivot = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && bars[j].low < low) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) out.push({ price: low, date: bars[i].date });
  }
  return out;
}

function buildVolumeProfile(bars, bins = VOLUME_PROFILE_BINS) {
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
  let pocIdx = 0;
  for (let i = 1; i < bins; i++) if (vols[i] > vols[pocIdx]) pocIdx = i;
  return { lo, binSize, vols, pocPrice: lo + (pocIdx + 0.5) * binSize };
}

function nearestHvnBelow(profile, currentPrice) {
  if (!profile) return null;
  const { lo, binSize, vols } = profile;
  const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
  let best = null;
  for (let i = 0; i < vols.length; i++) {
    const binPrice = lo + (i + 0.5) * binSize;
    if (binPrice >= currentPrice) continue;
    if (vols[i] > avg * HVN_THRESHOLD_MULT) {
      if (!best || binPrice > best.price) best = { price: binPrice, volume: vols[i] };
    }
  }
  return best;
}

// Yahoo has no native 4H interval, so hourly bars are grouped into 4-hour
// clock buckets as a practical approximation of a 4H chart.
function resampleToFourHour(hourlyBars) {
  const buckets = new Map();
  for (const b of hourlyBars) {
    const hourEpoch = Math.floor(new Date(b.date).getTime() / 3600000);
    const key = Math.floor(hourEpoch / 4);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(b);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  return keys.map((k) => {
    const group = buckets.get(k);
    return {
      date: group[group.length - 1].date,
      open: group[0].open,
      high: Math.max(...group.map((g) => g.high)),
      low: Math.min(...group.map((g) => g.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((s, g) => s + (g.volume || 0), 0),
    };
  });
}

// ----------------------------------------------------------------------
// Strategy A: Trend & Mean Reversion (20/50 EMA + RSI)
// ----------------------------------------------------------------------

function strategyA(bars, timeframe) {
  const closes = bars.map((b) => b.close);
  const ema20Series = emaSeries(closes, 20);
  const ema50Series = emaSeries(closes, 50);
  const ema20 = ema20Series[ema20Series.length - 1];
  const ema50 = ema50Series[ema50Series.length - 1];
  if (ema20 == null || ema50 == null) return null;

  const priorIdx = Math.max(0, ema20Series.length - 6);
  const priorEma20 = ema20Series[priorIdx];
  const trendRising = priorEma20 != null && ema20 > priorEma20;

  const rsi = calcRSI(closes, 14);
  let rsiCondition = 'neutral';
  if (rsi != null) {
    if (rsi < 30) rsiCondition = 'oversold';
    else if (rsi >= 40 && rsi <= 50) rsiCondition = 'normalized';
  }

  return {
    timeframe,
    zoneLow: Math.min(ema20, ema50),
    zoneHigh: Math.max(ema20, ema50),
    ema20,
    ema50,
    rsi,
    rsiCondition,
    trendRising,
  };
}

// ----------------------------------------------------------------------
// Strategy B: Structural S/R + Volume Profile
// ----------------------------------------------------------------------

function strategyB(dailyBars, currentPrice) {
  const window = dailyBars.slice(-DAILY_WINDOW);
  const pivotLows = findPivotLows(window);
  const nearbyPivots = pivotLows
    .filter((p) => p.price < currentPrice && p.price >= currentPrice * (1 - NEARBY_PCT))
    .sort((a, b) => b.price - a.price);
  const nearestPivot = nearbyPivots[0] || null;

  const profile = buildVolumeProfile(window);
  const hvn = nearestHvnBelow(profile, currentPrice);

  let zoneLow;
  let zoneHigh;
  let note;

  if (nearestPivot && hvn) {
    const closeEnough = Math.abs(nearestPivot.price - hvn.price) / currentPrice <= CLUSTER_MERGE_PCT;
    if (closeEnough) {
      zoneLow = Math.min(nearestPivot.price, hvn.price);
      zoneHigh = Math.max(nearestPivot.price, hvn.price);
      note = 'A prior swing-low and a high-volume node align closely — a well-confirmed structural level.';
    } else {
      const primary = Math.max(nearestPivot.price, hvn.price);
      zoneLow = primary * (1 - BAND_BUFFER_PCT);
      zoneHigh = primary * (1 + BAND_BUFFER_PCT);
      note = 'Swing-low support and the nearest high-volume node don’t align closely — using the level nearer to price.';
    }
  } else if (nearestPivot || hvn) {
    const primary = (nearestPivot || hvn).price;
    zoneLow = primary * (1 - BAND_BUFFER_PCT);
    zoneHigh = primary * (1 + BAND_BUFFER_PCT);
    note = nearestPivot ? 'Based on the nearest prior swing-low support.' : 'Based on the nearest high-volume node.';
  } else {
    zoneLow = currentPrice * 0.95;
    zoneHigh = currentPrice * 0.97;
    note = 'No clear structural support found nearby — using a generic pullback band; treat with extra caution.';
  }

  return {
    zoneLow,
    zoneHigh,
    pivotSupport: nearestPivot,
    volumeNode: hvn,
    pocPrice: profile?.pocPrice ?? null,
    note,
  };
}

// ----------------------------------------------------------------------
// Strategy C: Fibonacci retracement + extension
// ----------------------------------------------------------------------

function strategyC(dailyBars) {
  const window = dailyBars.slice(-DAILY_WINDOW);

  let swingHighIdx = 0;
  for (let i = 1; i < window.length; i++) if (window[i].high > window[swingHighIdx].high) swingHighIdx = i;
  const swingHigh = window[swingHighIdx];

  let swingLowIdx = 0;
  for (let i = 1; i <= swingHighIdx; i++) if (window[i].low < window[swingLowIdx].low) swingLowIdx = i;
  const swingLow = window[swingLowIdx];

  const range = swingHigh.high - swingLow.low;
  if (!(range > 0)) return null;

  return {
    zoneLow: swingHigh.high - range * 0.618,
    zoneHigh: swingHigh.high - range * 0.5,
    swingHigh: swingHigh.high,
    swingHighDate: toIsoDate(swingHigh.date),
    swingLow: swingLow.low,
    swingLowDate: toIsoDate(swingLow.date),
    ext1272: swingLow.low + range * 1.272,
    ext1618: swingLow.low + range * 1.618,
    pulledBack: swingHighIdx < window.length - 1,
  };
}

// ----------------------------------------------------------------------
// Volume confirmation: is today's bar showing above-average volume while
// price actually sits inside the confluence entry zone?
// ----------------------------------------------------------------------

function volumeConfirmation(dailyBars, currentPrice, entryLow, entryHigh) {
  const recent = dailyBars.slice(-(VOLUME_AVG_WINDOW + 1));
  if (recent.length < VOLUME_AVG_WINDOW + 1) return null;

  const currentVolume = recent[recent.length - 1].volume;
  const priorBars = recent.slice(0, -1);
  const avgVolume = priorBars.reduce((s, b) => s + b.volume, 0) / priorBars.length;
  const ratio = avgVolume > 0 ? currentVolume / avgVolume : null;
  const priceInZone = currentPrice >= entryLow && currentPrice <= entryHigh;

  let status;
  let note;
  if (!priceInZone) {
    status = 'not-at-zone';
    note = "Price hasn't reached the confluence entry zone yet — nothing to confirm until it does.";
  } else if (ratio != null && ratio >= VOLUME_CONFIRM_MULT) {
    status = 'confirmed';
    note = 'Price is in the entry zone and today\'s volume is running well above average — a supportive sign buyers are active here.';
  } else {
    status = 'unconfirmed';
    note = "Price is in the entry zone, but volume hasn't picked up yet — waiting for a volume increase makes this a stronger trigger.";
  }

  return { currentVolume, avgVolume, ratio, priceInZone, status, note };
}

// ----------------------------------------------------------------------
// Confluence + risk
// ----------------------------------------------------------------------

function overlap(a, b) {
  const low = Math.max(a.zoneLow, b.zoneLow);
  const high = Math.min(a.zoneHigh, b.zoneHigh);
  return low <= high ? { low, high } : null;
}

function computeConfluence(A, B, C) {
  const ab = overlap(A, B);
  const ac = overlap(A, C);
  const bc = overlap(B, C);

  let zone = null;
  let confidence;
  let agreeing;

  if (ab && ac && bc) {
    const low = Math.max(A.zoneLow, B.zoneLow, C.zoneLow);
    const high = Math.min(A.zoneHigh, B.zoneHigh, C.zoneHigh);
    if (low <= high) {
      zone = { low, high };
      confidence = 'High';
      agreeing = ['A', 'B', 'C'];
    }
  }

  if (!zone) {
    const pairs = [
      { pair: ab, names: ['A', 'B'] },
      { pair: ac, names: ['A', 'C'] },
      { pair: bc, names: ['B', 'C'] },
    ].filter((p) => p.pair);
    if (pairs.length) {
      pairs.sort((x, y) => x.pair.high - x.pair.low - (y.pair.high - y.pair.low));
      zone = pairs[0].pair;
      confidence = 'Medium';
      agreeing = pairs[0].names;
    }
  }

  if (!zone) {
    const mids = [A, B, C].map((s) => (s.zoneLow + s.zoneHigh) / 2).sort((x, y) => x - y);
    const mid = mids[1];
    const width = ((A.zoneHigh - A.zoneLow) + (B.zoneHigh - B.zoneLow) + (C.zoneHigh - C.zoneLow)) / 3 / 2;
    zone = { low: mid - width, high: mid + width };
    confidence = 'Low';
    agreeing = [];
  }

  return {
    entryLow: zone.low,
    entryHigh: zone.high,
    midpoint: (zone.low + zone.high) / 2,
    confidence,
    agreeingStrategies: agreeing,
  };
}

/**
 * Runs the three-strategy confluence framework for a single ticker: Strategy
 * A (20/50 EMA + RSI trend pullback), Strategy B (horizontal S/R + volume
 * profile), Strategy C (Fibonacci golden-pocket retracement), then finds
 * where they overlap and derives entry, stop, and target levels from that.
 */
export async function analyzeSwingSetup(ticker) {
  const result = {
    ticker,
    name: '',
    currency: null,
    sector: null,
    currentPrice: null,
    asOf: null,
    fourHourAvailable: false,
    weeklyTrendAvailable: false,
    strategyA: null,
    strategyB: null,
    strategyC: null,
    dailyTrendContext: null,
    weeklyTrendContext: null,
    volumeConfirmation: null,
    confluence: null,
    risk: null,
    analystTarget: null,
    trendWarning: null,
    nextEarningsDate: null,
    daysToEarnings: null,
    earningsWarning: null,
    error: null,
  };

  try {
    const dailyPeriod1 = new Date();
    dailyPeriod1.setDate(dailyPeriod1.getDate() - DAILY_FETCH_DAYS);

    const [dailyChart, summary] = await Promise.all([
      yahooFinance.chart(ticker, { period1: dailyPeriod1, interval: '1d' }),
      yahooFinance.quoteSummary(
        ticker,
        { modules: ['price', 'assetProfile', 'calendarEvents', 'financialData'] },
        { validateResult: false }
      ),
    ]);

    const dailyBars = normalizeBars(dailyChart);
    if (dailyBars.length < 60) {
      result.error = `Not enough price history for '${ticker}' to run a swing analysis.`;
      return result;
    }

    const priceInfo = summary.price || {};
    const assetProfile = summary.assetProfile || {};
    const calendarEvents = summary.calendarEvents || {};
    const financialData = summary.financialData || {};

    result.name = priceInfo.shortName || priceInfo.longName || ticker;
    result.currency = priceInfo.currency || null;
    result.sector = assetProfile.sector || null;

    const currentPrice = dailyBars[dailyBars.length - 1].close;
    result.currentPrice = currentPrice;
    result.asOf = toIsoDate(dailyBars[dailyBars.length - 1].date);

    if (financialData.targetMeanPrice != null) {
      result.analystTarget = {
        price: financialData.targetMeanPrice,
        upsidePct: ((financialData.targetMeanPrice - currentPrice) / currentPrice) * 100,
      };
    }

    const hourlyPeriod1 = new Date();
    hourlyPeriod1.setDate(hourlyPeriod1.getDate() - HOURLY_FETCH_DAYS);
    const weeklyPeriod1 = new Date();
    weeklyPeriod1.setDate(weeklyPeriod1.getDate() - WEEKLY_FETCH_DAYS);

    const [hourlyChart, weeklyChart] = await Promise.all([
      yahooFinance.chart(ticker, { period1: hourlyPeriod1, interval: '60m' }).catch(() => null),
      yahooFinance.chart(ticker, { period1: weeklyPeriod1, interval: '1wk' }).catch(() => null),
    ]);

    const fourHourBars = hourlyChart ? resampleToFourHour(normalizeBars(hourlyChart)) : [];
    const weeklyBars = weeklyChart ? normalizeBars(weeklyChart) : [];
    const weeklyA = weeklyBars.length >= 55 ? strategyA(weeklyBars, 'Weekly') : null;

    const dailyA = strategyA(dailyBars, 'Daily');
    let A = fourHourBars.length >= 55 ? strategyA(fourHourBars, '4H') : null;
    if (A && dailyA) {
      const dailyMid = (dailyA.zoneLow + dailyA.zoneHigh) / 2;
      const aMid = (A.zoneLow + A.zoneHigh) / 2;
      if (Math.abs(aMid - dailyMid) / dailyMid > 0.2) A = dailyA; // 4H diverged too far from daily context — fall back
    } else if (!A) {
      A = dailyA;
    }
    result.fourHourAvailable = fourHourBars.length >= 55 && A?.timeframe === '4H';

    if (!A) {
      result.error = `Not enough price history for '${ticker}' to compute moving averages.`;
      return result;
    }

    const B = strategyB(dailyBars, currentPrice);
    const C = strategyC(dailyBars);
    if (!C) {
      result.error = `Could not identify a clear swing structure for '${ticker}'.`;
      return result;
    }

    result.strategyA = A;
    result.strategyB = B;
    result.strategyC = C;
    result.dailyTrendContext = dailyA
      ? { ema20: dailyA.ema20, ema50: dailyA.ema50, trendRising: dailyA.trendRising }
      : null;
    result.weeklyTrendAvailable = !!weeklyA;
    result.weeklyTrendContext = weeklyA
      ? { ema20: weeklyA.ema20, ema50: weeklyA.ema50, trendRising: weeklyA.trendRising }
      : null;

    const warnings = [];
    if (dailyA && !dailyA.trendRising) {
      warnings.push("The daily 20-day EMA isn't rising — this asset isn't in a confirmed uptrend, so a long swing pullback entry carries more risk than usual.");
    }
    if (weeklyA && !weeklyA.trendRising) {
      warnings.push('The weekly trend is flat or falling — buying a daily/4H pullback against a weaker higher-timeframe trend has a lower historical success rate.');
    }
    if (C && !C.pulledBack) {
      warnings.push('Price is still at or near its recent swing high — no pullback has happened yet, so the levels below are not yet actionable.');
    }
    result.trendWarning = warnings.length ? warnings.join(' ') : null;

    const confluence = computeConfluence(A, B, C);
    if (weeklyA && !weeklyA.trendRising) {
      confluence.confidence = 'Low'; // higher-timeframe trend overrides — countertrend setups don't earn High/Medium
    } else if (dailyA && !dailyA.trendRising && confluence.confidence === 'High') {
      confluence.confidence = 'Medium';
    }
    result.confluence = confluence;

    result.volumeConfirmation = volumeConfirmation(dailyBars, currentPrice, confluence.entryLow, confluence.entryHigh);

    const lowestSupport = Math.min(A.zoneLow, B.zoneLow, C.zoneLow);
    const atrDaily = atr(dailyBars.slice(-30), 14);
    const buffer = atrDaily != null ? atrDaily * 0.5 : lowestSupport * 0.01;
    const stopLoss = lowestSupport - buffer;

    const target1 = C.swingHigh;
    const target2 = C.ext1272;
    const riskPerShare = confluence.midpoint - stopLoss;
    const rewardToTarget1 = target1 - confluence.midpoint;
    const rewardToTarget2 = target2 - confluence.midpoint;

    result.risk = {
      stopLoss,
      target1,
      target2,
      riskPerShare,
      rewardToTarget1,
      rewardToTarget2,
      rrTarget1: riskPerShare > 0 ? rewardToTarget1 / riskPerShare : null,
      rrTarget2: riskPerShare > 0 ? rewardToTarget2 / riskPerShare : null,
    };

    const earningsDates = calendarEvents.earnings?.earningsDate;
    if (earningsDates && earningsDates.length > 0) {
      const nextEarnings = new Date(earningsDates[0]);
      const daysOut = Math.round((nextEarnings - new Date()) / (1000 * 60 * 60 * 24));
      result.nextEarningsDate = toIsoDate(nextEarnings);
      result.daysToEarnings = daysOut;
      if (daysOut >= 0 && daysOut <= 14) {
        result.earningsWarning = `Earnings are expected in ${daysOut} day${daysOut === 1 ? '' : 's'} (${result.nextEarningsDate}) — inside this trade's holding window. An earnings gap can jump straight past both the stop loss and the targets overnight.`;
      }
    }
  } catch (exc) {
    result.error = `Unexpected error: ${exc.message}`;
  }

  return result;
}
