// Shared pivot/cluster support-resistance logic — used by both
// lib/swingAnalysis.js (entry-zone structural analysis) and
// lib/optionsAnalysis.js (strike selection + the "Strong Support /
// Resistance" reference). Kept dependency-free (no yahoo-finance2 import)
// so it's safe to import from either a server-only or client-safe context.

// Finds local swing lows ('below') or highs ('above') — a bar whose
// low/high is more extreme than every other bar within `lookback` bars on
// either side.
export function findPivots(bars, lookback, direction) {
  const out = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const val = direction === 'below' ? bars[i].low : bars[i].high;
    let isPivot = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      const other = direction === 'below' ? bars[j].low : bars[j].high;
      if (direction === 'below' ? other < val : other > val) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) out.push({ price: val, date: bars[i].date });
  }
  return out;
}

const CLUSTER_PIVOT_LOOKBACK = 5;
const CLUSTER_MERGE_PCT = 0.02;
const CLUSTER_NEARBY_PCT = 0.3;
const CLUSTER_MIN_TOUCHES = 2;

// Multi-touch cluster support/resistance — deliberately different from a
// "nearest single pivot" read: this groups all nearby pivots into clusters
// and ranks by touch count first, distance second. A level retested 3
// times months apart is a materially stronger reference than a level
// touched once last week, even if the once-touched level sits closer to
// today's price. Needs a wide bars window (a year+) to have any chance of
// seeing a level get retested months apart — callers should fetch
// accordingly.
export function findClusterLevel(bars, currentPrice, direction) {
  if (!bars.length || currentPrice == null) return null;
  const pivots = findPivots(bars, CLUSTER_PIVOT_LOOKBACK, direction).filter((p) =>
    direction === 'below'
      ? p.price < currentPrice && p.price >= currentPrice * (1 - CLUSTER_NEARBY_PCT)
      : p.price > currentPrice && p.price <= currentPrice * (1 + CLUSTER_NEARBY_PCT)
  );
  if (!pivots.length) return null;

  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const clusters = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(p.price - last.avgPrice) / last.avgPrice <= CLUSTER_MERGE_PCT) {
      last.prices.push(p.price);
      last.avgPrice = last.prices.reduce((a, b) => a + b, 0) / last.prices.length;
    } else {
      clusters.push({ prices: [p.price], avgPrice: p.price });
    }
  }

  const qualifying = clusters.filter((c) => c.prices.length >= CLUSTER_MIN_TOUCHES);
  if (!qualifying.length) return null;

  qualifying.sort((a, b) => {
    if (b.prices.length !== a.prices.length) return b.prices.length - a.prices.length;
    return Math.abs(a.avgPrice - currentPrice) - Math.abs(b.avgPrice - currentPrice);
  });
  const best = qualifying[0];
  return { price: best.avgPrice, touches: best.prices.length };
}
