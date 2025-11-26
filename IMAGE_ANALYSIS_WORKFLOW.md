# Image Analysis Workflow - Detailed Explanation

## Why You're Getting 429 Errors (Token Rate Limit)

**Problem**: Your rate limiter was only tracking **requests per minute (RPM)**, but OpenAI also has a **tokens per minute (TPM)** limit of 30,000.

**What happened**:
- Each API call uses ~1,000-1,500 tokens (prompt text + image + response)
- With 4 images processing concurrently × 6 prompts = 24 concurrent API calls
- That's ~24,000-36,000 tokens/minute → **exceeds 30,000 TPM limit**

**Solution**: Updated rate limiter now tracks BOTH:
- ✅ 480 requests/minute (RPM)
- ✅ 28,000 tokens/minute (TPM) - with buffer

---

## Image Analysis Workflow (Step by Step)

Based on your logs, here's exactly what happens:

### **Phase 1: Batch Setup**
```
📦 Batch 33/85: Processing 4 image(s) concurrently
```
- System processes **4 images at the same time** (controlled parallelism)
- Total batches = 339 images ÷ 4 = ~85 batches

---

### **Phase 2: Per Image Processing**

For each image (e.g., `LANCHESTER_ROAD_PONNURU_RD._SIDE_LALAPET_10_246_8_9_20251125_112143.jpg`):

#### **Step 1: Generate Signed URL**
```
📸 Generating GCS signed URL (1 hour expiration, zero memory)...
```
- Creates a temporary URL to access image from Google Cloud Storage
- **Zero memory** - image stays in GCS, not downloaded yet
- URL valid for 1 hour

#### **Step 2: Process All 6 Prompts Sequentially**
```
📸 Analyzing with 6 prompt(s): Crowd Detection, No Parking Violation, 
   Garbage Detection, Pothole Detection, Traffic Congestion, Wrong-Way / Wrong Driving
```

For **each prompt** (one at a time):

**2a. Try Signed URL First**
```
[Prompt Name] Trying signed URL (zero memory)...
```
- Sends signed URL directly to OpenAI
- OpenAI fetches image from GCS
- **If successful**: Fast, no memory used ✅
- **If timeout**: Falls back to base64

**2b. Fallback to Base64 (if needed)**
```
⚠️ Signed URL timed out, falling back to base64...
📥 Downloaded 764.72KB in 363ms, encoded in 1ms
```
- Downloads image from GCS to server memory
- Converts to base64 string
- Sends base64 to OpenAI
- **Uses memory** but more reliable

**2c. API Call with Rate Limiting**
```
✅ API responded in 8056ms
✅ Completed in 12116ms - Match: true, Count: 1
```
- Rate limiter ensures:
  - Max 480 requests/minute
  - Max 28,000 tokens/minute
- If limit hit, waits automatically
- Records token usage for tracking

#### **Step 3: Collect Results**
```
📸 ✅ Completed in 209059ms (URL Gen: 17ms, Processing: 209042ms, 2/6 prompts matched)
```
- All 6 prompts processed for this image
- Results collected (match status, counts, descriptions)
- Image marked as complete

---

### **Phase 3: Batch Completion**
```
📦 Batch 32/85 completed in 87.11s (4/4 successful)
📦 Estimated remaining: 71.5 minutes
```
- All 4 images in batch completed
- Results saved to checkpoint (every 10 images or 30 seconds)
- Progress updated

---

### **Phase 4: Incremental Saving**
```
💾 Checkpoint saved: 130/339 images → results/20251126_025312/results.json
```
- Every 10 images OR every 30 seconds
- Saves to same checkpoint file
- **If process stops, you don't lose progress!**

---

## Visual Flow Diagram

```
339 Images Total
    ↓
Split into 85 batches (4 images each)
    ↓
┌─────────────────────────────────────┐
│  Batch 1: Images 1-4 (concurrent)   │
│  ┌──────────┐  ┌──────────┐        │
│  │ Image 1 │  │ Image 2 │  │        │
│  │   ↓      │  │   ↓      │        │
│  │ 6 Prompts│  │ 6 Prompts│        │
│  │ (seq)    │  │ (seq)    │        │
│  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐        │
│  │ Image 3 │  │ Image 4 │  │        │
│  │   ↓      │  │   ↓      │        │
│  │ 6 Prompts│  │ 6 Prompts│        │
│  │ (seq)    │  │ (seq)    │        │
│  └──────────┘  └──────────┘        │
│         ↓                           │
│  Save Checkpoint (if needed)        │
└─────────────────────────────────────┘
    ↓
Repeat for Batch 2, 3, ... 85
    ↓
Final Save → Complete Results
```

---

## Rate Limiting Details

### **Before (Only RPM)**
- ❌ Tracked: 480 requests/minute
- ❌ Ignored: Token usage
- ❌ Result: Hit 30,000 TPM limit → 429 errors

### **After (RPM + TPM)**
- ✅ Tracks: 480 requests/minute
- ✅ Tracks: 28,000 tokens/minute
- ✅ Auto-retry: On 429 errors with exponential backoff
- ✅ Result: Stays within both limits

---

## Token Usage Per Request

Each API call uses approximately:
- **Prompt text**: ~200-300 tokens
- **Image (high detail)**: ~1,000-1,200 tokens
- **Response**: ~100-200 tokens
- **Total**: ~1,300-1,700 tokens per call

**For 339 images × 6 prompts = 2,034 calls**
- Total tokens: ~2.6M - 3.5M tokens
- At 28,000 tokens/minute: ~93-125 minutes

---

## Why Sequential Prompts Per Image?

**Question**: Why not process all 6 prompts in parallel?

**Answer**: 
- Each prompt needs the same image
- Processing sequentially ensures:
  - Rate limiter can properly queue requests
  - Token usage is tracked accurately
  - Easier error handling
  - More predictable performance

**But**: 4 images process concurrently, so you still get parallelism!

---

## Performance Metrics

From your logs:
- **Per image**: ~209 seconds (3.5 minutes)
- **Per prompt**: ~35 seconds average
- **Batch of 4 images**: ~87 seconds
- **Total estimated**: ~71 minutes for 339 images

**Bottleneck**: 
- API response time (~8-12 seconds per prompt)
- Rate limiting waits
- Image download time (if base64 fallback)

---

## Error Handling

### **429 Rate Limit Errors**
- ✅ Automatically retries (up to 5 times)
- ✅ Uses `retry-after-ms` header from OpenAI
- ✅ Logs remaining tokens/requests
- ✅ Continues processing after retry

### **Timeout Errors**
- ✅ Falls back to base64 automatically
- ✅ Retries with downloaded image
- ✅ Logs fallback reason

### **Other Errors**
- ✅ Logs error details
- ✅ Continues with next image
- ✅ Saves partial results

---

## Checkpoint System

**Saves automatically**:
- Every 10 images processed
- Every 30 seconds (whichever comes first)
- On any error (saves partial results)
- At final completion

**Recovery**:
- If process stops, checkpoint file has all results up to that point
- View in "Previous Results" page
- Can resume from checkpoint (future feature)

---

## Summary

**Workflow**: 
1. Batch images (4 at a time)
2. For each image: Generate URL → Process 6 prompts sequentially
3. Rate limiter ensures we stay under RPM + TPM limits
4. Save checkpoints incrementally
5. Continue until all images done

**Why 429 errors happened**: Token limit (30K TPM) exceeded, not just request limit

**Fix**: Now tracks both limits and auto-retries on 429 errors

