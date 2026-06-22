"use client";

import { useEffect, useState, useRef, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Edit2, ArrowLeft, Users, File, Lock, FileUp, BookOpen, Save } from "lucide-react";
import Link from "next/link";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableNoteItem } from "@/components/SortableNoteItem";
import InviteModal from "@/components/InviteModal";
import ConfirmModal from "@/components/ConfirmModal";

export default function NexusPage({ params }) {
  const unwrappedParams = use(params);
  const nexusId = unwrappedParams.id;
  const { user } = useAuth();
  const router = useRouter();
  
  const [nexus, setNexus] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  
  const [isEditingNexusName, setIsEditingNexusName] = useState(false);
  const [editNexusName, setEditNexusName] = useState("");
  const [isSavingNexus, setIsSavingNexus] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!user || !nexusId) return;

    const docRef = doc(db, "nexuses", nexusId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists() || !docSnap.data().memberIds.includes(user.uid)) {
        setError("Nexus not found or you don't have access.");
        setLoading(false);
        return;
      }
      setNexus({ id: docSnap.id, ...docSnap.data() });
    }, (err) => {
      console.error("Error fetching nexus:", err);
      setError("Failed to load Nexus.");
    });

    return () => unsubscribe();
  }, [user, nexusId]);

  useEffect(() => {
    if (!user || !nexusId || error) return;

    const q = query(collection(db, "notes"), where("nexusId", "==", nexusId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      loadedNotes.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      });
      
      setNotes(loadedNotes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, nexusId, error]);

  // Reset scroll position when opening a different note
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeNoteId]);

  const activeNote = notes.find(n => n.id === activeNoteId);
  const isOwner = nexus?.ownerId === user?.uid;

  const uploadFiles = async (files) => {
    if (!isOwner || files.length === 0) return;
    setLoading(true);
    let lastActiveId = null;

    try {
      for (const file of files) {
        if (!file.name.endsWith('.md')) continue;

        const text = await file.text();
        const title = file.name.replace('.md', '');
        
        const existingNote = notes.find(n => n.title.toLowerCase() === title.toLowerCase());

        if (existingNote) {
          await updateDoc(doc(db, "notes", existingNote.id), {
            content: text,
            updatedAt: serverTimestamp()
          });
          lastActiveId = existingNote.id;
        } else {
          const docRef = await addDoc(collection(db, "notes"), {
            nexusId,
            title,
            content: text,
            order: notes.length, // Could use existing max order + 1, but notes.length works roughly
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          lastActiveId = docRef.id;
        }
      }
      
      await updateDoc(doc(db, "nexuses", nexusId), { updatedAt: serverTimestamp() });
      if (lastActiveId) setActiveNoteId(lastActiveId);
    } catch (err) {
      console.error("Error uploading notes:", err);
      alert("Failed to upload notes.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = (e) => {
    uploadFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (isOwner && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Prevent flickering when dragging over child elements by checking if we actually left the window
    if (!e.relatedTarget || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (!isOwner) return;
    uploadFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragEnd = async (event) => {
    if (!isOwner) return;
    
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = notes.findIndex((n) => n.id === active.id);
    const newIndex = notes.findIndex((n) => n.id === over.id);
    
    const newNotes = arrayMove(notes, oldIndex, newIndex);
    setNotes(newNotes);

    try {
      const promises = newNotes.map((note, index) => 
        updateDoc(doc(db, "notes", note.id), { order: index })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to reorder notes:", err);
    }
  };

  const handleDeleteNote = (noteId) => {
    if (!isOwner) return;
    setConfirmConfig({
      title: "Delete Note",
      message: "Are you sure you want to delete this note? This cannot be undone.",
      confirmText: "Delete Note",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "notes", noteId));
          if (activeNoteId === noteId) setActiveNoteId(null);
        } catch (err) {
          console.error("Failed to delete note:", err);
        }
      }
    });
  };

  const startEditing = () => {
    if (!isOwner || !activeNote) return;
    setEditTitle(activeNote.title);
    setEditContent(activeNote.content);
    setIsEditing(true);
  };

  const saveNote = async () => {
    if (!isOwner || !activeNote) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "notes", activeNote.id), {
        title: editTitle,
        content: editContent,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save note:", err);
      alert("Failed to save note");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingNexus = () => {
    if (!isOwner) return;
    setEditNexusName(nexus?.name || "");
    setIsEditingNexusName(true);
  };

  const saveNexusName = async () => {
    if (!isOwner) return;
    if (!editNexusName.trim()) {
      setIsEditingNexusName(false);
      return;
    }
    setIsSavingNexus(true);
    try {
      await updateDoc(doc(db, "nexuses", nexusId), {
        name: editNexusName.trim(),
        updatedAt: serverTimestamp()
      });
      setNexus(prev => ({ ...prev, name: editNexusName.trim() }));
      setIsEditingNexusName(false);
    } catch (err) {
      console.error("Failed to update nexus name:", err);
      alert("Failed to update name");
    } finally {
      setIsSavingNexus(false);
    }
  };

  if (loading && !nexus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{error}</h1>
          <Link href="/dashboard" className="text-primary-500 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex h-screen bg-background overflow-hidden animate-fade-in-up relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-primary-500/20 backdrop-blur-sm border-4 border-primary-500 border-dashed flex items-center justify-center pointer-events-none transition-all">
          <div className="bg-card p-10 rounded-3xl shadow-2xl flex flex-col items-center transform scale-110">
            <FileUp className="w-16 h-16 text-primary-500 mb-4 animate-bounce" />
            <p className="font-bold text-2xl text-primary-500">Drop your Markdown files anywhere!</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-72 bg-card border-r border-border flex flex-col flex-shrink-0 relative z-20 shadow-2xl">
        <div className="p-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between mb-1 gap-2">
            {isEditingNexusName ? (
              <input 
                type="text"
                autoFocus
                value={editNexusName}
                onChange={(e) => setEditNexusName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveNexusName()}
                onBlur={saveNexusName}
                disabled={isSavingNexus}
                className="bg-background border border-border px-2 py-1 rounded font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-full min-w-0"
              />
            ) : (
              <div className="flex items-center gap-2 group flex-1 min-w-0">
                <h2 className="font-bold text-lg truncate">{nexus?.name}</h2>
                {isOwner && (
                  <button
                    onClick={startEditingNexus}
                    className="opacity-0 group-hover:opacity-100 p-1 text-foreground/40 hover:text-primary-500 transition-all rounded shrink-0"
                    title="Edit Nexus Name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            
            {isOwner && !isEditingNexusName && (
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="p-1.5 text-foreground/50 hover:text-primary-500 hover:bg-primary-500/10 rounded-md transition-colors shrink-0"
                title="Invite Viewers"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-foreground/50 font-medium">
            {isOwner ? "Owner (Editor)" : "Viewer"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={notes} strategy={verticalListSortingStrategy}>
              {notes.map((note) => (
                <SortableNoteItem
                  key={note.id}
                  note={note}
                  isOwner={isOwner}
                  isSelected={activeNoteId === note.id}
                  onSelect={setActiveNoteId}
                  onDelete={handleDeleteNote}
                />
              ))}
            </SortableContext>
          </DndContext>
          
          {notes.length === 0 && (
            <div className="text-center py-8 px-4 border-2 border-dashed border-border rounded-xl mt-4">
              <File className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-foreground/50">No notes yet.</p>
            </div>
          )}
        </div>

        {isOwner && (
          <div className="p-4 border-t border-border bg-card">
            <input
              type="file"
              accept=".md"
              multiple
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600/10 text-primary-500 border border-primary-500/20 font-medium rounded-xl hover:bg-primary-600 hover:text-white hover:border-primary-600 transition-all"
            >
              <FileUp className="w-4 h-4" />
              Upload Markdown
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-background relative z-10 overflow-hidden">
        {activeNote ? (
          <>
            <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
              {isEditing ? (
                <input 
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-background border border-border px-3 py-1.5 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-1/2"
                />
              ) : (
                <h1 className="font-bold text-xl truncate">{activeNote.title}</h1>
              )}
              
              {isOwner && (
                <div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 text-sm hover:bg-foreground/5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={saveNote}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {isSaving ? "Saving..." : "Save Note"}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={startEditing}
                      className="flex items-center gap-2 px-4 py-2 bg-foreground/5 hover:bg-foreground/10 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Note
                    </button>
                  )}
                </div>
              )}
            </header>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto p-8 md:p-12">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-[70vh] bg-background border border-border rounded-xl p-6 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none shadow-inner"
                    placeholder="Write your markdown here..."
                  />
                ) : (
                  <div className="prose prose-invert lg:prose-lg mx-auto">
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                      {activeNote.content
                        .replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (match, target, display) => {
                          return display ? display : target;
                        })
                        .split('\n')
                        .map(line => {
                          const match = line.match(/^([ \t]+)/);
                          if (match) {
                            const indentChars = match[1];
                            const restOfLine = line.slice(indentChars.length);
                            const isListItem = /^([-*+]|\d+\.)\s/.test(restOfLine);
                            if (!isListItem) {
                              const visualIndent = indentChars.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0').replace(/ /g, '\u00A0');
                              return visualIndent + restOfLine;
                            } else {
                              const parserIndent = indentChars.replace(/\t/g, '    ');
                              return parserIndent + restOfLine;
                            }
                          }
                          return line;
                        })
                        .join('\n')
                      }
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-foreground/40 p-8">
            <BookOpen className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground/60">Select a note from the sidebar</p>
            {isOwner && <p className="text-sm mt-2">or upload new markdown files to get started.</p>}
          </div>
        )}
      </div>

      <InviteModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        nexus={nexus} 
      />

      <ConfirmModal 
        isOpen={!!confirmConfig} 
        onClose={() => setConfirmConfig(null)} 
        {...confirmConfig} 
      />
    </div>
  );
}
