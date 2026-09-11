import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Returns conversion rates to USD for the requested currency codes, so a
// multi-currency portfolio (e.g. USD + SGD holdings) can be rolled up into
// one accurate total instead of just summing mismatched currencies.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const currencies = [...new Set((searchParams.get('currencies') || '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean))];

  const rates = { USD: 1 };

  await Promise.all(
    currencies
      .filter((c) => c !== 'USD')
      .map(async (currency) => {
        try {
          const quote = await yahooFinance.quote(`${currency}USD=X`);
          if (quote?.regularMarketPrice) rates[currency] = quote.regularMarketPrice;
        } catch {
          // leave this currency's rate unset — the client treats it as unknown
        }
      })
  );

  return NextResponse.json({ rates });
}
