import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Live ticker search fallback for anything not in the curated directory
// (lib/tickerDirectory.js). Keeps the autocomplete useful for tickers we
// haven't hand-listed, like recent IPOs.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const region = searchParams.get('region') === 'SG' ? 'SG' : 'US';

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const { quotes } = await yahooFinance.search(q, { quotesCount: 8, newsCount: 0 });

    const results = (quotes || [])
      .filter((quote) => {
        if (quote.quoteType !== 'EQUITY' || !quote.symbol) return false;
        return region === 'SG' ? quote.exchange === 'SES' : !quote.symbol.includes('.');
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
