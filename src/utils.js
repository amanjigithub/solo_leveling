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
    const res = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "openai",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ]
        }),
    });
    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || "";
    
    // Strip Pollinations legacy warning if it exists
    text = text.replace(/⚠️ \*\*IMPORTANT NOTICE\*\*(.|\n)*?continue to work normally\.\)?/gi, "");
    if (text.includes("pollinations.ai")) {
        text = text.split('\n').filter(line => !line.toLowerCase().includes("pollinations.ai")).join('\n');
    }

    // If it's a quest generation, ensure we only return the JSON array
    if (systemPrompt.includes("JSON")) {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) text = match[0];
    }

    return text.trim();
}
