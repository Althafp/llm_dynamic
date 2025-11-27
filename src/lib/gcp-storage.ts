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
    const datePattern = /^images\/(\d{4}-\d{2}-\d{2})\/$/;
    
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
        const match = file.name.match(/^images\/(\d{4}-\d{2}-\d{2})\//);
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
  const resultData = {
    timestamp: now.toISOString(),
    metadata: {
      date: metadata?.date || 'unknown',
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
  await file.save(JSON.stringify(resultData, null, 2), {
    contentType: 'application/json',
    metadata: {
      metadata: {
        timestamp: now.toISOString(),
        date: metadata?.date || 'unknown',
        cameraType: metadata?.cameraType || 'all',
        totalImages: String(resultData.summary.total || 0),
        successful: String(resultData.summary.successful || 0),
        failed: String(resultData.summary.failed || 0),
        isPartial: existingPath ? 'true' : 'false',
      },
    },
  });
  
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
      // FAST PATH: Try to read only first 2KB of file to get metadata (streaming)
      // This is much faster than downloading entire file or calling getMetadata()
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
      let date = 'unknown';
      let cameraType = 'all';
      let totalImages = 0;
      let successful = 0;
      let failed = 0;
      let created = file.metadata.updated || '';
      
      // Try to parse partial JSON
      try {
        // Find metadata section
        const metadataMatch = partialContent.match(/"metadata"\s*:\s*\{[^}]*"date"\s*:\s*"([^"]+)"/);
        if (metadataMatch) date = metadataMatch[1];
        
        const cameraTypeMatch = partialContent.match(/"metadata"\s*:\s*\{[^}]*"cameraType"\s*:\s*"([^"]+)"/);
        if (cameraTypeMatch) cameraType = cameraTypeMatch[1];
        
        // Find summary section
        const summaryMatch = partialContent.match(/"summary"\s*:\s*\{[^}]*"total"\s*:\s*(\d+)/);
        if (summaryMatch) totalImages = parseInt(summaryMatch[1], 10);
        
        const successfulMatch = partialContent.match(/"summary"\s*:\s*\{[^}]*"successful"\s*:\s*(\d+)/);
        if (successfulMatch) successful = parseInt(successfulMatch[1], 10);
        
        const failedMatch = partialContent.match(/"summary"\s*:\s*\{[^}]*"failed"\s*:\s*(\d+)/);
        if (failedMatch) failed = parseInt(failedMatch[1], 10);
        
        const timestampMatch = partialContent.match(/"timestamp"\s*:\s*"([^"]+)"/);
        if (timestampMatch) created = timestampMatch[1];
      } catch (parseError) {
        // If partial parse fails, fall back to full download (rare)
        console.warn(`Partial parse failed for ${file.name}, downloading full file...`);
        const [buffer] = await file.download();
        const data = JSON.parse(buffer.toString());
        date = data.metadata?.date || 'unknown';
        cameraType = data.metadata?.cameraType || 'all';
        totalImages = data.summary?.total || 0;
        successful = data.summary?.successful || 0;
        failed = data.summary?.failed || 0;
        created = data.timestamp || file.metadata.updated || '';
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

