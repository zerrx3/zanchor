'use client';

import { useEffect, useMemo, useState } from 'react';
import SiteNav from '@/components/SiteNav';
import { SECTOR_EMOJI } from '@/lib/tickerDirectory';

const CACHE_TTL_MS = 20 * 60 * 1000;

function cacheKey(region) {
  return `sectorRotation:${region}:v1`;
}

function getCached(region) {
  try {
    const raw = localStorage.getItem(cacheKey(region));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function setCached(region, data) {
  try {
    localStorage.setItem(cacheKey(region), JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // caching is a nice-to-have, not required
  }
}

const TIMEFRAMES = [
  { key: 'oneWeekPct', label: '1W' },
  { key: 'oneMonthPct', label: '1M' },
  { key: 'threeMonthPct', label: '3M' },
];

const HEATMAP_CAP_PCT = 10;

// Interpolates red (down) -> gray (flat) -> green (up), clamped at ±HEATMAP_CAP_PCT.
function heatColor(pct) {
  if (pct == null) return 'rgba(107, 114, 128, 0.15)'; // gray-500, no data
  const clamped = Math.max(-HEATMAP_CAP_PCT, Math.min(HEATMAP_CAP_PCT, pct));
  const intensity = Math.abs(clamped) / HEATMAP_CAP_PCT; // 0..1
  const alpha = 0.12 + intensity * 0.38; // keep it readable, never fully opaque
  return clamped >= 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(248, 113, 113, ${alpha})`;
}

function fmtPct(pct) {
  if (pct == null) return 'N/A';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export default function SectorRotationPage() {
  const [region, setRegion] = useState('US');
  const [timeframe, setTimeframe] = useState('oneMonthPct');
  const [sectors, setSectors] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cached = getCached(region);
    if (cached) setSectors(cached);
    else setSectors(null);
    setError(null);
    setLoading(!cached);

    fetch(`/api/sector-rotation?region=${region}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load sector performance');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSectors(data.sectors);
        setCached(region, data.sectors);
      })
      .catch((err) => {
        if (!cancelled && !cached) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [region]);

  const sortedSectors = useMemo(() => {
    if (!sectors) return null;
    return [...sectors].sort((a, b) => (b[timeframe] ?? -Infinity) - (a[timeframe] ?? -Infinity));
  }, [sectors, timeframe]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <SiteNav />
      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Sector Rotation</h1>
        <p className="mt-2 text-sm text-gray-400 text-center max-w-2xl mx-auto">
          Which parts of the market are leading or lagging — average price performance across each curated sector,
          over three timeframes.
        </p>

        {/* Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <div className="flex gap-1.5 bg-gray-800 rounded-lg p-1 border border-gray-700/50">
            {['US', 'SG'].map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  region === r
                    ? r === 'US'
                      ? 'bg-blue-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {r === 'US' ? '🇺🇸 US' : '🇸🇬 SG'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 bg-gray-800 rounded-lg p-1 border border-gray-700/50">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === tf.key ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-8 bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-lg px-4 py-3 text-center">
            {error}
          </div>
        )}

        {loading && !sortedSectors && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-rose-500 animate-spin" />
            <p className="text-gray-400 text-sm">Pulling price history across every sector…</p>
          </div>
        )}

        {sortedSectors && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sortedSectors.map((s) => (
              <div
                key={s.sector}
                className="rounded-xl border border-white/5 p-4"
                style={{ backgroundColor: heatColor(s[timeframe]) }}
              >
                <div className="flex items-center gap-1.5 text-sm text-gray-200">
                  <span>{SECTOR_EMOJI[s.sector] || '📊'}</span>
                  <span className="font-medium">{s.sector}</span>
                </div>
                <div className="mt-2 font-mono text-2xl font-bold text-white">{fmtPct(s[timeframe])}</div>
                <div className="mt-2 flex gap-3 text-[11px] text-gray-400">
                  {TIMEFRAMES.filter((tf) => tf.key !== timeframe).map((tf) => (
                    <span key={tf.key}>
                      {tf.label} {fmtPct(s[tf.key])}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[10px] text-gray-500">{s.coveredCount}/{s.tickerCount} tickers</div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-10 text-[11px] text-gray-600 text-center">
          Each sector's % is an equal-weighted average across its curated member tickers, not market-cap weighted —
          a small stock swinging hard can move the average as much as a large one.
        </p>
      </div>
    </div>
  );
}
