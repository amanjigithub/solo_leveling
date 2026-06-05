import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// ==========================================
// 📖 HOW ENVIRONMENT VARIABLES WORK
//
// On YOUR machine:
//   Vite reads the .env file → replaces import.meta.env.VITE_* with real values
//
// On NETLIFY's server:
//   Netlify reads its Dashboard (Site → Environment Variables) → same replacement
//
// On GITHUB (public):
//   .env is in .gitignore → never uploaded → keys stay secret ✅
//
// 📖 WHAT IS import.meta.env?
//   Vite replaces import.meta.env.VITE_* AT BUILD TIME with the actual string.
//   The final JS bundle has the real value baked in — not a variable lookup.
//   Example: import.meta.env.VITE_FIREBASE_API_KEY → "AIzaSyDz3f..."
// ==========================================

const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Guard: if .env is missing or keys are empty, show a helpful error screen
// instead of crashing with a cryptic Firebase error.
const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
export const isFirebaseConfigured = REQUIRED_KEYS.every((key) => {
    const val = firebaseConfig[key];
    return val && typeof val === "string" && val.trim() !== "" && !val.startsWith("YOUR_");
});

let app, auth, googleProvider, db;

if (isFirebaseConfigured) {
    app            = initializeApp(firebaseConfig);
    auth           = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db             = getFirestore(app);
}

export { app, auth, googleProvider, db, doc, setDoc, onSnapshot };

