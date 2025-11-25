'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ImageSelector from '@/components/ImageSelector';
import AnalysisResults from '@/components/AnalysisResults';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import Link from 'next/link';
import { ANALYSIS_PROMPTS } from '@/lib/analysis-prompts';

interface ImageFile {
  name: string;
  path: string;
  date: string;
  cameraType: 'ANALYTICS' | 'FIXED' | 'PTZ';
  url?: string;
}

interface AnalysisResult {
  filename: string;
  imagePath: string;
  date: string;
  cameraType: string;
  results: any[];
  status: 'success' | 'error';
  error?: string;
}

function AnalysisPageContent() {
  const searchParams = useSearchParams();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(searchParams.get('date') || '');
  const [selectedCameraType, setSelectedCameraType] = useState<'ANALYTICS' | 'FIXED' | 'PTZ' | ''>('');
  const [selectedAnalysisTypes, setSelectedAnalysisTypes] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<ImageFile[]>([]);
  const [showImageSelector, setShowImageSelector] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showResults, setShowResults] = useState(false);
  const [loadingDates, setLoadingDates] = useState(true);
  const [dateError, setDateError] = useState<string | null>(null);
  const [allImages, setAllImages] = useState<ImageFile[]>([]);

  useEffect(() => {
    loadDates();
  }, []);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam && availableDates.includes(dateParam)) {
      setSelectedDate(dateParam);
    }
  }, [searchParams, availableDates]);

  useEffect(() => {
    if (selectedDate && !showImageSelector) {
      loadAllImages();
    }
  }, [selectedDate, selectedCameraType, showImageSelector]);

  const loadAllImages = async () => {
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedCameraType) {
        params.append('cameraType', selectedCameraType);
      }
      
      const response = await fetch(`/api/images/list?${params}`);
      const data = await response.json();
      
      if (data.success) {
        const allImgs = data.images || [];
        setAllImages(allImgs);
        setSelectedImages(allImgs); // Automatically select all
      }
    } catch (error) {
      console.error('Error loading all images:', error);
    }
  };

  const loadDates = async () => {
    setLoadingDates(true);
    setDateError(null);
    try {
      const response = await fetch('/api/images/list');
      const data = await response.json();
      
      if (data.success) {
        if (data.dates && data.dates.length > 0) {
          setAvailableDates(data.dates);
          if (!selectedDate) {
            setSelectedDate(data.dates[0]);
          }
        } else {
          setDateError('No dates found in GCP bucket. Please upload images first.');
        }
      } else {
        setDateError(data.error || data.message || 'Failed to load dates');
      }
    } catch (error) {
      console.error('Error loading dates:', error);
      setDateError('Failed to connect to server. Please check your connection and try again.');
    } finally {
      setLoadingDates(false);
    }
  };

  const handleAnalyze = async () => {
    const imagesToAnalyze = showImageSelector ? selectedImages : allImages;
    if (imagesToAnalyze.length === 0) {
      alert('No images available to analyze');
      return;
    }

    setAnalyzing(true);
    setProgress({ current: 0, total: imagesToAnalyze.length });
    setShowResults(false);
    setAnalysisResults([]);

    try {
      const imagePaths = imagesToAnalyze.map(img => img.path);
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          cameraType: selectedCameraType || undefined,
          imagePaths,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setAnalysisResults(data.results);
        setShowResults(true);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error analyzing images:', error);
      alert('Failed to analyze images. Please check console for details.');
    } finally {
      setAnalyzing(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleStreamAnalyze = async () => {
    const imagesToAnalyze = showImageSelector ? selectedImages : allImages;
    if (imagesToAnalyze.length === 0) {
      alert('No images available to analyze');
      return;
    }

    setAnalyzing(true);
    setProgress({ current: 0, total: imagesToAnalyze.length });
    setShowResults(false);
    setAnalysisResults([]);

    try {
      const imagePaths = imagesToAnalyze.map(img => img.path);
      
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          cameraType: selectedCameraType || undefined,
          imagePaths,
          analysisTypes: selectedAnalysisTypes.length > 0 ? selectedAnalysisTypes : undefined,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      const results: AnalysisResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setProgress({ current: data.current, total: data.total });
              } else if (data.type === 'image_processed') {
                results.push(data.result);
                setAnalysisResults([...results]);
              } else if (data.type === 'complete') {
                setShowResults(true);
                if (data.savedPath) {
                  console.log('Results saved to:', data.savedPath);
                }
              } else if (data.type === 'error') {
                alert(`Error: ${data.message}`);
                setAnalyzing(false);
                return;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in stream analysis:', error);
      alert('Failed to analyze images. Please check console for details.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full">
        {/* Header */}
        <div className="bg-black border-b border-gray-300 mb-8">
          <div className="w-full mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="p-2 hover:bg-gray-800 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-white">Image Analysis</h1>
                  <p className="text-white/70 text-sm">Analyze CCTV images with GPT-4o Vision</p>
                </div>
              </div>
              <Link
                href="/results"
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-all border border-gray-300 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Results
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full px-6 pb-8 bg-gray-50">
          {/* Filters Card */}
          <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h2 className="text-2xl font-bold text-black">Filters</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date
                </label>
                {loadingDates ? (
                  <div className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50 flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-gray-600">Loading dates from GCP...</span>
                  </div>
                ) : dateError ? (
                  <div className="w-full px-4 py-3 border-2 border-red-300 rounded-xl bg-red-50">
                    <p className="text-sm text-red-600 font-medium">{dateError}</p>
                    <button
                      onClick={loadDates}
                      className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white text-gray-800 font-medium shadow-sm hover:border-gray-400"
                  >
                    {availableDates.length === 0 ? (
                      <option value="">No dates available</option>
                    ) : (
                      availableDates.map((date) => (
                        <option key={date} value={date}>
                          {date}
                        </option>
                      ))
                    )}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  Camera Type
                </label>
                <select
                  value={selectedCameraType}
                  onChange={(e) => setSelectedCameraType(e.target.value as any)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white text-gray-800 font-medium shadow-sm hover:border-gray-400"
                >
                  <option value="">All Types</option>
                  <option value="ANALYTICS">ANALYTICS</option>
                  <option value="FIXED">FIXED</option>
                  <option value="PTZ">PTZ</option>
                </select>
              </div>
            </div>
            
            {/* Analysis Type Filter */}
            <div className="mt-6 pt-6 border-t border-gray-300">
              <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Analysis Types (Select which types to analyze)
              </label>
              <div className="flex flex-wrap gap-3">
                {ANALYSIS_PROMPTS.map((prompt) => (
                  <label
                    key={prompt.id}
                    className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-all bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAnalysisTypes.includes(prompt.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAnalysisTypes([...selectedAnalysisTypes, prompt.id]);
                        } else {
                          setSelectedAnalysisTypes(selectedAnalysisTypes.filter(id => id !== prompt.id));
                        }
                      }}
                      className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <span className="text-sm font-medium text-gray-800">{prompt.name}</span>
                  </label>
                ))}
                {selectedAnalysisTypes.length > 0 && (
                  <button
                    onClick={() => setSelectedAnalysisTypes([])}
                    className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-all border border-gray-300"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-3">
                {selectedAnalysisTypes.length === 0
                  ? 'All analysis types will be performed'
                  : `Selected: ${selectedAnalysisTypes.map(id => ANALYSIS_PROMPTS.find(p => p.id === id)?.name).join(', ')}`}
              </p>
            </div>
          </div>

          {/* Image Show Filter */}
          {selectedDate && (
            <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-2xl font-bold text-black">Images</h2>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showImageSelector}
                    onChange={(e) => {
                      setShowImageSelector(e.target.checked);
                      if (!e.target.checked) {
                        // If unchecked, automatically select all images
                        loadAllImages();
                      } else {
                        // If checked, clear selection to show selector
                        setSelectedImages([]);
                      }
                    }}
                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                  />
                  <span className="text-sm font-medium text-gray-800">Image show</span>
                </label>
              </div>
              {showImageSelector ? (
                <ImageSelector
                  selectedDate={selectedDate}
                  selectedCameraType={selectedCameraType || undefined}
                  onImagesSelected={setSelectedImages}
                />
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600">
                    All images for the selected date and camera type will be automatically analyzed ({allImages.length} images).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Analysis Controls */}
          <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <h2 className="text-2xl font-bold text-black">Analysis</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className={`w-3 h-3 rounded-full ${(showImageSelector ? selectedImages.length : allImages.length) > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="font-medium">
                    {showImageSelector 
                      ? `${selectedImages.length} image(s) selected`
                      : `${allImages.length} image(s) will be analyzed (all images)`}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || (showImageSelector ? selectedImages.length === 0 : allImages.length === 0)}
                  className="px-8 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Analyze Images
                    </>
                  )}
                </button>
                <button
                  onClick={handleStreamAnalyze}
                  disabled={analyzing || (showImageSelector ? selectedImages.length === 0 : allImages.length === 0)}
                  className="px-8 py-3 bg-white text-black rounded-lg font-semibold border border-gray-300 hover:bg-gray-100 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Streaming...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Stream Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {analyzing && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-between text-sm font-medium text-gray-700 mb-3">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-pulse text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Processing...
                  </span>
                  <span className="font-bold text-gray-900">{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="bg-black h-3 rounded-full transition-all duration-300 ease-out shadow-sm"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  >
                    <div className="h-full w-full bg-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Results */}
          {showResults && analysisResults.length > 0 && (
            <>
              <div className="mb-6">
                <AnalyticsDashboard results={analysisResults} />
              </div>
              <div>
                <AnalysisResults results={analysisResults} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white text-gray-700">
          Loading analysis page...
        </div>
      }
    >
      <AnalysisPageContent />
    </Suspense>
  );
}
