import React, { useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

export function DraggableNode({ id, isOwner, isDragging, children, depth = 0, isDraggingFolder, isTargetFolder }) {
  // Draggable hook for the entire node
  const { attributes, listeners, setNodeRef: setDraggableRef } = useDraggable({
    id: id,
    disabled: !isOwner,
  });

  const noMergeZone = isDraggingFolder && !isTargetFolder;

  // Three droppable zones
  const { isOver: isAboveOver, setNodeRef: setAboveRef } = useDroppable({
    id: `above-${id}`,
    disabled: !isOwner,
  });

  const { isOver: isGroupOver, setNodeRef: setGroupRef } = useDroppable({
    id: `group-${id}`,
    disabled: !isOwner || noMergeZone,
  });

  const { isOver: isBelowOver, setNodeRef: setBelowRef } = useDroppable({
    id: `below-${id}`,
    disabled: !isOwner,
  });

  // Create a combined ref for the draggable container
  const nodeRef = useRef(null);
  const setRefs = (el) => {
    nodeRef.current = el;
    setDraggableRef(el);
  };

  return (
    <div
      ref={setRefs}
      className={`relative w-full flex flex-col ${isDragging ? "opacity-50" : ""}`}
      style={{ paddingLeft: depth > 0 ? '1rem' : '0' }}
    >
      {/* Drop Zones (Absolute positioned over the content) */}
      {!isDragging && isOwner && (
        <>
          <div ref={setAboveRef} className={`absolute inset-x-0 top-0 ${noMergeZone ? "h-[50%]" : "h-[35%]"} z-20 pointer-events-none`} />
          {!noMergeZone && <div ref={setGroupRef} className="absolute inset-x-0 top-[35%] bottom-[35%] z-20 pointer-events-none" />}
          <div ref={setBelowRef} className={`absolute inset-x-0 bottom-0 ${noMergeZone ? "h-[50%]" : "h-[35%]"} z-20 pointer-events-none`} />
        </>
      )}

      {/* Visual Insertion Lines */}
      {isAboveOver && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-500 z-30 pointer-events-none" />
      )}
      
      {/* Content wrapper with group highlight */}
      <div 
        {...(isOwner ? attributes : {})}
        {...(isOwner ? listeners : {})}
        className={`w-full relative rounded-lg transition-all ${
          isGroupOver ? "ring-2 ring-primary-500 bg-primary-500/10" : ""
        } ${isOwner ? "cursor-grab touch-none" : ""}`}
      >
        {children}
      </div>

      {isBelowOver && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 z-30 pointer-events-none" />
      )}
    </div>
  );
}
