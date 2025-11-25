'use client';

import { useState, useEffect } from 'react';

interface ImageFile {
  name: string;
  path: string;
  date: string;
  cameraType: 'ANALYTICS' | 'FIXED' | 'PTZ';
  url?: string;
}

interface ImageSelectorProps {
  onImagesSelected: (images: ImageFile[]) => void;
  selectedDate: string;
  selectedCameraType?: 'ANALYTICS' | 'FIXED' | 'PTZ';
}

export default function ImageSelector({
  onImagesSelected,
  selectedDate,
  selectedCameraType,
}: ImageSelectorProps) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedDate) {
      loadImages();
    }
  }, [selectedDate, selectedCameraType]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedCameraType) {
        params.append('cameraType', selectedCameraType);
      }
      
      const response = await fetch(`/api/images/list?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setImages(data.images || []);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = (path: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedImages(newSelected);
    
    const selected = images.filter(img => newSelected.has(img.path));
    onImagesSelected(selected);
  };

  const selectAll = () => {
    const allPaths = new Set(images.map(img => img.path));
    setSelectedImages(allPaths);
    onImagesSelected(images);
  };

  const clearSelection = () => {
    setSelectedImages(new Set());
    onImagesSelected([]);
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex items-center justify-center gap-3">
          <svg className="animate-spin h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600 font-medium">Loading images...</span>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex flex-col items-center gap-3">
          <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-600 font-medium">No images found for the selected date and camera type.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-semibold text-gray-800">
              {images.length} images found
            </span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-sm font-semibold text-gray-700">
            {selectedImages.size} selected
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-4 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-800 transition-all shadow-sm border border-gray-600"
          >
            Select All
          </button>
          <button
            onClick={clearSelection}
            className="px-4 py-2 text-sm font-semibold bg-white text-gray-800 rounded-lg hover:bg-gray-100 transition-all border border-gray-300"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {images.map((image) => (
          <div
            key={image.path}
            onClick={() => toggleImage(image.path)}
            className={`group relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all transform hover:scale-105 ${
              selectedImages.has(image.path)
                ? 'border-black ring-4 ring-gray-300 shadow-lg scale-105'
                : 'border-gray-300 hover:border-gray-500 hover:shadow-md'
            }`}
          >
            {image.url && (
              <div className="relative w-full h-32 bg-gray-100 overflow-hidden">
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            )}
            <div className="p-2.5 bg-white">
              <div className="text-xs font-semibold truncate text-gray-800">{image.name}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                  image.cameraType === 'ANALYTICS' ? 'bg-gray-100 text-gray-800 border-gray-300' :
                  image.cameraType === 'FIXED' ? 'bg-gray-100 text-gray-800 border-gray-300' :
                  'bg-gray-100 text-gray-800 border-gray-300'
                }`}>
                  {image.cameraType}
                </span>
              </div>
            </div>
            {selectedImages.has(image.path) && (
              <div className="absolute top-2 right-2 bg-black text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

