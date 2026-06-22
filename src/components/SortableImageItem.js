import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, GripVertical } from 'lucide-react';

export function SortableImageItem({ url, idx, isOwner, setZoomedImageIndex, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
    position: 'relative',
    flex: '1 1 200px', // Ensures it wraps beautifully without grid row constraints!
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes} 
      {...listeners}
      className={`relative group rounded-xl overflow-hidden border border-border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md bg-black/5 ${isDragging ? '' : 'transition-all'}`}
    >
      {/* The Image */}
      <img 
        src={url} 
        alt={`Gallery Image ${idx}`} 
        className="w-full h-auto block group-hover:scale-105 transition-transform duration-300" 
        onClick={(e) => {
          e.stopPropagation();
          setZoomedImageIndex(idx);
        }}
      />

      {/* Delete Button */}
      {isOwner && (
        <button 
          onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking delete
          onClick={(e) => {
            e.stopPropagation();
            onRemove(url);
          }}
          className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all z-10 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
