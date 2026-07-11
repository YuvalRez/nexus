import React, { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Users, Shield, ShieldAlert, Check, X } from "lucide-react";

export function FolderAccessControl({ folder, nexus, isOwner }) {
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);

  // allowedViewers is either null/undefined (public), or an array of user IDs (whitelist)
  const isPublic = !folder.allowedViewers || !Array.isArray(folder.allowedViewers);
  const allowedViewers = folder.allowedViewers || [];

  useEffect(() => {
    const fetchViewers = async () => {
      setLoading(true);
      try {
        if (!nexus?.memberIds) return;
        const viewerIds = nexus.memberIds.filter(id => id !== nexus.ownerId);
        if (viewerIds.length === 0) {
          setViewers([]);
          return;
        }

        const viewerPromises = viewerIds.map(id => getDoc(doc(db, "users", id)));
        const viewerDocs = await Promise.all(viewerPromises);
        
        const loadedViewers = viewerDocs
          .filter(d => d.exists())
          .map(d => ({ id: d.id, ...d.data() }));
          
        setViewers(loadedViewers);
      } catch (err) {
        console.error("Failed to fetch viewers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchViewers();
  }, [nexus]);

  const handleToggleAccess = async (viewerId) => {
    if (!isOwner) return;

    let newAllowedViewers;

    if (isPublic) {
      // Transition from Public to Whitelist
      // If public, it means currently ALL viewers have access.
      // We are toggling one off, so we create a whitelist of everyone EXCEPT this viewer.
      newAllowedViewers = viewers.map(v => v.id).filter(id => id !== viewerId);
    } else {
      // Currently in Whitelist mode
      if (allowedViewers.includes(viewerId)) {
        // Revoke access
        newAllowedViewers = allowedViewers.filter(id => id !== viewerId);
      } else {
        // Grant access
        newAllowedViewers = [...allowedViewers, viewerId];
        
        // If granting this makes everyone allowed again, revert to Public mode!
        const allViewerIds = viewers.map(v => v.id);
        const hasEveryone = allViewerIds.every(id => newAllowedViewers.includes(id));
        if (hasEveryone) {
          newAllowedViewers = null; // null deletes the field or sets it to null in Firestore, which falls back to public
        }
      }
    }

    try {
      await updateDoc(doc(db, "notes", folder.id), {
        allowedViewers: newAllowedViewers
      });
    } catch (err) {
      console.error("Failed to update folder access:", err);
      alert("Failed to update access.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 animate-fade-in-up">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary-500/10 text-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          {isPublic ? <Shield className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
        </div>
        <h2 className="text-2xl font-bold mb-2">Folder Access Control</h2>
        <p className="text-foreground/60">
          {isPublic 
            ? "This folder is currently public. All Nexus viewers can see it and its contents." 
            : "This folder is restricted. Only allowed viewers can see it and its contents."}
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-foreground/5 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Nexus Viewers
            <span className="text-xs font-medium px-2 py-0.5 bg-background rounded-md text-foreground/50 border border-border ml-1">
              {viewers.length}
            </span>
          </h3>
          {isOwner && viewers.length > 0 && (
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "notes", folder.id), { allowedViewers: null });
                  } catch (e) { alert("Failed to update access."); }
                }}
                className="text-xs font-medium px-3 py-1.5 bg-green-500/10 text-green-600 rounded-lg hover:bg-green-500/20 transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Allow All
              </button>
              <button 
                onClick={async () => {
                  try {
                    await updateDoc(doc(db, "notes", folder.id), { allowedViewers: [] });
                  } catch (e) { alert("Failed to update access."); }
                }}
                className="text-xs font-medium px-3 py-1.5 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Deny All
              </button>
            </div>
          )}
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : viewers.length === 0 ? (
            <div className="p-8 text-center text-foreground/50">
              <p>No external viewers in this Nexus yet.</p>
            </div>
          ) : (
            viewers.map(v => {
              const hasAccess = isPublic || allowedViewers.includes(v.id);
              return (
                <div key={v.id} className="p-4 flex items-center justify-between hover:bg-foreground/5 transition-colors">
                  <div>
                    <p className="font-medium">{v.displayName || "Unknown User"}</p>
                    <p className="text-sm text-foreground/50">{v.email}</p>
                  </div>
                  
                  {isOwner ? (
                    <button
                      onClick={() => handleToggleAccess(v.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        hasAccess ? 'bg-primary-500' : 'bg-foreground/20'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          hasAccess ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {hasAccess ? (
                        <span className="text-green-500 flex items-center gap-1"><Check className="w-4 h-4"/> Allowed</span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1"><X className="w-4 h-4"/> Denied</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
