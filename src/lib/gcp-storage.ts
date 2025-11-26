import { Storage } from '@google-cloud/storage';
import path from 'path';

// Initialize GCP Storage client
let storage: Storage | null = null;

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
 */
export async function listAvailableDates(): Promise<string[]> {
  try {
    const client = getStorageClient();
    const bucket = client.bucket(BUCKET_NAME);
    
    // Check if bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`Bucket '${BUCKET_NAME}' does not exist or is not accessible`);
    }
    
    // Get files with prefix to find date folders
    const [files] = await bucket.getFiles({
      prefix: 'images/',
      autoPaginate: false,
    });

    const dates = new Set<string>();
    const datePattern = /^images\/(\d{4}-\d{2}-\d{2})\//;
    
    // Extract dates from file paths
    files.forEach(file => {
      const match = file.name.match(datePattern);
      if (match && match[1]) {
        dates.add(match[1]);
      }
    });

    // Convert to array and sort (most recent first)
    const datesArray = Array.from(dates).sort().reverse();
    
    console.log(`Found ${datesArray.length} date(s):`, datesArray);
    
    return datesArray;
  } catch (error) {
    console.error('Error in listAvailableDates:', error);
    throw error;
  }
}

/**
 * List images for a specific date and camera type
 */
export async function listImages(
  date: string,
  cameraType?: 'ANALYTICS' | 'FIXED' | 'PTZ'
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
  
  for (const file of files) {
    // Skip if it's a folder or not an image
    if (!file.name.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) {
      continue;
    }

    const pathParts = file.name.split('/');
    const cameraTypeFromPath = pathParts[2] as 'ANALYTICS' | 'FIXED' | 'PTZ';
    
    // Generate signed URL (valid for 1 hour)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    const sizeValue = file.metadata.size;
    const size =
      typeof sizeValue === 'string'
        ? parseInt(sizeValue, 10)
        : typeof sizeValue === 'number'
          ? sizeValue
          : 0;

    images.push({
      name: pathParts[pathParts.length - 1],
      path: file.name,
      date,
      cameraType: cameraTypeFromPath,
      url,
      size,
      updated: file.metadata.updated,
    });
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
        date: metadata?.date || '',
        cameraType: metadata?.cameraType || '',
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
  const client = getStorageClient();
  const bucket = client.bucket(BUCKET_NAME);
  
  const [files] = await bucket.getFiles({
    prefix: 'results/',
  });
  
  const results: PreviousResult[] = [];
  const resultPattern = /^results\/(\d{8}_\d{6})\/results\.json$/;
  
  for (const file of files) {
    const match = file.name.match(resultPattern);
    if (match) {
      try {
        // Download and parse the result file
        const [buffer] = await file.download();
        const data = JSON.parse(buffer.toString());
        
        results.push({
          timestamp: match[1],
          path: file.name,
          date: data.metadata?.date || 'unknown',
          cameraType: data.metadata?.cameraType || 'all',
          totalImages: data.summary?.total || 0,
          successful: data.summary?.successful || 0,
          failed: data.summary?.failed || 0,
          created: data.timestamp || file.metadata.updated || '',
        });
      } catch (error) {
        console.error(`Error reading result file ${file.name}:`, error);
      }
    }
  }
  
  // Sort by timestamp (most recent first)
  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
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

