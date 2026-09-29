// Pure, client-safe ranking/sizing logic for Options Strategy — deliberately
// kept separate from lib/optionsAnalysis.js, which imports yahoo-finance2
// (a server-only dependency that can't be bundled for the browser). This
// file has no such dependency, so the client page can import it directly.

// Shared with the Strategy Guide page's per-card anchor ids, so a
// "Read more" link from a suggestion card can jump straight to it.
export function strategySlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Tiebreak order when two candidates score identically — prefer the lower-
// risk option first (even under Aggressive tolerance, an equally-fitting
// defined-risk trade should still outrank an undefined-risk one). Anything
// left tied after this falls back to the order buildCandidates defined them
// in, which is a deliberate, stable fallback (Array.sort is stable), not an
// accident.
const RISK_TYPE_RANK = { defined: 0, warning: 1, 'n/a': 2, undefined: 3 };

// The 5-point "Your View" scale maps onto both which bias bucket to show
// (bullish/bearish/neutral candidates all come back from the server
// regardless of its own verdict) and which conviction level within that
// bucket to prefer — mild conviction favors premium-selling trades that
// only need price to not move against you, strong conviction favors
// premium-buying trades that need an actual move to pay off.
const VIEW_BUCKET = {
  Bullish: 'bullish',
  'Mildly Bullish': 'bullish',
  Neutral: 'neutral',
  'Mildly Bearish': 'bearish',
  Bearish: 'bearish',
};

const VIEW_CONVICTION = {
  Bullish: 'strong',
  'Mildly Bullish': 'mild',
  Neutral: 'neutral',
  'Mildly Bearish': 'mild',
  Bearish: 'strong',
};

// Client-side ranking so adjusting the view/risk tolerance/goal re-sorts
// instantly without another fetch. Undefined-risk candidates are excluded
// entirely unless risk tolerance is explicitly "Aggressive". Candidates
// outside the selected view's bias bucket are excluded outright, same for
// a mismatched goal, AND (as of this pass) a mismatched conviction level —
// e.g. a genuinely Bullish (strong) view should never surface a
// Cash-Secured Put, because capping your gain at the premium collected
// directly contradicts wanting to catch a real rally; that's not a
// "slightly worse fit," it's the wrong trade for that view. Conviction is
// only enforced for Bullish/Bearish/Mildly-X views — Neutral has no
// mild/strong split (Goal alone decides Iron Condor vs. the straddle). A
// universal fallback (biasBucket/convictionLevel: null/undefined,
// goalFit: []) is exempt from every filter so there's always something to
// show.
export function rankSuggestions(candidates, { volRegime, goal, riskTolerance, view } = {}) {
  const tolerance = riskTolerance || 'Conservative';
  const targetBucket = VIEW_BUCKET[view];
  const targetConviction = VIEW_CONVICTION[view];

  const filtered = (candidates || []).filter((c) => {
    if (c.riskType === 'undefined' && tolerance !== 'Aggressive') return false;
    if (targetBucket && c.biasBucket && c.biasBucket !== targetBucket) return false;
    if (goal && c.goalFit?.length && !c.goalFit.includes(goal)) return false;
    if (targetConviction && targetConviction !== 'neutral' && c.convictionLevel && c.convictionLevel !== targetConviction) {
      return false;
    }
    return true;
  });

  const scored = filtered.map((c) => {
    let score = 0;
    if (c.idealVolRegime === volRegime) score += 2;
    else if (c.idealVolRegime === 'Any') score += 0.5;
    if (goal && c.goalFit?.includes(goal)) score += 2;
    if (c.isFallback) score -= 5;
    return { ...c, score };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (RISK_TYPE_RANK[a.riskType] ?? 9) - (RISK_TYPE_RANK[b.riskType] ?? 9);
  });

  // The fallback exists to fill an otherwise-empty list, not to pad out a
  // list that already has real matches — showing "maybe don't trade" next
  // to a genuine recommendation is confusing, not honest caution.
  const real = scored.filter((c) => !c.isFallback);
  if (real.length > 0) return real.slice(0, 3);
  return scored.slice(0, 3);
}
