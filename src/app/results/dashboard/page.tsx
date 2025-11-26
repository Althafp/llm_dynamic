'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import MapView from '@/components/MapView';
import MatchedImages from '@/components/MatchedImages';
import { ANALYSIS_PROMPTS } from '@/lib/analysis-prompts';
import { extractIPFromFilename } from '@/lib/image-utils';

interface AnalysisResult {
  filename: string;
  imagePath: string;
  date: string;
  cameraType: string;
  results: any[];
  status: 'success' | 'error';
  error?: string;
}

interface LocationDetails {
  district?: string;
  mandal?: string;
  locationName?: string;
  ip?: string;
  cameraType?: string;
}

interface AnalysisDetail {
  promptName: string;
  match: boolean;
  count: number;
  description: string;
  details: string;
  confidence: string;
  additionalObservations?: string;
}

interface MatchedImage {
  filename: string;
  imagePath: string;
  url?: string;
  ip?: string;
  analysisTypes: string[];
  locationDetails?: LocationDetails;
  analysisDetail?: AnalysisDetail;
}

function ResultsDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult[]>([]);
  const [resultMetadata, setResultMetadata] = useState<{
    timestamp?: string;
    date?: string;
    cameraType?: string;
    totalImages?: number;
  }>({});
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<string>('');
  const [showImages, setShowImages] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [matchedImages, setMatchedImages] = useState<MatchedImage[]>([]);
  const [locationMapping, setLocationMapping] = useState<Record<string, any>>({});

  useEffect(() => {
    const path = searchParams.get('path');
    if (path) {
      loadResult(path);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const loadResult = async (path: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/results/get?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      if (data.success && data.result) {
        setSelectedResult(data.result.results);
        setResultMetadata({
          timestamp: data.result.timestamp,
          date: data.result.metadata?.date,
          cameraType: data.result.metadata?.cameraType,
          totalImages: data.result.metadata?.totalImages,
        });
      } else {
        console.error('Failed to load result:', data.error);
      }
    } catch (error) {
      console.error('Error loading result:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load location mapping
  useEffect(() => {
    const loadLocationMapping = async () => {
      try {
        const response = await fetch('/api/locations/mapping');
        const data = await response.json();
        if (data.success) {
          setLocationMapping(data.mapping || {});
        }
      } catch (error) {
        console.error('Error loading location mapping:', error);
      }
    };
    loadLocationMapping();
  }, []);

  const handleSubmit = async () => {
    if (!selectedAnalysisType || !selectedResult.length) return;
    
    setLoadingImages(true);
    setSubmitted(true);
    
    try {
      const matched: MatchedImage[] = [];
      
      for (const result of selectedResult) {
        // Find the result that matches the selected analysis type
        const filteredResult = result.results.find(
          (r: any) => r.promptId === selectedAnalysisType
        );
        
        if (!filteredResult || !filteredResult.match) continue;
        
        const ip = extractIPFromFilename(result.filename);
        let imageUrl: string | undefined;
        
        try {
          const urlResponse = await fetch(`/api/images/url?path=${encodeURIComponent(result.imagePath)}`);
          const urlData = await urlResponse.json();
          if (urlData.success) {
            imageUrl = urlData.url;
          }
        } catch (error) {
          console.error('Error getting image URL:', error);
        }
        
        // Get location details if IP exists
        let locationDetails: LocationDetails | undefined;
        if (ip && locationMapping[ip]) {
          const loc = locationMapping[ip];
          locationDetails = {
            district: loc.district,
            mandal: loc.mandal,
            locationName: loc.locationName,
            ip: ip,
            cameraType: loc.cameraType,
          };
        }
        
        // Get analysis detail
        const analysisDetail: AnalysisDetail = {
          promptName: filteredResult.promptName,
          match: filteredResult.match,
          count: filteredResult.count,
          description: filteredResult.description,
          details: filteredResult.details,
          confidence: filteredResult.confidence,
          additionalObservations: filteredResult.additionalObservations,
        };
        
        matched.push({
          filename: result.filename,
          imagePath: result.imagePath,
          url: imageUrl,
          ip: ip || undefined,
          analysisTypes: [filteredResult.promptName],
          locationDetails,
          analysisDetail,
        });
      }
      
      setMatchedImages(matched);
    } catch (error) {
      console.error('Error processing matched images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const totalAnalyzedImages = useMemo(() => {
    if (!selectedResult.length) return 0;
    return selectedResult.filter(r => {
      return r.results.some((res: any) => res.promptId === selectedAnalysisType && res.match);
    }).length;
  }, [selectedResult, selectedAnalysisType]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/results"
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-black">Analysis Dashboard</h1>
              {resultMetadata.timestamp && (
                <p className="text-sm text-gray-600 mt-1">
                  {resultMetadata.date} • {resultMetadata.cameraType} • {resultMetadata.totalImages} images
                </p>
              )}
            </div>
          </div>
          <Link
            href="/results"
            className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-all border border-gray-600 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Results
          </Link>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        ) : selectedResult.length === 0 ? (
          <div className="bg-white border border-gray-300 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-600 text-lg mb-2">No result data available</p>
            <p className="text-gray-500 text-sm">Please select a result from the results page</p>
            <Link
              href="/results"
              className="inline-block mt-4 px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-all"
            >
              Go to Results
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Analytics Dashboard */}
            <AnalyticsDashboard results={selectedResult} />
            
            {/* Filter by Analysis Type Section */}
            <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-black mb-4">Filter by Analysis Type</h3>
              
              {/* Analysis Type Selection - Radio Buttons */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Analysis Type (Select One):</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ANALYSIS_PROMPTS.map((prompt) => (
                    <label
                      key={prompt.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedAnalysisType === prompt.id
                          ? 'border-black bg-gray-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="analysisType"
                        value={prompt.id}
                        checked={selectedAnalysisType === prompt.id}
                        onChange={() => setSelectedAnalysisType(prompt.id)}
                        className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                      />
                      <span className="text-sm font-medium text-gray-800">{prompt.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Display Options */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Display Options:</label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showImages}
                      onChange={(e) => setShowImages(e.target.checked)}
                      className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <span className="text-sm text-gray-800">Show Images</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showMap}
                      onChange={(e) => setShowMap(e.target.checked)}
                      className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                    />
                    <span className="text-sm text-gray-800">Show Map</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!selectedAnalysisType || loadingImages}
                className="w-full px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-sm border border-gray-600"
              >
                {loadingImages ? 'Loading...' : 'Submit'}
              </button>
            </div>

            {/* Results - Only show after submit */}
            {submitted && !loadingImages && (
              <>
                {/* Dashboard Stats */}
                <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
                  <h3 className="text-xl font-bold text-black mb-4">Filtered Results</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                      <div className="text-2xl font-bold text-black mb-1">
                        {totalAnalyzedImages}
                      </div>
                      <div className="text-sm text-gray-600">Total Matched Locations</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                      <div className="text-2xl font-bold text-black mb-1">
                        {matchedImages.length}
                      </div>
                      <div className="text-sm text-gray-600">Total Matched Images</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                      <div className="text-2xl font-bold text-black mb-1">
                        {ANALYSIS_PROMPTS.find(p => p.id === selectedAnalysisType)?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Selected Analysis Type</div>
                    </div>
                  </div>
                </div>

                {/* Matched Images */}
                {showImages && matchedImages.length > 0 && (
                  <MatchedImages 
                    images={matchedImages} 
                    showLocationDetails={true}
                    showAnalysisDetails={true}
                  />
                )}

                {/* Map View */}
                {showMap && matchedImages.length > 0 && (
                  <MapView 
                    matchedImages={matchedImages}
                    locationMapping={locationMapping}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResultsDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      }
    >
      <ResultsDashboardContent />
    </Suspense>
  );
}

