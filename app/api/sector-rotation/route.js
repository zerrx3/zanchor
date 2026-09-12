import { NextResponse } from 'next/server';
import { getSectorPerformance } from '@/lib/sectorRotation';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') === 'SG' ? 'SG' : 'US';

  try {
    const sectors = await getSectorPerformance(region);
    return NextResponse.json({ region, sectors });
  } catch (exc) {
    return NextResponse.json({ error: `Unexpected error: ${exc.message}` }, { status: 500 });
  }
}
