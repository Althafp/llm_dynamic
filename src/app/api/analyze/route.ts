import { NextRequest, NextResponse } from 'next/server';
import { analyzeImages } from '@/lib/openai-analyzer';
import { listImages, saveAnalysisResults } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, cameraType, imagePaths, analysisTypes } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Date is required' },
        { status: 400 }
      );
    }

    let images: Array<{ path: string; url?: string; filename: string; date: string; cameraType: string }> = [];

    if (imagePaths && Array.isArray(imagePaths)) {
      // Analyze specific images - need to get URLs
      const { getImageUrl } = await import('@/lib/gcp-storage');
      const imagePromises = imagePaths.map(async (path: string) => {
        const parts = path.split('/');
        const url = await getImageUrl(path);
        return {
          path,
          url,
          filename: parts[parts.length - 1],
          date,
          cameraType: parts[parts.length - 3] || 'UNKNOWN',
        };
      });
      images = await Promise.all(imagePromises);
    } else {
      // Analyze all images for the date/camera type - URLs already included
      const allImages = await listImages(date, cameraType);
      images = allImages.map(img => ({
        path: img.path,
        url: img.url, // Signed URL already generated
        filename: img.name,
        date: img.date,
        cameraType: img.cameraType,
      }));
    }

    if (images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images found' },
        { status: 404 }
      );
    }

    // Analyze images
    const results = await analyzeImages(images, undefined, analysisTypes);

    // Save results to GCP
    let savedPath = null;
    try {
      savedPath = await saveAnalysisResults(results, {
        date,
        cameraType: cameraType || undefined,
        totalImages: images.length,
      });
    } catch (saveError) {
      console.error('Error saving results to GCP:', saveError);
      // Continue even if save fails
    }

    return NextResponse.json({
      success: true,
      results,
      savedPath,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
      },
    });
  } catch (error) {
    console.error('Error analyzing images:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

