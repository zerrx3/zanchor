import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Live ticker search fallback for anything not in the curated directory
// (lib/tickerDirectory.js). Keeps the autocomplete useful for tickers we
// haven't hand-listed, like recent IPOs.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const regionParam = searchParams.get('region');
  // No region param (or explicitly 'ALL') searches every market; 'US'/'SG'
  // scopes results the way the region-toggle UIs (e.g. Stock Analyzer) expect.
  const region = regionParam === 'SG' ? 'SG' : regionParam === 'US' ? 'US' : 'ALL';

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const { quotes } = await yahooFinance.search(q, { quotesCount: 8, newsCount: 0 });

    const results = (quotes || [])
      .filter((quote) => {
        if (quote.quoteType !== 'EQUITY' || !quote.symbol) return false;
        if (region === 'SG') return quote.exchange === 'SES';
        if (region === 'US') return !quote.symbol.includes('.');
        return true;
      })
      .map((quote) => ({
        symbol: quote.symbol,
        name: quote.longname || quote.shortname || quote.symbol,
        sector: quote.sectorDisp || quote.sector || 'Other',
      }))
      .slice(0, 8);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
