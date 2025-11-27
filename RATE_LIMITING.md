# Rate Limiting Implementation

## OpenAI API Limits
- **500 requests/minute (RPM)**
- **30,000 tokens/minute**

## Current Implementation

### Rate Limiter
- **Location**: `src/lib/rate-limiter.ts`
- **Configuration**: 480 requests/minute (leaving 20 buffer)
- **Window**: 60 seconds rolling window
- **Behavior**: Automatically queues requests to stay under limit

### Processing Strategy

For **350 images × 6 prompts = 2,100 API calls**:

1. **Concurrent Images**: 4 images processed simultaneously
2. **Prompts per Image**: Processed sequentially (rate limiter queues each call)
3. **Rate Limiter**: Ensures max 480 requests/minute (8 requests/second)

### Estimated Time

- **Total API calls**: 2,100
- **Rate**: 480 calls/minute
- **Estimated time**: ~4.4 minutes (2,100 ÷ 480)

### How It Works

1. **Image Level**: 4 images processed concurrently
2. **Prompt Level**: Each image processes its 6 prompts sequentially
3. **Rate Limiter**: Each API call waits for its slot in the 480/minute window
4. **Automatic Queuing**: If limit reached, requests wait until window clears

### Example Flow

```
Image 1: Prompt 1 → [Rate Limiter] → API Call
Image 1: Prompt 2 → [Rate Limiter] → API Call
Image 1: Prompt 3 → [Rate Limiter] → API Call
...
Image 2: Prompt 1 → [Rate Limiter] → API Call (queued if needed)
Image 2: Prompt 2 → [Rate Limiter] → API Call (queued if needed)
...
```

### Benefits

✅ **Respects OpenAI limits**: Never exceeds 500 RPM
✅ **Efficient**: Processes 4 images concurrently
✅ **Automatic**: No manual delays needed
✅ **Scalable**: Works for any number of images

### Monitoring

The rate limiter logs:
- Current request count in window
- Wait times when limit reached
- Progress updates

### Adjusting Limits

To change the rate limit, edit `src/lib/rate-limiter.ts`:

```typescript
export const openaiRateLimiter = new RateLimiter({
  maxRequests: 480, // Adjust this (max 500 for OpenAI)
  windowMs: 60 * 1000, // 60 seconds
});
```

### Adjusting Concurrency

To change concurrent images, edit `src/lib/openai-analyzer.ts`:

```typescript
const concurrentImages = 4; // Adjust this (higher = faster but more queuing)
```

**Note**: Higher concurrency doesn't mean faster if rate limit is the bottleneck. The rate limiter will queue requests anyway.


