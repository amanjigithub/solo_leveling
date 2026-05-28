import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// ==========================================
// 🔐 Firebase config — values come from .env
// ==========================================
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// ── Validate all required keys are real, non-empty, non-placeholder ──
const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
export const isFirebaseConfigured = REQUIRED_KEYS.every((key) => {
    const val = firebaseConfig[key];
    return (
        val &&
        typeof val === "string" &&
        val.trim() !== "" &&
        !val.startsWith("YOUR_")   // catches any remaining placeholder text
    );
});

let app, auth, googleProvider, db;

if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
}

export { app, auth, googleProvider, db, doc, setDoc, onSnapshot };
