'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
  resultPath?: string;
  onImageDelete?: (imagePath: string) => void;
}

export default function MatchedImages({ images, showLocationDetails = false, showAnalysisDetails = false, resultPath, onImageDelete }: MatchedImagesProps) {
  const searchParams = useSearchParams();
  const [selectedImage, setSelectedImage] = useState<MatchedImage | null>(null);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<MatchedImage | null>(null);

  // Get resultPath from prop or URL as fallback
  const effectiveResultPath = resultPath || searchParams.get('path') || '';

  const handleDelete = async (image: MatchedImage, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowDeleteConfirm(image);
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    
    if (!effectiveResultPath) {
      alert('Result path is required to remove image record. Please refresh the page and try again.');
      setShowDeleteConfirm(null);
      return;
    }
    
    const imagePath = showDeleteConfirm.imagePath;
    setDeletingImage(imagePath);
    setShowDeleteConfirm(null);

    try {
      const response = await fetch(
        `/api/images/delete?imagePath=${encodeURIComponent(imagePath)}&resultPath=${encodeURIComponent(effectiveResultPath)}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (data.success) {
        // Call parent callback to remove image from list
        if (onImageDelete) {
          onImageDelete(imagePath);
        }
      } else {
        alert(`Failed to remove image record: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error removing image record:', error);
      alert('Failed to remove image record. Please try again.');
    } finally {
      setDeletingImage(null);
    }
  };

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
              className="border border-gray-300 rounded-lg overflow-hidden bg-white cursor-pointer hover:border-gray-500 hover:shadow-md transition-all relative"
              onClick={() => setSelectedImage(image)}
            >
              {image.url && (
                <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {/* Delete Button Overlay */}
                  <button
                    onClick={(e) => handleDelete(image, e)}
                    disabled={deletingImage === image.imagePath}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-lg z-10"
                    title="Delete image"
                  >
                    {deletingImage === image.imagePath ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(null)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Image</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove <strong>{showDeleteConfirm.filename}</strong> from this analysis result? The image will remain in storage, but this detection record will be removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deletingImage === showDeleteConfirm.imagePath}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
              >
                {deletingImage === showDeleteConfirm.imagePath ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
