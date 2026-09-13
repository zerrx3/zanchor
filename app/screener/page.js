'use client';

import { useState, useMemo, useEffect } from 'react';
import SiteNav from '@/components/SiteNav';
import {
  getSectorsForRegion,
  getTickersForSector,
  tickerColor,
  SECTOR_TAB_ACTIVE_STYLES,
  SECTOR_EMOJI,
} from '@/lib/tickerDirectory';
import { currencyPrefix } from '@/lib/currency';
import { mapWithConcurrency } from '@/lib/concurrency';

const FETCH_CONCURRENCY = 8;

const CACHE_PREFIX = 'stockAnalyzer:v5:'; // shared with Stock Analyzer — same result shape
const SWING_CACHE_PREFIX = 'swingStrategy:v1:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const SELECTION_STORAGE_KEY = 'screener:selection:v1';

function getCached(prefix, ticker) {
  try {
    const raw = localStorage.getItem(prefix + ticker);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCached(prefix, ticker, data) {
  try {
    localStorage.setItem(prefix + ticker, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // caching is a nice-to-have, not required
  }
}

function AvatarChip({ symbol }) {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded-full font-bold text-white text-[10px]"
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

const CONFIDENCE_STYLES = {
  High: 'bg-emerald-500/20 text-emerald-300',
  Medium: 'bg-amber-500/20 text-amber-300',
  Low: 'bg-gray-500/20 text-gray-400',
};

const CONFIDENCE_RANK = { High: 3, Medium: 2, Low: 1 };

function reasonsFor(result) {
  const metrics = result.metrics || [];
  const pros = metrics.filter((m) => m.points > 0).sort((a, b) => b.points - a.points);
  const cons = metrics.filter((m) => m.points < 0).sort((a, b) => a.points - b.points);
  return { pros, cons };
}

function sortValue(result, key) {
  switch (key) {
    case 'score':
      return result.compositeScorePct;
    case 'price':
      return result.price;
    case 'dividendYield':
      return result.dividendYield;
    case 'daysToEarnings':
      return result.daysToEarnings;
    case 'bestEntry':
      return CONFIDENCE_RANK[result.bestEntryConfidence] ?? null;
    default:
      return null;
  }
}

const ROW_GRID_YIELD_ENTRY = 'grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_4.5rem_7rem_5rem_7rem_4.5rem_1.5rem]';
const ROW_GRID_YIELD_NOENTRY = 'grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_4.5rem_5rem_7rem_4.5rem_1.5rem]';
const ROW_GRID_NOYIELD_ENTRY = 'grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_7rem_5rem_7rem_4.5rem_1.5rem]';
const ROW_GRID_NOYIELD_NOENTRY = 'grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_5rem_7rem_4.5rem_1.5rem]';

function rowGrid(showYield, showEntry) {
  if (showYield) return showEntry ? ROW_GRID_YIELD_ENTRY : ROW_GRID_YIELD_NOENTRY;
  return showEntry ? ROW_GRID_NOYIELD_ENTRY : ROW_GRID_NOYIELD_NOENTRY;
}

function SortIcon({ direction }) {
  if (direction === 'asc') {
    return (
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 15l6-6 6 6" />
      </svg>
    );
  }
  if (direction === 'desc') {
    return (
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-40"
    >
      <path d="M8 9l4-4 4 4" />
      <path d="M8 15l4 4 4-4" />
    </svg>
  );
}

function SortableHeaderCell({ label, sortKeyName, sortKey, sortDir, onSort, align = 'right' }) {
  const active = sortKey === sortKeyName;
  return (
    <button
      onClick={() => onSort(sortKeyName)}
      className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'} w-full uppercase tracking-wide transition-colors ${
        active ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
      <SortIcon direction={active ? sortDir : null} />
    </button>
  );
}

function ScreenerTableHeader({ showYield, showEntry, sortKey, sortDir, onSort }) {
  return (
    <div
      className={`grid ${rowGrid(showYield, showEntry)} items-center gap-3 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500`}
    >
      <span />
      <span>Ticker</span>
      <SortableHeaderCell label="Price" sortKeyName="price" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      {showYield && (
        <SortableHeaderCell
          label="Yield"
          sortKeyName="dividendYield"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      )}
      {showEntry && (
        <SortableHeaderCell
          label="Best Entry"
          sortKeyName="bestEntry"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      )}
      <SortableHeaderCell
        label="Earnings"
        sortKeyName="daysToEarnings"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />
      <span className="text-center">Verdict</span>
      <SortableHeaderCell label="Score" sortKeyName="score" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
      <span />
    </div>
  );
}

function ScreenerRow({ rank, result, expanded, onToggle, showYield, showEntry }) {
  const { pros, cons } = useMemo(() => reasonsFor(result), [result]);

  if (result.error) {
    const totalCols = 7 + (showYield ? 1 : 0) + (showEntry ? 1 : 0);
    const remainingSpan = totalCols - 2;
    return (
      <div className={`grid ${rowGrid(showYield, showEntry)} items-center gap-3 rounded-lg bg-gray-900/60 px-3 py-2.5 opacity-60`}>
        <span className="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded-full bg-gray-900 border border-red-900/40 text-xs text-red-400">
          !
        </span>
        <span className="font-semibold text-gray-400 text-sm truncate">{result.ticker}</span>
        <span style={{ gridColumn: `span ${remainingSpan} / span ${remainingSpan}` }}>
          <span className="text-xs text-red-400 truncate block">{result.error}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-900/60 overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full grid ${rowGrid(showYield, showEntry)} items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-900 transition-colors`}
      >
        <span className="text-xs font-mono text-gray-500 text-right">{rank}</span>
        <span className="flex items-center gap-2 min-w-0">
          <AvatarChip symbol={result.ticker} />
          <span className="min-w-0">
            <span className="block font-semibold text-white text-sm leading-tight">{result.ticker}</span>
            <span className="block text-xs text-gray-500 truncate leading-tight">{result.name}</span>
          </span>
        </span>
        <span className="text-sm font-mono text-gray-300 text-right">
          {currencyPrefix(result.currency)}
          {result.price?.toFixed(2)}
        </span>
        {showYield && (
          <span className="text-sm font-mono text-gray-300 text-right">
            {result.dividendYield != null ? `${result.dividendYield.toFixed(2)}%` : '—'}
          </span>
        )}
        {showEntry && (
          <span className="flex items-center justify-end gap-1.5">
            <span className="text-sm font-mono text-gray-300">
              {result.bestEntry != null ? `${currencyPrefix(result.currency)}${result.bestEntry.toFixed(2)}` : '—'}
            </span>
            {result.bestEntryConfidence && (
              <span
                className={`text-[9px] font-bold px-1 py-0.5 rounded leading-none ${CONFIDENCE_STYLES[result.bestEntryConfidence] || CONFIDENCE_STYLES.Low}`}
                title={`${result.bestEntryConfidence} confidence`}
              >
                {result.bestEntryConfidence[0]}
              </span>
            )}
          </span>
        )}
        <span className="text-xs font-mono text-gray-400 text-right">
          {result.daysToEarnings != null ? `${result.daysToEarnings}d` : '—'}
        </span>
        <span className="flex justify-center">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${verdictStyle(result.verdict)}`}
          >
            {result.verdict}
          </span>
        </span>
        <span className="text-sm font-mono text-gray-300 text-right">
          {result.compositeScorePct.toFixed(0)}/100
        </span>
        <span className={`text-gray-500 text-xs justify-self-end transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-800">
          {result.recommendationText && (
            <p className="text-xs text-gray-300 leading-relaxed my-2.5">{result.recommendationText}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pros.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-emerald-400">
                  Worth buying because
                </h5>
                <ul className="space-y-1">
                  {pros.map((m) => (
                    <li key={m.label} className="text-xs text-gray-300 flex items-start gap-1.5">
                      <span className="text-emerald-400">+</span>
                      <span>
                        <span className="text-gray-400">{m.label}:</span> {m.valueDisplay}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-red-400">Watch out for</h5>
                <ul className="space-y-1">
                  {cons.map((m) => (
                    <li key={m.label} className="text-xs text-gray-300 flex items-start gap-1.5">
                      <span className="text-red-400">−</span>
                      <span>
                        <span className="text-gray-400">{m.label}:</span> {m.valueDisplay}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {pros.length === 0 && cons.length === 0 && (
            <p className="text-xs text-gray-500">No standout factors either way — data was mostly neutral.</p>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_SECTORS = 5;

export default function ScreenerPage() {
  const [activeRegion, setActiveRegion] = useState('US');
  const [activeSectors, setActiveSectors] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [includeSwingEntry, setIncludeSwingEntry] = useState(false);
  const [resultsHaveEntry, setResultsHaveEntry] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [minConfidence, setMinConfidence] = useState('All');
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [expandedTicker, setExpandedTicker] = useState(null);

  // Restore the previously selected region/sectors once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTION_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.region === 'US' || saved.region === 'SG') setActiveRegion(saved.region);
        if (Array.isArray(saved.sectors)) setActiveSectors(saved.sectors.slice(0, MAX_SECTORS));
      }
    } catch {
      // ignore — storage unavailable or corrupted, just start fresh
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify({ region: activeRegion, sectors: activeSectors }));
    } catch {
      // ignore — nice-to-have only
    }
  }, [activeRegion, activeSectors]);

  const sectorsForRegion = useMemo(() => getSectorsForRegion(activeRegion), [activeRegion]);

  function selectRegion(region) {
    if (region === activeRegion) return;
    setActiveRegion(region);
    setActiveSectors([]);
    setResults(null);
    setError(null);
    setLoading(false);
    if (region === 'US' && sortKey === 'dividendYield') setSortKey('score');
  }

  function toggleSector(sector) {
    setActiveSectors((prev) => {
      if (prev.includes(sector)) return prev.filter((s) => s !== sector);
      if (prev.length >= MAX_SECTORS) return prev;
      return [...prev, sector];
    });
    setResults(null);
    setError(null);
  }

  async function runScreen() {
    if (activeSectors.length === 0) return;
    const seen = new Set();
    const entries = [];
    for (const sector of activeSectors) {
      for (const entry of getTickersForSector(sector, activeRegion)) {
        if (seen.has(entry.symbol)) continue;
        seen.add(entry.symbol);
        entries.push(entry);
      }
    }
    if (entries.length === 0) {
      setError(`No curated tickers found for ${activeSectors.join(', ')} (${activeRegion}).`);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const cachedByTicker = {};
    const toFetch = [];
    for (const entry of entries) {
      const cached = forceRefresh ? null : getCached(CACHE_PREFIX, entry.symbol);
      if (cached) cachedByTicker[entry.symbol] = { ...cached.data, cachedAt: cached.timestamp };
      else toFetch.push(entry.symbol);
    }

    const totalSteps = entries.length * (includeSwingEntry ? 2 : 1);
    let done = Object.keys(cachedByTicker).length;
    setProgress({ done, total: totalSteps });

    try {
      const fetched = await mapWithConcurrency(toFetch, FETCH_CONCURRENCY, async (t) => {
        try {
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: [t] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Analysis failed');
          const r = data.results?.[0];
          if (r && !r.error) setCached(CACHE_PREFIX, r.ticker, r);
          return r;
        } finally {
          done += 1;
          setProgress({ done, total: totalSteps });
        }
      });

      let merged = entries
        .map((entry) => cachedByTicker[entry.symbol] || fetched.find((r) => r?.ticker === entry.symbol))
        .filter(Boolean);

      if (includeSwingEntry) {
        const swingTickers = merged.filter((r) => !r.error).map((r) => r.ticker);
        const swingCachedByTicker = {};
        const swingToFetch = [];
        for (const t of swingTickers) {
          const cached = forceRefresh ? null : getCached(SWING_CACHE_PREFIX, t);
          if (cached) swingCachedByTicker[t] = cached.data;
          else swingToFetch.push(t);
        }
        done += swingTickers.length - swingToFetch.length;
        setProgress({ done, total: totalSteps });

        const swingFetched = await mapWithConcurrency(swingToFetch, FETCH_CONCURRENCY, async (t) => {
          try {
            const res = await fetch('/api/swing-strategy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker: t }),
            });
            const data = await res.json();
            if (res.ok && !data.error) {
              setCached(SWING_CACHE_PREFIX, t, data);
              return data;
            }
            return null;
          } catch {
            return null;
          } finally {
            done += 1;
            setProgress({ done, total: totalSteps });
          }
        });

        const swingByTicker = { ...swingCachedByTicker };
        for (const s of swingFetched) {
          if (s) swingByTicker[s.ticker] = s;
        }

        merged = merged.map((r) => ({
          ...r,
          bestEntry: swingByTicker[r.ticker]?.confluence?.midpoint ?? null,
          bestEntryConfidence: swingByTicker[r.ticker]?.confluence?.confidence ?? null,
        }));
      }

      setResults(merged);
      setResultsHaveEntry(includeSwingEntry);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const rankedResults = useMemo(() => {
    if (!results) return null;
    const valid = results.filter((r) => !r.error);
    const errored = results.filter((r) => r.error);
    let filtered = valid.filter((r) => r.compositeScorePct == null || r.compositeScorePct >= minScore);
    if (resultsHaveEntry && minConfidence !== 'All') {
      const threshold = CONFIDENCE_RANK[minConfidence];
      filtered = filtered.filter((r) => (CONFIDENCE_RANK[r.bestEntryConfidence] ?? 0) >= threshold);
    }
    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return { sorted, errored };
  }, [results, minScore, minConfidence, resultsHaveEntry, sortKey, sortDir]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <SiteNav />
      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Screener</h1>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-2xl mx-auto">
          Pick a sector and screen every curated ticker in it at once — scored on valuation, growth, financial
          health, and momentum. This is a rules-based research aid, not investment advice.
        </p>

        {/* Region toggle */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            onClick={() => selectRegion('US')}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 text-base font-semibold transition-colors ${
              activeRegion === 'US'
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <span className="text-2xl">🇺🇸</span> US Stocks
          </button>
          <button
            onClick={() => selectRegion('SG')}
            className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 text-base font-semibold transition-colors ${
              activeRegion === 'SG'
                ? 'bg-red-600 border-red-500 text-white shadow-lg'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <span className="text-2xl">🇸🇬</span> SG Stocks
          </button>
        </div>

        {/* Sector picker */}
        <div className="mt-4 bg-gray-800 rounded-xl p-5 border border-gray-700/50">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Sectors to screen <span className="text-gray-600 normal-case">(up to {MAX_SECTORS})</span>
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sectorsForRegion.map((sector) => {
              const count = getTickersForSector(sector, activeRegion).length;
              const selected = activeSectors.includes(sector);
              const atCap = !selected && activeSectors.length >= MAX_SECTORS;
              return (
                <button
                  key={sector}
                  onClick={() => toggleSector(sector)}
                  disabled={atCap}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    selected
                      ? SECTOR_TAB_ACTIVE_STYLES[sector]
                      : atCap
                      ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed opacity-50'
                      : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {SECTOR_EMOJI[sector]} {sector} <span className="text-gray-500">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={runScreen}
              disabled={loading || activeSectors.length === 0}
              className="shrink-0 px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-lg"
            >
              {loading ? 'Screening…' : activeSectors.length > 0 ? 'Run Screener' : 'Pick a sector first'}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={includeSwingEntry}
                onChange={(e) => setIncludeSwingEntry(e.target.checked)}
                className="accent-orange-600"
              />
              Include Best Entry price (Swing Strategy confluence)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="accent-orange-600"
              />
              Force refresh (skip 24h cache)
            </label>
          </div>

          <p className="mt-3 text-[11px] text-gray-600">
            Results are cached in your browser for 24h and shared with Stock Analyzer{includeSwingEntry ? ' and Swing Strategy' : ''}.
          </p>
        </div>

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-orange-500 animate-spin" />
            <p className="text-gray-400 text-sm">
              Screening {activeSectors.join(' + ')} — {progress.total} step{progress.total !== 1 ? 's' : ''}…
            </p>
            <div className="w-full max-w-xs bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-orange-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-600">
              {progress.done} / {progress.total}
            </p>
          </div>
        )}

        {rankedResults && (
          <div className="mt-10 bg-gray-800 rounded-xl p-5 border border-gray-700/50">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                {activeSectors.join(' + ')} — {rankedResults.sorted.length} ranked
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  Min score
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value) || 0)}
                    className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </label>
                {resultsHaveEntry && (
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    Min confidence
                    <select
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      <option value="All">All</option>
                      <option value="Medium">Medium+</option>
                      <option value="High">High only</option>
                    </select>
                  </label>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[42rem]">
                <ScreenerTableHeader
                  showYield={activeRegion === 'SG'}
                  showEntry={resultsHaveEntry}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <div className="space-y-1.5">
                  {rankedResults.sorted.map((r, i) => (
                    <ScreenerRow
                      key={r.ticker}
                      rank={i + 1}
                      result={r}
                      expanded={expandedTicker === r.ticker}
                      onToggle={() => setExpandedTicker((prev) => (prev === r.ticker ? null : r.ticker))}
                      showYield={activeRegion === 'SG'}
                      showEntry={resultsHaveEntry}
                    />
                  ))}
                  {rankedResults.sorted.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No tickers meet the min score filter.</p>
                  )}
                  {rankedResults.errored.map((r) => (
                    <ScreenerRow
                      key={r.ticker}
                      rank="!"
                      result={r}
                      expanded={false}
                      onToggle={() => {}}
                      showYield={activeRegion === 'SG'}
                      showEntry={resultsHaveEntry}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
