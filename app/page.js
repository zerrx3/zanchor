'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CHANGELOG } from '@/lib/changelog';

const STATS = [
  { value: '6', label: 'Research Tools' },
  { value: '15', label: 'Sectors Tracked' },
  { value: 'US + SG', label: 'Markets Covered' },
  { value: '24h', label: 'Data Refresh Cycle' },
];

const TOOLS = [
  {
    href: '/portfolio-analyzer',
    tag: '01 · Portfolio',
    title: 'Portfolio Analyzer',
    description:
      'Track your holdings in one place — live value, allocation by position, and gain/loss at a glance so you always know where you stand.',
    chips: ['Allocation', 'P&L Tracking', 'Holdings'],
    cta: 'Open portfolio',
    accent: 'cyan',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 19h16M6 19V9m6 10V5m6 14v-7"
      />
    ),
  },
  {
    href: '/stock-analyzer',
    tag: '02 · Equities',
    title: 'Stock Analyzer',
    description:
      'Score any ticker on valuation, growth, financial health, and momentum, then rank your watchlist by conviction with a full pros vs. cons breakdown.',
    chips: ['Valuation', 'Growth', 'Momentum', 'Analyst Sentiment'],
    cta: 'Launch analyzer',
    accent: 'emerald',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 17l5-5.5 4 3L21 5M21 5h-5M21 5v5"
      />
    ),
  },
  {
    href: '/swing-strategy',
    tag: '03 · Swing Trading',
    title: 'Swing Strategy',
    description:
      'Confluence entries for 2–14 day swing trades — trend pullback, market structure, and Fibonacci zones overlapped into one setup with stop-loss and take-profit levels.',
    chips: ['Confluence Entry', 'Risk & Reward', 'Multi-Timeframe'],
    cta: 'Strategize',
    accent: 'amber',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3 8 4-16 3 8h4" />,
  },
  {
    href: '/screener',
    tag: '04 · Ranking',
    title: 'Screener',
    description:
      'Pick a sector and screen every curated ticker in it at once — scored, ranked, and filterable by minimum score, dividend yield, or days to earnings.',
    chips: ['Sector Scan', 'Ranked Table', 'Filterable'],
    cta: 'Run a screen',
    accent: 'orange',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm8 16-4.35-4.35"
      />
    ),
  },
  {
    href: '/sector-rotation',
    tag: '05 · Heatmap',
    title: 'Sector Rotation',
    description:
      'See which parts of the market are leading or lagging — average performance across every curated sector, over 1W/1M/3M, US and SG.',
    chips: ['Heatmap', 'US + SG', 'Multi-Timeframe'],
    cta: 'View heatmap',
    accent: 'rose',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h4v-6H4v6Zm6 0h4V9h-4v10Zm6 0h4V4h-4v15Z" />,
  },
  {
    href: '/market-newsletter',
    tag: '06 · Briefing',
    title: 'Market Newsletter',
    description:
      'Draft a weekly market newsletter from live data — subject lines, a macro overview, a stock spotlight, and a quick watchlist, ready to edit and send.',
    chips: ['Spotlight', 'Watchlist', 'Bull vs. Bear'],
    cta: 'Draft this week’s issue',
    accent: 'purple',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4V6Zm0 0 8 7 8-7" />,
  },
];

const ACCENT_STYLES = {
  emerald: {
    border: 'hover:border-emerald-500/50',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(16,185,129,0.35)]',
    iconWrap: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    cta: 'text-emerald-400 group-hover:text-emerald-300',
  },
  cyan: {
    border: 'hover:border-cyan-500/50',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(34,211,238,0.35)]',
    iconWrap: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    cta: 'text-cyan-400 group-hover:text-cyan-300',
  },
  purple: {
    border: 'hover:border-purple-500/50',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(168,85,247,0.35)]',
    iconWrap: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    chip: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    cta: 'text-purple-400 group-hover:text-purple-300',
  },
  amber: {
    border: 'hover:border-amber-500/50',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(245,158,11,0.35)]',
    iconWrap: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    cta: 'text-amber-400 group-hover:text-amber-300',
  },
  rose: {
    border: 'hover:border-rose-500/50',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(244,63,94,0.35)]',
    iconWrap: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    chip: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    cta: 'text-rose-400 group-hover:text-rose-300',
  },
  orange: {
    border: 'hover:border-orange-500/50',
    glow: 'group-hover:shadow-[0_0_40px_-8px_rgba(249,115,22,0.35)]',
    iconWrap: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    chip: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    cta: 'text-orange-400 group-hover:text-orange-300',
  },
};

const TAPE_CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedTape(region) {
  try {
    const raw = localStorage.getItem(`tickerTape:${region}:v1`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > TAPE_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null; // storage unavailable — just refetch
  }
}

function setCachedTape(region, data) {
  try {
    localStorage.setItem(`tickerTape:${region}:v1`, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // caching is a nice-to-have, not required
  }
}

function TickerTape({ region }) {
  const [items, setItems] = useState(null);

  // Cache is browser-only state, so it's loaded post-mount (not as the lazy
  // initial state) to keep the client's first render identical to the
  // server's and avoid a hydration mismatch.
  useEffect(() => {
    const cached = getCachedTape(region);
    if (cached) setItems(cached);
  }, [region]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ticker-tape?region=${region}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled || !data.items?.length) return;
        setItems(data.items);
        setCachedTape(region, data.items);
      })
      .catch(() => {
        // keep whatever we had (cached or nothing) — the tape just hides itself
      });
    return () => {
      cancelled = true;
    };
  }, [region]);

  if (!items || items.length === 0) return null;

  const loop = [...items, ...items];
  return (
    <div className="ticker-tape relative w-full overflow-hidden border-y border-white/5 bg-black/40 backdrop-blur-sm">
      <div className={`flex w-max py-2.5 ${region === 'SG' ? 'animate-marquee-reverse' : 'animate-marquee'}`}>
        {loop.map((t, i) => {
          const up = t.changePct >= 0;
          return (
            <div key={i} className="flex items-center gap-2 px-5 whitespace-nowrap text-xs font-mono">
              <span className="text-gray-400">{t.symbol}</span>
              <span className="text-gray-200">{t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className={up ? 'text-emerald-400' : 'text-red-400'}>
                {up ? '▲' : '▼'} {Math.abs(t.changePct).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INDEX_CACHE_KEY = 'marketPulse:v1';
const INDEX_CACHE_TTL_MS = 15 * 60 * 1000;

function getCachedIndices() {
  try {
    const raw = localStorage.getItem(INDEX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > INDEX_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null; // storage unavailable — just refetch
  }
}

function setCachedIndices(data) {
  try {
    localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // caching is a nice-to-have, not required
  }
}

const INDEX_META = {
  SPX: { label: 'S&P 500', flag: '🇺🇸' },
  STI: { label: 'Straits Times Index', flag: '🇸🇬' },
};

function Sparkline({ points, color }) {
  const width = 300;
  const height = 90;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => [i * stepX, height - ((p - min) / range) * height]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = coords[coords.length - 1];
  const gradientId = `spark-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="100"
        className="animate-draw-line"
        style={{ filter: `drop-shadow(0 0 6px ${color}99)` }}
      />
      <circle cx={lastX} cy={lastY} r="4.5" fill={color} className="animate-blink-dot" />
    </svg>
  );
}

function IndexCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 animate-pulse">
      <div className="h-4 w-32 bg-gray-800 rounded mb-3" />
      <div className="h-8 w-24 bg-gray-800 rounded mb-4" />
      <div className="h-20 w-full bg-gray-800 rounded" />
    </div>
  );
}

function IndexCard({ data }) {
  if (!data) return <IndexCardSkeleton />;

  const meta = INDEX_META[data.key] || { label: data.name, flag: '' };

  if (data.error || data.points.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/60 p-5 text-center text-sm text-gray-500">
        {meta.label} unavailable right now.
      </div>
    );
  }

  const up = (data.changePct ?? 0) >= 0;
  const color = up ? '#34d399' : '#f87171';

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 text-left backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-400">
          <span>{meta.flag}</span>
          <span>{meta.label}</span>
        </div>
        {(data.fiftyTwoWeekHigh != null || data.fiftyTwoWeekLow != null) && (
          <div className="shrink-0 text-right font-mono text-[10px] leading-tight text-gray-500">
            {data.fiftyTwoWeekHigh != null && (
              <div>
                52w H <span className="text-gray-300">{data.fiftyTwoWeekHigh.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {data.fiftyTwoWeekLow != null && (
              <div>
                52w L <span className="text-gray-300">{data.fiftyTwoWeekLow.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-white">
          {data.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        {data.changePct != null && (
          <span className={`font-mono text-xs ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? '▲' : '▼'} {Math.abs(data.changePct).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <Sparkline points={data.points} color={color} />
      </div>
      <div className="mt-1 text-right text-[10px] uppercase tracking-wide text-gray-600">6-month trend</div>
    </div>
  );
}

function MarketPulse() {
  const [indices, setIndices] = useState(null);
  const [failed, setFailed] = useState(false);

  // Cache is browser-only state, so it's loaded post-mount (not as the lazy
  // initial state) to keep the client's first render identical to the
  // server's and avoid a hydration mismatch.
  useEffect(() => {
    const cached = getCachedIndices();
    if (cached) setIndices(cached);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/market-indices')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load market data');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setIndices(data.indices);
        setCachedIndices(data.indices);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed && !indices) {
    return <p className="text-center text-sm text-gray-500">Market data unavailable right now.</p>;
  }

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
      <IndexCard data={indices?.SPX} />
      <IndexCard data={indices?.STI} />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid animate-grid-pan opacity-60" aria-hidden />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(3,7,18,0.9)_75%)]"
          aria-hidden
        />
        <div
          className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl animate-pulse-glow"
          aria-hidden
        />
        <div
          className="absolute top-10 -right-16 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-3xl animate-pulse-glow"
          style={{ animationDelay: '1.2s' }}
          aria-hidden
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-mono tracking-wide text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              SYSTEMS OPERATIONAL — RESEARCH TOOLS ONLINE
            </span>

            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="block text-white">Data-driven tools for</span>
              <span className="block bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                smarter market decisions
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto">
              Zanchor is a small lab of rules-based research tools — score stocks, rank watchlists, and track
              a portfolio without the noise. No hype, just the numbers.
            </p>

          </div>

          {/* Stats strip */}
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-gray-950/80 px-4 py-5 text-center">
                <div className="font-mono text-2xl font-bold text-white">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-10">
          <TickerTape region="US" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mt-10 w-full">
            <MarketPulse />
          </div>
        </div>

        <div className="relative z-10 mt-8">
          <TickerTape region="SG" />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pt-0 pb-6 sm:px-6 lg:px-8">
        {/* Tools */}
        <section id="tools" className="pt-4 pb-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Research{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Tools
              </span>
            </h2>
            <div className="mx-auto mt-3 h-px w-16 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TOOLS.map((tool) => {
              const accent = ACCENT_STYLES[tool.accent];
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`group relative flex h-full flex-col rounded-2xl border border-gray-800 bg-gray-900/60 p-6 backdrop-blur transition-all duration-300 ${accent.border} ${accent.glow}`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${accent.iconWrap}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                        {tool.icon}
                      </svg>
                    </span>
                    <span className="font-mono text-[11px] tracking-wide text-gray-600">{tool.tag}</span>
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-white">{tool.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{tool.description}</p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tool.chips.map((chip) => (
                      <span
                        key={chip}
                        className={`rounded-full border px-2.5 py-1 text-[11px] ${accent.chip}`}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <span
                    className={`mt-auto self-end pt-5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${accent.cta}`}
                  >
                    {tool.cta}
                    <span className="transition-transform group-hover:translate-x-1" aria-hidden>
                      →
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Changelog */}
        <section id="changelog" className="pb-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Change
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                log
              </span>
            </h2>
            <div className="mx-auto mt-3 h-px w-16 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          </div>

          <div className="mx-auto max-w-3xl space-y-5">
            {CHANGELOG.slice(0, 1).map((entry) => (
              <div
                key={entry.version}
                className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 backdrop-blur"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs text-emerald-300">
                    {entry.version}
                  </span>
                  <h3 className="text-base font-semibold text-white">{entry.title}</h3>
                  <span className="ml-auto font-mono text-xs text-gray-600">{entry.date}</span>
                </div>
                <ul className="mt-4 space-y-2">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-600" aria-hidden />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-gray-800 text-center text-sm text-gray-500 font-mono">
          © {new Date().getFullYear()} Zanchor — Built with Next.js & Tailwind
        </footer>
      </div>
    </div>
  );
}
