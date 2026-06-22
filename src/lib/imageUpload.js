import { db, storage } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Helper to compute SHA-256 hash of a file
async function computeFileHash(file) {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn("Crypto subtle hashing failed, using fallback:", e);
  }
  // Fallback hash
  return `${file.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
}

export async function uploadImageWithDeduplication(file) {
  try {
    // 1. Hash the file
    const fileHash = await computeFileHash(file);
    
    // 2. Check if this exact image already exists in our global images registry
    const imageDocRef = doc(db, "images", fileHash);
    const imageDocSnap = await getDoc(imageDocRef);
    
    if (imageDocSnap.exists()) {
      // 3. Deduplication Success! Use the existing URL.
      console.log("Image deduplication triggered! Saving space.");
      return imageDocSnap.data().url;
    }
    
    // 4. If it doesn't exist, upload it to Cloudinary via our API route
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload to Cloudinary");
    }
    
    const data = await response.json();
    const downloadURL = data.url;
    
    // 5. Register this new image in Firestore so it can be reused later
    await setDoc(imageDocRef, {
      url: downloadURL,
      originalName: file.name,
      size: file.size,
      createdAt: new Date().toISOString()
    });
    
    return downloadURL;
  } catch (error) {
    console.error("Failed to upload image:", error);
    throw error;
  }
}
