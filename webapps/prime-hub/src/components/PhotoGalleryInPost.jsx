import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';

export default function PhotoGalleryInPost({
  photos = [],
  onDeletePhoto,
  editable = false,
  userRole,
}) {
  const [viewerIndex, setViewerIndex] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);

  const handleDeletePhoto = async (index) => {
    if (!confirm('Delete this photo?')) return;
    setIsDeleting(index);
    try {
      const photo = photos[index];
      if (photo.id && onDeletePhoto) {
        await onDeletePhoto(photo.id);
      }
    } catch (err) {
      console.error('Failed to delete photo:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  if (photos.length === 0) return null;

  return (
    <>
      {/* Photo Gallery Grid */}
      <div className={`grid gap-2 mt-3 ${
        photos.length === 1 ? 'grid-cols-1' :
        photos.length === 2 ? 'grid-cols-2' :
        'grid-cols-2 md:grid-cols-3'
      }`}>
        {photos.map((photo, index) => (
          <div key={index} className="relative group cursor-pointer overflow-hidden rounded-lg">
            <img
              src={photo.thumbnail_path || photo.url || photo}
              alt={`Photo ${index + 1}`}
              onClick={() => setViewerIndex(index)}
              className="w-full h-32 md:h-40 object-cover group-hover:scale-110 transition-transform"
            />
            {editable && (
              <button
                onClick={() => handleDeletePhoto(index)}
                disabled={isDeleting === index}
                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:bg-gray-400"
              >
                <Trash2 size={14} />
              </button>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all" />
          </div>
        ))}
      </div>

      {/* Photo Viewer Modal */}
      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNext={() => setViewerIndex((viewerIndex + 1) % photos.length)}
          onPrev={() => setViewerIndex((viewerIndex - 1 + photos.length) % photos.length)}
        />
      )}
    </>
  );
}

function PhotoViewer({ photos, index, onClose, onNext, onPrev }) {
  const photo = photos[index];
  const photoUrl = photo.file_path || photo.url || photo;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all"
        >
          <X size={24} />
        </button>

        {/* Image */}
        <div className="flex flex-col items-center gap-4">
          <img
            src={photoUrl}
            alt={`Photo ${index + 1}`}
            className="max-w-4xl max-h-[70vh] object-contain"
          />

          {/* Photo info */}
          {photo.caption && (
            <p className="text-white text-center max-w-2xl">{photo.caption}</p>
          )}

          {/* Navigation */}
          {photos.length > 1 && (
            <div className="flex gap-4 mt-4">
              <button
                onClick={onPrev}
                className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <span className="text-white px-4 py-2">
                {index + 1} / {photos.length}
              </span>
              <button
                onClick={onNext}
                className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-all"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
