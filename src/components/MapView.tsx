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
  height: '600px',
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
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-300">
        <h3 className="text-lg font-semibold text-gray-800">Map View - Matched Locations</h3>
        <p className="text-sm text-gray-600 mt-1">{markers.length} unique location(s) found</p>
      </div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={markers.length > 0 ? 11 : 10}
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
            <div className="p-2 max-w-xs">
              <h4 className="font-semibold text-gray-800 mb-1">
                {selectedMarker.locationName || selectedMarker.filename}
              </h4>
              <p className="text-xs text-gray-600 mb-2">{selectedMarker.filename}</p>
              <p className="text-xs text-gray-600 mb-2">IP: {selectedMarker.ip}</p>
              <div className="text-xs text-gray-600 mb-2">
                <strong>Analysis Types:</strong> {selectedMarker.analysisTypes.join(', ')}
              </div>
              {selectedMarker.url && (
                <img
                  src={selectedMarker.url}
                  alt={selectedMarker.filename}
                  className="mt-2 w-full h-32 object-cover rounded border border-gray-200"
                />
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

