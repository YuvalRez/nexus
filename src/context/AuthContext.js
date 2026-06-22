"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  updateProfile
} from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Explicitly handle the redirect result to finalize the login
    getRedirectResult(auth).catch((error) => {
      console.error("Failed to get redirect result:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Ensure user is in Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: currentUser.email,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            avatarUrl: currentUser.photoURL || "",
            createdAt: serverTimestamp(),
          });
        }
        
        // Resolve pending invites
        if (currentUser.email) {
          try {
            const invitesQ = query(collection(db, "pendingInvites"), where("email", "==", currentUser.email.toLowerCase()));
            const invitesSnap = await getDocs(invitesQ);
            
            for (const inviteDoc of invitesSnap.docs) {
              const inviteData = inviteDoc.data();
              const nexusRef = doc(db, "nexuses", inviteData.nexusId);
              
              // Only update if nexus exists
              await updateDoc(nexusRef, {
                memberIds: arrayUnion(currentUser.uid)
              }).catch(e => console.error("Nexus not found for invite", e));
              
              await deleteDoc(inviteDoc.ref);
            }
          } catch (err) {
            console.error("Failed to resolve pending invites", err);
          }
        }
        
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signupWithEmail = async (email, password, displayName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });
    return userCredential;
  };

  const loginWithGoogle = () => {
    return signInWithRedirect(auth, googleProvider);
  };

  const logout = () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithEmail, signupWithEmail, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
