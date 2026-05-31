import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// ==========================================
// 📖 WHY ARE FIREBASE KEYS HARD-CODED HERE?
//
// Firebase API keys are NOT secrets.
// They are public identifiers — like a street address.
// They tell Firebase WHICH project to connect to.
//
// Real security comes from Firestore Security Rules (in Firebase console),
// which control WHO can read/write your data regardless of the key.
//
// The problem: Netlify runs `npm run build` on their servers.
// Their server has no .env file → all VITE_* vars become undefined →
// isFirebaseConfigured = false → "SYSTEM OFFLINE" error.
//
// Solution: embed the values directly so the build always works,
// on any machine, on any server, with zero setup.
//
// 📖 WHAT IS import.meta.env?
// Vite replaces import.meta.env.VITE_* at BUILD TIME with the actual value.
// It's not read at runtime — it's literally replaced in the JS file during build.
// When the value is undefined (no .env), the bundle gets: apiKey: undefined
// That's why the app breaks on Netlify.
// ==========================================

const firebaseConfig = {
    // 📖 These values identify your Firebase project.
    // They are the same values you'd put in .env — just written directly.
    apiKey:            "AIzaSyDz3fKmV_gJrZ7bTJh--2LyvjKoPHD1STs",
    authDomain:        "shadow-system-d5f7f.firebaseapp.com",
    projectId:         "shadow-system-d5f7f",
    storageBucket:     "shadow-system-d5f7f.firebasestorage.app",
    messagingSenderId: "53245691961",
    appId:             "1:53245691961:web:6d314c52ee7698a9e1a5e8",
    measurementId:     "G-RLBZ8NDB1V",
};

// All keys are now hardcoded strings — this will always be true.
// We keep the check so the error screen still shows if someone
// accidentally deletes the values above.
const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
export const isFirebaseConfigured = REQUIRED_KEYS.every((key) => {
    const val = firebaseConfig[key];
    return val && typeof val === "string" && val.trim() !== "" && !val.startsWith("YOUR_");
});

// 📖 initializeApp() connects your app to Firebase.
// getAuth() sets up the authentication system.
// getFirestore() gives you a handle to the database.
// These are only created if config is valid (safety guard).
let app, auth, googleProvider, db;

if (isFirebaseConfigured) {
    app            = initializeApp(firebaseConfig);
    auth           = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db             = getFirestore(app);
}

export { app, auth, googleProvider, db, doc, setDoc, onSnapshot };
