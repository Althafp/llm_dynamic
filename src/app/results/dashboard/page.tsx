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

  const downloadAsHTML = async () => {
    if (matchedImages.length === 0) return;

    const analysisTypeName = ANALYSIS_PROMPTS.find(p => p.id === selectedAnalysisType)?.name || 'Unknown';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    
    // Get public URLs for images (since bucket is public)
    const BUCKET_NAME = 'llm_dynamic';
    const imagesWithUrls = matchedImages.map((image) => {
      let publicUrl = '';
      
      // If we have a signed URL, extract the public URL part (remove query params)
      if (image.url && image.url.includes('storage.googleapis.com')) {
        try {
          const urlObj = new URL(image.url);
          publicUrl = `${urlObj.origin}${urlObj.pathname}`;
        } catch (e) {
          // If URL parsing fails, construct from imagePath
          publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${image.imagePath}`;
        }
      } else if (image.imagePath) {
        // Construct public URL from imagePath
        publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${image.imagePath}`;
      } else if (image.url) {
        // Fallback to original URL
        publicUrl = image.url;
      }
      
      return { ...image, publicUrl };
    });

    // Prepare map markers data
    const mapMarkers = imagesWithUrls
      .filter(img => img.locationDetails && locationMapping[img.ip || ''])
      .map(img => {
        const loc = locationMapping[img.ip || ''];
        return {
          lat: loc.latitude,
          lng: loc.longitude,
          name: loc.locationName || img.filename,
          ip: img.ip,
          filename: img.filename,
          analysisTypes: img.analysisTypes,
        };
      });

    // Calculate map center and bounds
    const mapCenter = mapMarkers.length > 0
      ? {
          lat: mapMarkers.reduce((sum, m) => sum + m.lat, 0) / mapMarkers.length,
          lng: mapMarkers.reduce((sum, m) => sum + m.lng, 0) / mapMarkers.length,
        }
      : { lat: 16.5, lng: 80.3 };

    // Generate HTML content
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analysis Results - ${analysisTypeName}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #e5e5e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 28px;
            color: #1a1a1a;
            margin-bottom: 10px;
        }
        .header .meta {
            color: #666;
            font-size: 14px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            border: 1px solid #e5e5e5;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #666;
            font-size: 14px;
        }
        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 25px;
            margin-top: 30px;
        }
        .image-card {
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            overflow: hidden;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .image-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
        }
        .image-card .content {
            padding: 15px;
        }
        .image-card .filename {
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 12px;
            font-size: 14px;
            word-break: break-all;
        }
        .location-details {
            background: #f9f9f9;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            border: 1px solid #e5e5e5;
        }
        .location-details h4 {
            font-size: 12px;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 8px;
            font-weight: 600;
        }
        .location-details .detail-item {
            font-size: 13px;
            color: #333;
            margin-bottom: 4px;
        }
        .location-details .detail-item strong {
            color: #1a1a1a;
        }
        .analysis-details {
            background: #f0f7ff;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #cce5ff;
        }
        .analysis-details h4 {
            font-size: 12px;
            text-transform: uppercase;
            color: #0066cc;
            margin-bottom: 8px;
            font-weight: 600;
        }
        .analysis-details .detail-item {
            font-size: 13px;
            color: #333;
            margin-bottom: 6px;
        }
        .analysis-details .detail-item strong {
            color: #1a1a1a;
        }
        .match-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 8px;
        }
        .match-badge.yes {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .match-badge.no {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .map-section {
            margin-top: 40px;
            margin-bottom: 30px;
        }
        .map-section h2 {
            font-size: 24px;
            color: #1a1a1a;
            margin-bottom: 15px;
        }
        .map-container {
            width: 100%;
            height: 600px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #e5e5e5;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .map-info {
            background: #f9f9f9;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            border: 1px solid #e5e5e5;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Analysis Results - ${analysisTypeName}</h1>
            <div class="meta">
                Date: ${resultMetadata.date || 'N/A'} | 
                Camera Type: ${resultMetadata.cameraType || 'N/A'} | 
                Generated: ${new Date().toLocaleString()}
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${totalAnalyzedImages}</div>
                <div class="stat-label">Total Matched Locations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${matchedImages.length}</div>
                <div class="stat-label">Total Matched Images</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${analysisTypeName}</div>
                <div class="stat-label">Analysis Type</div>
            </div>
        </div>
        
        ${mapMarkers.length > 0 ? `
        <div class="map-section">
            <h2>📍 Map View - Matched Locations</h2>
            <div class="map-info">
                Showing ${mapMarkers.length} location${mapMarkers.length !== 1 ? 's' : ''} on the map
            </div>
            <div id="map" class="map-container"></div>
        </div>
        ` : ''}
        
        <div class="images-grid">
            ${imagesWithUrls.map((image, idx) => `
            <div class="image-card">
                ${image.publicUrl ? `<img src="${image.publicUrl}" alt="${image.filename}" onerror="this.style.display='none';" />` : ''}
                <div class="content">
                    <div class="filename">${image.filename}</div>
                    
                    ${image.locationDetails ? `
                    <div class="location-details">
                        <h4>Location Details</h4>
                        ${image.locationDetails.district ? `<div class="detail-item"><strong>District:</strong> ${image.locationDetails.district}</div>` : ''}
                        ${image.locationDetails.mandal ? `<div class="detail-item"><strong>Mandal:</strong> ${image.locationDetails.mandal}</div>` : ''}
                        ${image.locationDetails.locationName ? `<div class="detail-item"><strong>Location:</strong> ${image.locationDetails.locationName}</div>` : ''}
                        ${image.locationDetails.ip ? `<div class="detail-item"><strong>Camera IP:</strong> ${image.locationDetails.ip}</div>` : ''}
                    </div>
                    ` : ''}
                    
                    ${image.analysisDetail ? `
                    <div class="analysis-details">
                        <h4>LLM Analysis</h4>
                        <div class="detail-item">
                            <strong>Analysis Type:</strong> ${image.analysisDetail.promptName}
                        </div>
                        <div class="detail-item">
                            <strong>Match:</strong> 
                            <span class="match-badge ${image.analysisDetail.match ? 'yes' : 'no'}">
                                ${image.analysisDetail.match ? 'Yes' : 'No'}
                            </span>
                        </div>
                        ${image.analysisDetail.count > 0 ? `
                        <div class="detail-item">
                            <strong>Count:</strong> ${image.analysisDetail.count}
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <strong>Description:</strong> ${image.analysisDetail.description}
                        </div>
                        ${image.analysisDetail.details ? `
                        <div class="detail-item">
                            <strong>Details:</strong> ${image.analysisDetail.details}
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <strong>Confidence:</strong> ${image.analysisDetail.confidence}
                        </div>
                        ${image.analysisDetail.additionalObservations ? `
                        <div class="detail-item">
                            <strong>Additional Observations:</strong> ${image.analysisDetail.additionalObservations}
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
            `).join('')}
        </div>
        
        <div class="footer">
            Generated on ${new Date().toLocaleString()} | Total: ${matchedImages.length} images
        </div>
    </div>
    
    ${mapMarkers.length > 0 ? `
    <script>
        // Initialize map
        const map = L.map('map').setView([${mapCenter.lat}, ${mapCenter.lng}], ${mapMarkers.length > 1 ? 11 : 10});
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
        
        // Add markers
        const markers = ${JSON.stringify(mapMarkers)};
        const bounds = [];
        
        markers.forEach((marker, index) => {
            const markerIcon = L.divIcon({
                className: 'custom-marker',
                html: \`<div style="background: #DC2626; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>\`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            const leafletMarker = L.marker([marker.lat, marker.lng], { icon: markerIcon })
                .addTo(map)
                .bindPopup(\`
                    <div style="min-width: 200px;">
                        <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">\${marker.name}</h3>
                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-family: monospace;">\${marker.filename}</p>
                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;"><strong>IP:</strong> \${marker.ip}</p>
                        <div style="margin-top: 8px;">
                            <strong style="font-size: 12px; color: #1a1a1a;">Analysis Types:</strong>
                            <div style="margin-top: 4px;">
                                \${marker.analysisTypes.map(type => 
                                    \`<span style="display: inline-block; padding: 2px 8px; background: #3b82f6; color: white; border-radius: 4px; font-size: 11px; margin: 2px;">\${type}</span>\`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                \`);
            
            bounds.push([marker.lat, marker.lng]);
        });
        
        // Fit map to show all markers
        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    </script>
    ` : ''}
</body>
</html>`;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-results-${analysisTypeName.replace(/\s+/g, '-')}-${timestamp}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-black">Filtered Results</h3>
                    {matchedImages.length > 0 && (
                      <button
                        onClick={downloadAsHTML}
                        className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-all border border-gray-600 flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download as HTML
                      </button>
                    )}
                  </div>
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

