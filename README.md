# CCTV Image Analysis Dashboard

A Next.js application for analyzing CCTV/traffic camera images stored in Google Cloud Storage using OpenAI GPT-4o Vision API.

## Features

- **GCP Cloud Storage Integration**: Connect to GCP bucket `llm_dynamic` to list and analyze images
- **Multi-Prompt Analysis**: Automatically analyzes images with 5-6 different prompts:
  - Pole Detection
  - Vehicle Count
  - Pedestrian Detection
  - Traffic Sign Detection
  - Road Condition Assessment
  - Infrastructure Elements
- **Real-time Streaming**: Stream analysis results as they complete
- **Analytics Dashboard**: Comprehensive analytics and statistics
- **Image Selection**: Select specific images or analyze all images for a date/camera type

## Prerequisites

- Node.js 18+ installed
- GCP account with Cloud Storage bucket `llm_dynamic`
- GCP service account key file (`gcp-key.json`)
- OpenAI API key

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure GCP:**
   - Place your GCP service account key file as `gcs-key.json` in the project root
   - Ensure the service account has read access to the `llm_dynamic` bucket

3. **Configure OpenAI:**
   - Create a `.env.local` file in the project root
   - Add your OpenAI API key:
     ```
     OPENAI_API_KEY=your_openai_api_key_here
     ```

4. **GCP Bucket Structure:**
   The application expects images in the following structure:
   ```
   images/
     2025-11-23/
       ANALYTICS/
         snapshot files...
       FIXED/
         snapshot files...
       PTZ/
         snapshot files...
   ```

## Running the Application

1. **Development mode:**
```bash
npm run dev
   ```

2. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

3. **Open in browser:**
   Navigate to `http://localhost:3000`

## Usage

1. **Select Date**: Choose a date from the dropdown (automatically loads available dates from GCP)
2. **Filter by Camera Type** (optional): Filter by ANALYTICS, FIXED, or PTZ
3. **Select Images**: Click on images to select them, or use "Select All"
4. **Analyze**: 
   - Click "Analyze Images" for batch analysis
   - Click "Stream Analysis" for real-time streaming results
5. **View Results**: See analytics dashboard and detailed results for each image

## API Endpoints

### `GET /api/images/list`
List available dates or images for a specific date.

**Query Parameters:**
- `date` (optional): Filter by date (YYYY-MM-DD)
- `cameraType` (optional): Filter by camera type (ANALYTICS, FIXED, PTZ)

### `POST /api/analyze`
Analyze selected images.

**Request Body:**
```json
{
  "date": "2025-11-23",
  "cameraType": "ANALYTICS",
  "imagePaths": ["images/2025-11-23/ANALYTICS/image1.jpg"]
}
```

### `POST /api/analyze/stream`
Stream analysis results in real-time (Server-Sent Events).

### `GET /api/analytics`
Get analytics statistics for analysis results.

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/          # API routes
│   │   └── page.tsx       # Main dashboard page
│   ├── components/        # React components
│   │   ├── ImageSelector.tsx
│   │   ├── AnalysisResults.tsx
│   │   └── AnalyticsDashboard.tsx
│   └── lib/              # Utility functions
│       ├── gcp-storage.ts
│       └── openai-analyzer.ts
├── gcs-key.json          # GCP service account key (not in git)
├── .env.local            # Environment variables (not in git)
└── package.json
```

## Analysis Prompts

The application uses 6 predefined analysis prompts that are executed programmatically:

1. **Pole Detection**: Counts visible poles (street lights, utility poles, etc.)
2. **Vehicle Count**: Counts vehicles on the road
3. **Pedestrian Detection**: Counts pedestrians
4. **Traffic Sign Detection**: Counts traffic signs
5. **Road Condition Assessment**: Assesses road condition
6. **Infrastructure Elements**: Counts infrastructure components

Each prompt returns:
- `match`: Boolean indicating if criteria was met
- `count`: Number of items found
- `description`: Brief description
- `details`: Specific details
- `confidence`: Confidence level (high/medium/low)
- `additionalObservations`: Any other relevant observations

## Technologies Used

- **Next.js 16**: React framework with App Router
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Google Cloud Storage**: Image storage
- **OpenAI GPT-4o Vision**: Image analysis
- **Server-Sent Events**: Real-time streaming

## License

MIT
