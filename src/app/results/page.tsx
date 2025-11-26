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
    <div className="min-h-screen bg-gray-50">
      <div className="w-full h-full">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-300 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Previous Analysis Results</h1>
              <p className="text-sm text-gray-600 mt-1">View and analyze historical image analysis results</p>
            </div>
            <Link
              href="/analysis"
              className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-all border border-gray-600 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              New Analysis
            </Link>
          </div>
        </div>

        {/* Main Content - Split Layout */}
        <div className="flex h-[calc(100vh-120px)] overflow-hidden">
          {/* Left Side - Results List */}
          <div className="w-1/2 border-r border-gray-300 bg-white overflow-y-auto">
            {/* Date Filter */}
            <div className="p-4 border-b border-gray-300 bg-gray-50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 whitespace-nowrap">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Filter:
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all bg-white text-gray-800 font-medium shadow-sm hover:border-gray-400"
                  >
                    <option value="">All Dates</option>
                    {availableDates.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={loadPreviousResults}
                  className="px-3 py-2 text-sm font-medium text-gray-800 bg-white rounded-lg hover:bg-gray-100 transition-all flex items-center gap-2 border border-gray-300"
                  title="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {filteredResults.length} result(s) found
              </div>
            </div>

            {/* Results List */}
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600">No results found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 transition-all ${
                        showDetails && selectedResult.length > 0 && selectedResult[0]?.imagePath?.includes(result.path.split('/').pop() || '')
                          ? 'border-black bg-gray-50'
                          : 'border-gray-300 hover:border-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-black text-sm">
                          {formatTimestamp(result.timestamp)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(result.created).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600 mb-2">
                        <span>Date: <span className="font-medium text-black">{result.date}</span></span>
                        <span>Type: <span className="font-medium text-black">{result.cameraType}</span></span>
                      </div>
                      <div className="flex gap-2 text-xs mb-3">
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
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadResult(result.path);
                          }}
                          className="flex-1 px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all font-medium text-xs shadow-sm border border-gray-600 flex items-center justify-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Details
                        </button>
                        <Link
                          href={`/results/dashboard?path=${encodeURIComponent(result.path)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all font-medium text-xs shadow-sm border border-gray-500 flex items-center justify-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Dashboard
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Filters and Details */}
          <div className="w-1/2 bg-gray-50 overflow-y-auto">
            {showDetails && selectedResult.length > 0 ? (
              <div className="p-6 space-y-6">

                {/* Analysis Type Filters */}
                <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
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
                      <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-black mb-4">Analysis Dashboard</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                            <div className="text-2xl font-bold text-black mb-1">
                              {totalAnalyzedImages}
                            </div>
                            <div className="text-sm text-gray-600">Total Locations</div>
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
                            <div className="text-sm text-gray-600">Matched Images</div>
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
                          <div className="bg-white border border-gray-300 rounded-lg p-8 text-center shadow-sm">
                            <svg className="animate-spin h-6 w-6 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-gray-600 mt-2">Loading matched images...</p>
                          </div>
                        ) : matchedImages.length > 0 ? (
                          <div>
                            <MatchedImages 
                              images={matchedImages} 
                              showLocationDetails={true}
                              showAnalysisDetails={true}
                            />
                          </div>
                        ) : (
                          <div className="bg-white border border-gray-300 rounded-lg p-8 text-center shadow-sm">
                            <p className="text-gray-600">No matched images found for the selected analysis type.</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Map View */}
                    {showMap && !loadingImages && matchedImages.length > 0 && (
                      <div>
                        <MapView matchedImages={matchedImages} locationMapping={locationMapping} />
                      </div>
                    )}
                  </>
                )}

                {/* Analytics Dashboard */}
                <div>
                  <AnalyticsDashboard results={selectedResult} />
                </div>

                {/* Detailed Results */}
                <div>
                  <AnalysisResults results={selectedResult} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center p-12">
                <div>
                  <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-lg font-medium">Select a result to view details</p>
                  <p className="text-gray-400 text-sm mt-2">Click "View Details" on any result from the left panel</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
