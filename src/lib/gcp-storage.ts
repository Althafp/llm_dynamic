import { Storage } from '@google-cloud/storage';
import path from 'path';

// Initialize GCP Storage client
let storage: Storage | null = null;

// Simple in-memory cache for frequently accessed data
const cache = {
  dates: { data: null as string[] | null, timestamp: 0 },
  results: { data: null as any[] | null, timestamp: 0 },
};

const CACHE_TTL = 60000; // 60 seconds

export function getStorageClient(): Storage {
  if (!storage) {
    // Priority 1: Check for GCS_CREDENTIALS_JSON environment variable (JSON content as string)
    if (process.env.GCS_CREDENTIALS_JSON) {
      try {
        const credentials = JSON.parse(process.env.GCS_CREDENTIALS_JSON);
        storage = new Storage({
          credentials,
        });
        console.log('✅ GCP Storage initialized from GCS_CREDENTIALS_JSON environment variable');
        return storage;
      } catch (error) {
        console.error('❌ Failed to parse GCS_CREDENTIALS_JSON:', error);
        throw new Error('Invalid GCS_CREDENTIALS_JSON format. Must be valid JSON.');
      }
    }
    
    // Priority 2: Check for GOOGLE_APPLICATION_CREDENTIALS (path to credentials file)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      storage = new Storage({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      });
      console.log('✅ GCP Storage initialized from GOOGLE_APPLICATION_CREDENTIALS');
      return storage;
    }
    
    // Priority 3: Fallback to gcs-key.json in project root (for local development)
    const keyPath = path.join(process.cwd(), 'gcs-key.json');
    storage = new Storage({
      keyFilename: keyPath,
    });
    console.log('✅ GCP Storage initialized from gcs-key.json file');
  }
  return storage;
}

export interface ImageFile {
  name: string;
  path: string;
  date: string;
  cameraType: 'ANALYTICS' | 'FIXED' | 'PTZ';
  url?: string;
  size?: number;
  updated?: string;
}

const BUCKET_NAME = 'llm_dynamic';

/**
 * List all available dates (folders) in images/
 * Optimized to use delimiter for faster listing
 */
export async function listAvailableDates(): Promise<string[]> {
  // Check cache first
  const now = Date.now();
  if (cache.dates.data && (now - cache.dates.timestamp) < CACHE_TTL) {
    console.log('📦 Using cached dates list');
    return cache.dates.data;
  }

  try {
    const client = getStorageClient();
    const bucket = client.bucket(BUCKET_NAME);
    
    // Check if bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`Bucket '${BUCKET_NAME}' does not exist or is not accessible`);
    }
    
    // Use delimiter to get only top-level folders (much faster!)
    const [files, , apiResponse] = await bucket.getFiles({
      prefix: 'images/',
      delimiter: '/',
      autoPaginate: false,
    });

    const dates = new Set<string>();
    // Updated pattern to match both formats:
    // - Old format: 2025-11-30
    // - New format: 2025-11-30_chittoor (case-insensitive location name)
    const datePattern = /^images\/(\d{4}-\d{2}-\d{2}(?:_[a-zA-Z0-9_]+)?)\/$/i;
    
    // Extract dates from folder prefixes (faster than iterating all files)
    const prefixes = (apiResponse as any)?.prefixes as string[] | undefined;
    if (prefixes && Array.isArray(prefixes)) {
      prefixes.forEach((prefix: string) => {
        const match = prefix.match(datePattern);
        if (match && match[1]) {
          dates.add(match[1]);
        }
      });
    }
    
    // Fallback: Extract from file paths if prefixes didn't work
    if (dates.size === 0) {
      files.forEach(file => {
        const match = file.name.match(/^images\/(\d{4}-\d{2}-\d{2}(?:_[a-zA-Z0-9_]+)?)\//i);
        if (match && match[1]) {
          dates.add(match[1]);
        }
      });
    }

    // Convert to array and sort (most recent first)
    const datesArray = Array.from(dates).sort().reverse();
    
    console.log(`Found ${datesArray.length} date(s):`, datesArray);
    
    // Update cache
    cache.dates = { data: datesArray, timestamp: Date.now() };
    
    return datesArray;
  } catch (error) {
    console.error('Error in listAvailableDates:', error);
    throw error;
  }
}

/**
 * List images for a specific date and camera type
 * @param generateUrls - If false, skip generating signed URLs (much faster for large lists)
 */
export async function listImages(
  date: string,
  cameraType?: 'ANALYTICS' | 'FIXED' | 'PTZ',
  generateUrls: boolean = true
): Promise<ImageFile[]> {
  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  
  const prefix = cameraType 
    ? `images/${date}/${cameraType}/`
    : `images/${date}/`;
  
  const [files] = await bucket.getFiles({
    prefix,
  });

  const images: ImageFile[] = [];
  
  // Process files in parallel batches for better performance
  const batchSize = 20;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (file) => {
      // Skip if it's a folder or not an image
      if (!file.name.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) {
        return null;
      }

      const pathParts = file.name.split('/');
      const cameraTypeFromPath = pathParts[2] as 'ANALYTICS' | 'FIXED' | 'PTZ';
      
      // Only generate signed URL if requested (skip for faster listing)
      let url: string | undefined;
      if (generateUrls) {
        try {
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
          });
          url = signedUrl;
        } catch (error) {
          console.error(`Error generating signed URL for ${file.name}:`, error);
        }
      }

      const sizeValue = file.metadata.size;
      const size =
        typeof sizeValue === 'string'
          ? parseInt(sizeValue, 10)
          : typeof sizeValue === 'number'
            ? sizeValue
            : 0;

      return {
        name: pathParts[pathParts.length - 1],
        path: file.name,
        date,
        cameraType: cameraTypeFromPath,
        url,
        size,
        updated: file.metadata.updated,
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    for (const img of batchResults) {
      if (img !== null) {
        images.push(img);
      }
    }
  }

  return images;
}

/**
 * Get signed URL for an image (1 hour expiration, same as Flask version)
 * OpenAI fetches directly from GCS - zero server memory usage
 */
export async function getImageUrl(imagePath: string): Promise<string> {
  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  const file = bucket.file(imagePath);
  
  // Generate signed URL with 1 hour expiration (3600 seconds) - same as Flask
  // Format: https://storage.googleapis.com/bucket/path?X-Goog-Algorithm=...&X-Goog-Expires=3600&...
  // The Node.js SDK automatically uses v4 signing which matches Flask's format
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 3600 * 1000, // 1 hour (3600 seconds) - same as Flask
  });
  
  return url;
}

/**
 * Download image as base64 for OpenAI API
 */
export async function getImageAsBase64(imagePath: string): Promise<string> {
  const downloadStartTime = Date.now();
  const filename = imagePath.split('/').pop() || imagePath;
  
  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  const file = bucket.file(imagePath);
  
  const [buffer] = await file.download();
  const downloadTime = Date.now() - downloadStartTime;
  const fileSizeKB = (buffer.length / 1024).toFixed(2);
  
  const encodeStartTime = Date.now();
  const base64 = buffer.toString('base64');
  const encodeTime = Date.now() - encodeStartTime;
  
  // Determine MIME type from extension
  const ext = imagePath.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  
  const totalTime = Date.now() - downloadStartTime;
  console.log(`  📥 [${filename}] Downloaded ${fileSizeKB}KB in ${downloadTime}ms, encoded in ${encodeTime}ms (total: ${totalTime}ms)`);
  
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Save analysis results to GCP
 * Structure: results/TIMESTAMP/results.json
 * @param existingPath - Optional path to update existing file (for incremental saves)
 */
export async function saveAnalysisResults(
  results: any[],
  metadata?: {
    date?: string;
    cameraType?: string;
    totalImages?: number;
  },
  existingPath?: string | null
): Promise<string> {
  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  
  // Use existing path if provided, otherwise create new timestamp
  let resultPath: string;
  if (existingPath) {
    resultPath = existingPath;
  } else {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
    resultPath = `results/${timestamp}/results.json`;
  }
  
  // Prepare result data
  const now = new Date();
  const dateToSave = metadata?.date || 'unknown';
  console.log(`💾 Saving results with date: "${dateToSave}"`);
  
  const resultData = {
    timestamp: now.toISOString(),
    metadata: {
      date: dateToSave,
      cameraType: metadata?.cameraType || 'all',
      totalImages: metadata?.totalImages || results.length,
      processedImages: results.length, // Track how many actually processed
    },
    results,
    summary: {
      total: results.length,
      successful: results.filter((r: any) => r.status === 'success').length,
      failed: results.filter((r: any) => r.status === 'error').length,
    },
    isPartial: existingPath ? true : false, // Mark if this is a checkpoint
  };
  
  // Upload to GCP (overwrites if exists)
  const file = bucket.file(resultPath);
  
  // Ensure we have valid summary values
  const summaryTotal = resultData.summary?.total || results.length || 0;
  const summarySuccessful = resultData.summary?.successful || 0;
  const summaryFailed = resultData.summary?.failed || 0;
  
  await file.save(JSON.stringify(resultData, null, 2), {
    contentType: 'application/json',
    metadata: {
      metadata: {
        timestamp: now.toISOString(),
        date: dateToSave, // Use the same date variable
        cameraType: metadata?.cameraType || 'all',
        totalImages: String(summaryTotal),
        successful: String(summarySuccessful),
        failed: String(summaryFailed),
        isPartial: existingPath ? 'true' : 'false',
      },
    },
  });
  
  console.log(`✅ Saved results: date="${dateToSave}", totalImages=${summaryTotal}, successful=${summarySuccessful}, failed=${summaryFailed}`);
  
  const saveType = existingPath ? 'Checkpoint' : 'Results';
  console.log(`${saveType} saved to: ${resultPath} (${results.length} images)`);
  return resultPath;
}

/**
 * List all previous analysis results
 */
export interface PreviousResult {
  timestamp: string;
  path: string;
  date: string;
  cameraType: string;
  totalImages: number;
  successful: number;
  failed: number;
  created: string;
}

export async function listPreviousResults(): Promise<PreviousResult[]> {
  // Check cache first
  const now = Date.now();
  if (cache.results.data && (now - cache.results.timestamp) < CACHE_TTL) {
    console.log('📦 Using cached results list');
    return cache.results.data;
  }

  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  
  const [files] = await bucket.getFiles({
    prefix: 'results/',
  });
  
  const results: PreviousResult[] = [];
  const resultPattern = /^results\/(\d{8}_\d{6})\/results\.json$/;
  
  // Process ALL files in parallel - much faster than batching
  const filePromises = files.map(async (file) => {
    const match = file.name.match(resultPattern);
    if (!match) return null;
    
    try {
      // FIRST: Try to get metadata from file metadata (fastest - no download needed)
      let date = 'unknown';
      let cameraType = 'all';
      let totalImages = 0;
      let successful = 0;
      let failed = 0;
      let created = '';
      
      try {
        const [fileMetadata] = await file.getMetadata();
        const customMetadata = fileMetadata.metadata || {};
        
        // Check if metadata has the values we need
        if (customMetadata.totalImages || customMetadata.date) {
          const metadataDate = customMetadata.date;
          const metadataCamera = customMetadata.cameraType;
          const metadataTimestamp = customMetadata.timestamp;
          const metadataTotal = customMetadata.totalImages;
          const metadataSuccessful = customMetadata.successful;
          const metadataFailed = customMetadata.failed;

          if (typeof metadataDate === 'string' && metadataDate.trim().length > 0) {
            date = metadataDate.trim();
            console.log(`📅 Read date from file metadata: "${date}"`);
          }

          if (typeof metadataCamera === 'string' && metadataCamera.trim().length > 0) {
            cameraType = metadataCamera;
          }

          if (typeof metadataTimestamp === 'string' && metadataTimestamp.trim().length > 0) {
            created = metadataTimestamp;
          } else {
            created = fileMetadata.updated || '';
          }

          if (typeof metadataTotal === 'string') {
            totalImages = parseInt(metadataTotal, 10);
          } else if (typeof metadataTotal === 'number') {
            totalImages = metadataTotal;
          }

          if (typeof metadataSuccessful === 'string') {
            successful = parseInt(metadataSuccessful, 10);
          } else if (typeof metadataSuccessful === 'number') {
            successful = metadataSuccessful;
          }

          if (typeof metadataFailed === 'string') {
            failed = parseInt(metadataFailed, 10);
          } else if (typeof metadataFailed === 'number') {
            failed = metadataFailed;
          }
          
          // If we got valid data from metadata, use it (fastest path)
          if (totalImages > 0 || successful > 0 || failed > 0) {
            return {
              timestamp: match[1],
              path: file.name,
              date,
              cameraType,
              totalImages,
              successful,
              failed,
              created,
            };
          }
        }
        created = fileMetadata.updated || '';
      } catch (metadataError) {
        // If metadata read fails, continue to file download
        console.warn(`Could not read file metadata for ${file.name}:`, metadataError);
      }
      
      // FALLBACK: Try to read only first 2KB of file to get metadata (streaming)
      // This is much faster than downloading entire file
      const fileStream = file.createReadStream({ start: 0, end: 2048 });
      const chunks: Buffer[] = [];
      
      await new Promise<void>((resolve, reject) => {
        fileStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        fileStream.on('end', resolve);
        fileStream.on('error', reject);
      });
      
      const partialContent = Buffer.concat(chunks).toString('utf-8');
      
      // Try to extract metadata from partial JSON (usually in first 2KB)
      // Look for metadata and summary sections
      // (date, cameraType, created already set from metadata attempt above)
      
      // Try to parse partial JSON - first try full JSON parse, then regex fallback
      try {
        // Try to parse as complete JSON first (if we got enough content)
        let parsedData: any = null;
        try {
          const jsonStart = partialContent.indexOf('{');
          const jsonEnd = partialContent.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const jsonStr = partialContent.substring(jsonStart, jsonEnd + 1);
            parsedData = JSON.parse(jsonStr);
          }
        } catch (jsonError) {
          // JSON parse failed, will use regex fallback
        }
        
        if (parsedData && parsedData.summary) {
          // Use parsed JSON (most reliable)
          const parsedDate = parsedData.metadata?.date || 'unknown';
          if (parsedDate !== 'unknown') {
            date = parsedDate;
            console.log(`📅 Read date from JSON content: "${date}"`);
          }
          cameraType = parsedData.metadata?.cameraType || 'all';
          totalImages = parsedData.summary?.total || 0;
          successful = parsedData.summary?.successful || 0;
          failed = parsedData.summary?.failed || 0;
          created = parsedData.timestamp || file.metadata.updated || '';
        } else {
          // Fallback to regex parsing for partial content
          // Match date field - capture everything between quotes (handles "2025-11-30_CHITTOR")
          const metadataDateMatch = partialContent.match(/"date"\s*:\s*"([^"]+)"/);
          if (metadataDateMatch && metadataDateMatch[1]) {
            date = metadataDateMatch[1];
            console.log(`📅 Read date from regex (fallback): "${date}"`);
          }
          
          const metadataCameraMatch = partialContent.match(/"metadata"\s*:\s*\{[\s\S]*?"cameraType"\s*:\s*"([^"]+)"/);
          if (metadataCameraMatch) cameraType = metadataCameraMatch[1];
          
          // Find summary section - use non-greedy matching
          const summaryTotalMatch = partialContent.match(/"summary"\s*:\s*\{[\s\S]*?"total"\s*:\s*(\d+)/);
          if (summaryTotalMatch) totalImages = parseInt(summaryTotalMatch[1], 10);
          
          const summarySuccessfulMatch = partialContent.match(/"summary"\s*:\s*\{[\s\S]*?"successful"\s*:\s*(\d+)/);
          if (summarySuccessfulMatch) successful = parseInt(summarySuccessfulMatch[1], 10);
          
          const summaryFailedMatch = partialContent.match(/"summary"\s*:\s*\{[\s\S]*?"failed"\s*:\s*(\d+)/);
          if (summaryFailedMatch) failed = parseInt(summaryFailedMatch[1], 10);
          
          const timestampMatch = partialContent.match(/"timestamp"\s*:\s*"([^"]+)"/);
          if (timestampMatch) created = timestampMatch[1];
        }
        
        // If we still couldn't extract summary, download full file
        // But also check if metadata.totalImages exists (newer format)
        if (totalImages === 0 && successful === 0 && failed === 0) {
          // Try to get from metadata.totalImages first (stored in file metadata)
          const metadataTotal = parsedData?.metadata?.totalImages;
          if (metadataTotal) {
            totalImages = typeof metadataTotal === 'string' ? parseInt(metadataTotal, 10) : metadataTotal;
          }
          
          // If still 0, download full file
          if (totalImages === 0 && successful === 0 && failed === 0) {
            console.warn(`Could not extract summary from partial content for ${file.name}, downloading full file...`);
            const [buffer] = await file.download();
            const data = JSON.parse(buffer.toString());
            date = data.metadata?.date || date;
            cameraType = data.metadata?.cameraType || cameraType;
            totalImages = data.summary?.total || data.metadata?.totalImages || 0;
            successful = data.summary?.successful || 0;
            failed = data.summary?.failed || 0;
            created = data.timestamp || created;
          }
        }
      } catch (parseError) {
        // If partial parse fails, fall back to full download (rare)
        console.warn(`Partial parse failed for ${file.name}, downloading full file...`);
        try {
          const [buffer] = await file.download();
          const data = JSON.parse(buffer.toString());
          date = data.metadata?.date || 'unknown';
          cameraType = data.metadata?.cameraType || 'all';
          totalImages = data.summary?.total || 0;
          successful = data.summary?.successful || 0;
          failed = data.summary?.failed || 0;
          created = data.timestamp || file.metadata.updated || '';
        } catch (downloadError) {
          console.error(`Error downloading full file ${file.name}:`, downloadError);
        }
      }
      
      return {
        timestamp: match[1],
        path: file.name,
        date,
        cameraType,
        totalImages,
        successful,
        failed,
        created,
      };
    } catch (error) {
      console.error(`Error reading result file ${file.name}:`, error);
      return null;
    }
  });
  
  const allResults = await Promise.all(filePromises);
  results.push(...allResults.filter((r): r is PreviousResult => r !== null));
  
  // Sort by timestamp (most recent first)
  const sortedResults = results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  
  // Update cache
  cache.results = { data: sortedResults, timestamp: Date.now() };
  
  return sortedResults;
}

/**
 * Get a specific previous result
 */
export async function getPreviousResult(resultPath: string): Promise<any> {
  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  const file = bucket.file(resultPath);
  
  const [buffer] = await file.download();
  return JSON.parse(buffer.toString());
}

/**
 * Delete an image from GCS
 */
export async function deleteImage(imagePath: string): Promise<boolean> {
  try {
    const client = getStorageClient();
    const bucket = client.bucket(BUCKET_NAME);
    const file = bucket.file(imagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`Image not found: ${imagePath}`);
      return false;
    }
    
    // Delete the file
    await file.delete();
    console.log(`✅ Image deleted: ${imagePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting image ${imagePath}:`, error);
    throw error;
  }
}

/**
 * Custom Prompts Management
 */
const PROMPTS_FILE_PATH = 'prompts/custom-prompts.json';

export interface CustomPrompt {
  id: string;
  name: string;
  searchObjective: string;
  lookingFor: string;
  detectionCriteria: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * List all custom prompts
 */
export async function listCustomPrompts(): Promise<CustomPrompt[]> {
  try {
    const client = getStorageClient();
    const bucket = client.bucket(BUCKET_NAME);
    const file = bucket.file(PROMPTS_FILE_PATH);
    
    const [exists] = await file.exists();
    if (!exists) {
      return [];
    }
    
    const [buffer] = await file.download();
    const data = JSON.parse(buffer.toString());
    return Array.isArray(data.prompts) ? data.prompts : [];
  } catch (error) {
    console.error('Error listing custom prompts:', error);
    return [];
  }
}

/**
 * Save custom prompts
 */
export async function saveCustomPrompts(prompts: CustomPrompt[]): Promise<void> {
  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  const file = bucket.file(PROMPTS_FILE_PATH);
  
  const data = {
    prompts,
    updatedAt: new Date().toISOString(),
  };
  
  await file.save(JSON.stringify(data, null, 2), {
    contentType: 'application/json',
  });
  
  console.log(`✅ Saved ${prompts.length} custom prompt(s)`);
}

/**
 * Add a new custom prompt
 */
export async function addCustomPrompt(prompt: Omit<CustomPrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomPrompt> {
  const prompts = await listCustomPrompts();
  
  const newPrompt: CustomPrompt = {
    ...prompt,
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  prompts.push(newPrompt);
  await saveCustomPrompts(prompts);
  
  return newPrompt;
}

/**
 * Update an existing custom prompt
 */
export async function updateCustomPrompt(id: string, updates: Partial<Omit<CustomPrompt, 'id' | 'createdAt'>>): Promise<CustomPrompt | null> {
  const prompts = await listCustomPrompts();
  const index = prompts.findIndex(p => p.id === id);
  
  if (index === -1) {
    return null;
  }
  
  prompts[index] = {
    ...prompts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await saveCustomPrompts(prompts);
  return prompts[index];
}

/**
 * Delete a custom prompt
 */
export async function deleteCustomPrompt(id: string): Promise<boolean> {
  const prompts = await listCustomPrompts();
  const filtered = prompts.filter(p => p.id !== id);
  
  if (filtered.length === prompts.length) {
    return false; // Prompt not found
  }
  
  await saveCustomPrompts(filtered);
  return true;
}

