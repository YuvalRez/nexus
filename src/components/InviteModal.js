"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { X, Send, AlertCircle, CheckCircle2, Users, Clock, Mail, Trash2 } from "lucide-react";

export default function InviteModal({ isOpen, onClose, nexus }) {
  const [activeTab, setActiveTab] = useState("invite"); // "invite", "viewers", "pending"
  
  // Invite State
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  // Viewers State
  const [viewers, setViewers] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Pending State
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("invite");
      setStatus("idle");
      setMessage("");
      setEmail("");
    }
  }, [isOpen]);

  // Fetch Viewers
  useEffect(() => {
    if (isOpen && activeTab === "viewers" && nexus?.memberIds) {
      const fetchViewers = async () => {
        setLoadingViewers(true);
        try {
          const viewerIds = nexus.memberIds.filter(id => id !== nexus.ownerId);
          if (viewerIds.length === 0) {
            setViewers([]);
            setLoadingViewers(false);
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
          setLoadingViewers(false);
        }
      };
      fetchViewers();
    }
  }, [isOpen, activeTab, nexus]);

  // Fetch Pending Invites
  useEffect(() => {
    if (isOpen && activeTab === "pending" && nexus?.id) {
      const fetchPending = async () => {
        setLoadingPending(true);
        try {
          const q = query(collection(db, "pendingInvites"), where("nexusId", "==", nexus.id));
          const snap = await getDocs(q);
          const loadedPending = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setPendingInvites(loadedPending);
        } catch (err) {
          console.error("Failed to fetch pending invites:", err);
        } finally {
          setLoadingPending(false);
        }
      };
      fetchPending();
    }
  }, [isOpen, activeTab, nexus]);

  if (!isOpen || !nexus) return null;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      // Check if user exists and is already a member
      const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
      const userSnap = await getDocs(q);

      if (!userSnap.empty) {
        const invitedUser = userSnap.docs[0];
        if (nexus.memberIds.includes(invitedUser.id)) {
           setStatus("error");
           setMessage("User is already a viewer in this Nexus.");
           return;
        }
      }

      // Check if pending invite already exists
      const pendingQ = query(collection(db, "pendingInvites"), where("nexusId", "==", nexus.id), where("email", "==", email.trim().toLowerCase()));
      const pendingSnap = await getDocs(pendingQ);
      
      if (!pendingSnap.empty) {
        setStatus("error");
        setMessage("An invite has already been sent to this email.");
        return;
      }

      await addDoc(collection(db, "pendingInvites"), {
        nexusId: nexus.id,
        email: email.trim().toLowerCase(),
        createdAt: serverTimestamp()
      });
      setStatus("success");
      setMessage("Invite sent! They must accept it on their dashboard.");
      setEmail("");
    } catch (err) {
      console.error("Failed to invite:", err);
      setStatus("error");
      setMessage("Failed to send invite. Please try again.");
    }
  };

  const handleRemoveViewer = async (userId) => {
    if (!confirm("Are you sure you want to revoke access for this user?")) return;
    try {
      await updateDoc(doc(db, "nexuses", nexus.id), {
        memberIds: arrayRemove(userId)
      });
      setViewers(prev => prev.filter(v => v.id !== userId));
    } catch (err) {
      console.error("Failed to remove viewer:", err);
      alert("Failed to remove viewer");
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    if (!confirm("Are you sure you want to revoke this pending invite?")) return;
    try {
      await deleteDoc(doc(db, "pendingInvites", inviteId));
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch (err) {
      console.error("Failed to revoke invite:", err);
      alert("Failed to revoke invite");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">Manage Access</h2>
          <button 
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button 
            onClick={() => setActiveTab("invite")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === "invite" ? "border-primary-500 text-primary-500" : "border-transparent text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}
          >
            <Mail className="w-4 h-4" /> Invite
          </button>
          <button 
            onClick={() => setActiveTab("viewers")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === "viewers" ? "border-primary-500 text-primary-500" : "border-transparent text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}
          >
            <Users className="w-4 h-4" /> Viewers
          </button>
          <button 
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === "pending" ? "border-primary-500 text-primary-500" : "border-transparent text-foreground/60 hover:text-foreground hover:bg-foreground/5"}`}
          >
            <Clock className="w-4 h-4" /> Pending
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* INVITE TAB */}
          {activeTab === "invite" && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-foreground/70 mb-6">
                Invited users will have read-only access to all markdown notes in this Nexus.
              </p>

              {status === "success" && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{message}</span>
                </div>
              )}

              {status === "error" && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{message}</span>
                </div>
              )}

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@example.com"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-70"
                >
                  {status === "loading" ? "Sending..." : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Invite
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* VIEWERS TAB */}
          {activeTab === "viewers" && (
            <div className="animate-fade-in-up space-y-4">
              {loadingViewers ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : viewers.length === 0 ? (
                <div className="text-center py-8 text-foreground/50">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No external viewers yet.</p>
                </div>
              ) : (
                viewers.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{v.displayName || "Unknown User"}</p>
                      <p className="text-xs text-foreground/50 truncate">{v.email}</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveViewer(v.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2 shrink-0"
                      title="Revoke Access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* PENDING TAB */}
          {activeTab === "pending" && (
            <div className="animate-fade-in-up space-y-4">
              {loadingPending ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : pendingInvites.length === 0 ? (
                <div className="text-center py-8 text-foreground/50">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No pending invites.</p>
                </div>
              ) : (
                pendingInvites.map(invite => (
                  <div key={invite.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-xl">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{invite.email}</p>
                      <p className="text-xs text-foreground/50">Invited on {invite.createdAt?.toDate().toLocaleDateString() || "Recently"}</p>
                    </div>
                    <button 
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ml-2 shrink-0"
                      title="Revoke Invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
