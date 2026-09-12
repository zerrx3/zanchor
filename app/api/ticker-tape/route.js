import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// display: what the homepage ticker tape shows. symbol: the actual Yahoo
// Finance query symbol (differs when the display ticker isn't Yahoo's own).
const TAPE_SYMBOLS = {
  US: [
    // Magnificent 7
    { display: 'AAPL', symbol: 'AAPL' },
    { display: 'MSFT', symbol: 'MSFT' },
    { display: 'NVDA', symbol: 'NVDA' },
    { display: 'TSLA', symbol: 'TSLA' },
    { display: 'GOOGL', symbol: 'GOOGL' },
    { display: 'AMZN', symbol: 'AMZN' },
    { display: 'META', symbol: 'META' },
    { display: 'SPCX', symbol: 'SPCX' },
  ],
  // A representative slice of the Straits Times Index constituents.
  SG: [
    { display: 'D05.SI', symbol: 'D05.SI' }, // DBS
    { display: 'O39.SI', symbol: 'O39.SI' }, // OCBC
    { display: 'U11.SI', symbol: 'U11.SI' }, // UOB
    { display: 'Z74.SI', symbol: 'Z74.SI' }, // Singtel
    { display: 'C6L.SI', symbol: 'C6L.SI' }, // Singapore Airlines
    { display: 'S68.SI', symbol: 'S68.SI' }, // SGX
    { display: 'S63.SI', symbol: 'S63.SI' }, // ST Engineering
  ],
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') === 'SG' ? 'SG' : 'US';
  const symbols = TAPE_SYMBOLS[region];

  try {
    const quotes = await yahooFinance.quote(symbols.map((t) => t.symbol));
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

    const items = symbols
      .map(({ display, symbol }) => {
        const q = bySymbol.get(symbol);
        if (!q || q.regularMarketPrice == null) return null;
        return {
          symbol: display,
          price: q.regularMarketPrice,
          changePct: q.regularMarketChangePercent ?? 0,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
