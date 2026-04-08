import { useState, useEffect } from "react";
import AuthPage from "./components/AuthPage.jsx";
import GameApp from "./components/GameApp.jsx";
import { auth, isFirebaseConfigured } from "./firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

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
            try {
                await signOut(auth);
            } catch (e) {
                console.error("Logout failed:", e);
            }
        }
    };

    if (!isFirebaseConfigured) {
        return (
            <div style={{ background: "#020408", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff2244", fontFamily: "'Orbitron',monospace", textAlign: "center", padding: 20 }}>
                <div>
                    <h1 style={{ fontSize: 24, marginBottom: 20 }}>⚠ SYSTEM OFFLINE: BACKEND REQUIRED</h1>
                    <p style={{ fontSize: 14, color: "#4a7a9b", maxWidth: 600, lineHeight: 1.6 }}>
                        The Shadow System has been upgraded for cross-device synchronization and true Gmail login.<br /><br />
                        To boot the system, you must create a free Firebase Project, copy the <b>firebaseConfig</b> keys, and paste them into <br />
                        <span style={{ color: "#00a8ff" }}>src/firebase.js</span>.<br /><br />
                        Once pasted and saved, the system will automatically come online!
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
            {session
                ? <GameApp session={session} onLogout={handleLogout} />
                : <AuthPage />
            }
        </div>
    );
}
