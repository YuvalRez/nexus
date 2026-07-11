import { useState, useRef, useEffect } from "react";
import { Folder, FolderOpen, Trash2, ChevronRight, ChevronDown } from "lucide-react";

export function TreeFolderItem({ folder, isOwner, activeNoteId, isSelected, onSelect, onDelete, onRename, childrenContent }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(folder.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (editTitle.trim() && editTitle !== folder.title) {
      onRename(folder.id, editTitle.trim());
    } else {
      setEditTitle(folder.title);
    }
    setIsEditing(false);
  };

  return (
    <div className="w-full flex flex-col">
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect(folder.id);
          setIsExpanded(!isExpanded);
        }}
        className={`relative w-full flex items-center group rounded-lg transition-colors ${
          isSelected
            ? "bg-primary-50/80 dark:bg-primary-900/30 text-primary-600 font-medium"
            : "hover:bg-foreground/5"
        } ${!isOwner && !isEditing ? "cursor-pointer" : ""}`}
      >
        <div className="p-2 text-foreground/50 hover:text-foreground shrink-0 z-30 pointer-events-none">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        <div className="flex-1 flex items-center gap-2 truncate py-2 pr-3"
             onDoubleClick={(e) => {
               if (isOwner) {
                 e.stopPropagation();
                 setIsEditing(true);
               }
             }}
        >
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-primary-500" />
          ) : (
            <Folder className="w-4 h-4 shrink-0 text-primary-500" />
          )}
          
          {isEditing ? (
            <form onSubmit={handleRenameSubmit} className="flex-1">
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleRenameSubmit}
                className="w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-primary-500 rounded px-1 -ml-1"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              />
            </form>
          ) : (
            <span className="truncate font-medium text-foreground/80">{folder.title}</span>
          )}
        </div>

        {isOwner && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onDelete(folder.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`shrink-0 p-1.5 mr-1 rounded-md cursor-pointer hover:bg-red-500/10 hover:text-red-600 text-foreground/30 opacity-0 group-hover:opacity-100 transition-all z-30`}
            title="Delete folder"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      
      {isExpanded && childrenContent && (
        <div className="flex flex-col mt-1 border-l-2 border-foreground/10 ml-4">
          {childrenContent}
        </div>
      )}
    </div>
  );
}
