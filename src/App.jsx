import { useState, useEffect, lazy, Suspense } from "react";
import { auth, isFirebaseConfigured } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

// ── Lazy load heavy components — they load only when needed ──────────────
// GameApp (48KB) and AuthPage (14KB) are split into separate JS chunks.
// The initial bundle is now ~60KB lighter — faster first paint.
const AuthPage = lazy(() => import("./components/AuthPage.jsx"));
const GameApp  = lazy(() => import("./components/GameApp.jsx"));

// Shared loading spinner shown while a lazy chunk downloads
const SystemBooting = () => (
    <div style={{ background: "#020408", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#00a8ff", fontFamily: "'Orbitron',monospace", fontSize: 12, letterSpacing: 4 }}>
            <div className="spin" style={{ fontSize: 32, marginBottom: 16 }}>⚔</div>
            <div>LOADING SYSTEM...</div>
        </div>
    </div>
);


export default function App() {
    const [session, setSession] = useState(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (!isFirebaseConfigured) {
            setChecking(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setSession({ uid: user.uid, username: user.displayName || user.email.split('@')[0] });
            } else {
                setSession(null);
            }
            setChecking(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        if (isFirebaseConfigured) {
            // 📖 Set checking=true BEFORE signing out.
            // This shows the "CONNECTING..." spinner immediately on click.
            // Without this: session becomes null → React tries to render <AuthPage />
            // → Suspense shows blank while the JS chunk downloads → black screen flash.
            // With this: spinner shows → auth state resolves → AuthPage renders cleanly.
            setChecking(true);
            try {
                await signOut(auth);
                // onAuthStateChanged will fire with null → sets session=null, checking=false
            } catch (e) {
                console.error("Logout failed:", e);
                setChecking(false); // recover from error — don't stay stuck on spinner
            }
        }
    };

    if (!isFirebaseConfigured) {
        return (
            <div style={{ background: "#020408", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff2244", fontFamily: "'Orbitron',monospace", textAlign: "center", padding: 20 }}>
                <div>
                    <h1 style={{ fontSize: 24, marginBottom: 20 }}>⚠ SYSTEM OFFLINE: FIREBASE KEYS MISSING</h1>
                    <p style={{ fontSize: 14, color: "#4a7a9b", maxWidth: 600, lineHeight: 1.6 }}>
                        The Shadow System requires Firebase to sync your progress and authenticate your identity.<br /><br />
                        Open your <span style={{ color: "#00a8ff" }}>.env</span> file in the project root and fill in all{" "}
                        <span style={{ color: "#00a8ff" }}>VITE_FIREBASE_*</span> values with your real Firebase project credentials.<br /><br />
                        Get them from{" "}
                        <span style={{ color: "#ffd700" }}>console.firebase.google.com</span>{" "}
                        → Project Settings → Your Apps.<br /><br />
                        After saving <span style={{ color: "#00a8ff" }}>.env</span>, restart the dev server and the system will come online!
                    </p>
                </div>
            </div>
        );
    }

    if (checking) return (
        <div style={{ background: "#020408", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: "#00a8ff", fontFamily: "'Orbitron',monospace", fontSize: 12, letterSpacing: 4 }}>
                <div className="spin" style={{ fontSize: 32, marginBottom: 16 }}>⚔</div>
                <div>CONNECTING TO SECURE CLOUD...</div>
            </div>
        </div>
    );

    return (
        <div className="app" style={{ background: "#020408" }}>
            <div className="bg-glow" />
            <div className="scanlines" />
            <Suspense fallback={<SystemBooting />}>
                {session
                    ? <GameApp session={session} onLogout={handleLogout} />
                    : <AuthPage />
                }
            </Suspense>
        </div>
    );
}
