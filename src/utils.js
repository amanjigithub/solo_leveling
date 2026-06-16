import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase.js";

// ─────────────────────────────────────────
// SIMPLE HASH (for demo — not cryptographic)
// ─────────────────────────────────────────
export function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36) + password.length.toString(36) + "SYS";
}

// ─────────────────────────────────────────
// PASSWORD STRENGTH CHECKER
// ─────────────────────────────────────────
export function analyzePassword(pw) {
    const checks = [
        { id: "length", label: "At least 8 characters", pass: pw.length >= 8 },
        { id: "upper", label: "Contains uppercase letter", pass: /[A-Z]/.test(pw) },
        { id: "lower", label: "Contains lowercase letter", pass: /[a-z]/.test(pw) },
        { id: "number", label: "Contains a number", pass: /[0-9]/.test(pw) },
        { id: "special", label: "Contains special character", pass: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw) },
        {
            id: "nocommon", label: "Not a common password",
            pass: !["password", "123456", "qwerty", "hunter", "shadow", "system", "abc123", "letmein", "welcome"].includes(pw.toLowerCase()),
        },
    ];
    const score = checks.filter(c => c.pass).length;
    const strength =
        score <= 2 ? "WEAK" : score <= 4 ? "MODERATE" : score === 5 ? "STRONG" : "SOVEREIGN";
    const strengthColor =
        score <= 2 ? "#ff2244" : score <= 4 ? "#FF9800" : score === 5 ? "#4CAF50" : "#FFD700";
    return { checks, score, strength, strengthColor };
}

// ─────────────────────────────────────────
// OPENROUTER AI  — secure via Firebase Cloud Function
//
// 📖 HOW THIS WORKS:
//   Before: Browser → OpenRouter directly (API key visible in DevTools!)
//   After:  Browser → Firebase Cloud Function → OpenRouter (key is hidden!)
//
// The Firebase Cloud Function reads the API key from Firebase's Secret Manager
// (a secure vault) — the key never appears in browser network requests.
//
// FALLBACK: If the Cloud Function isn't deployed yet, we fall back to the
// direct call. Remove this fallback once the function is deployed.
// ─────────────────────────────────────────

// Initialize Firebase Functions SDK
// "us-central1" is the region our Cloud Function is deployed to
let _functions = null;
let _callAI = null;

function getCallAI() {
    if (!_callAI && app) {
        _functions = getFunctions(app, "us-central1");
        // httpsCallable creates a reference to our deployed function
        // Calling _callAI({ messages, systemPrompt }) will:
        //   1. Send the request to Firebase's servers
        //   2. Firebase runs our Cloud Function
        //   3. Our Cloud Function calls OpenRouter securely
        //   4. The AI response comes back to us
        _callAI = httpsCallable(_functions, "callAI");
    }
    return _callAI;
}

// ── Fallback: direct OpenRouter call (used ONLY if Cloud Function not deployed) ─
// TODO: Remove this entire block after deploying the Cloud Function
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
const OPENROUTER_URL     = import.meta.env.DEV
    ? "/api/openrouter/chat/completions"          // dev: proxied via Vite
    : "https://openrouter.ai/api/v1/chat/completions"; // prod: direct

const MODEL_PRIMARY  = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-2.5-flash:free";
const MODEL_FALLBACK = "deepseek/deepseek-v4-flash:free";
const MODEL_FALLBACK2 = "nvidia/nemotron-3-super-120b-a12b:free";

async function callOpenRouterDirect(model, messages, systemPrompt) {
    const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": window.location.origin,
            "X-Title": "Solo Leveling Shadow System",
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ],
            max_tokens: 400,
            temperature: 0.85,
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `OpenRouter error ${res.status}`);
    return data?.choices?.[0]?.message?.content || "";
}

// ── Main export: callClaude ─────────────────────────────────────────
export async function callClaude(messages, systemPrompt) {
    // ── SECURE PATH: Use Cloud Function (deployed) ──────────────────────
    const callAI = getCallAI();
    if (callAI) {
        try {
            const result = await callAI({ messages, systemPrompt });
            let text = result.data.text;

            // Extract JSON if needed (same logic as before)
            if (systemPrompt.includes("JSON")) {
                const match = text.match(/\[[\s\S]*?\]/);
                if (match) text = match[0];
            }

            return text.trim();
        } catch (cloudErr) {
            // If Cloud Function fails (not deployed, network error, etc.),
            // fall through to the direct call below
            console.warn("[Cloud Function] Failed, falling back to direct:", cloudErr.message);
        }
    }

    // ── FALLBACK PATH: Direct OpenRouter call (remove after deploying function) ─
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.startsWith("YOUR_")) {
        throw new Error("OpenRouter API key not set. Add VITE_OPENROUTER_API_KEY to your .env file.");
    }

    let lastError;
    for (const model of [MODEL_PRIMARY, MODEL_FALLBACK, MODEL_FALLBACK2]) {
        try {
            let text = await callOpenRouterDirect(model, messages, systemPrompt);

            if (systemPrompt.includes("JSON")) {
                const match = text.match(/\[[\s\S]*?\]/);
                if (match) text = match[0];
            }

            return text.trim();
        } catch (err) {
            console.warn(`[OpenRouter Direct] Model ${model} failed:`, err.message);
            lastError = err;
        }
    }

    throw lastError;
}

// ── B-02 FIX: Themed AI error translator ────────────────────────────────────
// Maps raw HTTP / network errors from OpenRouter / Firebase Cloud Functions
// into dramatic, in-universe System messages so the user never sees raw API
// error strings like "OpenRouter error 429" in the chat panel.
//
// Usage:  catch (err) { setAiChat({ ..., answer: themedAIError(err) }); }
// ────────────────────────────────────────────────────────────────────────────
export function themedAIError(err) {
    const msg = (err?.message || "").toLowerCase();

    // Rate-limited / quota exceeded
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("quota")) {
        return "[SYSTEM ALERT] ⚠ The Void is temporarily overwhelmed. Too many Hunters are querying the System at once. Rest for a moment, then try again.";
    }

    // Auth / API key issues
    if (msg.includes("401") || msg.includes("403") || msg.includes("api key") || msg.includes("unauthorized")) {
        return "[SYSTEM ALERT] ⚠ Gateway authentication failed. The System's seal is broken. Report this to your administrator.";
    }

    // Service unavailable / gateway errors
    if (msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("unavailable")) {
        return "[SYSTEM ALERT] ⚠ The dimensional gateway is currently unstable. The AI oracle cannot be reached. Stand by, Hunter.";
    }

    // Network / offline
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch") || msg.includes("offline")) {
        return "[SYSTEM ALERT] ⚠ Connection to the Shadow Realm severed. Check your network link and try again.";
    }

    // Timeout
    if (msg.includes("timeout") || msg.includes("timed out")) {
        return "[SYSTEM ALERT] ⚠ The oracle did not respond in time. The System's patience has limits. Try again shortly.";
    }

    // AI returned unparseable / non-JSON response (quest generation only)
    if (msg.includes("text response") || msg.includes("plain text") || msg.includes("json")) {
        return "[SYSTEM ALERT] ⚠ The oracle spoke in riddles instead of data. The System could not parse the prophecy. Rephrase your request or try again.";
    }

    // API key not configured (local dev only)
    if (msg.includes("openrouter api key not set")) {
        return "[SYSTEM OFFLINE] ⚠ The AI oracle is not configured. The System requires a valid API key to channel its power.";
    }

    // Generic fallback — still themed, never raw
    return "[SYSTEM ALERT] ⚠ An unknown disturbance disrupted the oracle. The void is silent for now — try again, Hunter.";
}
