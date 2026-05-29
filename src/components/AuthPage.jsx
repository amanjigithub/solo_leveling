import { useState } from "react";
import { analyzePassword } from "../utils.js";
import { auth, googleProvider } from "../firebase.js";
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";

export default function AuthPage() {
    const [mode, setMode] = useState("login"); // login | signup
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);

    const pwAnalysis = analyzePassword(password);

    const resetForm = () => {
        setUsername(""); setPassword(""); setConfirmPw("");
        setError(""); setSuccess(""); setAgreeTerms(false);
    };

    const getFakeEmail = (name) => `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@hunter.shadow`;

    const handleLogin = async () => {
        setError(""); setSuccess("");
        if (!username.trim() || !password) { setError("All fields are required."); return; }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, getFakeEmail(username), password);
            setSuccess("Identity confirmed. Entering the System...");
        } catch (e) {
            setError("Invalid credentials. Access denied.");
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        setError(""); setSuccess("");
        if (!username.trim() || !password || !confirmPw) { setError("All fields are required."); return; }
        if (username.trim().length < 3) { setError("Hunter name must be at least 3 characters."); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) { setError("Hunter name: letters, numbers, underscores only."); return; }
        if (pwAnalysis.score < 3) { setError("Password too weak. The System rejects the unworthy."); return; }
        if (password !== confirmPw) { setError("Passwords do not match."); return; }
        if (!agreeTerms) { setError("You must accept the Hunter's Oath."); return; }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, getFakeEmail(username), password);
            await updateProfile(userCredential.user, { displayName: username.trim() });
            setSuccess("Hunter registered. Welcome to the System.");
        } catch (e) {
            if (e.code === 'auth/email-already-in-use') {
                setError("Hunter name already taken.");
            } else {
                setError("System error. Try again.");
            }
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async () => {
        try {
            setLoading(true);
            setError(""); setSuccess("");
            await signInWithPopup(auth, googleProvider);
            setSuccess("Google Identity confirmed. Entering the System...");
        } catch (e) {
            setError(`Google auth failed: ${e.code || e.message}`);
            console.error(e);
            setLoading(false);
        }
    };

    const switchMode = (m) => { setMode(m); resetForm(); };

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                {/* Logo */}
                <div className="auth-logo">
                    <div className="icon">⚔</div>
                    <h1>SHADOW SYSTEM</h1>
                    <p>HUNTER INTERFACE v3.0</p>
                </div>

                {/* Tabs */}
                <div className="auth-tabs">
                    <div className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>LOGIN</div>
                    <div className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>REGISTER</div>
                </div>

                {/* Error / Success */}
                {error && <div className="form-error">⚠ {error}</div>}
                {success && <div className="form-success">✓ {success}</div>}

                <form onSubmit={e => { e.preventDefault(); mode === "login" ? handleLogin() : handleSignup(); }}>

                {/* Username */}
                <div className="form-group">
                    <label className="form-label">Hunter Name</label>
                    <div className="input-wrap">
                        <input
                            className={`form-input ${username && mode === "signup" && username.length >= 3 ? "success" : username && mode === "signup" && username.length < 3 ? "error" : ""}`}
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder={mode === "login" ? "Enter your hunter name" : "Choose a hunter name"}
                            autoComplete="username"
                        />
                        <span className="input-icon">👤</span>
                    </div>
                    {mode === "signup" && username && (
                        <div style={{ marginTop: 5, fontSize: 11, letterSpacing: 0.5, color: username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username) ? "#00ff88" : "#ff2244" }}>
                            {username.length < 3 ? "Too short" : !/^[a-zA-Z0-9_]+$/.test(username) ? "Invalid characters" : "✓ Name available"}
                        </div>
                    )}
                </div>

                {/* Password */}
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="input-wrap">
                        <input
                            className="form-input"
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            style={{ paddingRight: 40 }}
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                        />
                        <span className="input-icon" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁"}</span>
                    </div>

                    {/* Strength meter — signup only */}
                    {mode === "signup" && password.length > 0 && (
                        <div className="strength-bar-wrap">
                            <div className="strength-bar-track">
                                <div className="strength-bar-fill" style={{ width: `${(pwAnalysis.score / 6) * 100}%`, background: pwAnalysis.strengthColor, boxShadow: `0 0 8px ${pwAnalysis.strengthColor}` }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span className="strength-label" style={{ color: pwAnalysis.strengthColor }}>
                                    {pwAnalysis.strength === "SOVEREIGN" ? "◈ SOVEREIGN GRADE" : pwAnalysis.strength === "STRONG" ? "▲ STRONG" : pwAnalysis.strength === "MODERATE" ? "◆ MODERATE" : "▼ WEAK"}
                                </span>
                                <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, color: "#4a7a9b", letterSpacing: 1 }}>{pwAnalysis.score}/6 CHECKS</span>
                            </div>
                            <div className="checks-grid" style={{ marginTop: 10 }}>
                                {pwAnalysis.checks.map(c => (
                                    <div key={c.id} className="check-item" style={{ color: c.pass ? "#00ff88" : "#4a7a9b" }}>
                                        <div className="check-dot" style={{ background: c.pass ? "#00ff88" : "#1e3a52", boxShadow: c.pass ? "0 0 6px #00ff88" : "none" }} />
                                        {c.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Confirm password — signup only */}
                {mode === "signup" && (
                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <div className="input-wrap">
                            <input
                                className={`form-input ${confirmPw ? (confirmPw === password ? "success" : "error") : ""}`}
                                type={showConfirm ? "text" : "password"}
                                value={confirmPw}
                                onChange={e => setConfirmPw(e.target.value)}
                                placeholder="Re-enter your password"
                                style={{ paddingRight: 40 }}
                                autoComplete="new-password"
                            />
                            <span className="input-icon" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? "🙈" : "👁"}</span>
                        </div>
                        {confirmPw && (
                            <div style={{ marginTop: 5, fontSize: 11, color: confirmPw === password ? "#00ff88" : "#ff2244" }}>
                                {confirmPw === password ? "✓ Passwords match" : "✗ Passwords do not match"}
                            </div>
                        )}
                    </div>
                )}

                {/* Hunter's Oath — signup only */}
                {mode === "signup" && (
                    <div
                        onClick={() => setAgreeTerms(!agreeTerms)}
                        style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "rgba(0,168,255,0.03)", border: `1px solid ${agreeTerms ? "rgba(0,255,136,0.3)" : "#0d2d47"}`, cursor: "pointer", marginBottom: 16, transition: "border-color 0.2s" }}
                    >
                        <div style={{ width: 16, height: 16, border: `1.5px solid ${agreeTerms ? "#00ff88" : "#4a7a9b"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: agreeTerms ? "#00ff88" : "transparent", flexShrink: 0, marginTop: 1, transition: "all 0.2s", background: agreeTerms ? "rgba(0,255,136,0.1)" : "transparent" }}>
                            {agreeTerms ? "✓" : ""}
                        </div>
                        <span style={{ fontSize: 12, color: "#4a7a9b", lineHeight: 1.5 }}>
                            I accept the <span style={{ color: "#00a8ff" }}>Hunter's Oath</span> — to grow stronger every day and never abandon the quest.
                        </span>
                    </div>
                )}

                {/* Submit */}
                <button type="submit" className="btn-submit" disabled={loading || !!success}>
                    {loading ? <span className="spin">⚙</span> : mode === "login" ? "▶ ENTER THE SYSTEM" : "◈ REGISTER AS HUNTER"}
                </button>

                </form>

                {/* Footer note */}
                <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#1e3a52", letterSpacing: 1 }}>
                    {mode === "login" ? (
                        <>No account? <span style={{ color: "#00a8ff", cursor: "pointer" }} onClick={() => switchMode("signup")}>Register here</span></>
                    ) : (
                        <>Already a hunter? <span style={{ color: "#00a8ff", cursor: "pointer" }} onClick={() => switchMode("login")}>Login here</span></>
                    )}
                </div>

                {/* Google Login Divider */}
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px dashed #0d2d47", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2, color: "#4a7a9b" }}>OR CONTINUE WITH ALIEN TECH</div>
                    <button onClick={handleGoogleSuccess} disabled={loading} style={{ width: "100%", padding: "12px", background: "#ffffff", color: "#000000", border: "none", borderRadius: "4px", fontSize: "14px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: "10px" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        Continue with Google
                    </button>
                </div>
            </div>
        </div>
    );
}
