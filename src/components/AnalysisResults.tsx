'use client';

import { useState } from 'react';

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
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'medium':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const successfulResults = results.filter(r => r.status === 'success');
  const failedResults = results.filter(r => r.status === 'error');

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h2 className="text-2xl font-bold text-black">Analysis Summary</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 border border-gray-300 rounded-lg">
          <div className="text-3xl font-bold text-black">{results.length}</div>
          <div className="text-sm text-gray-600">Total Images</div>
        </div>
        <div className="text-center p-4 bg-gray-50 border border-gray-300 rounded-lg">
          <div className="text-3xl font-bold text-black">{successfulResults.length}</div>
          <div className="text-sm text-gray-600">Successful</div>
        </div>
        <div className="text-center p-4 bg-gray-50 border border-gray-300 rounded-lg">
          <div className="text-3xl font-bold text-black">{failedResults.length}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>

      <div className="space-y-4">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-lg border p-4 ${
              result.status === 'error' ? 'border-red-400' : 'border-gray-300'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg text-black">{result.filename}</h3>
                <div className="text-sm text-gray-600">
                  {result.cameraType} • {result.date}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  result.status === 'success'
                    ? 'bg-gray-100 text-gray-800 border-gray-300'
                    : 'bg-red-100 text-red-800 border-red-300'
                }`}
              >
                {result.status === 'success' ? 'Success' : 'Error'}
              </span>
            </div>

            {result.status === 'error' && (
              <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg text-red-800 text-sm">
                {result.error}
              </div>
            )}

            {result.status === 'success' && (
              <div className="space-y-3 mt-4">
                {result.results.map((analysis, aidx) => (
                  <div
                    key={aidx}
                    className={`p-3 rounded-lg border ${
                      analysis.match
                        ? 'bg-gray-50 border-gray-400'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-black">{analysis.promptName}</h4>
                      <div className="flex gap-2">
                        {analysis.match && (
                          <span className="px-2 py-1 bg-black text-white text-xs rounded border border-gray-600">
                            Match
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 text-xs rounded border ${getConfidenceColor(
                            analysis.confidence
                          )}`}
                        >
                          {analysis.confidence}
                        </span>
                        {analysis.count > 0 && (
                          <span className="px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-600">
                            Count: {analysis.count}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 mb-1">{analysis.description}</p>
                    {analysis.details && (
                      <p className="text-xs text-gray-600">{analysis.details}</p>
                    )}
                    {analysis.additionalObservations && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        {analysis.additionalObservations}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

