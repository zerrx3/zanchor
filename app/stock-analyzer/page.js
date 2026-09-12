'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import SiteNav from '@/components/SiteNav';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
} from 'recharts';
import { searchTickers, tickerColor, getSectorsForRegion } from '@/lib/tickerDirectory';
import { currencyPrefix } from '@/lib/currency';

const SECTOR_STYLES = {
  MAG7: 'bg-fuchsia-500/15 text-fuchsia-300',
  Software: 'bg-blue-500/15 text-blue-300',
  Cybersecurity: 'bg-sky-500/15 text-sky-300',
  Consumer: 'bg-pink-500/15 text-pink-300',
  Auto: 'bg-orange-500/15 text-orange-300',
  Finance: 'bg-emerald-500/15 text-emerald-300',
  Energy: 'bg-yellow-500/15 text-yellow-300',
  Mining: 'bg-amber-500/15 text-amber-300',
  Industrial: 'bg-gray-500/15 text-gray-300',
  Biotech: 'bg-violet-500/15 text-violet-300',
  Semis: 'bg-indigo-500/15 text-indigo-300',
  Defence: 'bg-rose-500/15 text-rose-300',
  REITs: 'bg-teal-500/15 text-teal-300',
  Space: 'bg-cyan-500/15 text-cyan-300',
};

const SECTOR_TAB_ACTIVE_STYLES = {
  MAG7: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/50',
  Software: 'bg-blue-500/20 text-blue-200 border-blue-500/50',
  Cybersecurity: 'bg-sky-500/20 text-sky-200 border-sky-500/50',
  Consumer: 'bg-pink-500/20 text-pink-200 border-pink-500/50',
  Auto: 'bg-orange-500/20 text-orange-200 border-orange-500/50',
  Finance: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/50',
  Energy: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50',
  Mining: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
  Industrial: 'bg-gray-500/20 text-gray-200 border-gray-500/50',
  Biotech: 'bg-violet-500/20 text-violet-200 border-violet-500/50',
  Semis: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50',
  Defence: 'bg-rose-500/20 text-rose-200 border-rose-500/50',
  REITs: 'bg-teal-500/20 text-teal-200 border-teal-500/50',
  Space: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50',
};

const SECTOR_EMOJI = {
  MAG7: '7️⃣',
  Software: '💾',
  Cybersecurity: '🔒',
  Consumer: '🛒',
  Auto: '🚗',
  Finance: '🏦',
  Energy: '⚡',
  Mining: '⛏️',
  Industrial: '🏗️',
  Biotech: '🧬',
  Semis: '🔩',
  Defence: '🛡️',
  REITs: '🏢',
  Space: '🚀',
};

const AVATAR_SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
};

function Avatar({ symbol, size = 'md' }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold text-white ${AVATAR_SIZES[size] || AVATAR_SIZES.md}`}
      style={{ backgroundColor: tickerColor(symbol) }}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

const METRIC_INFO = {
  'Trailing P/E': "Price divided by earnings per share over the last 12 months. Lower usually means cheaper relative to current profit — but very low can also signal the market expects trouble.",
  'PEG Ratio': 'P/E ratio divided by earnings growth rate. Below 1 suggests the price may be cheap relative to how fast earnings are growing.',
  'Price/Book': "Price divided by book (accounting) value per share. Lower can mean undervalued, but capital-light businesses like software naturally run higher.",
  'EV/EBITDA': 'Enterprise value divided by earnings before interest, tax, depreciation & amortization — a valuation multiple useful for comparing companies with different debt levels.',
  'Revenue Growth (YoY)': 'How much total sales grew compared to the same period last year.',
  'Earnings Growth (YoY)': 'How much net income grew compared to the same period last year.',
  'Net Profit Margin': 'Net income as a percentage of revenue — how much of every dollar in sales becomes actual profit.',
  'Return on Equity': "Net income as a percentage of shareholder equity — how efficiently the company turns shareholders' money into profit.",
  'Debt/Equity': 'Total debt relative to shareholder equity. Lower means less reliance on borrowed money, generally safer in a downturn.',
  'Current Ratio': 'Current assets divided by current liabilities. Above 1 means the company can cover short-term bills with short-term assets.',
  'Free Cash Flow': 'Cash left over from operations after capital expenditures — money available for dividends, buybacks, or paying down debt.',
  'Price vs 50-day SMA': "Compares today's price to the average closing price over the last 50 trading days — a short-term trend signal.",
  'Price vs 200-day SMA': "Compares today's price to the average closing price over the last 200 trading days — a long-term trend signal.",
  'RSI (14-day)': 'Relative Strength Index — momentum on a 0-100 scale. Above 70 is typically considered overbought, below 30 oversold.',
  'Distance from 52-wk high': 'How far the current price is below its highest close in the last year. Near 0% means trading right near its high.',
  'Consensus Rating': 'The average recommendation from Wall Street analysts covering the stock (Strong Buy, Buy, Hold, Sell, etc.).',
  'Upside to Price Target': "How far the current price is from analysts' average 12-month price target.",
};

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

function scoreColor(pct) {
  if (pct == null) return '#6b7280';
  if (pct >= 75) return '#34d399';
  if (pct >= 60) return '#4ade80';
  if (pct >= 40) return '#facc15';
  if (pct >= 25) return '#fb923c';
  return '#f87171';
}

function categoryBreakdown(metrics) {
  const byCategory = {};
  for (const m of metrics) {
    if (m.points === null) continue;
    if (!byCategory[m.category]) byCategory[m.category] = { points: 0, max: 0 };
    byCategory[m.category].points += m.points;
    byCategory[m.category].max += m.maxPoints;
  }
  return Object.entries(byCategory).map(([name, { points, max }]) => ({
    name,
    value: max > 0 ? Math.round((((points / max) + 1) / 2) * 100) : 50,
  }));
}

function PriceTargetBar({ price, targetPrice, currency }) {
  if (price == null || targetPrice == null) return null;

  const upsidePct = (targetPrice / price - 1) * 100;
  const isUpside = upsidePct >= 0;
  const cur = currencyPrefix(currency);

  // Scale the track to the actual magnitude of the gap, but never let the
  // target marker sit so close to "Current" that the labels overlap.
  const rangeMax = Math.max(20, Math.abs(upsidePct) * 1.3);
  let offset = (upsidePct / rangeMax) * 44;
  const minOffset = 16;
  if (Math.abs(offset) < minOffset) offset = (offset >= 0 ? 1 : -1) * minOffset;
  const targetPos = Math.min(94, Math.max(6, 50 + offset));
  const barStart = Math.min(50, targetPos);
  const barEnd = Math.max(50, targetPos);
  const accent = isUpside ? 'text-green-400' : 'text-red-400';
  const accentBg = isUpside ? 'bg-green-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">Price vs. Analyst Target</span>
        <span className={`text-xs font-semibold ${accent}`}>
          {isUpside ? '+' : ''}
          {upsidePct.toFixed(1)}% {isUpside ? 'upside' : 'downside'}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-gray-800">
        <div
          className={`absolute top-0 h-2 rounded-full opacity-40 ${accentBg}`}
          style={{ left: `${barStart}%`, width: `${barEnd - barStart}%` }}
        />
        <div
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-900 -translate-x-1/2 -translate-y-1/2"
          style={{ left: '50%' }}
        />
        <div
          className={`absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-gray-900 -translate-x-1/2 -translate-y-1/2 ${accentBg}`}
          style={{ left: `${targetPos}%` }}
        />
      </div>
      <div className="relative h-8 mt-1">
        <div className="absolute -translate-x-1/2 text-center" style={{ left: '50%' }}>
          <div className="text-[10px] text-gray-500">Current</div>
          <div className="text-[11px] text-gray-300">
            {cur}
            {price.toFixed(2)}
          </div>
        </div>
        <div className="absolute -translate-x-1/2 text-center" style={{ left: `${targetPos}%` }}>
          <div className={`text-[10px] ${accent}`}>Target</div>
          <div className={`text-[11px] ${accent}`}>
            {cur}
            {targetPrice.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreGauge({ score }) {
  const data = [{ name: 'score', value: score ?? 0, fill: scoreColor(score) }];
  return (
    <div className="relative h-40 w-40 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#1f2937' }} dataKey="value" cornerRadius={10} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score != null ? score.toFixed(0) : '—'}</span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

function CategoryChart({ metrics }) {
  const data = categoryBreakdown(metrics);
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={data.length * 34 + 10}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#e5e7eb' }}
          itemStyle={{ color: '#e5e7eb' }}
          formatter={(value) => [`${value}/100`, 'Score']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
          {data.map((entry, i) => (
            <Cell key={i} fill={scoreColor(entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MetricsList({ metrics }) {
  const categories = [...new Set(metrics.map((m) => m.category))];
  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{cat}</h4>
          <div className="space-y-1">
            {metrics
              .filter((m) => m.category === cat)
              .map((m) => (
                <div key={m.label} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-gray-400 flex items-center">
                    {m.label}
                    <InfoTooltip text={METRIC_INFO[m.label]} />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-gray-200">{m.valueDisplay}</span>
                    {m.points !== null ? (
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          m.points > 0
                            ? 'bg-green-500/15 text-green-400'
                            : m.points < 0
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-gray-500/15 text-gray-400'
                        }`}
                      >
                        {m.points > 0 ? '+' : ''}
                        {m.points}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">N/A</span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const RANK_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankBadge({ rank }) {
  if (rank == null) return null;
  return (
    <span className="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded-full bg-gray-900 border border-gray-700 text-xs font-bold text-gray-300">
      {RANK_MEDAL[rank] || `#${rank}`}
    </span>
  );
}

function reasonsFor(result) {
  const metrics = result.metrics || [];
  const pros = metrics.filter((m) => m.points > 0).sort((a, b) => b.points - a.points);
  const cons = metrics.filter((m) => m.points < 0).sort((a, b) => a.points - b.points);
  return { pros, cons };
}

function ReasonList({ title, items, tone }) {
  if (items.length === 0) return null;
  const toneClass = tone === 'positive' ? 'text-emerald-400' : 'text-red-400';
  return (
    <div>
      <h5 className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${toneClass}`}>{title}</h5>
      <ul className="space-y-1">
        {items.map((m) => (
          <li key={m.label} className="text-xs text-gray-300 flex items-start gap-1.5">
            <span className={toneClass}>{tone === 'positive' ? '+' : '−'}</span>
            <span>
              <span className="text-gray-400">{m.label}:</span> {m.valueDisplay}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankingRow({ rank, result, expanded, onToggle }) {
  const { pros, cons } = useMemo(() => reasonsFor(result), [result]);

  return (
    <div className="rounded-lg bg-gray-900/60 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-900 transition-colors"
      >
        <RankBadge rank={rank} />
        <Avatar symbol={result.ticker} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{result.ticker}</span>
            <span className="text-xs text-gray-500 truncate">{result.name}</span>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${verdictStyle(result.verdict)}`}>
          {result.verdict}
        </span>
        <span className="text-sm font-mono text-gray-300 w-14 text-right">
          {result.compositeScorePct.toFixed(0)}/100
        </span>
        <span className={`text-gray-500 text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-800">
          {result.recommendationText && (
            <p className="text-xs text-gray-300 leading-relaxed my-2.5">{result.recommendationText}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReasonList title="Worth buying because" items={pros} tone="positive" />
            <ReasonList title="Watch out for" items={cons} tone="negative" />
          </div>
          {pros.length === 0 && cons.length === 0 && (
            <p className="text-xs text-gray-500">No standout factors either way — data was mostly neutral.</p>
          )}
        </div>
      )}
    </div>
  );
}

function RankingSummary({ results }) {
  const [expandedTicker, setExpandedTicker] = useState(null);

  const ranked = useMemo(() => {
    return results
      .map((r, i) => ({ ...r, _origIndex: i }))
      .filter((r) => !r.error && r.compositeScorePct != null)
      .sort((a, b) => b.compositeScorePct - a.compositeScorePct);
  }, [results]);

  const errored = results.filter((r) => r.error);

  if (ranked.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
        Ranking — most to least worth buying
      </h2>
      <div className="space-y-1.5">
        {ranked.map((r, i) => {
          const rank = i + 1;
          return (
            <RankingRow
              key={r.ticker}
              rank={rank}
              result={r}
              expanded={expandedTicker === r.ticker}
              onToggle={() => setExpandedTicker((prev) => (prev === r.ticker ? null : r.ticker))}
            />
          );
        })}
        {errored.map((r) => (
          <div key={r.ticker} className="flex items-center gap-3 rounded-lg bg-gray-900/60 px-3 py-2 opacity-60">
            <span className="inline-flex items-center justify-center shrink-0 w-7 h-7 rounded-full bg-gray-900 border border-red-900/40 text-xs text-red-400">
              !
            </span>
            <span className="font-semibold text-gray-400 text-sm">{r.ticker}</span>
            <span className="text-xs text-red-400 truncate">{r.error}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ result, rank }) {
  const [expanded, setExpanded] = useState(false);

  if (result.error) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-red-900/40">
        <h3 className="text-lg font-semibold text-white">{result.ticker}</h3>
        <p className="mt-2 text-sm text-red-400">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <RankBadge rank={rank} />
            <Avatar symbol={result.ticker} size="sm" />
            <h3 className="text-lg font-semibold text-white">{result.ticker}</h3>
          </div>
          <p className="text-sm text-gray-400">{result.name}</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {currencyPrefix(result.currency)}
            {result.price?.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${verdictStyle(result.verdict)}`}>
            {result.verdict}
          </span>
          {result.cachedAt && <span className="text-[10px] text-gray-500">cached {formatAge(result.cachedAt)}</span>}
        </div>
      </div>

      <PriceTargetBar price={result.price} targetPrice={result.targetPrice} currency={result.currency} />

      <ScoreGauge score={result.compositeScorePct} />

      <CategoryChart metrics={result.metrics} />

      <div className="text-xs text-gray-500 text-center">Data coverage: {result.dataCoveragePct}%</div>

      <div className="rounded-lg bg-gray-900/60 p-3 text-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Upcoming Catalysts</h4>
        {result.nextEarningsDate ? (
          <p className="text-gray-300">
            Next earnings: <span className="text-white">{result.nextEarningsDate}</span>
            {result.daysToEarnings != null && <span className="text-gray-500"> ({result.daysToEarnings}d away)</span>}
          </p>
        ) : (
          <p className="text-gray-500">Next earnings: N/A</p>
        )}
        {result.earningsEstimate != null && (
          <p className="text-gray-400 text-xs mt-0.5">Consensus EPS estimate: {result.earningsEstimate.toFixed(2)}</p>
        )}
        {result.exDividendDate && <p className="text-gray-400 text-xs mt-0.5">Ex-dividend date: {result.exDividendDate}</p>}
      </div>

      {(result.keyTakeaways?.length > 0 || result.recommendationText) && (
        <div className="rounded-lg bg-gray-900/60 p-3 text-sm space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Summary</h4>
          {result.keyTakeaways?.map((line, i) => (
            <p key={i} className="text-gray-300 text-xs leading-relaxed">
              {line}
            </p>
          ))}
          {result.recommendationText && (
            <p className="text-gray-200 text-xs leading-relaxed pt-2 mt-1.5 border-t border-gray-800">
              <span className="font-semibold text-purple-300">Recommendation: </span>
              {result.recommendationText}
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => setExpanded((e) => !e)}
        className="text-sm text-purple-400 hover:text-purple-300 transition-colors self-start"
      >
        {expanded ? 'Hide details ▲' : 'Show all metrics ▼'}
      </button>

      {expanded && <MetricsList metrics={result.metrics} />}
    </div>
  );
}

const CACHE_PREFIX = 'stockAnalyzer:v2:'; // bumped: v1 entries predate the `sector` field
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const SELECTION_STORAGE_KEY = 'stockAnalyzer:selection:v1';

function getCached(ticker) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + ticker);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null; // storage unavailable (private mode, disabled, quota) — just refetch
  }
}

function setCached(ticker, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + ticker, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // ignore — caching is a nice-to-have, not required for the page to work
  }
}

function formatAge(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export default function StockAnalyzerPage() {
  // Each region keeps its own independent selection — switching tabs never
  // discards the other region's picks, they're just not shown right now.
  const [tickersByRegion, setTickersByRegion] = useState({ US: [], SG: [] });
  const [input, setInput] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [activeSector, setActiveSector] = useState(null);
  const [activeRegion, setActiveRegion] = useState('US');
  const activeRegionRef = useRef(activeRegion);
  activeRegionRef.current = activeRegion;
  const [liveMatches, setLiveMatches] = useState([]);
  const inputRef = useRef(null);
  const isFirstSaveRef = useRef(true);

  // Restore the previously selected tickers/region once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTION_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.tickersByRegion && typeof saved.tickersByRegion === 'object') {
          setTickersByRegion({
            US: Array.isArray(saved.tickersByRegion.US) ? saved.tickersByRegion.US : [],
            SG: Array.isArray(saved.tickersByRegion.SG) ? saved.tickersByRegion.SG : [],
          });
        }
        if (saved.region === 'US' || saved.region === 'SG') setActiveRegion(saved.region);
      }
    } catch {
      // ignore — storage unavailable or corrupted, just start fresh
    }
  }, []);

  // Persist selection on every change, skipping the mount-time run so we
  // don't clobber saved data with the pre-restore empty state above.
  useEffect(() => {
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify({ tickersByRegion, region: activeRegion }));
    } catch {
      // ignore — caching the selection is a nice-to-have, not required
    }
  }, [tickersByRegion, activeRegion]);

  const tickers = tickersByRegion[activeRegion] || [];

  const rankByTicker = useMemo(() => {
    if (!results) return {};
    const ranked = results
      .filter((r) => !r.error && r.compositeScorePct != null)
      .sort((a, b) => b.compositeScorePct - a.compositeScorePct);
    const map = {};
    ranked.forEach((r, i) => {
      map[r.ticker] = i + 1;
    });
    return map;
  }, [results]);

  // Cards follow the same best-to-worst order as the ranking summary above
  // them; errored tickers (no rank) sink to the end.
  const sortedResults = useMemo(() => {
    if (!results) return null;
    return [...results].sort((a, b) => {
      const rankA = rankByTicker[a.ticker];
      const rankB = rankByTicker[b.ticker];
      if (rankA == null && rankB == null) return 0;
      if (rankA == null) return 1;
      if (rankB == null) return -1;
      return rankA - rankB;
    });
  }, [results, rankByTicker]);

  function setTickers(updater) {
    setTickersByRegion((prev) => {
      const current = prev[activeRegion] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeRegion]: next };
    });
  }

  const sectorsForRegion = useMemo(() => getSectorsForRegion(activeRegion), [activeRegion]);

  const localMatches = useMemo(
    () => searchTickers(input, tickers, activeSector, activeRegion),
    [input, tickers, activeSector, activeRegion]
  );

  // Curated directory is small — fall back to a live Yahoo Finance ticker
  // search (debounced) for anything typed that isn't in it, e.g. recent IPOs.
  useEffect(() => {
    if (activeSector || !input.trim()) {
      setLiveMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-tickers?q=${encodeURIComponent(input.trim())}&region=${activeRegion}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setLiveMatches(data.results || []);
      } catch {
        setLiveMatches([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [input, activeSector, activeRegion]);

  const matches = useMemo(() => {
    const localSymbols = new Set(localMatches.map((m) => m.symbol));
    const extra = liveMatches.filter((m) => !localSymbols.has(m.symbol) && !tickers.includes(m.symbol));
    const limit = activeSector ? 20 : 8;
    return [...localMatches, ...extra].slice(0, limit);
  }, [localMatches, liveMatches, tickers, activeSector]);

  function selectRegion(region) {
    if (region === activeRegion) return;
    setActiveRegion(region);
    setActiveSector(null);
    setInput('');
    setShowDropdown(false);
    setResults(null);
    setError(null);
    // Any in-flight analysis for the region we're leaving is now stale —
    // runAnalysis's own region guard will no-op it when it resolves, so it's
    // safe to reset the loading UI here rather than leave it hanging.
    setLoading(false);
    setAnalyzeProgress({ done: 0, total: 0 });
  }

  function selectSector(sector) {
    setActiveSector((prev) => (prev === sector ? null : sector));
    setHighlightIndex(0);
    setShowDropdown(true);
    inputRef.current?.focus();
  }

  function addTicker(raw) {
    const t = raw.trim().toUpperCase();
    if (!t || tickers.includes(t)) return;
    if (tickers.length >= 15) return;
    setTickers((prev) => [...prev, t]);
    setInput('');
  }

  function selectMatch(symbol) {
    addTicker(symbol);
    // Browsing a sector: keep the dropdown open so multiple picks don't
    // require reopening it each time. Free-text search: close as before.
    if (!activeSector) setShowDropdown(false);
    inputRef.current?.focus();
  }

  function removeTicker(t) {
    setTickers((prev) => prev.filter((x) => x !== t));
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    setShowDropdown(true);
    setHighlightIndex(0);
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
      if (chosen) selectMatch(chosen.symbol);
      else if (input.trim()) {
        addTicker(input);
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  async function runAnalysis() {
    if (tickers.length === 0) return;
    const regionAtStart = activeRegion;
    setLoading(true);
    setError(null);
    setResults(null);

    const cachedByTicker = {};
    const toFetch = [];
    for (const t of tickers) {
      const cached = forceRefresh ? null : getCached(t);
      if (cached) cachedByTicker[t] = { ...cached.data, cachedAt: cached.timestamp };
      else toFetch.push(t);
    }

    let done = Object.keys(cachedByTicker).length;
    setAnalyzeProgress({ done, total: tickers.length });

    try {
      // One request per ticker (not one batched call) so the progress bar
      // reflects real completions instead of a fake/estimated fill.
      const fetched = await Promise.all(
        toFetch.map(async (t) => {
          try {
            const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tickers: [t] }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Analysis failed');
            const r = data.results?.[0];
            if (r && !r.error) setCached(r.ticker, r);
            return r;
          } finally {
            done += 1;
            setAnalyzeProgress({ done, total: tickers.length });
          }
        })
      );

      // If the user switched regions while this was in flight, the response
      // is stale — don't let it repopulate results for a region the user
      // has since navigated away from.
      if (activeRegionRef.current !== regionAtStart) return;

      const merged = tickers
        .map((t) => cachedByTicker[t] || fetched.find((r) => r?.ticker === t))
        .filter(Boolean);
      setResults(merged);
    } catch (err) {
      if (activeRegionRef.current === regionAtStart) setError(err.message);
    } finally {
      if (activeRegionRef.current === regionAtStart) setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <SiteNav />
      <div className="max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Stock Analyzer</h1>
        <p className="mt-2 text-sm text-gray-400 whitespace-nowrap text-center">
          Select up to 15 tickers to score on valuation, growth, financial health, and technical momentum. This is a
          rules-based research aid, not investment advice.
        </p>

        {/* Region toggle */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            onMouseDown={(e) => e.preventDefault()}
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
            onMouseDown={(e) => e.preventDefault()}
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

        {/* Ticker picker */}
        <div className="mt-4 bg-gray-800 rounded-xl p-5 border border-gray-700/50">

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Selected</span>
            <span className="flex items-center gap-2">
              {tickers.length > 0 && (
                <button
                  onClick={() => setTickers([])}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Clear all
                </button>
              )}
              <span className="text-xs text-gray-600">{tickers.length}/10</span>
            </span>
          </div>
          <div
            className={`flex flex-wrap gap-2 min-h-[3.25rem] rounded-lg border-2 p-2.5 transition-colors ${
              tickers.length > 0 ? 'border-purple-500/40 bg-purple-500/5' : 'border-dashed border-gray-700 bg-gray-900/40'
            }`}
          >
            {tickers.map((t) => (
              <span
                key={t}
                className="animate-chip-pop group flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full pl-1.5 pr-2.5 py-1 text-sm"
              >
                <Avatar symbol={t} size="xs" />
                <span className="text-gray-100 font-medium">{t}</span>
                <button
                  onClick={() => removeTicker(t)}
                  aria-label={`Remove ${t}`}
                  className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
            {tickers.length === 0 && (
              <span className="text-sm text-gray-500 py-1 self-center">No tickers selected yet.</span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {sectorsForRegion.map((sector) => (
              <button
                key={sector}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSector(sector)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  activeSector === sector
                    ? SECTOR_TAB_ACTIVE_STYLES[sector]
                    : 'bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                }`}
              >
                {SECTOR_EMOJI[sector]} {sector}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setShowDropdown(true)}
                onBlur={() =>
                  setTimeout(() => {
                    setShowDropdown(false);
                    setActiveSector(null);
                  }, 120)
                }
                placeholder={activeSector ? `Search within ${activeSector}…` : 'Search by ticker or company name…'}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />

              {showDropdown && matches.length > 0 && (
                <div className="absolute z-30 mt-1.5 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 shadow-2xl">
                  {activeSector && !input.trim() && (
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-600">
                      {SECTOR_EMOJI[activeSector]} {activeSector}
                    </div>
                  )}
                  {matches.map((m, i) => (
                    <button
                      key={m.symbol}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMatch(m.symbol);
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
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          SECTOR_STYLES[m.sector] || 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {m.sector}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading || tickers.length === 0}
              className="shrink-0 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-lg"
            >
              {loading ? 'Analyzing…' : 'Run Analysis'}
            </button>
          </div>

          <label className="mt-4 flex items-center gap-2 text-xs text-gray-400 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="accent-purple-600"
            />
            Force refresh (skip 24h cache)
          </label>

          <p className="mt-3 text-[11px] text-gray-600">
            Your ticker selections and analysis results are saved to your browser&apos;s local storage.
          </p>
        </div>

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-purple-500 animate-spin" />
            <p className="text-gray-400 text-sm">
              Fetching data and scoring {tickers.length} ticker{tickers.length !== 1 ? 's' : ''}…
            </p>
            <div className="w-full max-w-xs bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${analyzeProgress.total > 0 ? (analyzeProgress.done / analyzeProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-600">
              {analyzeProgress.done} / {analyzeProgress.total}
            </p>
          </div>
        )}

        {results && (
          <>
            <div className="mt-10">
              <RankingSummary results={results} />
            </div>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortedResults.map((r) => (
                <ResultCard key={r.ticker} result={r} rank={rankByTicker[r.ticker]} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
