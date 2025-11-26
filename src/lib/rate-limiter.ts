/**
 * Rate limiter for OpenAI API calls
 * Respects BOTH:
 * - 500 requests/minute (RPM) limit
 * - 30,000 tokens/minute (TPM) limit
 */

interface TokenUsage {
  timestamp: number;
  tokens: number;
}

interface RateLimiterOptions {
  maxRequests: number; // Maximum requests per window
  maxTokens: number; // Maximum tokens per window
  windowMs: number; // Time window in milliseconds
}

class RateLimiter {
  private requests: number[] = [];
  private tokenUsage: TokenUsage[] = [];
  private maxRequests: number;
  private maxTokens: number;
  private windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.maxTokens = options.maxTokens;
    this.windowMs = options.windowMs;
  }

  /**
   * Wait until we can make a request without exceeding rate limits
   * @param estimatedTokens - Estimated tokens for this request (for TPM limit)
   */
  async waitForSlot(estimatedTokens: number = 1500): Promise<void> {
    const now = Date.now();
    
    // Clean up old entries
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    this.tokenUsage = this.tokenUsage.filter(usage => now - usage.timestamp < this.windowMs);
    
    // Calculate current usage
    const currentRequests = this.requests.length;
    const currentTokens = this.tokenUsage.reduce((sum, usage) => sum + usage.tokens, 0);
    
    // Check if we need to wait for request limit
    if (currentRequests >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100;
      
      if (waitTime > 0) {
        console.log(`⏳ RPM limit: Waiting ${(waitTime / 1000).toFixed(2)}s (${currentRequests}/${this.maxRequests} requests)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Recalculate after wait
        const newNow = Date.now();
        this.requests = this.requests.filter(timestamp => newNow - timestamp < this.windowMs);
        this.tokenUsage = this.tokenUsage.filter(usage => newNow - usage.timestamp < this.windowMs);
      }
    }
    
    // Check if we need to wait for token limit
    const newTokenCount = this.tokenUsage.reduce((sum, usage) => sum + usage.tokens, 0) + estimatedTokens;
    if (newTokenCount > this.maxTokens) {
      // Find when we can make the request (when oldest tokens expire)
      const oldestTokenUsage = this.tokenUsage[0];
      if (oldestTokenUsage) {
        const waitTime = this.windowMs - (now - oldestTokenUsage.timestamp) + 100;
        if (waitTime > 0) {
          console.log(`⏳ TPM limit: Waiting ${(waitTime / 1000).toFixed(2)}s (${currentTokens}/${this.maxTokens} tokens, need ${estimatedTokens} more)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          // Recalculate after wait
          const newNow = Date.now();
          this.tokenUsage = this.tokenUsage.filter(usage => newNow - usage.timestamp < this.windowMs);
        }
      }
    }
    
    // Record this request
    this.requests.push(Date.now());
    // We'll record actual token usage after the API call
  }

  /**
   * Record actual token usage from API response
   */
  recordTokenUsage(tokens: number): void {
    this.tokenUsage.push({
      timestamp: Date.now(),
      tokens,
    });
  }

  /**
   * Get current usage stats
   */
  getUsageStats(): { requests: number; tokens: number } {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    this.tokenUsage = this.tokenUsage.filter(usage => now - usage.timestamp < this.windowMs);
    
    return {
      requests: this.requests.length,
      tokens: this.tokenUsage.reduce((sum, usage) => sum + usage.tokens, 0),
    };
  }
}

// Global rate limiter instance
// OpenAI limits: 500 RPM, 30,000 TPM
// Using 480 RPM and 28,000 TPM to leave buffer
export const openaiRateLimiter = new RateLimiter({
  maxRequests: 480, // 480 requests per minute
  maxTokens: 28000, // 28,000 tokens per minute (leaving 2K buffer)
  windowMs: 60 * 1000, // 60 seconds
});

/**
 * Record token usage (called after API response)
 */
export function recordTokenUsage(tokens: number): void {
  openaiRateLimiter.recordTokenUsage(tokens);
}

/**
 * Execute a function with rate limiting and automatic retry on 429 errors
 */
export async function withRateLimit<T>(fn: () => Promise<T>, retries: number = 5): Promise<T> {
  const estimatedTokens = 1500; // Average tokens per request (prompt + image + response)
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait for slot (handles both RPM and TPM)
      await openaiRateLimiter.waitForSlot(estimatedTokens);
      
      // Execute the function
      const result = await fn();
      
      return result;
    } catch (error: any) {
      // Handle 429 rate limit errors
      if (error?.status === 429) {
        const retryAfter = error?.headers?.get?.('retry-after-ms') 
          ? parseInt(error.headers.get('retry-after-ms'))
          : error?.headers?.get?.('retry-after')
          ? parseInt(error.headers.get('retry-after')) * 1000
          : error?.headers?.['retry-after-ms']
          ? parseInt(error.headers['retry-after-ms'])
          : error?.headers?.['retry-after']
          ? parseInt(error.headers['retry-after']) * 1000
          : (attempt + 1) * 2000; // Exponential backoff: 2s, 4s, 6s, etc.
        
        const errorType = error?.type || 'unknown';
        const remainingTokens = error?.headers?.get?.('x-ratelimit-remaining-tokens') || error?.headers?.['x-ratelimit-remaining-tokens'] || 'unknown';
        const remainingRequests = error?.headers?.get?.('x-ratelimit-remaining-requests') || error?.headers?.['x-ratelimit-remaining-requests'] || 'unknown';
        const resetTokens = error?.headers?.get?.('x-ratelimit-reset-tokens') || error?.headers?.['x-ratelimit-reset-tokens'] || 'unknown';
        
        console.log(`⚠️ Rate limit hit (${errorType}):`);
        console.log(`   Remaining: ${remainingRequests} requests, ${remainingTokens} tokens`);
        console.log(`   Reset tokens in: ${resetTokens}`);
        console.log(`   Retrying in ${(retryAfter / 1000).toFixed(2)}s (attempt ${attempt + 1}/${retries})`);
        
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          continue; // Retry
        }
      }
      
      // For other errors or max retries, throw
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

