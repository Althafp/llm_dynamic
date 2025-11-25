import { NextRequest, NextResponse } from 'next/server';
import { listPreviousResults } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const results = await listPreviousResults();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error listing previous results:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

