import React, { useState } from 'react';
import { X, GripVertical, Trash2 } from 'lucide-react';

export default function PhotoPreview({ photos, onRemove, onReorder }) {
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newPhotos = [...photos];
    const [draggedPhoto] = newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(targetIndex, 0, draggedPhoto);

    setDraggedIndex(null);
    onReorder(newPhotos);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (photos.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-gray-900 mb-3">Photos ({photos.length}/5)</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div
            key={index}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`relative group cursor-move ${draggedIndex === index ? 'opacity-50' : ''}`}
          >
            <img
              src={typeof photo === 'string' ? photo : URL.createObjectURL(photo)}
              alt={`Preview ${index}`}
              className="w-full aspect-square object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <div className="p-2 bg-gray-700 text-white rounded-full">
                  <GripVertical size={16} />
                </div>
                <button
                  onClick={() => onRemove(index)}
                  className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
              {index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
