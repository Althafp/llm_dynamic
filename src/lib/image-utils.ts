/**
 * Extract IP address from image filename
 * Format: APSRTC_BUS_STAND_IN_&_OUT_GTR_OLDGUNTUR_10_246_5_22_20251123_123807.jpg
 * IP is: 10_246_5_22 -> 10.246.5.22
 */
export function extractIPFromFilename(filename: string): string | null {
  // Pattern: digits_underscore_digits_underscore_digits_underscore_digits
  // This should match IP addresses in the format 10_246_5_22
  const ipPattern = /(\d+)_(\d+)_(\d+)_(\d+)/;
  const match = filename.match(ipPattern);
  
  if (match) {
    // Convert underscores to dots: 10_246_5_22 -> 10.246.5.22
    return match[0].replace(/_/g, '.');
  }
  
  return null;
}

/**
 * Extract date from image filename
 * Format: ..._20251123_123807.jpg
 */
export function extractDateFromFilename(filename: string): string | null {
  // Pattern: YYYYMMDD
  const datePattern = /(\d{8})/;
  const match = filename.match(datePattern);
  
  if (match) {
    const dateStr = match[1];
    // Format: YYYY-MM-DD
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  
  return null;
}

