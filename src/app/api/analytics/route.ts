import { NextRequest, NextResponse } from 'next/server';
import { ANALYSIS_PROMPTS } from '@/lib/analysis-prompts';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const resultsParam = searchParams.get('results');

    if (!resultsParam) {
      return NextResponse.json(
        { success: false, error: 'Results data is required' },
        { status: 400 }
      );
    }

    const results = JSON.parse(resultsParam);

    // Calculate statistics
    const stats = {
      totalImages: results.length,
      successful: results.filter((r: any) => r.status === 'success').length,
      failed: results.filter((r: any) => r.status === 'error').length,
      byPrompt: ANALYSIS_PROMPTS.map(prompt => {
        const promptResults = results.flatMap((r: any) => 
          r.results?.filter((pr: any) => pr.promptId === prompt.id) || []
        );
        const matches = promptResults.filter((pr: any) => pr.match);
        const totalCount = promptResults.reduce((sum: number, pr: any) => sum + (pr.count || 0), 0);
        
        return {
          promptId: prompt.id,
          promptName: prompt.name,
          totalAnalyzed: promptResults.length,
          matches: matches.length,
          totalCount,
          averageCount: promptResults.length > 0 ? totalCount / promptResults.length : 0,
        };
      }),
      byCameraType: ['ANALYTICS', 'FIXED', 'PTZ'].map(type => {
        const typeResults = results.filter((r: any) => r.cameraType === type);
        return {
          cameraType: type,
          count: typeResults.length,
          successful: typeResults.filter((r: any) => r.status === 'success').length,
        };
      }),
      byDate: results.reduce((acc: any, r: any) => {
        acc[r.date] = (acc[r.date] || 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Error generating analytics:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

