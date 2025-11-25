'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AnalysisResults from '@/components/AnalysisResults';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import MatchedImages from '@/components/MatchedImages';
import MapView from '@/components/MapView';
import { extractIPFromFilename } from '@/lib/image-utils';
import { ANALYSIS_PROMPTS } from '@/lib/analysis-prompts';

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

export default function ResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<PreviousResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [filteredResults, setFilteredResults] = useState<PreviousResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<string>('');
  const [showImages, setShowImages] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [matchedImages, setMatchedImages] = useState<MatchedImage[]>([]);
  const [locationMapping, setLocationMapping] = useState<Record<string, { latitude: number; longitude: number; locationName: string; district?: string; mandal?: string; cameraType?: string }>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    loadPreviousResults();
    loadLocationMapping();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      const filtered = results.filter(r => r.date === selectedDate);
      setFilteredResults(filtered);
    } else {
      setFilteredResults(results);
    }
  }, [selectedDate, results]);

  // Remove auto-filter on change - only filter on submit

  const loadLocationMapping = async () => {
    try {
      const response = await fetch('/api/locations/mapping');
      const data = await response.json();
      if (data.success && data.mapping) {
        const mapping: Record<string, { latitude: number; longitude: number; locationName: string; district?: string; mandal?: string; cameraType?: string }> = {};
        Object.values(data.mapping).forEach((loc: any) => {
          mapping[loc.ip] = {
            latitude: loc.latitude,
            longitude: loc.longitude,
            locationName: loc.locationName,
            district: loc.district,
            mandal: loc.mandal,
            cameraType: loc.cameraType,
          };
        });
        setLocationMapping(mapping);
      }
    } catch (error) {
      console.error('Error loading location mapping:', error);
    }
  };

  const loadPreviousResults = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/results/list');
      const data = await response.json();
      if (data.success) {
        const allResults = (data.results || []) as PreviousResult[];
        setResults(allResults);
        
        // Extract unique dates
        const dateSet = new Set<string>(
          allResults
            .map((r) => r.date)
            .filter((date): date is string => Boolean(date))
        );
        const dates = Array.from(dateSet)
          .sort()
          .reverse();
        setAvailableDates(dates);
        
        if (dates.length > 0 && !selectedDate) {
          setSelectedDate(dates[0]);
        }
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
        setSelectedResult(data.result.results);
        setShowDetails(true);
        // Reset filters when loading new result
        setSelectedAnalysisType('');
        setSubmitted(false);
        setMatchedImages([]);
      }
    } catch (error) {
      console.error('Error loading result:', error);
      alert('Failed to load previous result');
    }
  };

  const totalAnalyzedImages = useMemo(
    () => selectedResult.filter(result => result.status === 'success').length,
    [selectedResult]
  );

  const matchedUniqueLocations = useMemo(
    () => new Set(matchedImages.map(img => img.ip).filter(Boolean)).size,
    [matchedImages]
  );

  const matchedLocationsWithDetails = useMemo(
    () => matchedImages.filter(img => img.ip && locationMapping[img.ip]).length,
    [matchedImages, locationMapping]
  );

  const handleSubmit = async () => {
    if (!selectedResult || selectedResult.length === 0) return;
    if (!selectedAnalysisType) {
      alert('Please select an analysis type');
      return;
    }

    setLoadingImages(true);
    setSubmitted(true);
    setMatchedImages([]); // Clear previous results
    try {
      const matched: MatchedImage[] = [];

      for (const result of selectedResult) {
        if (result.status !== 'success') continue;

        // Filter by selected analysis type (only one) - must match
        const filteredResult = result.results.find(r => r.promptId === selectedAnalysisType && r.match);

        if (!filteredResult) continue; // Only include if it matches the selected analysis type

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
      console.error('Error filtering matched images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
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
    <div className="min-h-screen bg-white">
      <div className="w-full">
        {/* Header */}
        <div className="bg-black border-b border-gray-300 mb-8">
          <div className="w-full mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/')}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-white">Previous Analysis Results</h1>
                  <p className="text-white/70 text-sm">View and analyze historical image analysis results</p>
                </div>
              </div>
              <Link
                href="/analysis"
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-all border border-gray-300 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                New Analysis
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full px-6 pb-8 bg-gray-50">
          {/* Date Filter */}
          <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Filter by Date:
                </label>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all bg-white text-gray-800 font-medium shadow-sm hover:border-gray-400"
                >
                  <option value="">All Dates</option>
                  {availableDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-gray-600">
                  {filteredResults.length} result(s) found
                </span>
              </div>
              <button
                onClick={loadPreviousResults}
                className="px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2 border border-gray-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-gray-300 rounded-lg p-12 text-center shadow-sm">
              <svg className="animate-spin h-8 w-8 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 mt-4">Loading previous results...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="bg-white border border-gray-300 rounded-lg p-12 text-center shadow-sm">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 text-lg">No results found for the selected date</p>
            </div>
          ) : (
            <>
              {/* Results List */}
              <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 shadow-sm">
                <h2 className="text-2xl font-bold text-black mb-4">
                  {selectedDate ? `Results for ${selectedDate}` : 'All Results'}
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-300 rounded-lg p-4 hover:border-gray-500 hover:bg-gray-50 transition-all bg-white"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-black">
                              {formatTimestamp(result.timestamp)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(result.created).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex gap-4 text-sm text-gray-600 mb-2">
                            <span>Date: <span className="font-medium text-black">{result.date}</span></span>
                            <span>Type: <span className="font-medium text-black">{result.cameraType}</span></span>
                          </div>
                          <div className="flex gap-3 text-sm">
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-medium border border-gray-300">
                              Total: {result.totalImages}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-medium border border-gray-300">
                              Success: {result.successful}
                            </span>
                            {result.failed > 0 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded font-medium border border-gray-300">
                                Failed: {result.failed}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => loadResult(result.path)}
                          className="ml-4 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all font-medium text-sm shadow-sm border border-gray-600"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Result Details */}
              {showDetails && selectedResult.length > 0 && (
                <>
                  {/* Analysis Type Filters */}
                  <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-black mb-4">Filter by Analysis Type</h3>
                    
                    {/* Analysis Type Selection - Radio Buttons */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Select Analysis Type (Select One):</label>
                      <div className="space-y-2">
                        {ANALYSIS_PROMPTS.map((prompt) => (
                          <label
                            key={prompt.id}
                            className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-all"
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
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showImages}
                            onChange={(e) => setShowImages(e.target.checked)}
                            className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                          />
                          <span className="text-sm text-gray-800">Image show</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showMap}
                            onChange={(e) => setShowMap(e.target.checked)}
                            className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                          />
                          <span className="text-sm text-gray-800">Show map</span>
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
                  {submitted && (
                    <>
                      {/* Dashboard Stats */}
                      {!loadingImages && (
                        <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6 shadow-sm">
                          <h3 className="text-xl font-bold text-black mb-4">Analysis Dashboard</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                              <div className="text-2xl font-bold text-black mb-1">
                                {totalAnalyzedImages}
                              </div>
                              <div className="text-sm text-gray-600">Total Locations (Analyzed Images)</div>
                            </div>
                            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                              <div className="text-2xl font-bold text-black mb-1">
                                {matchedLocationsWithDetails}
                              </div>
                              <div className="text-sm text-gray-600">Matched Locations</div>
                            </div>
                            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                              <div className="text-2xl font-bold text-black mb-1">
                                {matchedImages.length}
                              </div>
                              <div className="text-sm text-gray-600">Total Matched Images</div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-300">
                            <div className="text-sm text-gray-600">
                              <span className="font-medium text-black">Selected Analysis Type:</span>{' '}
                              {ANALYSIS_PROMPTS.find(p => p.id === selectedAnalysisType)?.name || 'N/A'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Matched Images */}
                      {showImages && (
                        <>
                          {loadingImages ? (
                            <div className="bg-white border border-gray-300 rounded-lg p-8 text-center mb-6 shadow-sm">
                              <svg className="animate-spin h-6 w-6 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <p className="text-gray-600 mt-2">Loading matched images...</p>
                            </div>
                          ) : matchedImages.length > 0 ? (
                            <div className="mb-6">
                              <MatchedImages 
                                images={matchedImages} 
                                showLocationDetails={true}
                                showAnalysisDetails={true}
                              />
                            </div>
                          ) : (
                            <div className="bg-white border border-gray-300 rounded-lg p-8 text-center mb-6 shadow-sm">
                              <p className="text-gray-600">No matched images found for the selected analysis type.</p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Map View */}
                      {showMap && !loadingImages && matchedImages.length > 0 && (
                        <div className="mb-6">
                          <MapView matchedImages={matchedImages} locationMapping={locationMapping} />
                        </div>
                      )}
                    </>
                  )}

                  {/* Analytics Dashboard */}
                  <div className="mb-6">
                    <AnalyticsDashboard results={selectedResult} />
                  </div>

                  {/* Detailed Results */}
                  <div>
                    <AnalysisResults results={selectedResult} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
