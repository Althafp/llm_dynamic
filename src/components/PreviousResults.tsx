'use client';

import { useState, useEffect } from 'react';

interface PreviousResult {
  timestamp: string;
  path: string;
  date: string;
  cameraType: string;
  totalImages: number;
  successful: number;
  failed: number;
  created: string;
}

interface PreviousResultsProps {
  onLoadResult: (results: any[]) => void;
  refreshTrigger?: number;
}

export default function PreviousResults({ onLoadResult, refreshTrigger }: PreviousResultsProps) {
  const [results, setResults] = useState<PreviousResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadPreviousResults();
  }, [refreshTrigger]);

  const loadPreviousResults = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/results/list');
      const data = await response.json();
      if (data.success) {
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Error loading previous results:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResult = async (path: string) => {
    try {
      const response = await fetch(`/api/results/get?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      if (data.success && data.result) {
        onLoadResult(data.result.results);
      }
    } catch (error) {
      console.error('Error loading result:', error);
      alert('Failed to load previous result');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    // Convert YYYYMMDD_HHMMSS to readable format
    if (timestamp.length === 15) {
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      const hour = timestamp.substring(9, 11);
      const minute = timestamp.substring(11, 13);
      const second = timestamp.substring(13, 15);
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    return timestamp;
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800">Previous Results</h2>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
            {results.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPreviousResults}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          >
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <svg className="animate-spin h-6 w-6 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-2">Loading previous results...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No previous results found</p>
        </div>
      ) : (
        <div className={`space-y-2 ${expanded ? 'max-h-none' : 'max-h-96 overflow-y-auto'}`}>
          {results.map((result, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-800">
                      {formatTimestamp(result.timestamp)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(result.created).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600 mb-2">
                    <span>Date: <span className="font-medium">{result.date}</span></span>
                    <span>Type: <span className="font-medium">{result.cameraType}</span></span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                      Total: {result.totalImages}
                    </span>
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded">
                      Success: {result.successful}
                    </span>
                    {result.failed > 0 && (
                      <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
                        Failed: {result.failed}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => loadResult(result.path)}
                  className="ml-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium text-sm"
                >
                  Load
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

