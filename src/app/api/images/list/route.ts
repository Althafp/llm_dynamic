import { NextRequest, NextResponse } from 'next/server';
import { listAvailableDates, listImages } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const cameraType = searchParams.get('cameraType') as 'ANALYTICS' | 'FIXED' | 'PTZ' | null;

    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
    });

    if (date) {
      // List images for specific date
      const images = await Promise.race([
        listImages(date, cameraType || undefined),
        timeoutPromise,
      ]) as Awaited<ReturnType<typeof listImages>>;
      return NextResponse.json({ success: true, images });
    } else {
      // List available dates
      const dates = await Promise.race([
        listAvailableDates(),
        timeoutPromise,
      ]) as Awaited<ReturnType<typeof listAvailableDates>>;
      return NextResponse.json({ success: true, dates });
    }
  } catch (error) {
    console.error('Error listing images:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to connect to GCP. Please check your gcs-key.json file and network connection.'
      },
      { status: 500 }
    );
  }
}

