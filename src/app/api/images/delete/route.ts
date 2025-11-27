import { NextRequest, NextResponse } from 'next/server';
import { getPreviousResult, saveAnalysisResults } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imagePath = searchParams.get('imagePath');
    const resultPath = searchParams.get('resultPath');

    if (!imagePath) {
      return NextResponse.json(
        { success: false, error: 'Image path is required' },
        { status: 400 }
      );
    }

    if (!resultPath) {
      return NextResponse.json(
        { success: false, error: 'Result path is required' },
        { status: 400 }
      );
    }

    // Load the current results file
    const resultData = await getPreviousResult(resultPath);
    
    if (!resultData || !resultData.results) {
      return NextResponse.json(
        { success: false, error: 'Result file not found or invalid' },
        { status: 404 }
      );
    }

    // Find and remove the image entry
    const initialLength = resultData.results.length;
    resultData.results = resultData.results.filter(
      (result: any) => result.imagePath !== imagePath
    );

    if (resultData.results.length === initialLength) {
      return NextResponse.json(
        { success: false, error: 'Image record not found in results' },
        { status: 404 }
      );
    }

    // Update summary counts
    if (resultData.summary) {
      resultData.summary.total = resultData.results.length;
      resultData.summary.successful = resultData.results.filter(
        (r: any) => r.status === 'success'
      ).length;
      resultData.summary.failed = resultData.results.filter(
        (r: any) => r.status === 'error'
      ).length;
    }

    // Update metadata
    if (resultData.metadata) {
      resultData.metadata.processedImages = resultData.results.length;
    }

    // Save the updated results back to GCS
    await saveAnalysisResults(
      resultData.results,
      resultData.metadata,
      resultPath // Use existing path to update the file
    );

    return NextResponse.json({
      success: true,
      message: 'Image record removed from analysis results successfully',
    });
  } catch (error: any) {
    console.error('Error removing image record:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to remove image record',
      },
      { status: 500 }
    );
  }
}

