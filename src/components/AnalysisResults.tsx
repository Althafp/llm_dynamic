'use client';

interface AnalysisResult {
  promptId: string;
  promptName: string;
  match: boolean;
  count: number;
  description: string;
  details: string;
  confidence: 'high' | 'medium' | 'low';
  additionalObservations?: string;
}

interface ImageAnalysisResult {
  filename: string;
  imagePath: string;
  date: string;
  cameraType: string;
  results: AnalysisResult[];
  status: 'success' | 'error';
  error?: string;
}

interface AnalysisResultsProps {
  results: ImageAnalysisResult[];
}

export default function AnalysisResults({ results }: AnalysisResultsProps) {
  // Component returns nothing - all details removed
  return null;
}

