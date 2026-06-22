"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, addDoc, serverTimestamp, doc, writeBatch, onSnapshot, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { Plus, Folder, Clock, X, Trash2, LogOut, Check, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [nexuses, setNexuses] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newNexusName, setNewNexusName] = useState("");

  useEffect(() => {
    if (!user) return;

    // Listen to Nexuses where user is a member
    const nexusesQ = query(collection(db, "nexuses"), where("memberIds", "array-contains", user.uid));
    const unsubscribeNexuses = onSnapshot(nexusesQ, (snap) => {
      const loaded = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNexuses(loaded.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0)));
      setLoading(false);
    });

    // Listen to Pending Invites for user's email
    const invitesQ = query(collection(db, "pendingInvites"), where("email", "==", user.email));
    const unsubscribeInvites = onSnapshot(invitesQ, async (snap) => {
      const invites = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch the Nexus names for the invites to display them nicely
      const enrichedInvites = await Promise.all(invites.map(async (invite) => {
        try {
          const nexusSnap = await getDoc(doc(db, "nexuses", invite.nexusId));
          if (nexusSnap.exists()) {
            return { ...invite, nexusName: nexusSnap.data().name };
          }
          return invite;
        } catch (err) {
          return invite;
        }
      }));
      
      // Filter out any invites where the Nexus was deleted
      setPendingInvites(enrichedInvites.filter(i => i.nexusName));
    });

    return () => {
      unsubscribeNexuses();
      unsubscribeInvites();
    };
  }, [user]);

  const handleCreateNexus = async (e) => {
    e.preventDefault();
    if (!newNexusName.trim()) return;
    
    try {
      const docRef = await addDoc(collection(db, "nexuses"), {
        name: newNexusName.trim(),
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsCreating(false);
      setNewNexusName("");
      router.push(`/nexus/${docRef.id}`);
    } catch (err) {
      console.error("Failed to create nexus:", err);
    }
  };

  const handleDeleteNexus = async (nexusId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this Nexus? This will delete all notes inside it permanently.")) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "nexuses", nexusId));
        
        const notesQ = query(collection(db, "notes"), where("nexusId", "==", nexusId));
        const notesSnap = await getDocs(notesQ);
        notesSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
      } catch (err) {
        console.error("Failed to delete nexus:", err);
      }
    }
  };

  const handleLeaveNexus = async (nexusId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to leave this Nexus? You will lose access to its notes.")) {
      try {
        await updateDoc(doc(db, "nexuses", nexusId), {
          memberIds: arrayRemove(user.uid)
        });
      } catch (err) {
        console.error("Failed to leave nexus:", err);
      }
    }
  };

  const handleAcceptInvite = async (invite) => {
    try {
      await updateDoc(doc(db, "nexuses", invite.nexusId), {
        memberIds: arrayUnion(user.uid)
      });
      await deleteDoc(doc(db, "pendingInvites", invite.id));
    } catch (err) {
      console.error("Failed to accept invite:", err);
      alert("Failed to accept invite");
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    if (window.confirm("Are you sure you want to decline this invitation?")) {
      try {
        await deleteDoc(doc(db, "pendingInvites", inviteId));
      } catch (err) {
        console.error("Failed to decline invite:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-600">
              Nexus Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground/80 hidden sm:inline-block">
              {user?.displayName}
            </span>
            <button
              onClick={() => logout()}
              className="text-sm px-4 py-2 rounded-lg hover:bg-foreground/5 text-foreground/70 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-5xl animate-fade-in-up">
        
        {/* Pending Invites Section */}
        {pendingInvites.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary-500" />
              Pending Invitations
            </h2>
            <div className="grid gap-4">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h3 className="font-semibold text-lg text-primary-600">You've been invited to "{invite.nexusName}"</h3>
                    <p className="text-sm text-foreground/60 mt-1">Accept the invitation to collaborate and view markdown notes.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => handleAcceptInvite(invite)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Accept
                    </button>
                    <button 
                      onClick={() => handleDeclineInvite(invite.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors"
                    >
                      <X className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Your Workspaces</h2>
            <p className="text-foreground/60">Create or select a Nexus to start organizing your markdown notes.</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20"
          >
            <Plus className="w-5 h-5" />
            New Nexus
          </button>
        </div>

        {isCreating && (
          <div className="mb-8 p-6 bg-card border border-border rounded-2xl shadow-sm animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Nexus</h3>
              <button onClick={() => setIsCreating(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateNexus} className="flex gap-3">
              <input
                type="text"
                autoFocus
                required
                placeholder="E.g., Engineering Docs, Personal Wiki..."
                className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={newNexusName}
                onChange={(e) => setNewNexusName(e.target.value)}
              />
              <button
                type="submit"
                className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                Create
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nexuses.length === 0 && !isCreating ? (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-3xl">
              <Folder className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No workspaces yet</h3>
              <p className="text-foreground/50 max-w-sm mx-auto mb-6">
                A Nexus is a secure workspace where you can organize and share your markdown notes.
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="text-primary-500 font-medium hover:text-primary-400"
              >
                Create your first Nexus →
              </button>
            </div>
          ) : (
            nexuses.map((nexus) => (
              <Link
                href={`/nexus/${nexus.id}`}
                key={nexus.id}
                className="group bg-card border border-border p-6 rounded-2xl hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/5 transition-all block relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-500">
                    <Folder className="w-5 h-5" />
                  </div>
                  {nexus.ownerId === user?.uid ? (
                    <button
                      onClick={(e) => handleDeleteNexus(nexus.id, e)}
                      className="p-2 text-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Nexus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleLeaveNexus(nexus.id, e)}
                      className="p-2 text-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
