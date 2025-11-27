import { NextRequest } from 'next/server';
import { getImageUrl } from '@/lib/gcp-storage';
import { extractIPFromFilename } from '@/lib/image-utils';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json();
        const { results, selectedAnalysisType, locationMapping } = body;

        if (!results || !Array.isArray(results) || !selectedAnalysisType) {
          send({ type: 'error', message: 'Invalid request data' });
          controller.close();
          return;
        }

        send({ type: 'start', total: results.length });

        // Process results in batches for better performance
        const batchSize = 10;
        let processed = 0;
        let matchedCount = 0;

        for (let i = 0; i < results.length; i += batchSize) {
          const batch = results.slice(i, i + batchSize);
          
          // Process batch in parallel
          const batchPromises = batch.map(async (result: any) => {
            // Find the result that matches the selected analysis type
            const filteredResult = result.results?.find(
              (r: any) => r.promptId === selectedAnalysisType
            );
            
            if (!filteredResult || !filteredResult.match) {
              return null;
            }

            const ip = extractIPFromFilename(result.filename);
            
            // Generate image URL (faster on server side)
            let imageUrl: string | undefined;
            try {
              imageUrl = await getImageUrl(result.imagePath);
            } catch (error) {
              console.error('Error getting image URL:', error);
            }
            
            // Get location details if IP exists
            let locationDetails: any = undefined;
            if (ip && locationMapping?.[ip]) {
              const loc = locationMapping[ip];
              locationDetails = {
                district: loc.district,
                mandal: loc.mandal,
                locationName: loc.locationName,
                ip: ip,
                cameraType: loc.cameraType,
              };
            }
            
            // Get analysis detail
            const analysisDetail = {
              promptName: filteredResult.promptName,
              match: filteredResult.match,
              count: filteredResult.count,
              description: filteredResult.description,
              details: filteredResult.details,
              confidence: filteredResult.confidence,
              additionalObservations: filteredResult.additionalObservations,
            };
            
            return {
              filename: result.filename,
              imagePath: result.imagePath,
              url: imageUrl,
              ip: ip || undefined,
              analysisTypes: [filteredResult.promptName],
              locationDetails,
              analysisDetail,
            };
          });

          const batchResults = await Promise.all(batchPromises);
          const validResults = batchResults.filter(r => r !== null);
          
          // Send matched images as they're found
          if (validResults.length > 0) {
            send({ 
              type: 'data', 
              images: validResults,
              progress: processed + batch.length,
              matched: matchedCount + validResults.length
            });
            matchedCount += validResults.length;
          } else {
            // Send progress update even if no matches
            send({ 
              type: 'progress', 
              progress: processed + batch.length,
              matched: matchedCount
            });
          }
          
          processed += batch.length;
        }

        send({ type: 'complete', total: processed, matched: matchedCount });
        controller.close();
      } catch (error: any) {
        console.error('Error in filter stream:', error);
        send({ type: 'error', message: error.message || 'Unknown error' });
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

