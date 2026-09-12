'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import SiteNav from '@/components/SiteNav';
import { searchTickers, tickerColor } from '@/lib/tickerDirectory';
import { currencyPrefix } from '@/lib/currency';

const TONES = [
  { value: 'curiosity', label: 'Curious & Engaging' },
  { value: 'data', label: 'Objective & Data-First' },
  { value: 'direct', label: 'Concise & Direct' },
];

const MAX_TICKERS = 4;

function Avatar({ symbol, size = 'md' }) {
  const sizes = { sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs' };
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold text-white ${sizes[size] || sizes.md}`}
      style={{ backgroundColor: tickerColor(symbol) }}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

const RATING_STYLES = {
  'Strong Buy': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  Buy: 'bg-green-500/15 text-green-400 border-green-500/40',
  Hold: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  Sell: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  'Strong Sell': 'bg-red-500/15 text-red-400 border-red-500/40',
  Underperform: 'bg-red-500/15 text-red-400 border-red-500/40',
};

function ratingStyle(rating) {
  return RATING_STYLES[rating] || 'bg-gray-500/15 text-gray-400 border-gray-500/40';
}

const ACTION_STYLES = {
  up: 'text-emerald-400',
  down: 'text-red-400',
  reit: 'text-gray-300',
  init: 'text-purple-300',
  main: 'text-gray-300',
};

function ChangeBadge({ pct }) {
  if (pct == null) return <span className="text-xs text-gray-500">flat</span>;
  const up = pct >= 0;
  return (
    <span className={`font-mono text-xs ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function MarketNewsletterPage() {
  const [tickers, setTickers] = useState([]);
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [liveMatches, setLiveMatches] = useState([]);
  const [tone, setTone] = useState('data');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const localMatches = useMemo(() => searchTickers(input, tickers), [input, tickers]);

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
    const extra = liveMatches.filter((m) => !localSymbols.has(m.symbol) && !tickers.includes(m.symbol));
    return [...localMatches, ...extra].slice(0, 8);
  }, [localMatches, liveMatches, tickers]);

  function addTicker(raw) {
    const t = raw.trim().toUpperCase();
    if (!t || tickers.includes(t) || tickers.length >= MAX_TICKERS) return;
    setTickers((prev) => [...prev, t]);
    setInput('');
    setShowDropdown(false);
  }

  function removeTicker(t) {
    setTickers((prev) => prev.filter((x) => x !== t));
  }

  function makeSpotlight(t) {
    setTickers((prev) => [t, ...prev.filter((x) => x !== t)]);
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
      if (chosen) addTicker(chosen.symbol);
      else if (input.trim()) addTicker(input);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  async function generate() {
    if (tickers.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate newsletter');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Market Newsletter</h1>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-2xl mx-auto">
          Draft a weekly market newsletter from live data — fundamentals, analyst activity, and real headlines,
          not technical signals. Structured into subject lines, a spotlight, a watchlist, and a takeaway. Review
          before you send.
        </p>

        {/* Controls */}
        <div className="mt-8 bg-gray-800 rounded-xl p-5 border border-gray-700/50 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Tone</label>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                    tone === t.value
                      ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                      : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Featured tickers — first is the spotlight
              </label>
              <span className="text-xs text-gray-600">{tickers.length}/{MAX_TICKERS}</span>
            </div>

            <div className="flex flex-wrap gap-2 min-h-[3.25rem] rounded-lg border-2 border-dashed border-gray-700 bg-gray-900/40 p-2.5">
              {tickers.map((t, i) => (
                <span
                  key={t}
                  className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full pl-1.5 pr-2.5 py-1 text-sm"
                >
                  <Avatar symbol={t} size="sm" />
                  <span className="text-gray-100 font-medium">{t}</span>
                  <span className={`text-[10px] uppercase tracking-wide ${i === 0 ? 'text-purple-300' : 'text-gray-500'}`}>
                    {i === 0 ? 'Spotlight' : 'Watchlist'}
                  </span>
                  {i !== 0 && (
                    <button
                      onClick={() => makeSpotlight(t)}
                      title="Make spotlight"
                      className="text-gray-500 hover:text-purple-300 transition-colors"
                    >
                      ★
                    </button>
                  )}
                  <button
                    onClick={() => removeTicker(t)}
                    aria-label={`Remove ${t}`}
                    className="w-4 h-4 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
              {tickers.length === 0 && (
                <span className="text-sm text-gray-500 py-1 self-center">No tickers selected yet.</span>
              )}
            </div>

            <div className="mt-3 flex gap-2">
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
                  placeholder={tickers.length >= MAX_TICKERS ? 'Maximum reached' : 'Search by ticker or company name…'}
                  disabled={tickers.length >= MAX_TICKERS}
                  autoComplete="off"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                />
                {showDropdown && matches.length > 0 && (
                  <div className="absolute z-30 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 shadow-2xl">
                    {matches.map((m, i) => (
                      <button
                        key={m.symbol}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addTicker(m.symbol);
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
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || tickers.length === 0}
            className="w-full px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-lg"
          >
            {loading ? 'Drafting…' : 'Generate Newsletter'}
          </button>
        </div>

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-purple-500 animate-spin" />
            <p className="text-gray-400 text-sm">Pulling live data and drafting this week's issue…</p>
          </div>
        )}

        {result && (
          <div className="mt-10 rounded-2xl border border-gray-700/50 bg-gray-800/60 overflow-hidden">
            {/* Masthead */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-500/10 via-transparent to-transparent border-b border-gray-700/50">
              <span className="font-mono text-xs uppercase tracking-widest text-purple-300">Zanchor Weekly</span>
              <div className="text-xs text-gray-500">
                {new Date(result.generatedAt).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Subject lines */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Subject Line & Preview Text
                </h3>
                <div className="space-y-2">
                  {result.subjectLines.map((s) => (
                    <div
                      key={s.type}
                      className={`rounded-lg border p-3 ${
                        s.type === tone ? 'border-purple-500/50 bg-purple-500/5' : 'border-gray-700 bg-gray-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</span>
                        {s.type === tone && (
                          <span className="text-[10px] uppercase tracking-wide text-purple-300">
                            Recommended for your tone
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-white font-medium">{s.text}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.preview}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Market overview */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Market Overview</h3>
                <p className="text-sm text-gray-300 leading-relaxed rounded-lg bg-gray-900/40 p-4">
                  {result.marketOverview}
                </p>
              </section>

              {/* Spotlight */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Stock Spotlight
                </h3>
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Avatar symbol={result.spotlight.ticker} />
                      <div>
                        <div className="text-white font-semibold">
                          {result.spotlight.ticker} · {result.spotlight.name}
                          {result.spotlight.sector && (
                            <span className="ml-2 text-xs font-normal text-gray-500">{result.spotlight.sector}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-sm text-gray-200">
                            {currencyPrefix(result.spotlight.currency)}
                            {result.spotlight.price?.toFixed(2)}
                          </span>
                          <ChangeBadge pct={result.spotlight.weeklyChangePct} />
                        </div>
                      </div>
                    </div>
                    {result.spotlight.consensusRating && (
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${ratingStyle(result.spotlight.consensusRating)}`}>
                        {result.spotlight.consensusRating}
                      </span>
                    )}
                  </div>

                  {result.spotlight.nextEarningsDate && (
                    <p className="mt-3 text-xs text-gray-500">
                      Next earnings: <span className="text-gray-300">{result.spotlight.nextEarningsDate}</span>
                      {result.spotlight.daysToEarnings != null && ` (${result.spotlight.daysToEarnings}d away)`}
                    </p>
                  )}

                  {result.spotlight.fundamentalsNarrative && (
                    <p className="mt-3 text-sm text-gray-300 leading-relaxed">{result.spotlight.fundamentalsNarrative}</p>
                  )}

                  {result.spotlight.recommendationShift && (
                    <p className="mt-3 text-xs text-gray-400">
                      {result.spotlight.recommendationShift.nowPct}% of analysts rate it Buy or better
                      {result.spotlight.recommendationShift.diff !== 0 && (
                        <span className={result.spotlight.recommendationShift.diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {' '}
                          ({result.spotlight.recommendationShift.diff > 0 ? '+' : ''}
                          {result.spotlight.recommendationShift.diff}pp vs. a month ago)
                        </span>
                      )}
                      .
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(result.spotlight.analystActions || []).length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-400">
                          Analyst activity
                        </h5>
                        <ul className="space-y-1.5">
                          {result.spotlight.analystActions.map((a, i) => (
                            <li key={i} className="text-xs text-gray-300">
                              <span className={ACTION_STYLES[a.action] || 'text-gray-300'}>{a.text}</span>
                              <span className="text-gray-600"> · {a.date}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(result.spotlight.earningsTrack || []).length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-400">
                          Earnings track record
                        </h5>
                        <ul className="space-y-1.5">
                          {result.spotlight.earningsTrack.map((e) => (
                            <li key={e.quarter} className="text-xs text-gray-300 flex items-center gap-1.5">
                              <span className={e.beat ? 'text-emerald-400' : e.beat === false ? 'text-red-400' : 'text-gray-500'}>
                                {e.beat ? '▲' : e.beat === false ? '▼' : '·'}
                              </span>
                              <span>
                                {e.quarter}: EPS {e.epsActual ?? 'N/A'} vs. est. {e.epsEstimate ?? 'N/A'}
                                {e.surprisePercent != null && ` (${e.surprisePercent >= 0 ? '+' : ''}${e.surprisePercent.toFixed(1)}%)`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {(result.spotlight.news || []).length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-xs font-semibold uppercase tracking-wide mb-1.5 text-gray-400">
                        In the news
                      </h5>
                      <ul className="space-y-2">
                        {result.spotlight.news.map((n, i) => (
                          <li key={i} className="text-xs">
                            <a
                              href={n.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-200 hover:text-purple-300 transition-colors"
                            >
                              {n.title}
                            </a>
                            <span className="text-gray-600">
                              {' '}
                              — {n.publisher}
                              {n.timeAgo && `, ${n.timeAgo}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* Watchlist */}
              {result.watchlist.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    Quick Watchlist
                  </h3>
                  <div className="space-y-2">
                    {result.watchlist.map((w) => (
                      <div key={w.ticker} className="flex items-start gap-3 rounded-lg bg-gray-900/40 p-3">
                        <Avatar symbol={w.ticker} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white text-sm">{w.ticker}</span>
                            <ChangeBadge pct={w.weeklyChangePct} />
                            {w.consensusRating && (
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${ratingStyle(w.consensusRating)}`}>
                                {w.consensusRating}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{w.rationale}</p>

                          {w.nextEarningsDate && (
                            <p className="mt-1.5 text-[11px] text-gray-500">
                              Next earnings: <span className="text-gray-400">{w.nextEarningsDate}</span>
                              {w.daysToEarnings != null && ` (${w.daysToEarnings}d away)`}
                            </p>
                          )}

                          {w.recommendationShift && (
                            <p className="mt-1 text-[11px] text-gray-500">
                              {w.recommendationShift.nowPct}% of analysts rate it Buy or better
                              {w.recommendationShift.diff !== 0 && (
                                <span className={w.recommendationShift.diff > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {' '}
                                  ({w.recommendationShift.diff > 0 ? '+' : ''}
                                  {w.recommendationShift.diff}pp vs. a month ago)
                                </span>
                              )}
                              .
                            </p>
                          )}

                          {(w.earningsTrack || []).length > 0 && (
                            <ul className="mt-1.5 space-y-1">
                              {w.earningsTrack.map((e) => (
                                <li key={e.quarter} className="text-[11px] text-gray-400 flex items-center gap-1.5">
                                  <span className={e.beat ? 'text-emerald-400' : e.beat === false ? 'text-red-400' : 'text-gray-500'}>
                                    {e.beat ? '▲' : e.beat === false ? '▼' : '·'}
                                  </span>
                                  <span>
                                    {e.quarter}: EPS {e.epsActual ?? 'N/A'} vs. est. {e.epsEstimate ?? 'N/A'}
                                    {e.surprisePercent != null && ` (${e.surprisePercent >= 0 ? '+' : ''}${e.surprisePercent.toFixed(1)}%)`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {(w.news || []).length > 0 && (
                            <ul className="mt-1.5 space-y-1">
                              {w.news.map((n, i) => (
                                <li key={i} className="text-xs">
                                  <a
                                    href={n.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-300 hover:text-purple-300 transition-colors"
                                  >
                                    {n.title}
                                  </a>
                                  <span className="text-gray-600">
                                    {' '}
                                    — {n.publisher}
                                    {n.timeAgo && `, ${n.timeAgo}`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Key takeaway */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Key Takeaway
                </h3>
                <p className="text-sm text-purple-100 leading-relaxed rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
                  {result.keyTakeaway}
                </p>
              </section>

              {/* CTA */}
              <section className="rounded-lg bg-gradient-to-r from-purple-500/15 via-cyan-500/10 to-emerald-500/10 border border-white/5 p-4 text-center">
                <p className="text-sm text-gray-200">{result.cta}</p>
              </section>

              {result.failedTickers?.length > 0 && (
                <p className="text-xs text-gray-500 text-center">
                  Couldn&apos;t pull data for: {result.failedTickers.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
