# Analysis Workflow

## Overview

This application analyzes CCTV images from GCP Cloud Storage using OpenAI GPT-4o Vision API with multiple programmatic prompts.

## Workflow Steps

### 1. Image Selection (UI)
- User selects a date from available dates in GCP bucket
- Optionally filters by camera type (ANALYTICS, FIXED, PTZ)
- Selects specific images or all images for analysis

### 2. Analysis Trigger (UI → API)
- User clicks "Analyze Images" or "Stream Analysis"
- Frontend sends POST request to `/api/analyze` or `/api/analyze/stream`
- Request includes:
  - Selected date
  - Camera type (optional)
  - Array of image paths

### 3. Image Retrieval (API → GCP)
- API route calls `listImages()` from `lib/gcp-storage.ts`
- Retrieves images from GCP bucket: `llm_dynamic/images/{date}/{cameraType}/`
- Returns image metadata with signed URLs

### 4. Multi-Prompt Analysis (API → OpenAI)
For each selected image:

1. **Download Image**: Convert GCP image to base64
2. **Execute 6 Prompts Sequentially**:
   - Pole Detection
   - Vehicle Count
   - Pedestrian Detection
   - Traffic Sign Detection
   - Road Condition Assessment
   - Infrastructure Elements

3. **For Each Prompt**:
   - Build prompt text with search objective, looking for, and detection criteria
   - Call OpenAI GPT-4o Vision API with:
     - Model: `gpt-4o`
     - Image: base64 encoded
     - Detail: `high`
     - Temperature: `0.2` (for consistency)
     - Response format: `json_object`
   - Parse JSON response:
     ```json
     {
       "match": true/false,
       "count": number,
       "description": "string",
       "details": "string",
       "confidence": "high|medium|low",
       "additional_observations": "string"
     }
     ```

4. **Build Result Object**:
   ```typescript
   {
     filename: string,
     imagePath: string,
     date: string,
     cameraType: string,
     results: AnalysisResult[],  // One per prompt
     status: 'success' | 'error'
   }
   ```

### 5. Batch Processing
- Images processed in batches of 3 (configurable)
- Small delay between batches to avoid rate limits
- Progress callback updates UI in real-time (for streaming)

### 6. Results Aggregation
- All results collected into array
- Statistics calculated:
  - Total images analyzed
  - Successful vs failed
  - Results by prompt
  - Results by camera type
  - Counts and averages

### 7. Analytics Generation
- `/api/analytics` endpoint processes results
- Generates:
  - Overall statistics
  - Breakdown by prompt (matches, counts, averages)
  - Breakdown by camera type
  - Breakdown by date

### 8. UI Display
- **Analytics Dashboard**: Shows summary statistics and charts
- **Analysis Results**: Detailed view of each image's analysis results
- Color-coded by confidence and match status

## Prompt Configuration

Prompts are defined in `lib/openai-analyzer.ts`:

```typescript
export const ANALYSIS_PROMPTS: AnalysisPrompt[] = [
  {
    id: 'poles',
    name: 'Pole Detection',
    searchObjective: 'Count visible poles',
    lookingFor: 'poles',
    detectionCriteria: 'Look for vertical structures like street light poles...',
  },
  // ... 5 more prompts
];
```

To modify prompts, edit this array. The system will automatically use all prompts in the array.

## API Rate Limiting

- Images processed in batches of 3
- 200ms delay between individual prompt calls
- 1000ms delay between batches
- Adjustable in `lib/openai-analyzer.ts` → `analyzeImages()` function

## Error Handling

- Individual prompt failures don't stop analysis
- Failed prompts return low confidence result
- Image-level errors are captured in result status
- All errors logged to console

## Streaming vs Batch

### Batch (`/api/analyze`)
- Returns all results at once
- Better for small batches
- Simpler error handling

### Streaming (`/api/analyze/stream`)
- Server-Sent Events (SSE)
- Results appear in real-time
- Better UX for large batches
- Progress updates as each image completes

