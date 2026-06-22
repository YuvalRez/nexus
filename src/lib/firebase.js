import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCT1WCikscmsUY1txDG0bansXoULvJUOkw",
  authDomain: "nexus-38ab2.firebaseapp.com",
  projectId: "nexus-38ab2",
  storageBucket: "nexus-38ab2.firebasestorage.app",
  messagingSenderId: "453669278510",
  appId: "1:453669278510:web:08ca1929cc3857ededa0bf"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Optional: Fix popup blocked issues in some environments by forcing prompt
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, auth, db, googleProvider };
