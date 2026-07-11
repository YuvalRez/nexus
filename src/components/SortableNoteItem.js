import { FileText, Trash2 } from "lucide-react";

export function TreeNoteItem({ note, isOwner, isSelected, onSelect, onDelete }) {
  return (
    <div
      onClick={() => onSelect(note.id)}
      className={`relative w-full flex items-center group rounded-lg transition-colors ${
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 font-medium"
          : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
      } ${!isOwner ? "cursor-pointer" : ""}`}
    >
      <div className="flex-1 flex items-center gap-2 truncate py-2.5 px-3 pointer-events-none">
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate">{note.title}</span>
      </div>

      {isOwner && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`shrink-0 p-1.5 mr-1 rounded-md cursor-pointer hover:bg-red-500/10 hover:text-red-600 text-foreground/30 ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } transition-all z-10`}
          title="Delete note"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
