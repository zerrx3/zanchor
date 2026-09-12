import { NextResponse } from 'next/server';
import { analyzeTicker } from '@/lib/stockAnalysis';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tickers = Array.isArray(body?.tickers) ? body.tickers : [];
  const cleaned = [...new Set(tickers.map((t) => String(t).trim().toUpperCase()).filter(Boolean))].slice(0, 15);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: 'Provide at least one ticker' }, { status: 400 });
  }

  const results = await Promise.all(cleaned.map((ticker) => analyzeTicker(ticker)));

  return NextResponse.json({ results });
}
