'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import SiteNav from '@/components/SiteNav';
import { searchTickers, tickerColor } from '@/lib/tickerDirectory';
import { currencyPrefix } from '@/lib/currency';

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

function InfoTooltip({ text }) {
  if (!text) return null;
  return (
    <span className="relative inline-flex group/tip ml-1 align-middle">
      <span
        tabIndex={0}
        className="flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-600 text-gray-500 text-[9px] leading-none cursor-help hover:border-gray-400 hover:text-gray-300 focus:border-gray-400 focus:text-gray-300 focus:outline-none"
      >
        i
      </span>
      <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-950 p-2.5 text-xs leading-snug text-gray-300 shadow-xl group-hover/tip:block group-focus-within/tip:block">
        {text}
      </span>
    </span>
  );
}

const CONFIDENCE_STYLES = {
  High: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  Low: 'bg-red-500/15 text-red-400 border-red-500/40',
};

const VOLUME_STYLES = {
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  unconfirmed: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  'not-at-zone': 'bg-gray-500/15 text-gray-400 border-gray-500/40',
};

const VOLUME_LABELS = {
  confirmed: 'Volume Confirmed',
  unconfirmed: 'Volume Not Yet Confirmed',
  'not-at-zone': 'Not At Entry Zone',
};

function TrendBadge({ label, trendRising, available = true }) {
  const style = !available
    ? 'bg-gray-500/15 text-gray-500 border-gray-500/30'
    : trendRising
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';
  const text = !available ? 'N/A' : trendRising ? 'Rising' : 'Falling';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style}`}>
      {label}: {text}
    </span>
  );
}

function fmt(v, currency, digits = 2) {
  if (v == null || Number.isNaN(v)) return 'N/A';
  return `${currencyPrefix(currency)}${v.toFixed(digits)}`;
}

function fmtRR(v) {
  if (v == null || Number.isNaN(v)) return 'N/A';
  return `1 : ${v.toFixed(2)}`;
}

function StrategyCard({ letter, title, subtitle, accent, currency, zoneLow, zoneHigh, children }) {
  const accentText = {
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
  }[accent];
  const accentBorder = {
    cyan: 'border-cyan-500/30',
    emerald: 'border-emerald-500/30',
    purple: 'border-purple-500/30',
  }[accent];

  return (
    <div className={`rounded-xl border ${accentBorder} bg-gray-900/40 p-4`}>
      <div className="flex items-center gap-2">
        <span className={`font-mono text-xs font-bold ${accentText}`}>{letter}</span>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>
      <div className="mt-3 rounded-lg bg-black/20 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-500">Entry Zone</div>
        <div className={`font-mono text-sm font-semibold ${accentText}`}>
          {fmt(zoneLow, currency)} – {fmt(zoneHigh, currency)}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-gray-400">{children}</div>
    </div>
  );
}

export default function SwingStrategyPage() {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [liveMatches, setLiveMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [shares, setShares] = useState('100');
  const [entryPriceInput, setEntryPriceInput] = useState('');
  const [stopLossInput, setStopLossInput] = useState('');
  const [targetPriceInput, setTargetPriceInput] = useState('');
  const inputRef = useRef(null);

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

  async function runAnalysis(rawTicker) {
    const ticker = rawTicker.trim().toUpperCase();
    if (!ticker) return;
    setShowDropdown(false);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/swing-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze this ticker');
      setResult(data);
      setShares(data.currency === 'SGD' ? '100' : '10');
      setEntryPriceInput(data.confluence?.midpoint != null ? data.confluence.midpoint.toFixed(2) : '');
      setStopLossInput(data.risk?.stopLoss != null ? data.risk.stopLoss.toFixed(2) : '');
      setTargetPriceInput(data.risk?.target1 != null ? data.risk.target1.toFixed(2) : '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const A = result?.strategyA;
  const B = result?.strategyB;
  const C = result?.strategyC;
  const confluence = result?.confluence;
  const risk = result?.risk;

  const tradeRisk = useMemo(() => {
    if (!confluence) return null;
    const shareCount = parseFloat(shares);
    const entryPrice = parseFloat(entryPriceInput);
    const stopPrice = parseFloat(stopLossInput);
    const targetPrice = parseFloat(targetPriceInput);
    if (!(shareCount > 0) || !(entryPrice > 0) || !(stopPrice >= 0)) return null;

    const riskPerShare = entryPrice - stopPrice;
    const invalidStop = riskPerShare <= 0;
    const riskAmount = shareCount * riskPerShare;
    const riskPct = (riskPerShare / entryPrice) * 100;
    const positionValue = shareCount * entryPrice;

    let gainPct = null;
    let gainAmount = null;
    let rr = null;
    let invalidTarget = false;
    if (targetPrice >= 0) {
      gainPct = ((targetPrice - entryPrice) / entryPrice) * 100;
      gainAmount = shareCount * (targetPrice - entryPrice);
      invalidTarget = targetPrice <= entryPrice;
      if (!invalidStop && !invalidTarget) rr = (targetPrice - entryPrice) / riskPerShare;
    }

    return { entryPrice, riskPerShare, invalidStop, riskAmount, riskPct, positionValue, gainPct, gainAmount, invalidTarget, rr };
  }, [shares, entryPriceInput, stopLossInput, targetPriceInput, confluence]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Swing Strategy</h1>

        {/* Strategy summary */}
        <div className="mt-6 max-w-2xl mx-auto rounded-xl border border-gray-700/50 bg-gray-800/40 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Strategies Used
          </h2>
          <ul className="space-y-2.5 text-sm text-gray-300">
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-cyan-400">A</span>
              <span>
                <span className="font-medium text-white">Trend & Mean Reversion</span> — 20/50 EMA pullback zone on
                4H (falls back to Daily), confirmed with RSI(14) for oversold/normalized conditions.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-emerald-400">B</span>
              <span>
                <span className="font-medium text-white">Structural Market Structure</span> — horizontal
                support from prior swing lows, cross-checked against a volume profile (POC + high-volume nodes).
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-purple-400">C</span>
              <span>
                <span className="font-medium text-white">Fibonacci & Math Levels</span> — golden-pocket retracement
                (0.5–0.618) of the most recent swing low-to-high leg, with 1.272/1.618 extensions for targets.
              </span>
            </li>
          </ul>
          <p className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500">
            Plus: a weekly trend gate, same-bar volume confirmation, earnings-date risk flagging, and position
            sizing off the resulting stop distance.
          </p>
        </div>

        {/* Ticker input */}
        <div className="mt-8 bg-gray-800 rounded-xl p-5 border border-gray-700/50">
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
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shrink-0"
            >
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-amber-500 animate-spin" />
            <p className="text-gray-400 text-sm">Running the three strategies and finding confluence…</p>
          </div>
        )}

        {result && (
          <div className="mt-10 space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-700/50 bg-gray-800/60 p-5">
              <div className="flex items-center gap-3">
                <Avatar symbol={result.ticker} />
                <div>
                  <div className="text-white font-semibold">
                    {result.ticker} · {result.name}
                    {result.sector && <span className="ml-2 text-xs font-normal text-gray-500">{result.sector}</span>}
                  </div>
                  <div className="mt-0.5 font-mono text-lg text-gray-100">{fmt(result.currentPrice, result.currency)}</div>
                  <div className="text-[11px] text-gray-500">As of {result.asOf} · {result.fourHourAvailable ? '4H + Daily' : 'Daily only (4H data unavailable)'}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <TrendBadge label="Daily" trendRising={result.dailyTrendContext?.trendRising} available={!!result.dailyTrendContext} />
                    <TrendBadge label="Weekly" trendRising={result.weeklyTrendContext?.trendRising} available={result.weeklyTrendAvailable} />
                  </div>
                </div>
              </div>
              {result.nextEarningsDate && (
                <div className="text-right text-[11px] text-gray-500 shrink-0">
                  Next earnings
                  <div className="text-gray-300">{result.nextEarningsDate}{result.daysToEarnings != null && ` (${result.daysToEarnings}d)`}</div>
                </div>
              )}
            </div>

            {result.trendWarning && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm px-4 py-3">
                ⚠ {result.trendWarning}
              </div>
            )}
            {result.earningsWarning && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-4 py-3">
                ⚠ {result.earningsWarning}
              </div>
            )}

            {/* Multi-strategy analysis */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Multi-Strategy Independent Analysis
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StrategyCard
                  letter="A"
                  title="Trend & Mean Reversion"
                  subtitle={`${A.timeframe} · 20/50 EMA + RSI`}
                  accent="cyan"
                  currency={result.currency}
                  zoneLow={A.zoneLow}
                  zoneHigh={A.zoneHigh}
                >
                  <div>20 EMA: <span className="text-gray-200 font-mono">{fmt(A.ema20, result.currency)}</span></div>
                  <div>50 EMA: <span className="text-gray-200 font-mono">{fmt(A.ema50, result.currency)}</span></div>
                  <div>
                    RSI(14): <span className="text-gray-200 font-mono">{A.rsi != null ? A.rsi.toFixed(1) : 'N/A'}</span>{' '}
                    <span className="text-gray-500">({A.rsiCondition})</span>
                  </div>
                  <div>{A.trendRising ? '20 EMA is rising (uptrend).' : '20 EMA is not rising — trend is weak or down.'}</div>
                </StrategyCard>

                <StrategyCard
                  letter="B"
                  title="Structural Market Structure"
                  subtitle="Horizontal S/R + Volume Profile"
                  accent="emerald"
                  currency={result.currency}
                  zoneLow={B.zoneLow}
                  zoneHigh={B.zoneHigh}
                >
                  {B.pivotSupport && <div>Prior swing low: <span className="text-gray-200 font-mono">{fmt(B.pivotSupport.price, result.currency)}</span></div>}
                  {B.volumeNode && <div>High-volume node: <span className="text-gray-200 font-mono">{fmt(B.volumeNode.price, result.currency)}</span></div>}
                  {B.pocPrice != null && <div>Volume POC: <span className="text-gray-200 font-mono">{fmt(B.pocPrice, result.currency)}</span></div>}
                  <div className="text-gray-500">{B.note}</div>
                </StrategyCard>

                <StrategyCard
                  letter="C"
                  title="Fibonacci & Math Levels"
                  subtitle="Golden Pocket (0.5 – 0.618)"
                  accent="purple"
                  currency={result.currency}
                  zoneLow={C.zoneLow}
                  zoneHigh={C.zoneHigh}
                >
                  <div>Swing low ({C.swingLowDate}): <span className="text-gray-200 font-mono">{fmt(C.swingLow, result.currency)}</span></div>
                  <div>Swing high ({C.swingHighDate}): <span className="text-gray-200 font-mono">{fmt(C.swingHigh, result.currency)}</span></div>
                  <div>1.272 ext: <span className="text-gray-200 font-mono">{fmt(C.ext1272, result.currency)}</span></div>
                  <div>1.618 ext: <span className="text-gray-200 font-mono">{fmt(C.ext1618, result.currency)}</span></div>
                </StrategyCard>
              </div>
            </section>

            {/* Confluence */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Confluence Mid-Point Recommendation
              </h3>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Ultimate Entry Range</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
                      {fmt(confluence.entryLow, result.currency)} – {fmt(confluence.entryHigh, result.currency)}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      Mid-point: <span className="font-mono text-gray-200">{fmt(confluence.midpoint, result.currency)}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap ${CONFIDENCE_STYLES[confluence.confidence]}`}>
                    {confluence.confidence} Confidence
                  </span>
                </div>
                <p className="mt-3 text-xs text-gray-400">
                  {confluence.agreeingStrategies.length > 0
                    ? `Strategies ${confluence.agreeingStrategies.join(' & ')} overlap in this range.`
                    : 'The three strategies did not overlap — this is a best-estimate blended zone from all three midpoints. Treat with extra caution.'}
                </p>
                {result.volumeConfirmation && (
                  <div className="mt-3 flex items-start gap-2 border-t border-white/5 pt-3">
                    <span className="shrink-0 flex items-center">
                      <span className={`text-[10px] font-medium px-2 py-1 rounded-full border whitespace-nowrap ${VOLUME_STYLES[result.volumeConfirmation.status]}`}>
                        {VOLUME_LABELS[result.volumeConfirmation.status]}
                        {result.volumeConfirmation.ratio != null && ` (${result.volumeConfirmation.ratio.toFixed(1)}x avg)`}
                      </span>
                      <InfoTooltip text="Today's trading volume compared to its 20-day average. Above 1.3x average counts as confirmation that buyers are actually stepping in — below that, the entry zone hasn't been validated by volume yet." />
                    </span>
                    <p className="text-xs text-gray-400">{result.volumeConfirmation.note}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Risk */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Risk & Mitigation Parameters
              </h3>
              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-red-400">Stop Loss</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-red-300">{fmt(risk.stopLoss, result.currency)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-emerald-400">Target 1</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-emerald-300">{fmt(risk.target1, result.currency)}</div>
                    <div className="text-[11px] text-gray-500">R:R {fmtRR(risk.rrTarget1)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-emerald-400">Target 2</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-emerald-300">{fmt(risk.target2, result.currency)}</div>
                    <div className="text-[11px] text-gray-500">R:R {fmtRR(risk.rrTarget2)}</div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-400 leading-relaxed text-center">
                  Stop loss sits just below the lowest support of the three strategies, with an ATR-based buffer — a
                  close below it means the structural, trend, and Fibonacci case for this setup has broken down.
                  Target 1 is the recent swing high; Target 2 is the 1.272 Fibonacci extension beyond it.
                  {risk.rrTarget1 != null && risk.rrTarget1 < 2 && risk.rrTarget2 != null && risk.rrTarget2 >= 2 &&
                    ' Target 1 alone falls short of a 1:2 reward-to-risk — Target 2 is where this setup meets that bar.'}
                  {risk.rrTarget2 != null && risk.rrTarget2 < 2 &&
                    ' Neither target clears a 1:2 reward-to-risk here — the stop is too close to the entry relative to the upside. This setup doesn’t meet the framework’s own risk bar; consider passing or waiting for a tighter entry.'}
                </p>
                {result.analystTarget && (
                  <div className="mt-4 flex items-center justify-center gap-2 border-t border-white/5 pt-3 text-xs text-gray-400">
                    <span className="uppercase tracking-wide text-gray-500">Analyst Consensus Target:</span>
                    <span className="font-mono text-gray-200">{fmt(result.analystTarget.price, result.currency)}</span>
                    <span className={result.analystTarget.upsidePct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      ({result.analystTarget.upsidePct >= 0 ? '+' : ''}
                      {result.analystTarget.upsidePct.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Trade risk */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Trade Risk & Reward
              </h3>
              <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-5">
                <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 mb-4">
                  <span className="text-xs font-medium uppercase tracking-wide text-amber-300/80">Current Price</span>
                  <span className="font-mono text-xl font-bold text-amber-300">{fmt(result.currentPrice, result.currency)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Shares to Buy
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Entry Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entryPriceInput}
                      onChange={(e) => setEntryPriceInput(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Stop Loss Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stopLossInput}
                      onChange={(e) => setStopLossInput(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                      Target Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={targetPriceInput}
                      onChange={(e) => setTargetPriceInput(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                </div>

                {tradeRisk ? (
                  <>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">% Loss at Stop</div>
                        <div className={`mt-1 font-mono text-lg font-bold ${tradeRisk.invalidStop ? 'text-gray-600' : 'text-red-300'}`}>
                          {tradeRisk.invalidStop ? 'N/A' : `-${tradeRisk.riskPct.toFixed(1)}%`}
                        </div>
                        <div className="text-sm font-medium text-red-300/90">
                          {!tradeRisk.invalidStop && `${fmt(tradeRisk.riskAmount, result.currency)} at risk`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">% Gain at Target</div>
                        <div className={`mt-1 font-mono text-lg font-bold ${tradeRisk.gainPct == null || tradeRisk.invalidTarget ? 'text-gray-600' : 'text-emerald-300'}`}>
                          {tradeRisk.gainPct == null || tradeRisk.invalidTarget ? 'N/A' : `+${tradeRisk.gainPct.toFixed(1)}%`}
                        </div>
                        <div className="text-sm font-medium text-emerald-300/90">
                          {tradeRisk.gainAmount != null && !tradeRisk.invalidTarget && `${fmt(tradeRisk.gainAmount, result.currency)} gain`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">Reward : Risk</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-gray-200">{tradeRisk.rr != null ? `1 : ${tradeRisk.rr.toFixed(2)}` : 'N/A'}</div>
                        {tradeRisk.rr != null && (
                          <div
                            className={`mt-1 text-[11px] font-medium ${
                              tradeRisk.rr >= 2 ? 'text-emerald-400' : tradeRisk.rr >= 1 ? 'text-amber-400' : 'text-red-400'
                            }`}
                          >
                            {tradeRisk.rr >= 2 ? 'Worth it' : tradeRisk.rr >= 1 ? 'Marginal' : 'Not worth it'}
                          </div>
                        )}
                      </div>
                    </div>
                    {tradeRisk.rr != null && (
                      <p
                        className={`mt-3 text-xs text-center rounded-lg border px-4 py-2.5 ${
                          tradeRisk.rr >= 2
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : tradeRisk.rr >= 1
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                            : 'border-red-500/30 bg-red-500/10 text-red-200'
                        }`}
                      >
                        {tradeRisk.rr >= 2
                          ? `This clears the 1:2 reward-to-risk bar most swing traders use — the target pays for ${tradeRisk.rr.toFixed(1)}x what the stop risks.`
                          : tradeRisk.rr >= 1
                          ? "Positive, but thin — you're risking almost as much as you stand to gain. Only worth it if you're fairly confident in the target."
                          : "You're risking more than the potential reward here. Better to wait for a tighter entry or a further target before sizing in."}
                      </p>
                    )}
                    {tradeRisk.invalidStop && (
                      <p className="mt-3 text-xs text-amber-300 text-center">
                        Stop loss must be below the entry price ({fmt(tradeRisk.entryPrice, result.currency)}) for a long setup.
                      </p>
                    )}
                    {!tradeRisk.invalidStop && tradeRisk.invalidTarget && (
                      <p className="mt-3 text-xs text-amber-300 text-center">
                        Target price must be above the entry price ({fmt(tradeRisk.entryPrice, result.currency)}) for a long setup.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-4 text-xs text-gray-500 text-center">Enter an entry price, shares, and a stop loss to compute risk.</p>
                )}
                <p className="mt-4 text-[11px] text-gray-600 text-center">
                  % gain = (target − entry price) ÷ entry price. Entry, stop loss, and target are pre-filled from the
                  confluence analysis above but all three are editable — adjust them to test a different plan.
                </p>
              </div>
            </section>

            <p className="text-[11px] text-gray-600 text-center">
              Rules-based technical output, not financial advice. 4H bars are approximated from hourly data and
              clock-aligned in 4-hour buckets. Always confirm against a live chart before placing a trade.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
