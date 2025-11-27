import { NextRequest, NextResponse } from 'next/server';
import { listPreviousResults } from '@/lib/gcp-storage';

export const runtime = 'nodejs';
export const revalidate = 300; // Cache for 5 minutes (results don't change often)

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    const results = await listPreviousResults();
    const duration = Date.now() - startTime;
    console.log(`✅ listPreviousResults completed in ${duration}ms (${results.length} results)`);
    
    // Add cache headers
    const response = NextResponse.json({ success: true, results });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return response;
  } catch (error) {
    console.error('Error listing previous results:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

