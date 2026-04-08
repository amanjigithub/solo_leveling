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
// ANTHROPIC API
// ─────────────────────────────────────────
export async function callClaude(messages, systemPrompt) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: systemPrompt,
            messages,
        }),
    });
    const data = await res.json();
    return data.content?.map(b => b.text || "").join("") || "";
}
