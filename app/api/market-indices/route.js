import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const INDICES = [
  { key: 'SPX', symbol: '^GSPC', name: 'S&P 500' },
  { key: 'STI', symbol: '^STI', name: 'Straits Times Index' },
];

// Powers the homepage's "Market Pulse" mini-charts — a 6-month daily close
// series plus the latest quote for each tracked index.
export async function GET() {
  const period1 = new Date();
  period1.setDate(period1.getDate() - 180);

  const results = await Promise.all(
    INDICES.map(async ({ key, symbol, name }) => {
      try {
        const [chart, quote] = await Promise.all([
          yahooFinance.chart(symbol, { period1, interval: '1d' }),
          yahooFinance.quote(symbol),
        ]);
        const points = (chart.quotes || [])
          .filter((q) => q.close !== null && q.close !== undefined)
          .map((q) => q.close);

        if (points.length === 0) throw new Error('No price history returned');

        return {
          key,
          symbol,
          name,
          points,
          price: quote?.regularMarketPrice ?? points[points.length - 1],
          changePct: quote?.regularMarketChangePercent ?? null,
          fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
        };
      } catch {
        return {
          key,
          symbol,
          name,
          points: [],
          price: null,
          changePct: null,
          fiftyTwoWeekHigh: null,
          fiftyTwoWeekLow: null,
          error: true,
        };
      }
    })
  );

  const indices = {};
  for (const r of results) indices[r.key] = r;
  return NextResponse.json({ indices });
}
