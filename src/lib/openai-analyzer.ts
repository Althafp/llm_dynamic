import OpenAI from 'openai';
import { getImageUrl, getImageAsBase64 } from './gcp-storage';
import { ANALYSIS_PROMPTS, type AnalysisPrompt } from './analysis-prompts';

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
      const response = await openai.chat.completions.create({
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
      
      const apiTime = Date.now() - apiStartTime;
      console.log(`${logPrefix} [${prompt.name}] ✅ Signed URL worked! API responded in ${apiTime}ms`);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const result = parseAnalysisResponse(parsed);
      
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
        const response = await openai.chat.completions.create({
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
        
        const retryTime = Date.now() - retryStartTime;
        console.log(`${logPrefix} [${prompt.name}] ✅ Base64 fallback worked! API responded in ${retryTime}ms`);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response from OpenAI');
        }

        const parsed = JSON.parse(content);
        const result = parseAnalysisResponse(parsed);
        
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
    
    // Process all prompts in PARALLEL (not sequential!)
    // All prompts use the same signed URL - OpenAI fetches directly from GCS
    // If timeout, automatically falls back to base64 (reliable)
    const promptPromises = promptsToUse.map(async (prompt) => {
      try {
        return await analyzeImageWithPromptUsingUrl(signedUrl, imagePath, prompt, filename);
      } catch (error) {
        console.error(`📸 [${filename}] Failed to analyze with prompt ${prompt.id}:`, error);
        // Return error result instead of throwing
        return {
          promptId: prompt.id,
          promptName: prompt.name,
          match: false,
          count: 0,
          description: 'Analysis failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          confidence: 'low' as const,
        };
      }
    });
    
    // Wait for all prompts to complete in parallel
    const results = await Promise.all(promptPromises);
    
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
  
  // Process in batches of 5 (increased from 3 since we're more efficient now)
  // Each image downloads once and processes prompts in parallel
  const batchSize = 5;
  const totalBatches = Math.ceil(total / batchSize);
  
  for (let i = 0; i < images.length; i += batchSize) {
    const batchNumber = Math.floor(i / batchSize) + 1;
    const batch = images.slice(i, i + batchSize);
    const batchStartTime = Date.now();
    
    console.log(`\n📦 Batch ${batchNumber}/${totalBatches}: Processing ${batch.length} image(s) in parallel`);
    console.log(`📦 Images: ${batch.map(img => img.filename).join(', ')}`);
    
    // Analyze images in parallel - each image downloads once and processes all prompts in parallel
    const batchPromises = batch.map((image) => {
      return analyzeImage(image.path, image.filename, image.date, image.cameraType, selectedPromptIds);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    const batchTime = Date.now() - batchStartTime;
    const successful = batchResults.filter(r => r.status === 'success').length;
    console.log(`📦 Batch ${batchNumber}/${totalBatches} completed in ${(batchTime / 1000).toFixed(2)}s (${successful}/${batch.length} successful)`);
    
    // Report progress
    if (onProgress) {
      batchResults.forEach(result => {
        onProgress(results.length, total, result);
      });
    }
    
    // Small delay between batches to avoid rate limits (reduced from 1s to 500ms)
    if (i + batchSize < images.length) {
      console.log(`⏳ Waiting 500ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 500));
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
