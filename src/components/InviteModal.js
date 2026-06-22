"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { X, Send, AlertCircle, CheckCircle2 } from "lucide-react";

export default function InviteModal({ isOpen, onClose, nexusId }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const q = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
      const userSnap = await getDocs(q);

      if (!userSnap.empty) {
        const invitedUser = userSnap.docs[0];
        const nexusRef = doc(db, "nexuses", nexusId);
        await updateDoc(nexusRef, {
          memberIds: arrayUnion(invitedUser.id)
        });
        setStatus("success");
        setMessage("User added to Nexus successfully!");
      } else {
        await addDoc(collection(db, "pendingInvites"), {
          nexusId,
          email: email.trim().toLowerCase(),
          createdAt: serverTimestamp()
        });
        setStatus("success");
        setMessage("Invite sent! They will get access when they sign up.");
      }
      setEmail("");
    } catch (err) {
      console.error("Failed to invite:", err);
      setStatus("error");
      setMessage("Failed to send invite. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Invite a Viewer</h2>
          <button 
            onClick={() => {
              onClose();
              setStatus("idle");
              setMessage("");
              setEmail("");
            }}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
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
    </div>
  );
}
