import OpenAI from 'openai';
import { getImageUrl, getImageAsBase64 } from './gcp-storage';
import { ANALYSIS_PROMPTS, type AnalysisPrompt } from './analysis-prompts';
import { withRateLimit } from './rate-limiter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Re-export for backward compatibility
export { ANALYSIS_PROMPTS, type AnalysisPrompt };

export interface AnalysisResult {
  promptId: string;
  promptName: string;
  match: boolean;
  count: number;
  description: string;
  details: string;
  confidence: 'high' | 'medium' | 'low';
  additionalObservations?: string;
}

export interface ImageAnalysisResult {
  filename: string;
  imagePath: string;
  date: string;
  cameraType: string;
  results: AnalysisResult[];
  status: 'success' | 'error';
  error?: string;
}


/**
 * Build analysis prompt text
 */
function buildPrompt(prompt: AnalysisPrompt): string {
  return `Analyze this CCTV/traffic camera image carefully.

SEARCH OBJECTIVE: ${prompt.searchObjective}

LOOKING FOR: ${prompt.lookingFor}

DETECTION CRITERIA: ${prompt.detectionCriteria}

Please analyze the image and provide a JSON response with:

1. "match": true/false - Does this image match the search criteria?
2. "count": Number of items found (0 if none). If multiple types, provide a single total number.
3. "description": Brief description of what you see relevant to the query
4. "details": Specific details about the items found
5. "confidence": Your confidence level (high/medium/low)
6. "additional_observations": Any other relevant observations

Respond ONLY with valid JSON.`;
}

/**
 * Parse OpenAI response and handle object types
 */
function parseAnalysisResponse(parsed: any): AnalysisResult {
  // Handle count - might be a number or an object
  let count = 0;
  if (typeof parsed.count === 'number') {
    count = parsed.count;
  } else if (typeof parsed.count === 'object' && parsed.count !== null) {
    // If count is an object like {trucks: 2, cars: 5, motorcycles: 1}, sum the values
    count = Object.values(parsed.count).reduce((sum: number, val: any) => {
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);
  }
  
  // Ensure all string fields are actually strings (not objects)
  const description = typeof parsed.description === 'string' 
    ? parsed.description 
    : JSON.stringify(parsed.description || '');
  
  const details = typeof parsed.details === 'string'
    ? parsed.details
    : JSON.stringify(parsed.details || '');
  
  const additionalObservations = typeof parsed.additional_observations === 'string'
    ? parsed.additional_observations
    : parsed.additional_observations ? JSON.stringify(parsed.additional_observations) : undefined;
  
  return {
    promptId: parsed.promptId || '',
    promptName: parsed.promptName || '',
    match: parsed.match === true,
    count,
    description,
    details,
    confidence: parsed.confidence || 'medium',
    additionalObservations,
  };
}

/**
 * Analyze a single image with a single prompt (with smart fallback)
 * Tries signed URL first (zero memory), falls back to base64 if timeout
 */
async function analyzeImageWithPromptUsingUrl(
  signedUrl: string,
  imagePath: string,
  prompt: AnalysisPrompt,
  imageFilename?: string
): Promise<AnalysisResult> {
  const promptStartTime = Date.now();
  const logPrefix = imageFilename ? `[${imageFilename}]` : '[Image]';
  
  try {
    console.log(`${logPrefix} [${prompt.name}] Starting analysis...`);
    
    // Build prompt text
    const promptText = buildPrompt(prompt);
    
    // Try signed URL first (zero memory usage - same as Flask)
    const apiStartTime = Date.now();
    console.log(`${logPrefix} [${prompt.name}] Trying signed URL (zero memory)...`);
    
    try {
      // Use rate limiter to respect OpenAI's 500 RPM limit
      const response = await withRateLimit(async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                {
                  type: 'image_url',
                  image_url: {
                    url: signedUrl, // Direct GCS signed URL - OpenAI fetches directly
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
      });
      
      const apiTime = Date.now() - apiStartTime;
      
      // Record token usage if available
      if (response.usage) {
        const { total_tokens, prompt_tokens, completion_tokens } = response.usage;
        console.log(`${logPrefix} [${prompt.name}] ✅ Signed URL worked! API responded in ${apiTime}ms (Tokens: ${total_tokens} = ${prompt_tokens} prompt + ${completion_tokens} completion)`);
      } else {
        console.log(`${logPrefix} [${prompt.name}] ✅ Signed URL worked! API responded in ${apiTime}ms`);
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const result = parseAnalysisResponse(parsed);
      
      // Record token usage for rate limiter
      if (response.usage?.total_tokens) {
        const { recordTokenUsage } = await import('./rate-limiter');
        recordTokenUsage(response.usage.total_tokens);
      }
      
      const totalTime = Date.now() - promptStartTime;
      console.log(`${logPrefix} [${prompt.name}] ✅ Completed in ${totalTime}ms (API: ${apiTime}ms) - Match: ${result.match}, Count: ${result.count}`);
      
      return {
        ...result,
        promptId: prompt.id,
        promptName: prompt.name,
      };
    } catch (urlError: any) {
      // Check if it's a timeout error (OpenAI can't fetch from GCS)
      const isTimeout = urlError?.message?.includes('Timeout') || 
                       urlError?.message?.includes('timeout') ||
                       urlError?.message?.includes('downloading') ||
                       (urlError?.status === 400 && urlError?.message?.includes('Timeout'));
      
      if (isTimeout) {
        console.log(`${logPrefix} [${prompt.name}] ⚠️ Signed URL timed out, falling back to base64 (uses memory but reliable)...`);
        
        // Fallback: Download and use base64 (reliable method)
        const downloadStartTime = Date.now();
        const base64 = await getImageAsBase64(imagePath);
        const downloadTime = Date.now() - downloadStartTime;
        console.log(`${logPrefix} [${prompt.name}] Downloaded in ${downloadTime}ms, retrying with base64...`);
        
        const retryStartTime = Date.now();
        // Use rate limiter for fallback request too
        const response = await withRateLimit(async () => {
          return await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptText },
                  {
                    type: 'image_url',
                    image_url: {
                      url: base64, // Base64 fallback (reliable)
                      detail: 'high',
                    },
                  },
                ],
              },
            ],
            max_tokens: 1000,
            temperature: 0.2,
            response_format: { type: 'json_object' },
          });
        });

        const retryTime = Date.now() - retryStartTime;
        
        // Record token usage if available
        if (response.usage) {
          const { total_tokens, prompt_tokens, completion_tokens } = response.usage;
          console.log(`${logPrefix} [${prompt.name}] ✅ Base64 fallback worked! API responded in ${retryTime}ms (Tokens: ${total_tokens} = ${prompt_tokens} prompt + ${completion_tokens} completion)`);
        } else {
          console.log(`${logPrefix} [${prompt.name}] ✅ Base64 fallback worked! API responded in ${retryTime}ms`);
        }

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from OpenAI');
        }

        const parsed = JSON.parse(content);
        const result = parseAnalysisResponse(parsed);
        
        // Record token usage for rate limiter
        if (response.usage?.total_tokens) {
          const { recordTokenUsage } = await import('./rate-limiter');
          recordTokenUsage(response.usage.total_tokens);
        }
        
        const totalTime = Date.now() - promptStartTime;
        console.log(`${logPrefix} [${prompt.name}] ✅ Completed in ${totalTime}ms (Download: ${downloadTime}ms, API: ${retryTime}ms) - Match: ${result.match}, Count: ${result.count}`);
    
        return {
          ...result,
          promptId: prompt.id,
          promptName: prompt.name,
        };
      } else {
        // Not a timeout, rethrow the error
        throw urlError;
      }
    }
  } catch (error) {
    const totalTime = Date.now() - promptStartTime;
    console.error(`${logPrefix} [${prompt.name}] ❌ Error after ${totalTime}ms:`, error);
    throw error;
  }
}

/**
 * Analyze a single image with all prompts
 * Generates signed URL ONCE (no memory buffering) and processes prompts in parallel
 */
export async function analyzeImage(
  imagePath: string,
  filename: string,
  date: string,
  cameraType: string,
  selectedPromptIds?: string[]
): Promise<ImageAnalysisResult> {
  const imageStartTime = Date.now();
  console.log(`\n📸 [${filename}] Starting image analysis...`);
  
  try {
    // Filter prompts if specific ones are selected
    const promptsToUse = selectedPromptIds && selectedPromptIds.length > 0
      ? ANALYSIS_PROMPTS.filter(p => selectedPromptIds.includes(p.id))
      : ANALYSIS_PROMPTS;
    
    console.log(`📸 [${filename}] Analyzing with ${promptsToUse.length} prompt(s): ${promptsToUse.map(p => p.name).join(', ')}`);
    
    // Generate signed URL ONCE for all prompts (same as Flask - 1 hour expiration)
    // Zero memory usage - OpenAI fetches directly from GCS
    const urlStartTime = Date.now();
    console.log(`📸 [${filename}] Generating GCS signed URL (1 hour expiration, zero memory)...`);
    const signedUrl = await getImageUrl(imagePath); // 1 hour expiration (3600 seconds) - same as Flask
    const urlTime = Date.now() - urlStartTime;
    console.log(`📸 [${filename}] Signed URL generated in ${urlTime}ms, now processing ${promptsToUse.length} prompts in parallel...`);
    console.log(`📸 [${filename}] URL format: ${signedUrl.substring(0, 100)}...`);
        
    // Process prompts SEQUENTIALLY to respect rate limits
    // Rate limiter will ensure we don't exceed 500 RPM
    // Each prompt waits for its turn in the rate limit queue
    const results: AnalysisResult[] = [];
    
    for (const prompt of promptsToUse) {
      try {
        const result = await analyzeImageWithPromptUsingUrl(signedUrl, imagePath, prompt, filename);
        results.push(result);
      } catch (error) {
        console.error(`📸 [${filename}] Failed to analyze with prompt ${prompt.id}:`, error);
        // Return error result instead of throwing
        results.push({
          promptId: prompt.id,
          promptName: prompt.name,
          match: false,
          count: 0,
          description: 'Analysis failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          confidence: 'low' as const,
        });
      }
    }
    
    const totalTime = Date.now() - imageStartTime;
    const matches = results.filter(r => r.match).length;
    const processingTime = totalTime - urlTime;
    console.log(`📸 [${filename}] ✅ Completed in ${totalTime}ms (URL Gen: ${urlTime}ms, Processing: ${processingTime}ms, ${matches}/${results.length} prompts matched)\n`);
    
    return {
      filename,
      imagePath,
      date,
      cameraType,
      results,
      status: 'success',
    };
  } catch (error) {
    const totalTime = Date.now() - imageStartTime;
    console.error(`📸 [${filename}] ❌ Failed after ${totalTime}ms:`, error);
    return {
      filename,
      imagePath,
      date,
      cameraType,
      results: [],
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Analyze multiple images concurrently
 * Downloads from GCP and converts to base64 (reliable method)
 */
export async function analyzeImages(
  images: Array<{ path: string; url?: string; filename: string; date: string; cameraType: string }>,
  onProgress?: (current: number, total: number, result?: ImageAnalysisResult) => void,
  selectedPromptIds?: string[]
): Promise<ImageAnalysisResult[]> {
  const overallStartTime = Date.now();
  const results: ImageAnalysisResult[] = [];
  const total = images.length;
  
  console.log(`\n🚀 ========================================`);
  console.log(`🚀 Starting batch analysis: ${total} image(s)`);
  console.log(`🚀 Selected prompts: ${selectedPromptIds && selectedPromptIds.length > 0 ? selectedPromptIds.length : 'ALL'}`);
  console.log(`🚀 ========================================\n`);
  
  // Process images with controlled parallelism to respect rate limits
  // Rate limiter ensures we stay under 500 RPM (8 requests/second)
  // Process 4 images concurrently, each processes prompts sequentially
  // Rate limiter will queue API calls automatically to stay under limit
  const promptsPerImage = selectedPromptIds?.length || ANALYSIS_PROMPTS.length;
  const totalApiCalls = total * promptsPerImage;
  const estimatedMinutes = Math.ceil(totalApiCalls / 480);
  
  console.log(`\n📊 Rate Limiting Configuration:`);
  console.log(`📊   Max requests: 480/minute (8 requests/second)`);
  console.log(`📊   Total API calls: ${totalApiCalls} (${total} images × ${promptsPerImage} prompts)`);
  console.log(`📊   Estimated time: ~${estimatedMinutes} minutes`);
  console.log(`📊   Processing: 4 images concurrently, prompts sequentially`);
  console.log(`📊   Rate limiter will queue requests automatically\n`);
  
  const concurrentImages = 4; // Process 4 images at a time (rate limiter handles queuing)
  const totalBatches = Math.ceil(total / concurrentImages);
  
  for (let i = 0; i < images.length; i += concurrentImages) {
    const batchNumber = Math.floor(i / concurrentImages) + 1;
    const batch = images.slice(i, i + concurrentImages);
    const batchStartTime = Date.now();
    
    console.log(`\n📦 Batch ${batchNumber}/${totalBatches}: Processing ${batch.length} image(s) concurrently`);
    
    // Process batch images concurrently (rate limiter will queue API calls properly)
    const batchPromises = batch.map(async (image, idx) => {
      const imageNumber = i + idx + 1;
      console.log(`📸 [${imageNumber}/${total}] Starting: ${image.filename}`);
      const result = await analyzeImage(image.path, image.filename, image.date, image.cameraType, selectedPromptIds);
      console.log(`📸 [${imageNumber}/${total}] Completed: ${image.filename}`);
      return result;
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    const batchTime = Date.now() - batchStartTime;
    const successful = batchResults.filter(r => r.status === 'success').length;
    const remainingImages = total - results.length;
    const avgTimePerImage = results.length > 0 ? (Date.now() - overallStartTime) / results.length : 0;
    const estimatedRemaining = (remainingImages * avgTimePerImage) / 1000 / 60;
    
    console.log(`📦 Batch ${batchNumber}/${totalBatches} completed in ${(batchTime / 1000).toFixed(2)}s (${successful}/${batch.length} successful)`);
    if (remainingImages > 0) {
      console.log(`📦 Estimated remaining: ${estimatedRemaining.toFixed(1)} minutes`);
    }
    
    // Report progress
    if (onProgress) {
      batchResults.forEach(result => {
        onProgress(results.length, total, result);
      });
    }
  }
  
  const overallTime = Date.now() - overallStartTime;
  const successful = results.filter(r => r.status === 'success').length;
  const avgTimePerImage = total > 0 ? overallTime / total : 0;
  
  console.log(`\n🎉 ========================================`);
  console.log(`🎉 Analysis Complete!`);
  console.log(`🎉 Total Images: ${total}`);
  console.log(`🎉 Successful: ${successful}`);
  console.log(`🎉 Failed: ${total - successful}`);
  console.log(`🎉 Total Time: ${(overallTime / 1000).toFixed(2)}s`);
  console.log(`🎉 Average Time per Image: ${(avgTimePerImage / 1000).toFixed(2)}s`);
  console.log(`🎉 Estimated Time for 100 images: ${((avgTimePerImage * 100) / 1000 / 60).toFixed(2)} minutes`);
  console.log(`🎉 ========================================\n`);
  
  return results;
}
