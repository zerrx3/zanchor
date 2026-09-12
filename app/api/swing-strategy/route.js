import { NextResponse } from 'next/server';
import { analyzeSwingSetup } from '@/lib/swingAnalysis';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ticker = typeof body?.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
  if (!ticker) {
    return NextResponse.json({ error: 'Provide a ticker symbol' }, { status: 400 });
  }

  const result = await analyzeSwingSetup(ticker);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result);
}
