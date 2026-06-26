"use client";

import { useEffect, useState, useRef, use } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Edit2, ArrowLeft, Users, File, Lock, FileUp, BookOpen, Save, Trash2, PlusCircle, ChevronLeft, ChevronRight, X, PanelRightClose, PanelRightOpen, RotateCcw } from "lucide-react";
import Link from "next/link";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableNoteItem } from "@/components/SortableNoteItem";
import { SortableImageItem } from "@/components/SortableImageItem";
import InviteModal from "@/components/InviteModal";
import ConfirmModal from "@/components/ConfirmModal";
import MilkdownEditor from "@/components/MilkdownEditor";
import { uploadImageWithDeduplication } from "@/lib/imageUpload";

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
  const [isDraggingMd, setIsDraggingMd] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [editorKeySuffix, setEditorKeySuffix] = useState(0);
  const [zoomedImageIndex, setZoomedImageIndex] = useState(null);
  
  const [isEditingNexusName, setIsEditingNexusName] = useState(false);
  const [editNexusName, setEditNexusName] = useState("");
  const [isSavingNexus, setIsSavingNexus] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [remoteCursor, setRemoteCursor] = useState(null);
  const cursorUpdateTimeoutRef = useRef(null);
  
  const [galleryWidth, setGalleryWidth] = useState(320);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const scrollRef = useRef(null);
  const thumbnailContainerRef = useRef(null);

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

  // Load gallery settings from local storage
  useEffect(() => {
    const savedWidth = localStorage.getItem("nexus_gallery_width");
    const savedCollapsed = localStorage.getItem("nexus_gallery_collapsed");
    if (savedWidth) setGalleryWidth(parseInt(savedWidth, 10));
    if (savedCollapsed) setIsGalleryCollapsed(savedCollapsed === "true");
  }, []);

  // Save gallery settings to local storage
  useEffect(() => {
    localStorage.setItem("nexus_gallery_width", galleryWidth.toString());
    localStorage.setItem("nexus_gallery_collapsed", isGalleryCollapsed.toString());
  }, [galleryWidth, isGalleryCollapsed]);

  // Window mouse events for resizing
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e) => {
      // Gallery is on the right, so width is screen width minus mouse X
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 150 && newWidth < window.innerWidth - 300) {
        setGalleryWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Scroll thumbnail into view when changed via arrows
  useEffect(() => {
    if (thumbnailContainerRef.current && zoomedImageIndex !== null) {
      const activeThumb = thumbnailContainerRef.current.children[zoomedImageIndex];
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [zoomedImageIndex]);

  const activeNote = notes.find(n => n.id === activeNoteId);
  const isOwner = user && nexus && nexus.ownerId === user.uid;

  // Listen to remote cursor updates (Viewers only)
  useEffect(() => {
    if (!activeNoteId || isOwner) return;
    
    const unsubscribe = onSnapshot(doc(db, "cursors", activeNoteId), (snapshot) => {
      if (snapshot.exists()) {
        setRemoteCursor(snapshot.data());
      } else {
        setRemoteCursor(null);
      }
    });
    
    return () => unsubscribe();
  }, [activeNoteId, isOwner]);

  // Broadcast cursor updates (Owner only)
  const handleSelectionChange = (selection) => {
    if (!isOwner || !activeNoteId) return;
    
    // Throttle to 1 write per second to respect Firebase quotas
    if (cursorUpdateTimeoutRef.current) return;
    
    cursorUpdateTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, "cursors", activeNoteId), {
        from: selection.from,
        to: selection.to,
        user: user.displayName || user.email?.split('@')[0] || 'Owner',
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(console.error);
      
      cursorUpdateTimeoutRef.current = null;
    }, 1000);
  };

  const checkAndDeleteOrphanedImages = async (urlsToCheck) => {
    if (!urlsToCheck || urlsToCheck.length === 0) return;
    
    for (const url of urlsToCheck) {
      try {
        const q = query(collection(db, "notes"), where("images", "array-contains", url));
        const snapshots = await getDocs(q);
        
        if (snapshots.empty) {
          console.log(`Image orphaned! Deleting globally: ${url}`);
          await fetch('/api/deleteImage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          
          const imageRegistryQuery = query(collection(db, "images"), where("url", "==", url));
          const registrySnaps = await getDocs(imageRegistryQuery);
          registrySnaps.forEach(async (registryDoc) => {
            await deleteDoc(doc(db, "images", registryDoc.id));
          });
        }
      } catch (e) {
        console.error(`Failed to garbage collect image ${url}:`, e);
      }
    }
  };

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
      
      // Force Tiptap Editor to fully remount with the newly uploaded content
      // by appending this incrementing suffix to its React key!
      setEditorKeySuffix(prev => prev + 1);
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

  const handleMdDragOver = (e) => {
    e.preventDefault();
    if (isOwner && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
      setIsDraggingMd(true);
    }
  };

  const handleMdDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingMd(false);
    }
  };

  const handleMdDrop = async (e) => {
    e.preventDefault();
    setIsDraggingMd(false);
    if (!isOwner) return;

    const files = Array.from(e.dataTransfer.files);
    const markdownFiles = files.filter(f => f.name.endsWith(".md"));

    if (markdownFiles.length > 0) {
      uploadFiles(markdownFiles);
    }
  };

  const handleImageDragOver = (e) => {
    e.preventDefault();
    if (isOwner && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
      setIsDraggingImage(true);
    }
  };

  const handleImageDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingImage(false);
    }
  };

  const handleImageDrop = async (e) => {
    e.preventDefault();
    setIsDraggingImage(false);
    if (!isOwner || !activeNoteId) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith("image/"));

    if (imageFiles.length > 0) {
      await handleImageUpload(imageFiles);
    }
  };

  const handleImageUpload = async (files) => {
    if (!isOwner || !activeNoteId || files.length === 0) return;
    setIsUploadingImage(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const imageUrl = await uploadImageWithDeduplication(file);
        await updateDoc(doc(db, "notes", activeNoteId), {
          images: arrayUnion(imageUrl),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Failed to upload images:", err);
      alert(`Failed to upload image: ${err.message || err}`);
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleCreateNote = async () => {
    if (!isOwner) return;
    try {
      const docRef = await addDoc(collection(db, "notes"), {
        nexusId,
        title: "Untitled Note",
        content: "",
        images: [],
        order: notes.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActiveNoteId(docRef.id);
      setEditTitle("Untitled Note");
      setIsEditingTitle(true);
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = notes.findIndex((n) => n.id === active.id);
      const newIndex = notes.findIndex((n) => n.id === over.id);
      
      const newNotes = arrayMove(notes, oldIndex, newIndex);
      setNotes(newNotes);
      
      // Update all changed orders in Firestore
      try {
        const batchUpdate = newNotes.map((note, index) => 
          updateDoc(doc(db, "notes", note.id), { order: index })
        );
        await Promise.all(batchUpdate);
      } catch (err) {
        console.error("Error reordering notes:", err);
      }
    }
  };

  const handleGalleryDragEnd = async (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id && activeNote) {
      const oldIndex = activeNote.images.indexOf(active.id);
      const newIndex = activeNote.images.indexOf(over.id);
      
      const newImages = arrayMove(activeNote.images, oldIndex, newIndex);
      
      // Update Firestore
      try {
        await updateDoc(doc(db, "notes", activeNote.id), {
          images: newImages
        });
      } catch (err) {
        console.error("Error reordering images:", err);
      }
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
          const noteImages = notes.find(n => n.id === noteId)?.images || [];
          await deleteDoc(doc(db, "notes", noteId));
          if (activeNoteId === noteId) setActiveNoteId(null);
          
          // Trigger garbage collection for images that were in this note
          checkAndDeleteOrphanedImages(noteImages);
        } catch (err) {
          console.error("Failed to delete note:", err);
        }
      }
    });
  };

  const startEditingTitle = () => {
    if (!isOwner || !activeNote) return;
    setEditTitle(activeNote.title);
    setIsEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!isOwner || !activeNote) return;
    try {
      await updateDoc(doc(db, "notes", activeNote.id), {
        title: editTitle,
        updatedAt: serverTimestamp()
      });
      setIsEditingTitle(false);
    } catch (err) {
      console.error("Failed to save title:", err);
      alert("Failed to save title");
    }
  };

  const saveContent = async (newContent) => {
    if (!isOwner || !activeNote) return;
    try {
      await updateDoc(doc(db, "notes", activeNote.id), {
        content: newContent,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to auto-save content:", err);
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
    <div className="flex h-screen bg-background overflow-hidden animate-fade-in-up">
      
      {/* Markdown Drag Zone Wrapper (Left Side) */}
      <div 
        className="flex-1 flex relative"
        onDragOver={handleMdDragOver}
        onDragLeave={handleMdDragLeave}
        onDrop={handleMdDrop}
      >
        {isDraggingMd && (
          <div className="absolute inset-0 z-50 bg-primary-500/20 backdrop-blur-sm border-4 border-primary-500 border-dashed flex items-center justify-center transition-all">
            <div className="bg-card p-10 rounded-3xl shadow-2xl flex flex-col items-center transform scale-110 pointer-events-none">
              <FileUp className="w-16 h-16 text-primary-500 mb-4 animate-bounce" />
              <p className="font-bold text-2xl text-primary-500">Drop your Markdown files here!</p>
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
          <div className="p-4 border-t border-border bg-card flex gap-2">
            <input
              type="file"
              accept=".md"
              multiple
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={handleCreateNote}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-all shadow-sm"
              title="New Note"
            >
              <Edit2 className="w-4 h-4" />
              New
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary-600/10 text-primary-500 border border-primary-500/20 font-medium rounded-xl hover:bg-primary-500 hover:text-white transition-all"
              title="Upload Markdown"
            >
              <FileUp className="w-4 h-4" />
              Upload
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex bg-background relative z-10 overflow-hidden">
        {activeNote ? (
          <>
            <div className="flex-1 flex flex-col min-w-0">
              <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                {isEditingTitle ? (
                  <input 
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                    onBlur={saveTitle}
                    autoFocus
                    className="bg-background border border-border px-3 py-1.5 rounded-lg font-bold text-xl focus:outline-none focus:ring-2 focus:ring-primary-500 w-1/2"
                  />
                ) : (
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={startEditingTitle}>
                    <h1 className="font-bold text-xl truncate">{activeNote.title}</h1>
                    {isOwner && <Edit2 className="w-4 h-4 opacity-0 group-hover:opacity-100 text-foreground/40 hover:text-primary-500 transition-all" />}
                  </div>
                )}
                
                {/* Removed auto-saving indicator */}
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsGalleryCollapsed(!isGalleryCollapsed)}
                    className="p-1.5 hover:bg-foreground/10 rounded-lg text-foreground/60 hover:text-foreground transition-all"
                    title={isGalleryCollapsed ? "Show Gallery" : "Hide Gallery"}
                  >
                    {isGalleryCollapsed ? <PanelRightOpen className="w-5 h-5" /> : <PanelRightClose className="w-5 h-5" />}
                  </button>
                </div>
              </header>
              
              {/* Left Side: Milkdown Live Preview Editor */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-background relative flex flex-col items-center">
                <div className="w-full max-w-[800px] mt-8 flex-1 flex flex-col">
                  <MilkdownEditor 
                    key={isOwner ? `${activeNote.id}-${editorKeySuffix}` : `${activeNote.id}-${activeNote.updatedAt?.toMillis() || 'viewer'}`}
                    initialContent={activeNote.content || ""} 
                    onChange={saveContent} 
                    isEditable={isOwner}
                    onSelectionChange={handleSelectionChange}
                    remoteCursor={remoteCursor}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-foreground/40 p-8">
            <BookOpen className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground/60">Select a note from the sidebar</p>
          </div>
        )}
      </div>
      </div>

      {/* Right Side: Image Gallery (Only if note is active) */}
      {activeNote && (
        <div 
          style={{ width: isGalleryCollapsed ? '0px' : `${galleryWidth}px`, transition: isResizing ? 'none' : 'width 0.3s ease' }}
          className="border-l border-border bg-card flex flex-col flex-shrink-0 z-20 relative overflow-hidden"
          onDragOver={handleImageDragOver}
          onDragLeave={handleImageDragLeave}
          onDrop={handleImageDrop}
        >
          {/* Invisible Resizer Handle */}
          {!isGalleryCollapsed && (
            <div 
              className="w-1.5 cursor-col-resize absolute left-0 top-0 bottom-0 z-30 hover:bg-primary-500/50 transition-colors"
              onMouseDown={() => setIsResizing(true)}
            />
          )}
          {isDraggingImage && (
            <div className="absolute inset-0 z-50 bg-primary-500/20 backdrop-blur-sm border-4 border-primary-500 border-dashed flex items-center justify-center transition-all">
              <div className="bg-card p-6 rounded-3xl shadow-2xl flex flex-col items-center transform scale-110 pointer-events-none text-center">
                <PlusCircle className="w-12 h-12 text-primary-500 mb-3 animate-bounce" />
                <p className="font-bold text-lg text-primary-500">Drop Images to Gallery</p>
              </div>
            </div>
          )}

          <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 min-w-[200px]">
            <h3 className="font-semibold flex items-center gap-2 whitespace-nowrap">
              Gallery
              {isUploadingImage && <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>}
            </h3>
            <button 
              onClick={() => setGalleryWidth(320)}
              title="Reset width"
              className="p-1.5 hover:bg-foreground/10 rounded-lg text-foreground/60 hover:text-foreground transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <div 
            className="flex-1 overflow-y-auto p-4 grid gap-4 content-start"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
          >
            {activeNote.images && activeNote.images.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleGalleryDragEnd}
              >
                <SortableContext
                  items={activeNote.images}
                  strategy={rectSortingStrategy}
                >
                  {activeNote.images.map((url, idx) => (
                    <SortableImageItem 
                      key={url} // ID must match the string URL exactly
                      url={url}
                      idx={idx}
                      isOwner={isOwner}
                      setZoomedImageIndex={setZoomedImageIndex}
                      onRemove={(urlToRemove) => {
                        setConfirmConfig({
                          title: "Delete Image",
                          message: "Are you sure you want to permanently delete this image from the gallery?",
                          onConfirm: async () => {
                            await updateDoc(doc(db, "notes", activeNote.id), {
                              images: activeNote.images.filter((url) => url !== urlToRemove)
                            });
                            checkAndDeleteOrphanedImages([urlToRemove]);
                          }
                        });
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <div className="text-center aspect-square flex items-center justify-center px-4 border-2 border-dashed border-border rounded-xl">
                <p className="text-sm text-foreground/50">No images yet.</p>
              </div>
            )}

            {isOwner && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={imageInputRef}
                  onChange={(e) => handleImageUpload(Array.from(e.target.files))}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full aspect-square border-2 border-dashed border-primary-500/30 rounded-xl hover:border-primary-500 hover:bg-primary-500/5 transition-all flex flex-col items-center justify-center gap-2 text-primary-500"
                >
                  <PlusCircle className="w-6 h-6" />
                  <span className="text-sm font-medium">Add Images</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Fullscreen Image Lightbox */}
      {zoomedImageIndex !== null && activeNote && activeNote.images && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center animate-fade-in select-none"
          onClick={() => setZoomedImageIndex(null)}
        >
          {/* Previous Area (Left Bar) */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-24 sm:w-32 flex items-center justify-start pl-4 sm:pl-8 group cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImageIndex(prev => prev > 0 ? prev - 1 : activeNote.images.length - 1);
            }}
          >
            <div className="bg-black/50 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronLeft className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Next Area (Right Bar) */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-24 sm:w-32 flex items-center justify-end pr-4 sm:pr-8 group cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImageIndex(prev => prev < activeNote.images.length - 1 ? prev + 1 : 0);
            }}
          >
            <div className="bg-black/50 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* The Zoomed Image */}
          <img 
            src={activeNote.images[zoomedImageIndex]} 
            alt="Zoomed Fullscreen" 
            className="max-w-full max-h-full object-contain pointer-events-none"
          />

          {/* Thumbnail Strip */}
          <div 
            ref={thumbnailContainerRef}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 max-w-[780px] overflow-x-auto p-4 bg-black/40 backdrop-blur-md rounded-2xl z-50"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.stopPropagation();
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            {activeNote.images.map((imgUrl, i) => (
              <img 
                key={i}
                src={imgUrl}
                alt={`Thumbnail ${i}`}
                className={`w-16 h-16 object-cover rounded-xl cursor-pointer shrink-0 transition-all duration-300 ${i === zoomedImageIndex ? 'border-2 border-primary-500 scale-110 opacity-100 shadow-lg' : 'opacity-50 hover:opacity-100 hover:scale-105'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedImageIndex(i);
                }}
              />
            ))}
          </div>

          {/* Close Button */}
          <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-2 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImageIndex(null);
            }}
          >
            <X className="w-8 h-8" />
          </button>
        </div>
      )}

    </div>
  );
}
