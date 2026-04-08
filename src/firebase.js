import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ==========================================
// 🛑 PASTE YOUR FIREBASE CONFIGURATION HERE:
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDz3fKmV_gJrZ7bTJh--2LyvjKoPHD1STs",
    authDomain: "shadow-system-d5f7f.firebaseapp.com",
    projectId: "shadow-system-d5f7f",
    storageBucket: "shadow-system-d5f7f.firebasestorage.app",
    messagingSenderId: "53245691961",
    appId: "1:53245691961:web:6d314c52ee7698a9e1a5e8",
    measurementId: "G-RLBZ8NDB1V"
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, auth, googleProvider, db;

if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
}

export { auth, googleProvider, db };
