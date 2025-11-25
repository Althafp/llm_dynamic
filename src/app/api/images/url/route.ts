import { NextRequest, NextResponse } from 'next/server';
import { getImageUrl } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imagePath = searchParams.get('path');

    if (!imagePath) {
      return NextResponse.json(
        { success: false, error: 'Image path is required' },
        { status: 400 }
      );
    }

    const url = await getImageUrl(imagePath);
    
    return NextResponse.json({
      success: true,
      url,
    });
  } catch (error: any) {
    console.error('Error getting image URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get image URL',
      },
      { status: 500 }
    );
  }
}

