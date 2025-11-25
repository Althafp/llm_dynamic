'use client';

import { useState } from 'react';

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

interface MatchedImagesProps {
  images: MatchedImage[];
  showLocationDetails?: boolean;
  showAnalysisDetails?: boolean;
}

export default function MatchedImages({ images, showLocationDetails = false, showAnalysisDetails = false }: MatchedImagesProps) {
  const [selectedImage, setSelectedImage] = useState<MatchedImage | null>(null);

  if (images.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-8 text-center">
        <p className="text-gray-600">No matched images found</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-300">
        <h3 className="text-lg font-semibold text-gray-800">Matched Images ({images.length})</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image, idx) => (
            <div
              key={idx}
              className="border border-gray-300 rounded-lg overflow-hidden bg-white cursor-pointer hover:border-gray-500 hover:shadow-md transition-all"
              onClick={() => setSelectedImage(image)}
            >
              {image.url && (
                <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="text-sm font-semibold text-gray-800 mb-2 truncate">{image.filename}</div>
                
                {/* Location Details */}
                {showLocationDetails && image.locationDetails && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Location Details</h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      {image.locationDetails.district && (
                        <div><span className="font-medium">District:</span> {image.locationDetails.district}</div>
                      )}
                      {image.locationDetails.mandal && (
                        <div><span className="font-medium">Mandal:</span> {image.locationDetails.mandal}</div>
                      )}
                      {image.locationDetails.locationName && (
                        <div><span className="font-medium">Location:</span> {image.locationDetails.locationName}</div>
                      )}
                      {image.locationDetails.ip && (
                        <div><span className="font-medium">Camera IP:</span> {image.locationDetails.ip}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Analysis Details */}
                {showAnalysisDetails && image.analysisDetail && (
                  <div className="mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">LLM Analysis</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-medium text-gray-700">Analysis Type:</span>{' '}
                        <span className="text-gray-600">{image.analysisDetail.promptName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">Match:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          image.analysisDetail.match 
                            ? 'bg-green-100 text-green-800 border border-green-300' 
                            : 'bg-gray-100 text-gray-800 border border-gray-300'
                        }`}>
                          {image.analysisDetail.match ? 'Yes' : 'No'}
                        </span>
                      </div>
                      {image.analysisDetail.count > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Count:</span>{' '}
                          <span className="text-gray-600">{image.analysisDetail.count}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">Description:</span>
                        <p className="text-gray-600 mt-1">{image.analysisDetail.description}</p>
                      </div>
                      {image.analysisDetail.details && (
                        <div>
                          <span className="font-medium text-gray-700">Details:</span>
                          <p className="text-gray-600 mt-1">{image.analysisDetail.details}</p>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">Confidence:</span>{' '}
                        <span className="text-gray-600 capitalize">{image.analysisDetail.confidence}</span>
                      </div>
                      {image.analysisDetail.additionalObservations && (
                        <div>
                          <span className="font-medium text-gray-700">Additional Observations:</span>
                          <p className="text-gray-600 mt-1 italic">{image.analysisDetail.additionalObservations}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-2">
                  {image.analysisTypes.length} match{image.analysisTypes.length !== 1 ? 'es' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-300 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">{selectedImage.filename}</h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-gray-600 hover:text-black"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {selectedImage.url && (
                <img
                  src={selectedImage.url}
                  alt={selectedImage.filename}
                  className="w-full h-auto rounded-lg mb-4"
                />
              )}
              {showLocationDetails && selectedImage.locationDetails && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Location Details</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedImage.locationDetails.district && (
                      <div><span className="font-medium text-gray-700">District:</span> {selectedImage.locationDetails.district}</div>
                    )}
                    {selectedImage.locationDetails.mandal && (
                      <div><span className="font-medium text-gray-700">Mandal:</span> {selectedImage.locationDetails.mandal}</div>
                    )}
                    {selectedImage.locationDetails.locationName && (
                      <div className="col-span-2"><span className="font-medium text-gray-700">Location:</span> {selectedImage.locationDetails.locationName}</div>
                    )}
                    {selectedImage.locationDetails.ip && (
                      <div><span className="font-medium text-gray-700">Camera IP:</span> {selectedImage.locationDetails.ip}</div>
                    )}
                  </div>
                </div>
              )}
              {showAnalysisDetails && selectedImage.analysisDetail && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">LLM Analysis</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Analysis Type:</span>{' '}
                      <span className="text-gray-600">{selectedImage.analysisDetail.promptName}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Match:</span>{' '}
                      <span className={selectedImage.analysisDetail.match ? 'text-green-600' : 'text-gray-600'}>
                        {selectedImage.analysisDetail.match ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {selectedImage.analysisDetail.count > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Count:</span>{' '}
                        <span className="text-gray-600">{selectedImage.analysisDetail.count}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-700">Description:</span>
                      <p className="text-gray-600 mt-1">{selectedImage.analysisDetail.description}</p>
                    </div>
                    {selectedImage.analysisDetail.details && (
                      <div>
                        <span className="font-medium text-gray-700">Details:</span>
                        <p className="text-gray-600 mt-1">{selectedImage.analysisDetail.details}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-700">Confidence:</span>{' '}
                      <span className="text-gray-600 capitalize">{selectedImage.analysisDetail.confidence}</span>
                    </div>
                    {selectedImage.analysisDetail.additionalObservations && (
                      <div>
                        <span className="font-medium text-gray-700">Additional Observations:</span>
                        <p className="text-gray-600 mt-1 italic">{selectedImage.analysisDetail.additionalObservations}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-4">
                <h4 className="font-semibold text-gray-800 mb-2">Matched Analysis Types:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedImage.analysisTypes.map((type, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm border border-gray-300"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
