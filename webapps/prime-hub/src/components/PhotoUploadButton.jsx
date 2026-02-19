import React, { useRef } from 'react';
import { Image } from 'lucide-react';

export default function PhotoUploadButton({ onPhotosSelected, disabled = false, maxPhotos = 5 }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);

    if (files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    // Validate all files before calling callback
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      onPhotosSelected(validFiles);
    }

    // Reset input
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        title="Add photos to your post (max 5, 10MB each)"
      >
        <Image size={18} />
        <span>Photo</span>
      </button>
    </>
  );
}
