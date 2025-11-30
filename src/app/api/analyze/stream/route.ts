import { NextRequest } from 'next/server';
import { analyzeImages } from '@/lib/openai-analyzer';
import { listImages, saveAnalysisResults } from '@/lib/gcp-storage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Declare variables outside try block for error handling
      const allResults: any[] = [];
      let images: Array<{ path: string; url?: string; filename: string; date: string; cameraType: string }> = [];
      let checkpointPath: string | null = null;
      let date: string = '';
      let cameraType: 'ANALYTICS' | 'FIXED' | 'PTZ' | undefined = undefined;

      try {
        const body = await request.json();
        date = body.date;
        // Validate cameraType to match expected type
        const rawCameraType = body.cameraType;
        if (rawCameraType === 'ANALYTICS' || rawCameraType === 'FIXED' || rawCameraType === 'PTZ') {
          cameraType = rawCameraType;
        } else {
          cameraType = undefined;
        }
        const { imagePaths, analysisTypes } = body;

        if (!date) {
          send({ type: 'error', message: 'Date is required' });
          controller.close();
          return;
        }

        send({ type: 'start', message: 'Starting analysis...' });

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

        // Incremental save configuration
        let lastSaveTime = Date.now();
        const SAVE_INTERVAL = 30 * 1000; // Save every 30 seconds
        const SAVE_BATCH_SIZE = 10; // Save every 10 images
        let savedPath: string | null = null;

        // Helper function to save results incrementally
        const saveIncremental = async (isFinal: boolean = false) => {
          if (allResults.length === 0) return null;
          
          try {
            // For incremental saves, use checkpoint path. For final, update the checkpoint
            const pathToUse = checkpointPath || (isFinal ? null : null);
            // Ensure date is exactly as received (folder name format)
            const dateToSave = date.trim(); // Remove any whitespace but keep the exact format
            console.log(`💾 [Stream] Saving results with date: "${dateToSave}"`);
            
            const savePath = await saveAnalysisResults(
              allResults,
              {
                date: dateToSave, // Save exactly as folder name
                cameraType: cameraType || undefined,
                totalImages: images.length,
              },
              pathToUse // Pass existing path to update it
            );
            
            if (!checkpointPath) {
              checkpointPath = savePath;
            }
            
            if (isFinal) {
              savedPath = savePath;
            }
            
            send({ 
              type: 'log', 
              message: isFinal 
                ? `✅ Final results saved: ${allResults.length}/${images.length} images → ${savePath}` 
                : `💾 Checkpoint saved: ${allResults.length}/${images.length} images → ${savePath}` 
            });
            
            return savePath;
          } catch (saveError) {
            console.error('Error saving results to GCP:', saveError);
            send({ type: 'log', message: `⚠️ Warning: Failed to save ${isFinal ? 'final' : 'checkpoint'} results` });
            throw saveError;
          }
        };

        // Keep-alive ping to prevent connection timeout
        const keepAliveInterval = setInterval(() => {
          try {
            send({ type: 'ping', timestamp: Date.now() });
          } catch (e) {
            // Connection closed, clear interval
            clearInterval(keepAliveInterval);
          }
        }, 10000); // Ping every 10 seconds

        // Analyze with progress updates
        try {
          await analyzeImages(images, (current, total, result) => {
            try {
              send({ type: 'progress', current, total });
              
              if (result) {
                allResults.push(result);
                send({ type: 'image_processed', result });
                
                // Check if any prompt matched
                const hasMatch = result.results.some(r => r.match);
                if (hasMatch) {
                  send({ type: 'match', result });
                }

                // Save incrementally: every N images or every 30 seconds
                const shouldSave = 
                  allResults.length % SAVE_BATCH_SIZE === 0 || 
                  (Date.now() - lastSaveTime) >= SAVE_INTERVAL;
                
                if (shouldSave && allResults.length > 0) {
                  lastSaveTime = Date.now();
                  // Save in background (don't await to avoid blocking)
                  saveIncremental(false).catch(err => {
                    console.error('Error in incremental save (non-blocking):', err);
                    // Don't throw - allow processing to continue
                  });
                }

                // Log memory usage periodically
                if (current % 50 === 0 && typeof process !== 'undefined' && process.memoryUsage) {
                  const memUsage = process.memoryUsage();
                  const memMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
                  console.log(`📊 Memory usage at image ${current}: ${memMB}MB`);
                  send({ type: 'log', message: `Memory: ${memMB}MB` });
                }
              }
            } catch (sendError) {
              console.error('Error sending progress update:', sendError);
              // Continue processing even if send fails
            }
          }, analysisTypes);

          // Clear keep-alive interval on completion
          clearInterval(keepAliveInterval);

          // Final save
          await saveIncremental(true);
        } catch (analysisError) {
          // Clear keep-alive on error
          clearInterval(keepAliveInterval);
          
          // If analysis fails, try to save what we have
          console.error('❌ Analysis error at image', allResults.length, ':', analysisError);
          console.error('Error stack:', analysisError instanceof Error ? analysisError.stack : 'No stack');
          
          if (allResults.length > 0) {
            try {
              const partialPath = await saveIncremental(true);
              send({ type: 'log', message: `💾 Partial results saved: ${allResults.length}/${images.length} images → ${partialPath}` });
              send({ type: 'error', message: `Analysis stopped at image ${allResults.length}. Partial results saved.` });
            } catch (saveError) {
              console.error('❌ Failed to save partial results:', saveError);
              send({ type: 'error', message: `Analysis failed and could not save results. Error: ${saveError instanceof Error ? saveError.message : 'Unknown'}` });
            }
          } else {
            send({ type: 'error', message: `Analysis failed before any results were generated. Error: ${analysisError instanceof Error ? analysisError.message : 'Unknown'}` });
          }
          throw analysisError; // Re-throw to trigger error handler
        }

        send({ type: 'complete', message: 'Analysis complete', savedPath });
        controller.close();
      } catch (error) {
        console.error('❌ Stream error:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        console.error('Results collected:', allResults.length, 'images');
        console.error('Checkpoint path:', checkpointPath);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        try {
          send({ type: 'error', message: errorMessage });
        } catch (sendErr) {
          console.error('Failed to send error message (connection may be closed):', sendErr);
        }
        
        // Try to save partial results even on error
        if (allResults && allResults.length > 0) {
          try {
            console.log(`💾 Attempting to save ${allResults.length} partial results...`);
            // Ensure date is exactly as received (folder name format)
            const dateToSave = date.trim(); // Remove any whitespace but keep the exact format
            console.log(`💾 [Stream Error] Saving partial results with date: "${dateToSave}"`);
            
            const partialPath = await saveAnalysisResults(
              allResults,
              {
                date: dateToSave, // Save exactly as folder name
                cameraType: cameraType || undefined,
                totalImages: images.length,
              },
              checkpointPath
            );
            console.log(`✅ Partial results saved: ${partialPath}`);
            try {
              send({ type: 'log', message: `💾 Partial results saved due to error: ${partialPath} (${allResults.length} images)` });
            } catch (sendErr) {
              // Connection closed, but results are saved
            }
          } catch (saveError) {
            console.error('❌ Failed to save partial results on error:', saveError);
            console.error('Save error stack:', saveError instanceof Error ? saveError.stack : 'No stack');
          }
        } else {
          console.warn('⚠️ No results to save (allResults is empty)');
        }
        
        try {
          controller.close();
        } catch (closeErr) {
          console.error('Error closing controller:', closeErr);
        }
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

