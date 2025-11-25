import { NextRequest, NextResponse } from 'next/server';
import { getPreviousResult } from '@/lib/gcp-storage';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { success: false, error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    const result = await getPreviousResult(path);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error getting previous result:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

