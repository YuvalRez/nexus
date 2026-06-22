import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { Folder, Trash2, LogOut, Clock } from 'lucide-react';

export function SortableNexusItem({ nexus, user, handleDeleteNexus, handleLeaveNexus }) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: nexus.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className="relative h-full">
      <div
        className={`group bg-card border border-border p-6 rounded-2xl hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/5 block h-full cursor-grab active:cursor-grabbing ${isDragging ? '' : 'transition-all'}`}
        {...attributes} 
        {...listeners} 
        onClick={() => router.push(`/nexus/${nexus.id}`)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-500 relative z-0">
            <Folder className="w-5 h-5" />
          </div>
          {nexus.ownerId === user?.uid ? (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNexus(nexus.id, e);
              }}
              className="relative z-10 p-2 text-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              title="Delete Nexus"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleLeaveNexus(nexus.id, e);
              }}
              className="relative z-10 p-2 text-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              title="Leave Nexus"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
        <h3 className="text-xl font-semibold mb-2 group-hover:text-primary-400 transition-colors">
          {nexus.name}
        </h3>
        <div className="flex items-center gap-4 text-sm text-foreground/50">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {nexus.updatedAt ? new Date(nexus.updatedAt.toMillis()).toLocaleDateString() : 'Just now'}
          </span>
          {nexus.ownerId === user?.uid ? (
            <span className="px-2 py-0.5 bg-primary-500/10 text-primary-500 rounded text-xs font-medium">Owner</span>
          ) : (
            <span className="px-2 py-0.5 bg-foreground/10 rounded text-xs font-medium">Shared</span>
          )}
        </div>
      </div>
    </div>
  );
}
