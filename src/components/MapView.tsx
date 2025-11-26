'use client';

import React, { useMemo, useState } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { extractIPFromFilename } from '@/lib/image-utils';

interface MatchedImage {
  filename: string;
  imagePath: string;
  url?: string;
  ip?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  analysisTypes: string[];
}

interface MarkerData extends MatchedImage {
  ip: string;
  latitude: number;
  longitude: number;
}

interface MapViewProps {
  matchedImages: MatchedImage[];
  locationMapping: Record<string, { latitude: number; longitude: number; locationName: string; district?: string; mandal?: string; cameraType?: string }>;
}

const containerStyle = {
  width: '100%',
  height: '700px',
};

const defaultCenter = {
  lat: 16.5,
  lng: 80.3,
};

export default function MapView({ matchedImages, locationMapping }: MapViewProps) {
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Use useLoadScript hook instead of LoadScript component to avoid duplicate loading
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
  });

  // Process images to get coordinates
  const markers = useMemo<MarkerData[]>(() => {
    return matchedImages
      .map<MarkerData | null>((image) => {
        const ip = image.ip || extractIPFromFilename(image.filename);
        if (!ip) return null;

        const location = locationMapping[ip];
        if (!location || !location.latitude || !location.longitude) return null;

        return {
          ...image,
          ip,
          latitude: location.latitude,
          longitude: location.longitude,
          locationName: location.locationName,
        };
      })
      .filter((m): m is MarkerData => m !== null);
  }, [matchedImages, locationMapping]);

  const mapCenter = useMemo(() => {
    if (markers.length === 0) return defaultCenter;
    
    const avgLat = markers.reduce((sum, m) => sum + m.latitude, 0) / markers.length;
    const avgLng = markers.reduce((sum, m) => sum + m.longitude, 0) / markers.length;
    
    return { lat: avgLat, lng: avgLng };
  }, [markers]);

  if (!apiKey) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-600">Google Maps API key not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-8 text-center">
        <p className="text-red-600">Error loading Google Maps: {loadError.message}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-8 text-center">
        <div className="inline-flex items-center justify-center gap-3">
          <svg className="animate-spin h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Loading Google Maps...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-lg">
      <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Map View - Matched Locations
            </h3>
            <p className="text-sm text-gray-600 mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
                {markers.length} location{markers.length !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-500">•</span>
              <span>{matchedImages.length} image{matchedImages.length !== 1 ? 's' : ''} matched</span>
            </p>
          </div>
        </div>
      </div>
      <div className="relative">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={markers.length > 0 ? 11 : 10}
          options={{
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }],
              },
            ],
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          }}
        >
          {markers.map((marker, idx) => (
            <Marker
              key={idx}
              position={{ lat: marker.latitude, lng: marker.longitude }}
              onClick={() => setSelectedMarker(marker)}
              title={marker.locationName || marker.filename}
            />
          ))}
          
          {selectedMarker && (
            <InfoWindow
              position={{
                lat: selectedMarker.latitude!,
                lng: selectedMarker.longitude!,
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-3 max-w-sm">
                <div className="mb-3">
                  <h4 className="font-bold text-gray-900 text-base mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {selectedMarker.locationName || selectedMarker.filename}
                  </h4>
                  <p className="text-xs text-gray-600 mb-2 font-mono">{selectedMarker.filename}</p>
                </div>
                
                <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs text-gray-700 mb-1">
                    <span className="font-semibold">Camera IP:</span> {selectedMarker.ip}
                  </p>
                  <div className="mt-2">
                    <span className="text-xs font-semibold text-gray-700">Analysis Types:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedMarker.analysisTypes.map((type, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium border border-blue-300"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                {selectedMarker.url && (
                  <div className="mt-3">
                    <img
                      src={selectedMarker.url}
                      alt={selectedMarker.filename}
                      className="w-full h-40 object-cover rounded-lg border-2 border-gray-300 shadow-sm hover:shadow-md transition-shadow"
                    />
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

