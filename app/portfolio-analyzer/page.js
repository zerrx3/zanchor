'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { searchTickers, tickerColor } from '@/lib/tickerDirectory';
import { currencyPrefix } from '@/lib/currency';

// Shares the same cache as Stock Analyzer (same prefix/TTL) — if you already
// analyzed a ticker there, Portfolio Analyzer reuses it instead of refetching.
const CACHE_PREFIX = 'stockAnalyzer:v2:'; // bumped: v1 entries predate the `sector` field
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HOLDINGS_STORAGE_KEY = 'portfolioAnalyzer:holdings:v1';

function getCached(ticker) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + ticker);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCached(ticker, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + ticker, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // ignore
  }
}

const VERDICT_STYLES = {
  'Strong Buy': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  Buy: 'bg-green-500/15 text-green-400 border-green-500/40',
  Hold: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  Sell: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  Avoid: 'bg-red-500/15 text-red-400 border-red-500/40',
};

const VERDICT_RANK = { 'Strong Buy': 5, Buy: 4, Hold: 3, Sell: 2, Avoid: 1 };

const TABLE_COLUMNS = [
  { key: 'holding', label: 'Holding', sortable: false },
  { key: 'qty', label: 'Qty' },
  { key: 'avgPrice', label: 'Avg Price' },
  { key: 'current', label: 'Current' },
  { key: 'value', label: 'Value' },
  { key: 'weight', label: 'Weight' },
  { key: 'gainLoss', label: 'Gain/Loss' },
  { key: 'score', label: 'Score' },
  { key: 'verdict', label: 'Verdict' },
];

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

function verdictStyle(verdict) {
  return VERDICT_STYLES[verdict] || 'bg-gray-500/15 text-gray-400 border-gray-500/40';
}

const AVATAR_SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
};

function Avatar({ symbol, size = 'sm' }) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold text-white ${AVATAR_SIZES[size] || AVATAR_SIZES.sm}`}
      style={{ backgroundColor: tickerColor(symbol) }}
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

function gainLossColor(value) {
  if (value == null) return 'text-gray-500';
  return value >= 0 ? 'text-green-400' : 'text-red-400';
}

function SectorAllocationChart({ data }) {
  if (data.length === 0) return null;
  const maxPct = Math.max(...data.map((d) => d.pct));
  return (
    <div className="space-y-2.5">
      {data.map((entry) => (
        <div key={entry.sector} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-xs text-gray-400 truncate">{entry.sector}</span>
          <div className="flex-1 h-4 rounded bg-gray-900/60 overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{ width: `${(entry.pct / maxPct) * 100}%`, backgroundColor: tickerColor(entry.sector) }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs text-gray-300 font-medium">{entry.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function PortfolioAnalyzerPage() {
  const [holdings, setHoldings] = useState([]);
  const [activeRegion, setActiveRegion] = useState('US');
  const [input, setInput] = useState('');
  const [pendingTicker, setPendingTicker] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [liveMatches, setLiveMatches] = useState([]);
  const [addError, setAddError] = useState(null);
  const [results, setResults] = useState(null);
  const [fxRates, setFxRates] = useState({ USD: 1 });
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const isFirstSaveRef = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HOLDINGS_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) setHoldings(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isFirstSaveRef.current) {
      isFirstSaveRef.current = false;
      return;
    }
    try {
      localStorage.setItem(HOLDINGS_STORAGE_KEY, JSON.stringify(holdings));
    } catch {
      // ignore
    }
  }, [holdings]);

  const localMatches = useMemo(
    () => searchTickers(input, holdings.map((h) => h.ticker), null, activeRegion),
    [input, holdings, activeRegion]
  );

  useEffect(() => {
    if (!input.trim()) {
      setLiveMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-tickers?q=${encodeURIComponent(input.trim())}&region=${activeRegion}`);
        if (!res.ok) return;
        const data = await res.json();
        setLiveMatches(data.results || []);
      } catch {
        setLiveMatches([]);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [input, activeRegion]);

  const matches = useMemo(() => {
    const localSymbols = new Set(localMatches.map((m) => m.symbol));
    const held = new Set(holdings.map((h) => h.ticker));
    const extra = liveMatches.filter((m) => !localSymbols.has(m.symbol) && !held.has(m.symbol));
    return [...localMatches, ...extra].slice(0, 8);
  }, [localMatches, liveMatches, holdings]);

  function selectMatch(m) {
    setPendingTicker({ symbol: m.symbol, name: m.name });
    setInput('');
    setShowDropdown(false);
    setAddError(null);
  }

  function handleAddHolding() {
    if (!pendingTicker) {
      setAddError('Search for a ticker and select it first.');
      return;
    }
    if (holdings.some((h) => h.ticker === pendingTicker.symbol)) {
      setAddError('Already in your portfolio.');
      return;
    }
    const qty = parseFloat(quantity);
    const price = parseFloat(avgPrice);
    if (!qty || qty <= 0) {
      setAddError('Enter a valid quantity.');
      return;
    }
    if (!price || price <= 0) {
      setAddError('Enter a valid average price.');
      return;
    }
    setHoldings((prev) => [...prev, { ticker: pendingTicker.symbol, name: pendingTicker.name, quantity: qty, avgPrice: price }]);
    setPendingTicker(null);
    setQuantity('');
    setAvgPrice('');
    setAddError(null);
    setResults(null);
  }

  function removeHolding(ticker) {
    setHoldings((prev) => prev.filter((h) => h.ticker !== ticker));
    setResults((prev) => (prev ? prev.filter((r) => r.ticker !== ticker) : prev));
  }

  async function analyzePortfolio() {
    if (holdings.length === 0) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const cachedByTicker = {};
    const toFetch = [];
    for (const h of holdings) {
      const cached = getCached(h.ticker);
      if (cached) cachedByTicker[h.ticker] = cached.data;
      else toFetch.push(h.ticker);
    }

    let done = Object.keys(cachedByTicker).length;
    setProgress({ done, total: holdings.length });

    try {
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
            setProgress({ done, total: holdings.length });
          }
        })
      );

      const analysisByTicker = { ...cachedByTicker };
      for (const r of fetched) if (r) analysisByTicker[r.ticker] = r;

      // Always include SGD so the USD/SGD display toggle works even for an
      // all-US portfolio, not just when an SG holding happens to be present.
      const currencies = [
        ...new Set([
          'SGD',
          ...Object.values(analysisByTicker)
            .filter((a) => !a.error)
            .map((a) => a.currency)
            .filter(Boolean),
        ]),
      ];

      let rates = { USD: 1 };
      const fxRes = await fetch(`/api/fx-rate?currencies=${currencies.join(',')}`);
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        rates = { ...rates, ...fxData.rates };
      }
      setFxRates(rates);

      const merged = holdings.map((h) => {
        const a = analysisByTicker[h.ticker];
        if (!a || a.error) {
          return { ...h, error: a?.error || 'No data available', analysis: null };
        }
        const fx = !a.currency || a.currency === 'USD' ? 1 : rates[a.currency];
        const valueNative = h.quantity * a.price;
        const costNative = h.quantity * h.avgPrice;
        const gainLossPct = costNative > 0 ? ((valueNative - costNative) / costNative) * 100 : null;
        const valueUSD = fx != null ? valueNative * fx : null;
        const costUSD = fx != null ? costNative * fx : null;
        return { ...h, analysis: a, valueNative, costNative, gainLossPct, valueUSD, costUSD, fxMissing: fx == null };
      });

      setResults(merged);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // USD is the internal base for all conversion (weights/sector allocation
  // are ratios and stay correct regardless of display currency). Converting
  // to another display currency only affects the dollar figures shown.
  function fromUSD(usdAmount, currency) {
    if (usdAmount == null) return null;
    if (currency === 'USD') return usdAmount;
    const rate = fxRates[currency];
    return rate ? usdAmount / rate : null;
  }

  // Converts a per-share price (or any amount) from its own native currency
  // into the selected display currency, via USD as the intermediate step.
  function toDisplay(nativeAmount, nativeCurrency) {
    if (nativeAmount == null) return null;
    const toUSDRate = !nativeCurrency || nativeCurrency === 'USD' ? 1 : fxRates[nativeCurrency];
    if (toUSDRate == null) return null;
    return fromUSD(nativeAmount * toUSDRate, displayCurrency);
  }

  const totals = useMemo(() => {
    if (!results) return null;
    const valid = results.filter((r) => !r.error && r.valueUSD != null);
    const totalValueUSD = valid.reduce((s, r) => s + r.valueUSD, 0);
    const totalCostUSD = valid.reduce((s, r) => s + r.costUSD, 0);
    const totalGainLossUSD = totalValueUSD - totalCostUSD;
    const totalGainLossPct = totalCostUSD > 0 ? (totalGainLossUSD / totalCostUSD) * 100 : null;
    const excludedCount = results.length - valid.length;
    const displayTotalValue = fromUSD(totalValueUSD, displayCurrency);
    const displayTotalCost = fromUSD(totalCostUSD, displayCurrency);
    const displayTotalGainLoss = fromUSD(totalGainLossUSD, displayCurrency);
    return {
      totalValueUSD,
      totalCostUSD,
      totalGainLossUSD,
      totalGainLossPct,
      excludedCount,
      displayTotalValue,
      displayTotalCost,
      displayTotalGainLoss,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, displayCurrency, fxRates]);

  const sectorAllocation = useMemo(() => {
    if (!results || !totals || totals.totalValueUSD <= 0) return [];
    const byS = {};
    for (const r of results) {
      if (r.error || r.valueUSD == null) continue;
      const sector = r.analysis?.sector || 'Unclassified';
      byS[sector] = (byS[sector] || 0) + r.valueUSD;
    }
    return Object.entries(byS)
      .map(([sector, value]) => ({ sector, value, pct: (value / totals.totalValueUSD) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [results, totals]);

  // Portfolio-level narrative: synthesizes concentration risk, a
  // value-weighted quality score across holdings, and performance — built
  // from the same computed data as the cards/table above, not a fixed script.
  const portfolioSummary = useMemo(() => {
    if (!results || !totals || totals.totalValueUSD <= 0) return null;
    const valid = results.filter((r) => !r.error && r.valueUSD != null && r.analysis?.compositeScorePct != null);
    if (valid.length === 0) return null;

    const byWeight = valid.map((r) => ({ ...r, weight: (r.valueUSD / totals.totalValueUSD) * 100 }));
    const top = [...byWeight].sort((a, b) => b.weight - a.weight)[0];
    const topSector = sectorAllocation[0];

    const weightedAvgScore = byWeight.reduce((s, r) => s + r.analysis.compositeScorePct * (r.weight / 100), 0);
    let scoreBucket;
    if (weightedAvgScore >= 75) scoreBucket = 'Strong Buy';
    else if (weightedAvgScore >= 60) scoreBucket = 'Buy';
    else if (weightedAvgScore >= 40) scoreBucket = 'Hold';
    else if (weightedAvgScore >= 25) scoreBucket = 'Sell';
    else scoreBucket = 'Avoid';

    const weakHoldings = byWeight.filter((r) => r.analysis.verdict === 'Sell' || r.analysis.verdict === 'Avoid');
    const weakWeight = weakHoldings.reduce((s, r) => s + r.weight, 0);

    const takeaways = [];

    if (top.weight > 40) {
      takeaways.push(`Concentration risk: ${top.ticker} alone makes up ${top.weight.toFixed(0)}% of the portfolio's value.`);
    } else if (topSector && topSector.pct > 50) {
      takeaways.push(
        `Concentration risk: ${topSector.sector} makes up ${topSector.pct.toFixed(0)}% of the portfolio — limited diversification across sectors.`
      );
    } else {
      takeaways.push(
        `Diversification looks reasonable — the largest position (${top.ticker}) is ${top.weight.toFixed(0)}% of the portfolio, and the largest sector (${
          topSector?.sector ?? 'n/a'
        }) is ${topSector ? topSector.pct.toFixed(0) : '—'}%.`
      );
    }

    takeaways.push(
      `Weighted by position size, the portfolio's average composite score is ${weightedAvgScore.toFixed(0)}/100 (${scoreBucket} territory).`
    );

    if (weakHoldings.length > 0) {
      takeaways.push(
        `${weakWeight.toFixed(0)}% of the portfolio (${weakHoldings
          .map((r) => r.ticker)
          .join(', ')}) currently scores Sell or Avoid on the model — worth a closer look.`
      );
    }

    if (totals.totalGainLossPct != null) {
      takeaways.push(
        `Overall, the portfolio is ${totals.totalGainLossPct >= 0 ? 'up' : 'down'} ${Math.abs(totals.totalGainLossPct).toFixed(
          1
        )}% versus cost basis.`
      );
    }

    let recommendation;
    if (weakWeight > 20) {
      recommendation = 'A meaningful share of this portfolio is in weak-scoring holdings — consider reviewing those positions rather than adding to them.';
    } else if (top.weight > 40) {
      recommendation = 'Position sizing looks like the main risk here, not stock selection — consider trimming the largest holding to reduce single-name risk.';
    } else if (topSector && topSector.pct > 50) {
      recommendation = 'Sector concentration is the main risk here — consider adding names outside the dominant sector to spread that risk.';
    } else {
      recommendation = 'No major red flags from the model — the portfolio is reasonably diversified with a healthy weighted average score.';
    }

    return { takeaways, recommendation };
  }, [results, totals, sectorAllocation]);

  // Pre-compute every display-ready field once per row (currency-converted
  // price/value, weight) so both rendering and sorting read the same values
  // — sorting "Value" always matches what's actually shown in that column.
  const tableRows = useMemo(() => {
    if (!results) return [];
    return results.map((r) => {
      if (r.error) return r;
      const weight = totals && totals.totalValueUSD > 0 && r.valueUSD != null ? (r.valueUSD / totals.totalValueUSD) * 100 : null;
      return {
        ...r,
        weight,
        displayValue: fromUSD(r.valueUSD, displayCurrency),
        displayAvgPrice: toDisplay(r.avgPrice, r.analysis.currency),
        displayCurrentPrice: toDisplay(r.analysis.price, r.analysis.currency),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, totals, displayCurrency, fxRates]);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  function handleSort(key) {
    setSortConfig((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
  }

  function getSortValue(row, key) {
    if (row.error) return null;
    switch (key) {
      case 'holding':
        return row.ticker;
      case 'qty':
        return row.quantity;
      case 'avgPrice':
        return row.displayAvgPrice;
      case 'current':
        return row.displayCurrentPrice;
      case 'value':
        return row.displayValue;
      case 'weight':
        return row.weight;
      case 'gainLoss':
        return row.gainLossPct;
      case 'score':
        return row.analysis?.compositeScorePct;
      case 'verdict':
        return VERDICT_RANK[row.analysis?.verdict] ?? 0;
      default:
        return null;
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return tableRows;
    const withIndex = tableRows.map((row, i) => ({ row, i }));
    withIndex.sort((a, b) => {
      const av = getSortValue(a.row, sortConfig.key);
      const bv = getSortValue(b.row, sortConfig.key);
      if (av == null && bv == null) return a.i - b.i;
      if (av == null) return 1; // errors/missing data always sink to the bottom
      if (bv == null) return -1;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return withIndex.map((x) => x.row);
  }, [tableRows, sortConfig]);

  function handleInputChange(e) {
    setInput(e.target.value);
    setShowDropdown(true);
    setHighlightIndex(0);
  }

  function handleInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = matches[highlightIndex];
      if (chosen) selectMatch(chosen);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
          ← Back home
        </Link>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl text-center">Portfolio Analyzer</h1>
        <p className="mt-2 text-sm text-gray-400 text-center">
          Add your holdings with quantity and average price, then analyze value, allocation, and gain/loss.
        </p>

        {/* Add holding */}
        <div className="mt-8 bg-gray-800 rounded-xl p-5 border border-gray-700/50">
          <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-0.5 mb-3">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveRegion('US')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeRegion === 'US' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🇺🇸 US
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveRegion('SG')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeRegion === 'SG' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🇸🇬 SG
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-start">
            <div className="relative">
              {pendingTicker ? (
                <div className="flex items-center gap-2 bg-gray-900 border border-purple-500/50 rounded-lg px-3 py-2 text-sm">
                  <Avatar symbol={pendingTicker.symbol} size="xs" />
                  <span className="text-white font-medium">{pendingTicker.symbol}</span>
                  <span className="text-gray-500 truncate">{pendingTicker.name}</span>
                  <button
                    onClick={() => setPendingTicker(null)}
                    className="ml-auto text-gray-500 hover:text-red-400 transition-colors"
                    aria-label="Clear selected ticker"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 120)}
                  placeholder="Search by ticker or company name…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              )}

              {!pendingTicker && showDropdown && matches.length > 0 && (
                <div className="absolute z-30 mt-1.5 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 shadow-2xl">
                  {matches.map((m, i) => (
                    <button
                      key={m.symbol}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMatch(m);
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

            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity"
              className="w-full sm:w-28 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <input
              type="number"
              min="0"
              step="any"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              placeholder="Avg price"
              className="w-full sm:w-28 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <button
              onClick={handleAddHolding}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors"
            >
              Add Holding
            </button>
          </div>

          {addError && <p className="mt-2 text-xs text-red-400">{addError}</p>}

          {/* Holdings list */}
          <div className="mt-4 space-y-1.5">
            {holdings.length === 0 && <p className="text-sm text-gray-500">No holdings added yet.</p>}
            {holdings.map((h) => (
              <div key={h.ticker} className="flex items-center gap-3 bg-gray-900/60 rounded-lg px-3 py-2 text-sm">
                <Avatar symbol={h.ticker} size="xs" />
                <span className="text-white font-medium w-16">{h.ticker}</span>
                <span className="text-gray-500 flex-1 truncate hidden sm:inline">{h.name}</span>
                <span className="text-gray-400">{h.quantity} sh</span>
                <span className="text-gray-400">@ {h.avgPrice}</span>
                <button
                  onClick={() => removeHolding(h.ticker)}
                  aria-label={`Remove ${h.ticker}`}
                  className="ml-2 w-5 h-5 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="text-xs text-gray-500">
              {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={analyzePortfolio}
              disabled={loading || holdings.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shadow-lg"
            >
              {loading ? 'Analyzing…' : 'Analyze Portfolio'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-900/40 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-purple-500 animate-spin" />
            <p className="text-gray-400 text-sm">Analyzing {holdings.length} holding{holdings.length !== 1 ? 's' : ''}…</p>
            <div className="w-full max-w-xs bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-600">
              {progress.done} / {progress.total}
            </p>
          </div>
        )}

        {results && totals && (
          <div className="mt-10 space-y-6">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Portfolio Summary</h2>
              <div className="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-0.5">
                <button
                  onClick={() => setDisplayCurrency('USD')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    displayCurrency === 'USD' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  USD
                </button>
                <button
                  onClick={() => setDisplayCurrency('SGD')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    displayCurrency === 'SGD' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  SGD
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Value</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {totals.displayTotalValue != null ? `${currencyPrefix(displayCurrency)}${totals.displayTotalValue.toFixed(2)}` : '—'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cost Basis</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {totals.displayTotalCost != null ? `${currencyPrefix(displayCurrency)}${totals.displayTotalCost.toFixed(2)}` : '—'}
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Gain/Loss</p>
                <p className={`mt-1 text-2xl font-bold ${gainLossColor(totals.displayTotalGainLoss)}`}>
                  {totals.displayTotalGainLoss != null ? (
                    <>
                      {totals.displayTotalGainLoss >= 0 ? '+' : ''}
                      {currencyPrefix(displayCurrency)}
                      {totals.displayTotalGainLoss.toFixed(2)}
                    </>
                  ) : (
                    '—'
                  )}
                  {totals.totalGainLossPct != null && (
                    <span className="text-base ml-1.5">
                      ({totals.totalGainLossPct >= 0 ? '+' : ''}
                      {totals.totalGainLossPct.toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {totals.excludedCount > 0 && (
              <p className="text-xs text-yellow-400">
                {totals.excludedCount} holding{totals.excludedCount !== 1 ? 's' : ''} excluded from totals (data or FX conversion unavailable).
              </p>
            )}

            {/* Portfolio-level narrative */}
            {portfolioSummary && (
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Overview &amp; Recommendation</h3>
                <div className="space-y-1.5">
                  {portfolioSummary.takeaways.map((t, i) => (
                    <p key={i} className="text-gray-300 text-xs leading-relaxed">
                      {t}
                    </p>
                  ))}
                  <p className="text-gray-200 text-xs leading-relaxed pt-2 mt-1.5 border-t border-gray-700/60">
                    <span className="font-semibold text-purple-300">Recommendation: </span>
                    {portfolioSummary.recommendation}
                  </p>
                </div>
              </div>
            )}

            {/* Sector allocation */}
            {sectorAllocation.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Sector Allocation</h3>
                <SectorAllocationChart data={sectorAllocation} />
              </div>
            )}

            {/* Holdings table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-700/50">
                    {TABLE_COLUMNS.map((col) => {
                      if (col.sortable === false) {
                        return (
                          <th key={col.key} className="px-4 py-3">
                            {col.label}
                          </th>
                        );
                      }
                      const active = sortConfig.key === col.key;
                      return (
                        <th key={col.key} className="px-4 py-3">
                          <button
                            onClick={() => handleSort(col.key)}
                            className={`flex items-center gap-1.5 uppercase tracking-wide transition-colors ${
                              active ? 'text-gray-200' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {col.label}
                            <SortIcon direction={active ? sortConfig.direction : null} />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => {
                    if (r.error) {
                      return (
                        <tr key={r.ticker} className="border-b border-gray-800/60 last:border-0">
                          <td className="px-4 py-3 flex items-center gap-2">
                            <Avatar symbol={r.ticker} size="xs" />
                            <span className="text-white font-medium">{r.ticker}</span>
                          </td>
                          <td colSpan={8} className="px-4 py-3 text-red-400 text-xs">
                            {r.error}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={r.ticker} className="border-b border-gray-800/60 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar symbol={r.ticker} size="xs" />
                            <div>
                              <div className="text-white font-medium">{r.ticker}</div>
                              <div className="text-gray-500 text-xs truncate max-w-[140px]">{r.analysis.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{r.quantity}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {r.displayAvgPrice != null ? (
                            <>
                              {currencyPrefix(displayCurrency)}
                              {r.displayAvgPrice.toFixed(2)}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {r.displayCurrentPrice != null ? (
                            <>
                              {currencyPrefix(displayCurrency)}
                              {r.displayCurrentPrice.toFixed(2)}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {r.displayValue != null ? (
                            <>
                              {currencyPrefix(displayCurrency)}
                              {r.displayValue.toFixed(2)}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{r.weight != null ? `${r.weight.toFixed(1)}%` : '—'}</td>
                        <td className={`px-4 py-3 font-medium ${gainLossColor(r.gainLossPct)}`}>
                          {r.gainLossPct != null ? `${r.gainLossPct >= 0 ? '+' : ''}${r.gainLossPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{r.analysis.compositeScorePct?.toFixed(0) ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${verdictStyle(r.analysis.verdict)}`}>
                            {r.analysis.verdict}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-600 text-center">
              Totals are converted to {displayCurrency} using current exchange rates for display purposes only. Individual
              gain/loss % figures are always computed in each holding's own currency and are unaffected by FX conversion.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
