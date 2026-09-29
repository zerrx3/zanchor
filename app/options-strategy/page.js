'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import { searchTickers, tickerColor } from '@/lib/tickerDirectory';
import { currencyPrefix } from '@/lib/currency';
import { rankSuggestions, strategySlug } from '@/lib/optionsStrategyRules';

// Single ticker-scoped session: remembers the last analyzed ticker together
// with the profile (view/risk tolerance/goal) that was active for it, so
// navigating away and back restores the exact same state, not just the
// ticker with a fresh/default profile.
const SESSION_KEY = 'optionsStrategy:lastSession:v1';
const RISK_TOLERANCES = ['Conservative', 'Aggressive'];
const RISK_TOLERANCE_SELECTED_STYLES = {
  Conservative: 'bg-emerald-600 text-white',
  Aggressive: 'bg-red-600 text-white',
};
const GOALS = [
  { value: 'income', label: 'Income' },
  { value: 'protection', label: 'Protection' },
  { value: 'speculative', label: 'Speculative' },
];
const GOAL_DESCRIPTIONS = {
  income: 'Sell premium and profit as long as the stock doesn’t move against you — the classic "get paid to wait" approach.',
  protection: 'Trades that double as a hedge — a long put protecting an existing position, or a spread whose long leg caps the risk on its short leg.',
  speculative: 'Directional or volatility bets that need the stock to actually move to pay off — bigger potential reward, but time decay works against you if it doesn’t.',
};
const GOAL_SELECTED_STYLES = {
  income: 'bg-indigo-600 text-white',
  protection: 'bg-emerald-600 text-white',
  speculative: 'bg-orange-600 text-white',
};
const GOAL_TEXT_STYLES = {
  income: 'text-indigo-300',
  protection: 'text-emerald-300',
  speculative: 'text-orange-300',
};
const VIEWS = ['Bearish', 'Mildly Bearish', 'Neutral', 'Mildly Bullish', 'Bullish'];
const VIEW_SELECTED_STYLES = {
  Bearish: 'bg-red-600 text-white',
  'Mildly Bearish': 'bg-red-500/40 text-red-100',
  Neutral: 'bg-gray-600 text-white',
  'Mildly Bullish': 'bg-emerald-500/40 text-emerald-100',
  Bullish: 'bg-emerald-600 text-white',
};

function InfoTooltip({ text }) {
  if (!text) return null;
  return (
    <span className="relative inline-flex group/tip ml-1 align-middle">
      <span
        tabIndex={0}
        className="flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-600 text-gray-500 text-[9px] leading-none cursor-help hover:border-gray-400 hover:text-gray-300 focus:border-gray-400 focus:text-gray-300 focus:outline-none"
      >
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-950 p-2.5 text-xs normal-case leading-snug text-gray-300 shadow-xl group-hover/tip:block group-focus-within/tip:block">
        {text}
      </span>
    </span>
  );
}

function Avatar({ symbol, size = 'md' }) {
  const sizes = { sm: 'w-7 h-7 text-[10px]', md: 'w-10 h-10 text-sm' };
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold text-white ${sizes[size] || sizes.md}`}
      style={{ backgroundColor: tickerColor(symbol) }}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

const VERDICT_STYLES = {
  'Strong Buy': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  Buy: 'bg-green-500/15 text-green-400 border-green-500/40',
  Hold: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  Sell: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  Avoid: 'bg-red-500/15 text-red-400 border-red-500/40',
};

function verdictStyle(verdict) {
  return VERDICT_STYLES[verdict] || 'bg-gray-500/15 text-gray-400 border-gray-500/40';
}

const VOL_REGIME_STYLES = {
  Elevated: 'bg-red-500/15 text-red-300 border-red-500/30',
  Normal: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  Low: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

const DIRECTION_STYLES = {
  Bullish: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Bearish: 'bg-red-500/10 text-red-300 border-red-500/20',
  Neutral: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  'Neutral to Mildly Bullish': 'bg-emerald-500/10 text-emerald-300/90 border-emerald-500/20',
  'Neutral to Mildly Bearish': 'bg-red-500/10 text-red-300/90 border-red-500/20',
};

function directionStyle(direction) {
  return DIRECTION_STYLES[direction] || 'bg-gray-500/10 text-gray-300 border-gray-500/20';
}

// Cash-Secured Put/Covered Call/Naked Put/Naked Call carry a levelFound
// flag (whether a confident support/resistance level backs the strike) —
// border the card green when one was found, red when the rationale is
// really "no clear level, consider waiting." Every other strategy has no
// such concept, so levelFound is undefined and the border stays neutral.
function levelBorderStyle(levelFound) {
  if (levelFound === true) return 'border-emerald-500/50';
  if (levelFound === false) return 'border-red-500/50';
  return 'border-gray-700';
}

const RISK_TYPE_STYLES = {
  defined: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  undefined: 'bg-red-500/15 text-red-300 border-red-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'n/a': 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const RISK_TYPE_LABELS = {
  defined: 'Defined risk',
  undefined: 'Undefined risk',
  warning: 'Risk flag',
  'n/a': 'No trade',
};

function fmt(value, currency) {
  if (value == null) return '—';
  return `${currencyPrefix(currency)}${value.toFixed(2)}`;
}

function fmtPct(value) {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

// Splits a chain into three buckets: the single strike closest to the
// current price (ATM), and everything else split by Yahoo's own
// in-the-money flag.
function groupByMoneyness(contracts, currentPrice) {
  if (!contracts.length || currentPrice == null) return { itm: [], atm: [], otm: contracts };
  let atmIndex = 0;
  let bestDiff = Infinity;
  contracts.forEach((c, i) => {
    const diff = Math.abs(c.strike - currentPrice);
    if (diff < bestDiff) {
      bestDiff = diff;
      atmIndex = i;
    }
  });
  const itm = [];
  const otm = [];
  contracts.forEach((c, i) => {
    if (i === atmIndex) return;
    (c.inTheMoney ? itm : otm).push(c);
  });
  return { itm, atm: [contracts[atmIndex]], otm };
}

// ROI on selling this contract for its bid (what you'd actually receive
// selling to open), against the cash needed to secure it (strike × 100) —
// the same static-return math as the Cash-Secured Put/Covered Call cards.
// Annualized scales that by the days left to this expiration.
//
// A real bid of exactly 0 on an actively traded contract essentially never
// happens — it means Yahoo has no live bid right now, not that the option
// is worth nothing. Falls back in order: bid (live, what you'd actually
// get) → mid ((bid+ask)/2, still a live market snapshot, just slightly
// optimistic for a seller) → lastPrice (weakest — just the most recent
// trade, which can be stale and doesn't reflect the market right now).
// Anything short of a live bid is flagged with isEstimate so the UI can
// mark it as approximate rather than passing it off as a live quote.
function premiumForRoi(bid, ask, lastPrice) {
  if (bid) return { value: bid, isEstimate: false };
  const mid = ask ? ((bid || 0) + ask) / 2 : null;
  if (mid) return { value: mid, isEstimate: true };
  if (lastPrice) return { value: lastPrice, isEstimate: true };
  return null;
}

function contractRoiPct(bid, ask, lastPrice, strike, daysToExpiration) {
  const premium = premiumForRoi(bid, ask, lastPrice);
  if (!premium || !strike || daysToExpiration == null || daysToExpiration <= 0) return null;
  // Premium received for 1 contract = premium × 100 shares; collateral =
  // strike × 100 shares — the ×100s cancel, so ROI% = (premium / strike) × 100.
  return { pct: (premium.value / strike) * 100, isEstimate: premium.isEstimate };
}

function contractAnnualizedRoiPct(bid, ask, lastPrice, strike, daysToExpiration) {
  const roi = contractRoiPct(bid, ask, lastPrice, strike, daysToExpiration);
  if (!roi) return null;
  return { pct: roi.pct * (365 / daysToExpiration), isEstimate: roi.isEstimate };
}

function ChainTable({ contracts, currency, daysToExpiration, highlightStrikes }) {
  if (contracts.length === 0) {
    return <p className="px-4 py-4 text-center text-xs text-gray-500">No contracts in this group.</p>;
  }
  return (
    <table className="w-full text-sm min-w-[520px]">
      <thead>
        <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-800">
          <th className="px-4 py-2">Strike</th>
          <th className="px-4 py-2 text-right">Last</th>
          <th className="px-4 py-2 text-right">Volume</th>
          <th className="px-4 py-2 text-right">Open Int.</th>
          <th className="px-4 py-2 text-right">IV</th>
          <th className="px-4 py-2 text-right">ROI</th>
          <th className="px-4 py-2 text-right">aROI</th>
        </tr>
      </thead>
      <tbody>
        {contracts.map((c) => {
          const roi = contractRoiPct(c.bid, c.ask, c.lastPrice, c.strike, daysToExpiration);
          const annualizedRoi = contractAnnualizedRoiPct(c.bid, c.ask, c.lastPrice, c.strike, daysToExpiration);
          const isSupportStrike = highlightStrikes?.belowSupport === c.strike;
          const isResistanceStrike = highlightStrikes?.aboveResistance === c.strike;
          return (
            <tr
              key={c.strike}
              className={`border-b border-gray-800/60 last:border-0 ${
                isSupportStrike
                  ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                  : isResistanceStrike
                    ? 'bg-red-500/10 border-l-2 border-l-red-500'
                    : ''
              }`}
            >
              <td className="px-4 py-2 font-mono text-white">
                {c.strike}
                {isSupportStrike && <span className="ml-1.5 text-[10px] text-emerald-400">▲ support</span>}
                {isResistanceStrike && <span className="ml-1.5 text-[10px] text-red-400">▼ resistance</span>}
              </td>
              <td className="px-4 py-2 font-mono text-gray-400 text-right">{fmt(c.lastPrice, currency)}</td>
              <td className="px-4 py-2 font-mono text-gray-400 text-right">{c.volume ?? '—'}</td>
              <td className="px-4 py-2 font-mono text-gray-400 text-right">{c.openInterest ?? '—'}</td>
              <td className="px-4 py-2 font-mono text-gray-400 text-right">{fmtPct(c.impliedVolatilityPct)}</td>
              <td className={`px-4 py-2 font-mono text-right ${roi?.isEstimate ? 'text-amber-300/80' : 'text-gray-300'}`}>
                {roi?.isEstimate && '~'}
                {fmtPct(roi?.pct)}
              </td>
              <td
                className={`px-4 py-2 font-mono text-right ${annualizedRoi?.isEstimate ? 'text-amber-300' : 'text-emerald-300'}`}
              >
                {annualizedRoi?.isEstimate && '~'}
                {fmtPct(annualizedRoi?.pct)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const CHAIN_SECTION_LABELS = {
  itm: 'In the Money',
  atm: 'At the Money',
  otm: 'Out of the Money',
};

function ChainSection({ sectionKey, contracts, currency, daysToExpiration, highlightStrikes, open, onToggle }) {
  return (
    <div className="border-b border-gray-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-900/40 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">
          {CHAIN_SECTION_LABELS[sectionKey]} <span className="text-gray-600 normal-case">({contracts.length})</span>
        </span>
        <span className={`text-gray-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <ChainTable
            contracts={contracts}
            currency={currency}
            daysToExpiration={daysToExpiration}
            highlightStrikes={highlightStrikes}
          />
        </div>
      )}
    </div>
  );
}

export default function OptionsStrategyPage() {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedExpiration, setSelectedExpiration] = useState(null);
  const [chain, setChain] = useState(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [optionType, setOptionType] = useState('calls');
  const [openSections, setOpenSections] = useState({ itm: false, atm: false, otm: false });
  const [riskTolerance, setRiskTolerance] = useState('Conservative');
  const [goal, setGoal] = useState(null);
  const [view, setView] = useState('Neutral');
  const inputRef = useRef(null);

  // Deep-link support: /options-strategy?ticker=SYMBOL pre-fills the ticker
  // (used by Screener's "Options Strategy →" button) and starts fresh —
  // a link from another tool shouldn't inherit a stale profile. Otherwise,
  // restore the last full session (ticker + view + risk tolerance + goal)
  // so navigating away (e.g. to the Strategy Guide) and back doesn't lose
  // either the analysis or the profile that was tuned for it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTicker = params.get('ticker')?.trim().toUpperCase();
    if (urlTicker) {
      setInput(urlTicker);
      return;
    }
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved?.ticker) return;
      if (RISK_TOLERANCES.includes(saved.riskTolerance)) setRiskTolerance(saved.riskTolerance);
      if (saved.goal === null || GOALS.some((g) => g.value === saved.goal)) setGoal(saved.goal);
      setInput(saved.ticker);
      runAnalysis(saved.ticker, saved.view);
    } catch {
      // ignore — storage unavailable or corrupted, just start fresh
    }
  }, []);

  // Persist the full session whenever the ticker or profile changes, so the
  // latest state is always what gets restored — not just what was true
  // right when the analysis finished.
  useEffect(() => {
    if (!result?.ticker) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ticker: result.ticker, view, riskTolerance, goal }));
    } catch {
      // ignore — persisting the session is a nice-to-have, not required
    }
  }, [result, view, riskTolerance, goal]);

  const localMatches = useMemo(() => searchTickers(input, []), [input]);

  useEffect(() => {
    if (!input.trim()) {
      setLiveMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-tickers?q=${encodeURIComponent(input.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        setLiveMatches(data.results || []);
      } catch {
        setLiveMatches([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [input]);

  const matches = useMemo(() => {
    const localSymbols = new Set(localMatches.map((m) => m.symbol));
    const extra = liveMatches.filter((m) => !localSymbols.has(m.symbol));
    return [...localMatches, ...extra].slice(0, 8);
  }, [localMatches, liveMatches]);

  async function runAnalysis(rawTicker, viewOverride) {
    const ticker = rawTicker.trim().toUpperCase();
    if (!ticker) return;
    setShowDropdown(false);
    setLoading(true);
    setError(null);
    setResult(null);
    setChain(null);
    try {
      const res = await fetch('/api/options-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze this ticker');
      setResult(data);
      setSelectedExpiration(data.selectedExpiration);
      setChain(data.chain);
      setView(viewOverride || data.impliedView || 'Neutral');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function switchExpiration(expiration) {
    if (!result) return;
    setSelectedExpiration(expiration);
    if (expiration === result.selectedExpiration) {
      setChain(result.chain);
      return;
    }
    setChainLoading(true);
    try {
      const res = await fetch('/api/options-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: result.ticker, expiration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load this expiration');
      setChain(data.chain);
    } catch (err) {
      setError(err.message);
    } finally {
      setChainLoading(false);
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowDropdown(true);
      setHighlightIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = matches[highlightIndex];
      runAnalysis(chosen ? chosen.symbol : input);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  const daysToSelectedExpiration = useMemo(() => {
    if (!selectedExpiration) return null;
    return Math.round((new Date(selectedExpiration) - Date.now()) / 86400000);
  }, [selectedExpiration]);

  // Far-dated expirations (>~2 months out) are rarely useful for the
  // premium-selling strategies this tool focuses on — trim the dropdown
  // rather than scrolling through a year-plus of LEAPS. Falls back to the
  // full list if a ticker somehow has nothing nearer-term (better than an
  // empty dropdown).
  const nearTermExpirations = useMemo(() => {
    if (!result) return [];
    const near = result.expirations.filter((exp) => {
      const dte = Math.round((new Date(exp) - Date.now()) / 86400000);
      return dte <= 60;
    });
    return near.length > 0 ? near : result.expirations;
  }, [result]);

  const earningsWithinSelected = useMemo(() => {
    if (!result || daysToSelectedExpiration == null || result.daysToEarnings == null) return false;
    return result.daysToEarnings >= 0 && result.daysToEarnings <= daysToSelectedExpiration;
  }, [result, daysToSelectedExpiration]);

  const visibleContracts = chain ? chain[optionType] : [];
  const groupedContracts = useMemo(
    () => groupByMoneyness(visibleContracts, result?.currentPrice),
    [visibleContracts, result]
  );

  // Which strike, in the currently visible chain, sits just below the
  // support cluster / just above the resistance cluster — highlighted in
  // the raw chain table below so the reference level is traceable to an
  // actual tradeable strike, not just an abstract price.
  const clusterHighlightStrikes = useMemo(() => {
    if (!visibleContracts.length) return { belowSupport: null, aboveResistance: null };
    let belowSupport = null;
    if (result?.supportCluster) {
      const eligible = visibleContracts.filter((c) => c.strike <= result.supportCluster.price);
      if (eligible.length) belowSupport = Math.max(...eligible.map((c) => c.strike));
    }
    let aboveResistance = null;
    if (result?.resistanceCluster) {
      const eligible = visibleContracts.filter((c) => c.strike >= result.resistanceCluster.price);
      if (eligible.length) aboveResistance = Math.min(...eligible.map((c) => c.strike));
    }
    return { belowSupport, aboveResistance };
  }, [visibleContracts, result]);

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const rankedSuggestions = useMemo(() => {
    if (!result) return [];
    return rankSuggestions(result.suggestions, { volRegime: result.volRegime, goal, riskTolerance, view });
  }, [result, goal, riskTolerance, view]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Options Strategy</h1>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-2xl mx-auto">
          For a selected ticker, reads its fundamentals/technical score, implied vs. realized volatility, and
          upcoming earnings, then suggests rules-based options strategies to consider. This is an early, simplified
          pass — not strike-optimized yet, and definitely not investment advice.
        </p>

        <div className="mt-4 max-w-2xl mx-auto rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200 text-center">
          Options carry meaningfully higher risk than the other tools here — undefined-risk strategies (naked
          calls/puts) can lose far more than your initial capital, and assignment/early-exercise risk applies.
          Understand a strategy's full risk profile before using it, and treat every suggestion below as a starting
          point for your own research, not a recommendation.
        </div>

        {/* Ticker input */}
        <div className="mt-6 bg-gray-800 rounded-xl p-5 border border-gray-700/50">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            Ticker Symbol
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setShowDropdown(true);
                  setHighlightIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 120)}
                placeholder="Search by ticker or company name…"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              {showDropdown && matches.length > 0 && (
                <div className="absolute z-30 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 shadow-2xl">
                  {matches.map((m, i) => (
                    <button
                      key={m.symbol}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setInput(m.symbol);
                        setShowDropdown(false);
                        inputRef.current?.focus();
                      }}
                      onMouseEnter={() => setHighlightIndex(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        i === highlightIndex ? 'bg-gray-800' : 'hover:bg-gray-900'
                      }`}
                    >
                      <Avatar symbol={m.symbol} size="sm" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-white">{m.symbol}</span>
                        <span className="block text-xs text-gray-500 truncate">{m.name}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => runAnalysis(input)}
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shrink-0"
            >
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
            <Link
              href="/options-strategy/strategies"
              className="px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors shrink-0 flex items-center"
            >
              Strategy Guide
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-indigo-500 animate-spin" />
            <p className="text-gray-400 text-sm">Pulling the options chain and scoring the setup…</p>
          </div>
        )}

        {result && (
          <div className="mt-10 space-y-8">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-700/50 bg-gray-800/60 p-5">
              <div className="flex items-center gap-3">
                <Avatar symbol={result.ticker} />
                <div>
                  <div className="text-white font-semibold">
                    {result.ticker} · {result.name}
                  </div>
                  <div className="mt-0.5 font-mono text-lg text-gray-100">{fmt(result.currentPrice, result.currency)}</div>
                  {result.nextEarningsDate && (
                    <div className="text-[11px] text-gray-500">
                      Next earnings: {result.nextEarningsDate}
                      {result.daysToEarnings != null && ` (${result.daysToEarnings}d away)`}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${verdictStyle(result.verdict)}`}>
                  {result.verdict} · {result.compositeScorePct?.toFixed(0)}/100
                </span>
                {result.volRegime && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${VOL_REGIME_STYLES[result.volRegime]}`}>
                    IV {result.volRegime.toLowerCase()} vs. realized
                  </span>
                )}
              </div>
            </div>

            {/* Volatility read */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Volatility Read</h3>
              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">ATM Implied Vol</div>
                  <div className="mt-1 font-mono text-lg font-bold text-white">{fmtPct(result.atmImpliedVolatilityPct)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">30d Realized Vol</div>
                  <div className="mt-1 font-mono text-lg font-bold text-white">{fmtPct(result.historicalVolatilityPct)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center justify-center">
                    Regime
                    <InfoTooltip
                      text={
                        <>
                          <span className="text-red-300 font-semibold">Elevated</span>: option premium is pricier
                          than the stock's recent moves justify — good for selling it.
                          <br />
                          <br />
                          <span className="text-gray-300 font-semibold">Normal</span>: premium roughly matches
                          recent moves — no clear edge.
                          <br />
                          <br />
                          <span className="text-emerald-300 font-semibold">Low</span>: premium is cheaper than the
                          stock's recent moves justify — good for buying it.
                        </>
                      }
                    />
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold text-gray-200">{result.volRegime || '—'}</div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-600 text-center">
                An approximation, not true IV Rank — compares current implied volatility against this stock's own
                recent realized (historical) volatility, since Yahoo Finance doesn't expose a year of historical
                implied vol.
              </p>
            </section>

            {/* Your profile */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Your Profile <span className="normal-case text-gray-600">— tunes the suggestions below, saved on this device</span>
                </h3>
                <button
                  onClick={() => {
                    setRiskTolerance('Conservative');
                    setGoal(null);
                    setView(result.impliedView || 'Neutral');
                  }}
                  className="rounded-lg border border-gray-700 bg-gray-900/60 px-2.5 py-1 text-[11px] font-medium text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                >
                  Reset
                </button>
              </div>
              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4 space-y-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                    Your View{' '}
                    <span className="normal-case text-gray-600">
                      — our model reads {result.verdict}; override it with your own take
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-1 bg-gray-950 rounded-lg p-1 border border-gray-700 w-fit">
                    {VIEWS.map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                          view === v ? VIEW_SELECTED_STYLES[v] : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Risk Tolerance</label>
                    <div className="flex gap-1 bg-gray-950 rounded-lg p-1 border border-gray-700">
                      {RISK_TOLERANCES.map((t) => (
                        <button
                          key={t}
                          onClick={() => setRiskTolerance(t)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            riskTolerance === t ? RISK_TOLERANCE_SELECTED_STYLES[t] : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Goal
                      <InfoTooltip
                        text={
                          <>
                            {GOALS.map((g, i) => (
                              <span key={g.value}>
                                {i > 0 && (
                                  <>
                                    <br />
                                    <br />
                                  </>
                                )}
                                <span className={`font-semibold ${GOAL_TEXT_STYLES[g.value]}`}>{g.label}</span>: {GOAL_DESCRIPTIONS[g.value]}
                              </span>
                            ))}
                          </>
                        }
                      />
                    </label>
                    <div className="flex gap-1 bg-gray-950 rounded-lg p-1 border border-gray-700">
                      {GOALS.map((g) => (
                        <button
                          key={g.value}
                          onClick={() => setGoal((prev) => (prev === g.value ? null : g.value))}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            goal === g.value ? GOAL_SELECTED_STYLES[g.value] : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {riskTolerance === 'Aggressive' && (
                <p className="mt-2 text-[11px] text-red-300 text-center">
                  Aggressive risk tolerance unlocks undefined-risk suggestions (naked puts/calls) — max loss on
                  these is not capped by the trade structure itself.
                </p>
              )}
            </section>

            {/* Suggested strategies */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Suggested Strategies</h3>

              {result.earningsWarning && (
                <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-amber-200 text-sm">{result.earningsWarning.strategy}</span>
                    <span
                      className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${RISK_TYPE_STYLES.warning}`}
                    >
                      {RISK_TYPE_LABELS.warning}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-amber-100/80 leading-relaxed">{result.earningsWarning.rationale}</p>
                </div>
              )}

              <div className="space-y-3">
                {rankedSuggestions.map((s, i) => {
                  return (
                    <div key={i} className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white text-sm">{s.strategy}</span>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${directionStyle(s.direction)}`}
                        >
                          {s.direction}
                        </span>
                        <span
                          className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${RISK_TYPE_STYLES[s.riskType]}`}
                        >
                          {RISK_TYPE_LABELS[s.riskType]}
                        </span>
                      </div>
                      {s.strategy === 'Covered Call' && (
                        <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200 leading-relaxed">
                          Requires already owning (or being willing to buy) at least 100 shares of the stock — this only applies if you do.
                        </div>
                      )}
                      <p className="mt-2 text-xs text-gray-400 leading-relaxed">{s.rationale}</p>
                      {s.levelNote && (
                        <div className={`mt-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${levelBorderStyle(s.levelFound)} ${s.levelFound ? 'bg-emerald-500/10 text-emerald-200' : 'bg-red-500/10 text-red-200'}`}>
                          {s.levelNote}
                        </div>
                      )}
                      {!s.isFallback && (
                        <div className="mt-3 flex justify-end">
                          <Link
                            href={`/options-strategy/strategies#${strategySlug(s.strategy)}`}
                            className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-300 hover:bg-orange-500/20 hover:border-orange-500/60 transition-colors"
                          >
                            Read more →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-gray-600 text-center">
                Based on the {result.daysToExpiration}d expiration ({result.selectedExpiration}) — the classic
                25–45 day window used for premium-selling strategies. Strike selection isn't optimized yet; browse
                the raw chain below.
              </p>
            </section>

            {/* Cluster support/resistance — a second, strength-weighted signal
                separate from the level used for strike selection above. Only
                shown when a genuine multi-touch level was actually found. */}
            {(result.supportCluster || result.resistanceCluster) && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Strong Support / Resistance
                </h3>
                <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {result.supportCluster ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">Support</div>
                      <div className="mt-0.5 font-mono text-lg text-emerald-200">
                        {fmt(result.supportCluster.price, result.currency)}
                      </div>
                      <div className="text-[11px] text-emerald-300/70">
                        Tested {result.supportCluster.touches}× over the past year — a repeated, retested level.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-700 px-3 py-2.5 text-[11px] text-gray-500">
                      No repeatedly-tested support found nearby.
                    </div>
                  )}
                  {result.resistanceCluster ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-red-400">Resistance</div>
                      <div className="mt-0.5 font-mono text-lg text-red-200">
                        {fmt(result.resistanceCluster.price, result.currency)}
                      </div>
                      <div className="text-[11px] text-red-300/70">
                        Tested {result.resistanceCluster.touches}× over the past year — a repeated, retested level.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-700 px-3 py-2.5 text-[11px] text-gray-500">
                      No repeatedly-tested resistance found nearby.
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-gray-600 text-center">
                  A level the stock has bounced off (or rejected from) multiple times over the past year — a
                  stronger reference than a single nearby touch. The closest strike to each is highlighted in the
                  chain below.
                </p>
              </section>
            )}

            {/* Options chain */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Options Chain</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedExpiration || ''}
                    onChange={(e) => switchExpiration(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    {nearTermExpirations.map((exp) => {
                      const dte = Math.round((new Date(exp) - Date.now()) / 86400000);
                      return (
                        <option key={exp} value={exp}>
                          {exp} ({dte}d)
                        </option>
                      );
                    })}
                  </select>
                  <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-700">
                    {['calls', 'puts'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setOptionType(t)}
                        className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                          optionType === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {earningsWithinSelected && (
                <p className="mb-3 text-xs text-amber-300 text-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2">
                  Earnings ({result.nextEarningsDate}) fall inside this expiration — expect elevated implied
                  volatility and the risk of a large overnight move.
                </p>
              )}

              <div className="rounded-xl border border-gray-700 bg-gray-900/40 overflow-x-auto">
                {chainLoading ? (
                  <div className="p-6 text-center text-sm text-gray-500">Loading chain…</div>
                ) : visibleContracts.length === 0 ? (
                  <p className="p-6 text-center text-sm text-gray-500">No {optionType} contracts for this expiration.</p>
                ) : (
                  <>
                    <ChainSection
                      sectionKey="itm"
                      contracts={groupedContracts.itm}
                      currency={result.currency}
                      daysToExpiration={daysToSelectedExpiration}
                      highlightStrikes={clusterHighlightStrikes}
                      open={openSections.itm}
                      onToggle={() => toggleSection('itm')}
                    />
                    <ChainSection
                      sectionKey="atm"
                      contracts={groupedContracts.atm}
                      currency={result.currency}
                      daysToExpiration={daysToSelectedExpiration}
                      highlightStrikes={clusterHighlightStrikes}
                      open={openSections.atm}
                      onToggle={() => toggleSection('atm')}
                    />
                    <ChainSection
                      sectionKey="otm"
                      contracts={groupedContracts.otm}
                      currency={result.currency}
                      daysToExpiration={daysToSelectedExpiration}
                      highlightStrikes={clusterHighlightStrikes}
                      open={openSections.otm}
                      onToggle={() => toggleSection('otm')}
                    />
                  </>
                )}
              </div>
              <p className="mt-2 text-[11px] text-gray-600 text-center">
                At the Money is the single strike closest to the current price; everything else is grouped by
                whether it's in or out of the money. ROI = premium ÷ (strike × 100); a{' '}
                <span className="text-amber-300/80">~</span> means no live bid was available, so it's estimated
                from the bid/ask midpoint instead (or the last traded price if there's no ask either), which can
                be stale.
              </p>
              <div className="mt-2 max-w-md mx-auto rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200 leading-relaxed text-center">
                Practical rule of thumb: use ROI to pick a strike, use aROI to pick an expiration. For a ~30-45 day
                expiration, 1-3% ROI is typically the sweet spot. Common management rule: close for a profit once
                you've captured ~50% of the premium, rather than holding to expiration for the last dollar.
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
