// =============================================================================
// 🗡️  Solo Leveling — Firebase Cloud Function: AI Proxy
// =============================================================================
//
// 📖 WHAT IS THIS FILE?
//
// This is a "serverless function" — code that runs on Google's servers, NOT in
// the user's browser. It acts as a secure middleman between your app and OpenRouter.
//
// THE PROBLEM IT SOLVES:
//   ❌ Before: Browser → OpenRouter (API key is VISIBLE in DevTools → Network tab)
//   ✅ After:  Browser → THIS FUNCTION → OpenRouter (API key never touches browser)
//
// HOW IT WORKS:
//   1. Your React app sends a request to this function with just the message
//   2. This function reads the secret API key from Firebase's secure environment
//   3. This function calls OpenRouter with that secret key
//   4. This function returns the AI response to your app
//
// The API key lives in Firebase's secure environment, NOT in your frontend code.
//
// =============================================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");

// ── Tell Firebase to run this function in the US (closest to most users) ──────
setGlobalOptions({ region: "us-central1" });

// ── Securely read the API key from Firebase's secret manager ──────────────────
// 📖 EXPLANATION: Instead of hardcoding the API key here (bad!) or putting it
// in .env (also bad for backend!), Firebase has a "Secret Manager" — a secure
// vault. We declare that this function needs this secret, and Firebase provides
// it at runtime without it ever appearing in code or logs.
const openRouterApiKey = defineSecret("OPENROUTER_API_KEY");

// ── The models we'll try (in order) — free tier auto-rotation ─────────────────
const MODELS = [
    "google/gemini-2.5-flash:free",
    "deepseek/deepseek-v4-flash:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
];

// =============================================================================
// 📡 The actual Cloud Function: callAI
// =============================================================================
// "onCall" = an HTTPS Callable Function. The Firebase SDK handles:
//   - Authentication (who is calling this function?)
//   - CORS (no cross-origin issues)
//   - Serialization (converting data to/from JSON automatically)
//
// Usage from frontend:
//   const callAI = httpsCallable(functions, 'callAI');
//   const result = await callAI({ messages, systemPrompt });
//
exports.callAI = onCall(
    {
        // ── Security: only logged-in users can call this function ─────────
        // Without this, anyone on the internet could call your function
        // and rack up OpenRouter bills on your account!
        enforceAppCheck: false, // set to true if you add App Check later
        secrets: [openRouterApiKey], // inject the secret into this function's env
    },
    async (request) => {
        // ── Who is calling? ───────────────────────────────────────────────
        // request.auth contains the Firebase user info (uid, email, etc.)
        // If they're not logged in, request.auth will be null
        if (!request.auth) {
            // HttpsError codes: https://firebase.google.com/docs/reference/node/firebase-admin.firestore
            throw new HttpsError(
                "unauthenticated",
                "You must be logged in to use the AI System."
            );
        }

        // ── Extract the data sent from the frontend ───────────────────────
        const { messages, systemPrompt } = request.data;

        // ── Validate input ────────────────────────────────────────────────
        if (!messages || !Array.isArray(messages)) {
            throw new HttpsError("invalid-argument", "messages must be an array");
        }
        if (!systemPrompt || typeof systemPrompt !== "string") {
            throw new HttpsError("invalid-argument", "systemPrompt must be a string");
        }

        // ── Try each model in sequence (same fallback logic as before) ─────
        let lastError;
        for (const model of MODELS) {
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        // ✅ API key is READ FROM SECURE ENVIRONMENT — never touches browser!
                        "Authorization": `Bearer ${openRouterApiKey.value()}`,
                        "HTTP-Referer": "https://shadow-system-d5f7f.web.app",
                        "X-Title": "Solo Leveling Shadow System",
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...messages,
                        ],
                        max_tokens: 400,
                        temperature: 0.85,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error?.message || `OpenRouter error ${response.status}`);
                }

                const text = data?.choices?.[0]?.message?.content || "";
                console.log(`[callAI] Success with model: ${model}, uid: ${request.auth.uid}`);
                return { text }; // ← Return to frontend

            } catch (err) {
                console.warn(`[callAI] Model ${model} failed:`, err.message);
                lastError = err;
            }
        }

        // All models failed
        console.error("[callAI] All models failed:", lastError?.message);
        throw new HttpsError("internal", `AI unavailable: ${lastError?.message || "unknown error"}`);
    }
);
