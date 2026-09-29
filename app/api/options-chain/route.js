import { NextResponse } from 'next/server';
import { fetchExpirationChain } from '@/lib/optionsAnalysis';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ticker = typeof body?.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
  const expiration = typeof body?.expiration === 'string' ? body.expiration : '';
  if (!ticker || !expiration) {
    return NextResponse.json({ error: 'Provide a ticker and expiration date' }, { status: 400 });
  }

  try {
    const chain = await fetchExpirationChain(ticker, expiration);
    if (!chain) {
      return NextResponse.json({ error: `Could not load the options chain for '${ticker}'.` }, { status: 422 });
    }
    return NextResponse.json({ chain });
  } catch (exc) {
    return NextResponse.json({ error: `Unexpected error: ${exc.message}` }, { status: 500 });
  }
}
