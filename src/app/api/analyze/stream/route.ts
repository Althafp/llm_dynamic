import { NextRequest } from 'next/server';
import { analyzeImages } from '@/lib/openai-analyzer';
import { listImages, saveAnalysisResults } from '@/lib/gcp-storage';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json();
        const { date, cameraType, imagePaths, analysisTypes } = body;

        if (!date) {
          send({ type: 'error', message: 'Date is required' });
          controller.close();
          return;
        }

        send({ type: 'start', message: 'Starting analysis...' });

        let images: Array<{ path: string; url?: string; filename: string; date: string; cameraType: string }> = [];

        if (imagePaths && Array.isArray(imagePaths)) {
          // Get signed URLs for selected images
          const { getImageUrl } = await import('@/lib/gcp-storage');
          send({ type: 'log', message: 'Generating signed URLs...' });
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
          send({ type: 'log', message: 'Fetching images from GCP...' });
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
          send({ type: 'error', message: 'No images found' });
          controller.close();
          return;
        }

        send({ type: 'log', message: `Found ${images.length} images to analyze` });
        send({ type: 'progress', current: 0, total: images.length });

        // Collect all results for saving
        const allResults: any[] = [];

        // Analyze with progress updates
        await analyzeImages(images, (current, total, result) => {
          send({ type: 'progress', current, total });
          
          if (result) {
            allResults.push(result);
            send({ type: 'image_processed', result });
            
            // Check if any prompt matched
            const hasMatch = result.results.some(r => r.match);
            if (hasMatch) {
              send({ type: 'match', result });
            }
          }
        }, analysisTypes);

        // Save results to GCP
        let savedPath = null;
        try {
          send({ type: 'log', message: 'Saving results to GCP...' });
          savedPath = await saveAnalysisResults(allResults, {
            date,
            cameraType: cameraType || undefined,
            totalImages: images.length,
          });
          send({ type: 'log', message: `Results saved to: ${savedPath}` });
        } catch (saveError) {
          console.error('Error saving results to GCP:', saveError);
          send({ type: 'log', message: 'Warning: Failed to save results to GCP' });
        }

        send({ type: 'complete', message: 'Analysis complete', savedPath });
        controller.close();
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

