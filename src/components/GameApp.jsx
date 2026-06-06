import { useState, useEffect, useCallback, useRef } from "react";
import { STORAGE_KEY, RANKS, RANK_COLORS, TITLES, DEFAULT_GAME_STATE } from "../constants.js";
import { callClaude } from "../utils.js";
import { doc, setDoc, onSnapshot } from "../firebase.js";
import { db } from "../firebase.js";
import { motion, AnimatePresence } from "framer-motion";
import DungeonFocusOverlay from "./DungeonFocusOverlay.jsx";
import { useDungeonStore } from "../store/useDungeonStore.js";

// ── Local cache helpers ──────────────────────────────────────────────────────
const localLoad = (uid) => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY(uid));
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};
const localSave = (uid, state) => {
    try { localStorage.setItem(STORAGE_KEY(uid), JSON.stringify(state)); } catch { }
};

export default function GameApp({ session, onLogout }) {
    const [state, setState] = useState(null);
    const [tab, setTab] = useState("quests");
    const [toast, setToast] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiChat, setAiChat] = useState(null);
    const [chatInput, setChatInput] = useState("");
    // dungeonTimer + timerRef moved to useDungeonStore (see DungeonFocusOverlay)
    const [newQuestName, setNewQuestName] = useState("");
    const [newQuestType, setNewQuestType] = useState("bonus");
    const [newQuestStat, setNewQuestStat] = useState("STR");
    const timerRef = useRef(null); // kept for potential future use
    // ── Debounce ref: delays Firestore writes by 500ms after last change ──────
    // Without this, every single state update triggers a Firestore write.
    // With debouncing: we wait until the user stops changing things for 500ms.
    // Example: user types in quest name → we don't write 10 times, just once.
    const saveDebounceRef = useRef(null);

    // ── Push notification state ───────────────────────────────────────────────
    // Tracks browser Notification permission: 'default' | 'granted' | 'denied'
    const [notifStatus, setNotifStatus] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );
    const midnightTimerRef = useRef(null); // stores the setTimeout id for midnight alert

    // ── Schedule daily quest-reset notification ──────────────────────────────
    // 📖 HOW THIS WORKS:
    // 1. We calculate milliseconds until the NEXT midnight (local time).
    // 2. We set a setTimeout for that duration.
    // 3. When it fires, we show a notification via the Service Worker.
    //    Using SW.showNotification (instead of new Notification()) means it
    //    works even when the browser tab is in the background.
    // 4. After showing, we recurse to schedule the NEXT midnight.
    //
    // Limitation: if the user force-quits the browser, the timer is lost.
    // True server-push (VAPID) would survive that — but requires a backend.
    const scheduleMidnightNotification = () => {
        // Clear any existing timer first (prevent duplicates)
        if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);

        const now = new Date();
        const midnight = new Date(
            now.getFullYear(), now.getMonth(), now.getDate() + 1, // tomorrow
            0, 0, 0, 0 // 00:00:00.000
        );
        const msUntilMidnight = midnight.getTime() - now.getTime();

        midnightTimerRef.current = setTimeout(async () => {
            try {
                // Use Service Worker registration to show notification
                // (works even when the tab is minimised)
                const reg = await navigator.serviceWorker?.ready;
                if (reg) {
                    reg.showNotification('Shadow System', {
                        body: '🗡️ Daily quests have reset. Rise, Hunter. The System awaits.',
                        icon: '/pwa-192x192.png',
                        badge: '/pwa-192x192.png',
                        tag: 'daily-reset',          // replaces any previous notification with same tag
                        renotify: true,               // vibrate even if replacing existing
                        data: { url: window.location.origin },
                    });
                }
            } catch (e) {
                console.warn('[PWA] Notification failed:', e);
            }
            // Schedule again for the NEXT midnight
            scheduleMidnightNotification();
        }, msUntilMidnight);
    };

    // ── Request notification permission + start schedule ─────────────────────
    const requestNotifPermission = async () => {
        if (!('Notification' in window)) return; // unsupported browser
        const permission = await Notification.requestPermission();
        setNotifStatus(permission);
        if (permission === 'granted') scheduleMidnightNotification();
    };

    // ── Auto-start scheduling if permission already granted ───────────────────
    useEffect(() => {
        if (notifStatus === 'granted') scheduleMidnightNotification();
        // Cleanup: cancel the timer on unmount / logout
        return () => { if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Zustand dungeon store ─────────────────────────────────────────
    // 📖 Instead of managing dungeon + timer state here in GameApp,
    // we delegate to the Zustand store. DungeonFocusOverlay reads from it directly.
    // This means the 1-second timer tick NO LONGER causes GameApp to re-render!
    const setDungeonFromStore = useDungeonStore(s => s.setDungeon);

    const SK = STORAGE_KEY(session.uid);

    useEffect(() => {
        const uid = session.uid;

        // ──────────────────────────────────────────────────────────────────────
        // 📖 WHAT IS HAPPENING HERE?
        //
        // Before: getDoc() → fetches data ONCE, then disconnects.
        // Now:    onSnapshot() → fetches data AND keeps a LIVE connection open.
        //         Whenever Firestore data changes (from ANY device), this callback
        //         runs automatically. The app updates in real time — no refresh needed.
        // ──────────────────────────────────────────────────────────────────────

        // Helper: apply daily reset logic in one place (reused for both local and Firestore)
        const applyDailyReset = (data) => {
            const today = new Date().toDateString();
            if (data.lastQuestReset !== today) {
                const lastLogin = data.player?.lastLoginDate;
                const yesterday = new Date(Date.now() - 86400000).toDateString();
                return {
                    ...data,
                    quests: data.quests.map(q => ({ ...q, done: false })),
                    lastQuestReset: today,
                    player: {
                        ...data.player,
                        streak: lastLogin === yesterday ? (data.player.streak + 1)
                               : lastLogin === today    ? data.player.streak
                               : 0,
                        lastLoginDate: today,
                    },
                };
            }
            return data;
        };

        // ── Step 1: Show local cache instantly (zero loading time) ─────────
        const cached = localLoad(uid);
        if (cached) {
            const resetCached = applyDailyReset(cached);
            if (resetCached !== cached) localSave(uid, resetCached); // persist reset
            setState(resetCached);
        }

        // ── Step 2: Open real-time Firestore listener ──────────────────────
        // onSnapshot() returns an "unsubscribe" function.
        // We MUST call it when done, or the connection leaks (stays open forever).
        const docRef = doc(db, "hunters", uid);
        const unsubscribe = onSnapshot(
            docRef,
            (snap) => {
                // This callback fires:
                //   • Immediately when you first call onSnapshot() (initial load)
                //   • Every time the Firestore document changes (from ANY device)

                if (snap.exists()) {
                    let loaded = snap.data();
                    loaded = applyDailyReset(loaded);

                    setState(prev => {
                        // Safety check: don't overwrite local data that has MORE quests
                        // (This protects against stale cloud data overwriting new local quests)
                        const prevCount = prev ? prev.quests?.length ?? 0 : 0;
                        const remoteCount = loaded.quests?.length ?? 0;
                        if (!prev || remoteCount >= prevCount) {
                            localSave(uid, loaded);
                            // ── Sync dungeon state into Zustand store ──────────────────
                            // 📖 DungeonFocusOverlay reads from useDungeonStore, not from state.
                            // So when Firestore data loads, we push dungeon data into the store.
                            // This keeps the store and Firestore in sync automatically.
                            if (loaded.dungeon) setDungeonFromStore(loaded.dungeon);
                            return loaded;
                        }
                        return prev;
                    });
                } else if (!cached) {
                    // New user — no Firestore doc AND no local cache → create fresh state
                    const fresh = DEFAULT_GAME_STATE(uid, session.username);
                    localSave(uid, fresh);
                    setState(fresh);
                }
            },
            (error) => {
                // Firestore listener failed (no internet, rules rejected, etc.)
                // Gracefully fall back to local cache — app still works offline
                console.warn("[Firestore] onSnapshot error, using local cache:", error.message);
                if (!cached) {
                    const fresh = DEFAULT_GAME_STATE(uid, session.username);
                    localSave(uid, fresh);
                    setState(fresh);
                }
            }
        );

        // ── Cleanup: React calls this when the component unmounts ──────────
        // This closes the WebSocket connection to Firestore.
        // Without this, the listener would keep running even after logout.
        // Think of it as hanging up the phone when the call is over.
        return () => {
            unsubscribe(); // 📴 Close the live connection
        };
    }, [session.uid]);

    const save = useCallback(async (s) => {
        // Always save to localStorage first (instant, reliable)
        localSave(session.uid, s);

        // ── Debounced Firestore write ──────────────────────────────────────
        // Instead of writing to Firestore immediately on every state change,
        // we wait 500ms. If another change happens within that 500ms, we reset
        // the timer. Only the LAST change within each 500ms window gets written.
        //
        // WHY? Without debouncing:
        //   User clicks "complete quest" → 1 Firestore write (fine)
        //   User types 10 characters → 10 Firestore writes (wasteful!)
        //
        // With debouncing:
        //   User types 10 characters fast → only 1 Firestore write (efficient)
        if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = setTimeout(async () => {
            try {
                await setDoc(doc(db, "hunters", session.uid), s);
            } catch (e) {
                console.warn("[Firestore] Save failed, data kept in localStorage:", e.message);
            }
        }, 500);
    }, [session.uid]);

    const update = useCallback((fn) => {
        setState(prev => {
            const next = fn(prev);
            save(next);
            return next;
        });
    }, [save]);

    const addLog = (s, msg, type = "info") => ({
        ...s,
        systemLog: [{ id: Date.now() + Math.random(), msg, type, time: Date.now() }, ...s.systemLog.slice(0, 49)],
    });

    const completeQuest = (questId) => {
        update(prev => {
            const quest = prev.quests.find(q => q.id === questId);
            if (!quest || quest.done) return prev;
            let s = { ...prev };
            s.quests = s.quests.map(q => q.id === questId ? { ...q, done: true, streak: q.streak + 1 } : q);
            let player = { ...s.player };
            player.xp += quest.xp;
            player.totalCompleted += 1;
            player.stats = { ...player.stats, [quest.stat]: (player.stats[quest.stat] || 10) + 1 };
            let leveledUp = false;
            while (player.xp >= player.xpToNext) { player.xp -= player.xpToNext; player.level += 1; player.xpToNext = Math.floor(player.xpToNext * 1.4); leveledUp = true; }
            let rankedUp = false;
            const newRankIdx = Math.min(Math.floor((player.level - 1) / 10), RANKS.length - 1);
            const newRank = RANKS[newRankIdx];
            if (newRank !== player.rank) { player.rank = newRank; player.title = TITLES[newRank]; rankedUp = true; }
            if (quest.streak % 7 === 0 && quest.streak > 0) {
                const existingShadow = s.shadows.find(sh => sh.questId === questId);
                if (!existingShadow) {
                    s.shadows = [...s.shadows, { id: `sh-${questId}`, questId, name: quest.name, emoji: quest.emoji, streak: quest.streak, level: 1 }];
                    s = addLog(s, `Shadow extracted: "${quest.name}" has joined your army!`, "shadow");
                } else {
                    s.shadows = s.shadows.map(sh => sh.questId === questId ? { ...sh, streak: quest.streak, level: sh.level + 1 } : sh);
                }
            }
            s.player = player;
            s = addLog(s, `Quest complete: "${quest.name}" — +${quest.xp} XP, +1 ${quest.stat}`, "complete");
            if (leveledUp) s = addLog(s, `LEVEL UP! Now Level ${player.level}!`, "levelup");
            if (rankedUp) s = addLog(s, `RANK UP! Achieved ${player.rank}-Rank!`, "rankup");
            if (rankedUp) setTimeout(() => setToast({ type: "rankup", data: player }), 100);
            else if (leveledUp) setTimeout(() => setToast({ type: "levelup", data: player }), 100);
            return s;
        });
    };

    const uncompleteQuest = (questId) => {
        update(prev => {
            const quest = prev.quests.find(q => q.id === questId);
            if (!quest || !quest.done) return prev;
            let s = { ...prev };
            s.quests = s.quests.map(q => q.id === questId ? { ...q, done: false, streak: Math.max(0, q.streak - 1) } : q);

            let p = { ...s.player };
            p.xp -= quest.xp;
            p.totalCompleted = Math.max(0, p.totalCompleted - 1);
            p.stats = { ...p.stats, [quest.stat]: Math.max(10, (p.stats[quest.stat] || 10) - 1) };

            while (p.xp < 0 && p.level > 1) {
                p.level -= 1;
                let targetXp = 1000;
                for (let i = 1; i < p.level; i++) targetXp = Math.floor(targetXp * 1.4);
                p.xpToNext = targetXp;
                p.xp += p.xpToNext;
            }
            if (p.xp < 0 && p.level === 1) p.xp = 0;

            const newRankIdx = Math.min(Math.floor((p.level - 1) / 10), RANKS.length - 1);
            p.rank = RANKS[newRankIdx];
            p.title = TITLES[p.rank];

            s.player = p;
            return s;
        });
    };

    const addQuest = () => {
        if (!newQuestName.trim()) return;
        const newQ = { id: `q-${Date.now()}`, name: newQuestName.trim(), type: newQuestType, stat: newQuestStat, xp: newQuestType === "mandatory" ? 800 : 500, done: false, streak: 0, emoji: "⭐" };
        update(prev => { let s = { ...prev, quests: [...prev.quests, newQ] }; return addLog(s, `New quest: "${newQ.name}"`, "info"); });
        setNewQuestName("");
    };

    const deleteQuest = (id) => update(prev => ({ ...prev, quests: prev.quests.filter(q => q.id !== id) }));

    // ── enterDungeon / startFocusBlock / completeFocusBlock / retreatDungeon ───────
    // These are now handled INSIDE DungeonFocusOverlay via useDungeonStore.
    // GameApp only needs a callback for when XP should be awarded:
    const handleDungeonBlockComplete = (xpEarned, defeated) => {
        update(prev => {
            let s = { ...prev };
            s.player = { ...s.player, xp: s.player.xp + xpEarned };
            if (defeated) {
                setTimeout(() => setToast({ type: "dungeon", data: prev.dungeon?.bossName || "Boss" }), 100);
            }
            return s;
        });
    };

    const handleDungeonLog = (msg, type) => {
        update(prev => addLog(prev, msg, type));
    };

    // ── JSON extraction helper ────────────────────────────────────────────────
    // 📖 WHY THIS EXISTS:
    // Free AI models sometimes ignore "return ONLY JSON" instructions.
    // They might say "We need to know more..." or wrap JSON in explanation text.
    // This function tries MULTIPLE strategies to find valid JSON in any response.
    //
    // Strategy 1: Find a [...] array directly
    // Strategy 2: Strip markdown code fences (```json ... ```) then parse
    // Strategy 3: Find the first [ to the last ] in the whole string
    // Strategy 4: Synthesize quests from plain text response (fallback)
    const extractQuestJSON = (raw) => {
        // Strategy 1: Find a clean [...] array block
        const arrMatch = raw.match(/\[[\s\S]*?\]/);
        if (arrMatch) {
            try { return JSON.parse(arrMatch[0]); } catch (_) { /* try next */ }
        }

        // Strategy 2: Strip markdown fences, then try to parse the whole thing
        const stripped = raw.replace(/```json|```/gi, "").trim();
        if (stripped.startsWith("[")) {
            try { return JSON.parse(stripped); } catch (_) { /* try next */ }
        }

        // Strategy 3: Find first [ and last ] and try that substring
        const start = raw.indexOf("[");
        const end   = raw.lastIndexOf("]");
        if (start !== -1 && end > start) {
            try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { /* try next */ }
        }

        // 📖 Strategy 4: AI returned plain text (free models often do this).
        // We scan the text for numbered lines or bullet points and build
        // quest objects from the words we find. It's not perfect but works
        // much better than showing an error.
        //
        // Example AI text it can handle:
        //   "1. Complete 2 coding problems on LeetCode (INT)"
        //   "• Study for 1 hour - Vitality boost"
        //   "- Go to the gym for 30 minutes"
        const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);
        const questLines = lines.filter(l =>
            /^[\d•\-\*>]+/.test(l) ||      // starts with number, bullet, dash
            l.toLowerCase().includes("quest") ||
            l.toLowerCase().includes("complete") ||
            l.toLowerCase().includes("study") ||
            l.toLowerCase().includes("exercise") ||
            l.toLowerCase().includes("practice")
        );

        if (questLines.length >= 1) {
            // Map stat keywords to stat codes
            const statMap = [
                { keys: ["study","read","learn","code","leetcode","assignment","exam","math","problem","mental","book","research"], stat: "INT" },
                { keys: ["gym","exercise","workout","run","push","lift","physical","training","strength"], stat: "STR" },
                { keys: ["sleep","diet","health","eat","meal","rest","vitamin","water","hydrat"], stat: "VIT" },
                { keys: ["walk","jog","cycle","sprint","speed","agil","stretch","yoga","move"], stat: "AGI" },
                { keys: ["meditat","focus","breath","mindful","sense","reflect","journal"], stat: "SEN" },
            ];
            const emojiMap = { STR: "💪", INT: "📚", VIT: "❤️", AGI: "⚡", SEN: "🎯" };

            const getStat = (text) => {
                const lower = text.toLowerCase();
                for (const { keys, stat } of statMap) {
                    if (keys.some(k => lower.includes(k))) return stat;
                }
                return "INT"; // default for students
            };

            // Clean up the line: remove numbering / bullets at the start
            const cleanName = (l) => l.replace(/^[\d\.\)•\-\*>]+\s*/, "").replace(/\(.*?\)/g, "").trim();

            const syntheticQuests = questLines.slice(0, 3).map((line, i) => ({
                name: cleanName(line) || `Quest ${i + 1}`,
                type: i === 0 ? "mandatory" : "bonus",
                stat: getStat(line),
                emoji: emojiMap[getStat(line)] || "⭐",
            }));

            // Pad to 3 quests if AI only gave us 1-2 lines
            while (syntheticQuests.length < 3) {
                const fallbacks = [
                    { name: "Complete one focused study session", type: "mandatory", stat: "INT", emoji: "📚" },
                    { name: "30 minutes of physical activity", type: "bonus",     stat: "STR", emoji: "💪" },
                    { name: "10 minutes of mindful reflection", type: "bonus",     stat: "SEN", emoji: "🎯" },
                ];
                syntheticQuests.push(fallbacks[syntheticQuests.length]);
            }

            return syntheticQuests;
        }

        // All strategies failed — AI returned plain text, not JSON
        // Throw a friendly error that explains what happened
        throw new Error(
            "The AI returned a text response instead of quest data. " +
            "This sometimes happens with free AI models. Tap 'Try again' or rephrase your request."
        );
    };

    // Strict JSON-only prompt used as a RETRY if the first attempt fails
    // Strict JSON-only prompt — more aggressive, no room for the AI to talk back
    const STRICT_QUEST_PROMPT = `Return ONLY a raw JSON array. No text before or after. No markdown. No explanation. DO NOT say anything. ONLY output: [{"name":"...","type":"mandatory","stat":"STR","emoji":"⚔"}]. Any other output is WRONG. Three items.`;

    const askSystem = async () => {
        if (!chatInput.trim() || aiLoading || !state) return;
        const q = chatInput.trim(); setChatInput(""); setAiLoading(true);

        // ── Intent detection: does the user want quests generated? ──────
        // Catches: "I'm a btech student", "I am a developer", "create quests",
        //          "quests according to me", "set quests", "suggest quests", etc.
        const wantsQuests = /add quest|generate quest|create quest|suggest quest|give me quest|quests for me|set quest|make quest|quests? (based on|according to|for a|as a|suited|related)|i('m| am) (a |an )?.*(student|developer|engineer|athlete|designer|writer|gamer|btech|mtech|coder|programmer|doctor|artist|musician|teacher)|my background|personali[sz]/i.test(q);

        if (wantsQuests) {
            // Generate personalized quests based on user's context, then actually add them
            const questPmt = `You are the System from Solo Leveling. The hunter described themselves: "${q}". Generate exactly 3 highly personalized daily quests for them. DO NOT write any explanation, greeting, or text. DO NOT use markdown. ONLY output a valid JSON array, nothing else: [{"name":"specific quest name","type":"mandatory|bonus","stat":"STR|INT|VIT|AGI|SEN","emoji":"single emoji"}]. Stat guide: STR=physical/gym, INT=study/coding/mental, VIT=health/sleep/diet, AGI=movement/speed, SEN=focus/meditation. Quests must be concrete, actionable, and tailored to their background. First quest is mandatory, rest are bonus.`;
            try {
                // 📖 ATTEMPT 1: Ask the AI normally
                const raw = await callClaude([{ role: "user", content: q }], questPmt);

                let quests;
                try {
                    // 📖 Try to extract JSON from the response using multiple strategies
                    quests = extractQuestJSON(raw);
                } catch {
                    // 📖 ATTEMPT 2 (RETRY): AI gave us text — ask again with ultra-strict prompt
                    // The retry has NO context, just the strict JSON requirement
                    console.warn("[AI] First attempt returned non-JSON, retrying with strict prompt...");
                    const raw2 = await callClaude(
                        [{ role: "user", content: `Generate 3 daily quests for a ${q}. ${STRICT_QUEST_PROMPT}` }],
                        STRICT_QUEST_PROMPT
                    );
                    // If this ALSO fails, extractQuestJSON will throw and the outer catch handles it
                    quests = extractQuestJSON(raw2);
                }

                update(prev => {
                    const nq = quests.map((quest, i) => ({
                        id: `ai-q-${Date.now()}-${i}`,
                        name: quest.name,
                        type: quest.type || "bonus",
                        stat: quest.stat || "INT",
                        xp: quest.type === "mandatory" ? 800 : 500,
                        done: false,
                        streak: 0,
                        emoji: quest.emoji || "⭐"
                    }));
                    return addLog({ ...prev, quests: [...prev.quests, ...nq] }, `System analyzed your profile and added ${nq.length} personalized quests.`, "ai");
                });
                setAiChat({ question: q, answer: `[SYSTEM] Hunter profile analyzed. ${quests.length} custom quests deployed to your quest log. The System has spoken — now arise and complete them.` });
            } catch (err) {
                console.error("[AI] Quest generation error:", err);
                // 📖 Show the friendly error message, not the raw JS error
                setAiChat({ question: q, answer: `[SYSTEM ERROR] ${err.message || "Quest generation failed. Try again."}` });
            }
        } else {
            // Regular motivational chat
            const sysPmt = `You are the mysterious System from Solo Leveling — an all-knowing AI guiding a Hunter. Speak in short, dramatic, cryptic, motivational messages. Use [SYSTEM] or [ALERT] tags occasionally. Under 80 words. Be intense. Player: Level ${state.player.level}, Rank ${state.player.rank}, ${state.player.streak} day streak. Completed: ${state.quests.filter(q => q.done).length}/${state.quests.length} quests today.`;
            try {
                const ans = await callClaude([{ role: "user", content: q }], sysPmt);
                setAiChat({ question: q, answer: ans });
            } catch (err) {
                console.error("[AI] Chat error:", err);
                setAiChat({ question: q, answer: `[SYSTEM ERROR] ${err.message || "The void is silent. Try again."}` });
            }
        }
        setAiLoading(false);
    };

    const generateQuests = async () => {
        if (aiLoading || !state) return;
        setAiLoading(true);
        const sysPmt = `You are the System from Solo Leveling. Generate exactly 3 new daily quest suggestions. Return ONLY valid JSON array — no markdown, no explanation: [{"name":"quest name","type":"mandatory|bonus","stat":"STR|INT|VIT|AGI|SEN","emoji":"single emoji"}] Stat guide: STR=physical, INT=mental, VIT=health/sleep, AGI=movement, SEN=mindfulness. Hunter rank: ${state.player.rank}. Make quests realistic habits at that level.`;
        try {
            const raw = await callClaude([{ role: "user", content: "Generate 3 quests" }], sysPmt);
            // 📖 Use the same robust extraction helper — handles all AI response formats
            const quests = extractQuestJSON(raw);
            update(prev => {
                const nq = quests.map((q, i) => ({ id: `ai-q-${Date.now()}-${i}`, name: q.name, type: q.type || "bonus", stat: q.stat || "INT", xp: q.type === "mandatory" ? 800 : 500, done: false, streak: 0, emoji: q.emoji || "⭐" }));
                return addLog({ ...prev, quests: [...prev.quests, ...nq] }, `System generated ${nq.length} new quests.`, "ai");
            });
        } catch (err) {
            update(prev => addLog(prev, `Failed to generate quests: ${err.message}`, "system"));
        }
        setAiLoading(false);
    };

    // formatTimer is now only needed as a local helper if needed elsewhere
    // (timer display is handled by DungeonFocusOverlay)

    if (!state) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
            <div style={{ textAlign: "center", color: "#00a8ff", fontFamily: "'Orbitron',monospace", fontSize: 12, letterSpacing: 4 }}>
                <div className="spin" style={{ fontSize: 32, marginBottom: 16 }}>⚔</div>
                <div>LOADING HUNTER DATA...</div>
            </div>
        </div>
    );

    const rankColor = RANK_COLORS[state.player.rank];
    const xpPct = Math.floor((state.player.xp / state.player.xpToNext) * 100);
    const statMax = Math.max(...Object.values(state.player.stats), 20);
    const statBars = [
        { key: "STR", label: "STRENGTH", emoji: "💪", cls: "bar-red" },
        { key: "INT", label: "INTEL", emoji: "🧠", cls: "bar-blue" },
        { key: "VIT", label: "VITALITY", emoji: "❤️", cls: "bar-green" },
        { key: "AGI", label: "AGILITY", emoji: "⚡", cls: "bar-purple" },
        { key: "SEN", label: "SENSE", emoji: "🎯", cls: "bar-gold" },
    ];

    return (
        <div className="game-container">
            {/* Toast */}
            {toast && (
                <div className="overlay" onClick={() => setToast(null)}>
                    <div className="toast">
                        {toast.type === "levelup" && <>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 5, color: "#00a8ff", textShadow: "0 0 10px #00a8ff" }}>LEVEL UP</div>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 80, fontWeight: 900, color: "#fff", textShadow: "0 0 30px #00a8ff", lineHeight: 1 }}>{toast.data.level}</div>
                            <div style={{ fontSize: 13, letterSpacing: 3, color: "#4a7a9b", marginTop: 8 }}>YOU HAVE GROWN STRONGER</div>
                        </>}
                        {toast.type === "rankup" && <>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 5, color: rankColor, textShadow: `0 0 10px ${rankColor}` }}>RANK UP</div>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 80, fontWeight: 900, color: rankColor, textShadow: `0 0 40px ${rankColor}`, lineHeight: 1 }}>{toast.data.rank}</div>
                            <div style={{ fontSize: 13, letterSpacing: 3, color: "#c8e8ff", marginTop: 8 }}>{TITLES[toast.data.rank]}</div>
                        </>}
                        {toast.type === "dungeon" && <>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 5, color: "#ffd700" }}>BOSS DEFEATED</div>
                            <div style={{ fontSize: 48, margin: "12px 0" }}>🏆</div>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 14, color: "#ffd700" }}>{toast.data}</div>
                        </>}
                        <div style={{ fontSize: 10, color: "#1e3a52", marginTop: 20, letterSpacing: 2 }}>CLICK TO DISMISS</div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="game-header">
                <div style={{ position: "absolute", bottom: -1, left: 0, width: 200, height: 1, background: "linear-gradient(90deg,#00a8ff,transparent)", boxShadow: "0 0 8px #00a8ff" }} />
                <div className="game-header-left">
                    <div className="clip" style={{ width: 48, height: 48, border: "1.5px solid #00a8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: "#071525", boxShadow: "0 0 20px rgba(0,168,255,0.3)", animation: "glow-pulse 3s ease-in-out infinite" }}>⚔</div>
                    <div>
                        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 4, color: "#00a8ff", textShadow: "0 0 10px #00a8ff" }}>SHADOW SYSTEM</div>
                        <div style={{ fontSize: 11, color: "#4a7a9b", letterSpacing: 2, marginTop: 2 }}>HUNTER INTERFACE v3.0</div>
                    </div>
                </div>
                <div className="game-header-right">
                    <div className="game-header-date" style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2, color: "#4a7a9b", padding: "6px 12px", border: "1px solid #0d2d47" }}>{new Date().toDateString().toUpperCase()}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #0d2d47" }}>
                        <span style={{ fontSize: 11 }}>🔥</span>
                        <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, color: "#ffd700" }}>{state.player.streak}D</span>
                    </div>
                    {/* ── Notification bell button ── */}
                    {/* Shows 🔔 when not yet granted, 🔕 when denied, glowing green when granted */}
                    {'Notification' in window && (
                        <button
                            id="notif-bell-btn"
                            title={
                                notifStatus === 'granted' ? 'Notifications ON — daily reset alerts active'
                              : notifStatus === 'denied'  ? 'Notifications blocked — enable in browser settings'
                              : 'Enable daily quest reset notifications'
                            }
                            onClick={notifStatus === 'default' ? requestNotifPermission : undefined}
                            style={{
                                background: 'none',
                                border: `1px solid ${
                                    notifStatus === 'granted' ? 'rgba(0,255,128,0.4)'
                                  : notifStatus === 'denied'  ? '#1e3a52'
                                  : '#0d2d47'
                                }`,
                                borderRadius: 0,
                                cursor: notifStatus === 'default' ? 'pointer' : 'default',
                                padding: '7px 10px',
                                fontSize: 13,
                                lineHeight: 1,
                                color: notifStatus === 'granted' ? '#00ff88' : '#4a7a9b',
                                boxShadow: notifStatus === 'granted' ? '0 0 8px rgba(0,255,128,0.3)' : 'none',
                                transition: 'all 0.3s',
                            }}
                        >
                            {notifStatus === 'denied' ? '🔕' : '🔔'}
                        </button>
                    )}
                    <button className="btn btn-red clip-sm" style={{ fontSize: 8, padding: "7px 12px" }} onClick={onLogout}>⏻ LOGOUT</button>
                </div>
            </div>

            {/* Main layout */}
            <div className="game-layout">

                {/* Player card */}
                <div className="panel clip" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div className="panel-title">▸ PLAYER STATUS</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div className="clip" style={{ width: 64, height: 64, border: `2px solid ${rankColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: "#071525", boxShadow: `0 0 20px ${rankColor}44`, flexShrink: 0 }}>🗡</div>
                        <div>
                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#fff" }}>{state.player.name}</div>
                            <div style={{ fontSize: 12, color: "#ffd700", letterSpacing: 1.5, marginTop: 2 }}>♦ {state.player.title}</div>
                            <div className="clip-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", background: `${rankColor}18`, border: `1px solid ${rankColor}`, marginTop: 6 }}>
                                <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, color: rankColor }}>◈ RANK {state.player.rank}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: 1.5, color: "#4a7a9b", marginBottom: 6 }}>
                            <span style={{ fontFamily: "'Orbitron',monospace" }}>LV.{state.player.level}</span>
                            <span style={{ color: "#00a8ff" }}>{state.player.xp.toLocaleString()} / {state.player.xpToNext.toLocaleString()} XP</span>
                        </div>
                        <div className="bar-track">
                            <div className="bar-fill bar-blue" style={{ width: `${xpPct}%` }} />
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {statBars.map(s => (
                            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{s.emoji}</span>
                                <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 7, letterSpacing: 2, color: "#4a7a9b", width: 52 }}>{s.label}</span>
                                <div className="bar-track" style={{ flex: 1, height: 5 }}>
                                    <div className={`bar-fill ${s.cls}`} style={{ width: `${Math.min((state.player.stats[s.key] / statMax) * 100, 100)}%`, transition: "width 1s" }} />
                                </div>
                                <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, color: "#c8e8ff", width: 24, textAlign: "right" }}>{state.player.stats[s.key]}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 4, borderTop: "1px solid #0d2d47" }}>
                        {[
                            { label: "QUESTS", val: state.player.totalCompleted },
                            { label: "SHADOWS", val: state.shadows.length },
                            { label: "STREAK", val: `${state.player.streak}d` },
                            { label: "RANK", val: state.player.rank },
                        ].map(item => (
                            <div key={item.label} style={{ background: "rgba(0,168,255,0.03)", border: "1px solid #0d2d47", padding: "8px 10px" }}>
                                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 7, letterSpacing: 2, color: "#4a7a9b" }}>{item.label}</div>
                                <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 14, color: "#c8e8ff", marginTop: 3 }}>{item.val}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div className="nav-tabs-row">
                        {["quests", "dungeon", "shadows", "system", "log"].map(t => (
                            <div key={t} className={`nav-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                                {t === "quests" ? "⬡ QUESTS" : t === "dungeon" ? "⚔ DUNGEON" : t === "shadows" ? "👥 SHADOWS" : t === "system" ? "🤖 AI" : "📋 LOG"}
                            </div>
                        ))}
                    </div>

                    {/* QUESTS */}
                    {tab === "quests" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div className="quest-progress-row" style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: "rgba(0,168,255,0.04)", border: "1px solid #0d2d47" }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: 1.5, color: "#4a7a9b", marginBottom: 5 }}>
                                        <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9 }}>DAILY PROGRESS</span>
                                        <span style={{ color: "#00a8ff" }}>{state.quests.filter(q => q.done).length} / {state.quests.length}</span>
                                    </div>
                                    <div className="bar-track">
                                        <div className="bar-fill bar-blue" style={{ width: `${state.quests.length ? (state.quests.filter(q => q.done).length / state.quests.length) * 100 : 0}%` }} />
                                    </div>
                                </div>
                                <button className="btn btn-purple clip-sm" style={{ fontSize: 8, padding: "8px 12px" }} onClick={generateQuests} disabled={aiLoading}>
                                    {aiLoading ? <span className="spin">⚙</span> : "AI GENERATE"}
                                </button>
                            </div>

                            {/* Quest list — wrapped in AnimatePresence for enter/exit animations */}
                            {/* 📖 AnimatePresence tracks when children are ADDED or REMOVED and plays exit animations */}
                            <AnimatePresence initial={false}>
                            {state.quests.map(q => (
                                <motion.div
                                    key={q.id}
                                    layout
                                    initial={{ opacity: 0, x: -24, height: 0 }}
                                    animate={{ opacity: 1, x: 0, height: "auto" }}
                                    exit={{ opacity: 0, x: 24, height: 0 }}
                                    transition={{ duration: 0.22, ease: "easeOut" }}
                                    className="clip-sm"
                                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: q.done ? "rgba(0,168,255,0.02)" : "rgba(0,168,255,0.06)", border: `1px solid ${q.done ? "#0d2d47" : q.type === "mandatory" ? "rgba(255,34,68,0.25)" : "#0d2d47"}`, opacity: q.done ? 0.5 : 1, animation: !q.done && q.type === "mandatory" ? "urgent-pulse 2.5s ease-in-out infinite" : "none" }}
                                >
                                    <div className="clip-sm" onClick={() => q.done ? uncompleteQuest(q.id) : completeQuest(q.id)} style={{ width: 24, height: 24, border: `1.5px solid ${q.done ? "#00a8ff" : "#4a7a9b"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: q.done ? "#00a8ff" : "transparent", color: q.done ? "#020408" : "#4a7a9b", fontSize: 11, flexShrink: 0, boxShadow: q.done ? "0 0 8px #00a8ff" : "none", transition: "all 0.2s" }}>
                                        {q.done ? "✓" : "○"}
                                    </div>
                                    <span style={{ fontSize: 18, flexShrink: 0 }}>{q.emoji}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: "#c8e8ff", textDecoration: q.done ? "line-through" : "none" }}>{q.name}</div>
                                        <div style={{ display: "flex", gap: 10, marginTop: 3 }}>
                                            <span style={{ fontSize: 10, letterSpacing: 1.5, color: q.type === "mandatory" ? "#ff2244" : "#c084fc" }}>{q.type.toUpperCase()}</span>
                                            <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, color: "#ffd700" }}>+{q.xp} XP</span>
                                            {q.streak > 0 && <span style={{ fontSize: 10, color: "#ff9800" }}>🔥 {q.streak}d</span>}
                                        </div>
                                    </div>
                                    <div className="clip-sm" style={{ padding: "3px 8px", border: `1px solid ${rankColor}44`, fontFamily: "'Orbitron',monospace", fontSize: 9, color: rankColor, flexShrink: 0 }}>{q.stat}+1</div>
                                    <motion.button
                                        onClick={() => deleteQuest(q.id)}
                                        style={{ background: "none", border: "none", color: "#1e3a52", cursor: "pointer", fontSize: 14, flexShrink: 0 }}
                                        whileHover={{ color: "#ff2244", scale: 1.2 }}
                                        whileTap={{ scale: 0.9 }}
                                    >✕</motion.button>
                                </motion.div>
                            ))}
                            </AnimatePresence>

                            <div className="quest-add-row">
                                <input value={newQuestName} onChange={e => setNewQuestName(e.target.value)} onKeyDown={e => e.key === "Enter" && addQuest()} placeholder="Add new quest..." style={{ flex: 1, background: "transparent", border: "1px solid #0d2d47", color: "#c8e8ff", padding: "8px 12px", fontFamily: "'Rajdhani',sans-serif", fontSize: 13, outline: "none" }} />
                                <select value={newQuestType} onChange={e => setNewQuestType(e.target.value)} style={{ background: "#050d18", border: "1px solid #0d2d47", color: "#4a7a9b", padding: "8px", fontFamily: "'Orbitron',monospace", fontSize: 8, outline: "none" }}>
                                    <option value="bonus">BONUS</option>
                                    <option value="mandatory">MANDATORY</option>
                                </select>
                                <select value={newQuestStat} onChange={e => setNewQuestStat(e.target.value)} style={{ background: "#050d18", border: "1px solid #0d2d47", color: "#4a7a9b", padding: "8px", fontFamily: "'Orbitron',monospace", fontSize: 8, outline: "none" }}>
                                    {["STR", "INT", "VIT", "AGI", "SEN"].map(s => <option key={s}>{s}</option>)}
                                </select>
                                <button className="btn btn-blue clip-sm" onClick={addQuest} style={{ padding: "8px 14px" }}>+ ADD</button>
                            </div>
                        </div>
                    )}

                    {/* DUNGEON — now using the extracted DungeonFocusOverlay component */}
                    {/* 📖 The old 60+ lines of dungeon JSX is replaced by ONE component.
                         DungeonFocusOverlay reads its state from useDungeonStore directly.
                         GameApp only passes the player rank and callbacks. */}
                    {tab === "dungeon" && (
                        <DungeonFocusOverlay
                            playerRank={state.player.rank}
                            onBlockComplete={handleDungeonBlockComplete}
                            onLogMessage={handleDungeonLog}
                        />
                    )}

                    {/* SHADOWS */}
                    {tab === "shadows" && (
                        <div className="panel clip" style={{ flex: 1 }}>
                            <div className="panel-title">👥 SHADOW ARMY — {state.shadows.length} EXTRACTED</div>
                            {state.shadows.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px 20px", color: "#4a7a9b" }}>
                                    <div style={{ fontSize: 40, marginBottom: 12 }}>🌑</div>
                                    <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 3 }}>NO SHADOWS YET</div>
                                    <div style={{ fontSize: 13, marginTop: 8 }}>Maintain a 7-day quest streak to extract a shadow.</div>
                                </div>
                            ) : (
                                <div className="shadows-grid">
                                    {state.shadows.map(sh => (
                                        <div key={sh.id} className="clip-sm" style={{ background: "rgba(123,47,255,0.08)", border: "1px solid rgba(123,47,255,0.3)", padding: "14px 10px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                                            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%,rgba(123,47,255,0.15),transparent 70%)" }} />
                                            <div style={{ fontSize: 28, marginBottom: 6, filter: "drop-shadow(0 0 6px rgba(123,47,255,0.6))", position: "relative" }}>{sh.emoji}</div>
                                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, letterSpacing: 1.5, color: "#c084fc", position: "relative" }}>{sh.name.split(" ")[0].toUpperCase()}</div>
                                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, color: "#00a8ff", marginTop: 4, position: "relative" }}>LV.{sh.level}</div>
                                            <div style={{ fontSize: 10, color: "#ff9800", marginTop: 2, position: "relative" }}>🔥 {sh.streak}d</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div style={{ marginTop: 16, padding: "12px", background: "rgba(0,168,255,0.03)", border: "1px solid #0d2d47", fontSize: 12, color: "#4a7a9b", letterSpacing: 1 }}>
                                ▸ Complete any quest for 7 consecutive days to extract a Shadow.
                            </div>
                        </div>
                    )}

                    {/* AI SYSTEM */}
                    {tab === "system" && (
                        <div className="panel clip" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <div className="panel-title">🤖 SYSTEM AI — ASK THE VOID</div>
                            {aiChat && (
                                <div style={{ marginBottom: 16, animation: "slide-in 0.3s ease-out" }}>
                                    <div style={{ padding: "10px 14px", background: "rgba(0,168,255,0.05)", border: "1px solid #0d2d47", marginBottom: 8 }}>
                                        <div style={{ fontSize: 10, color: "#4a7a9b", letterSpacing: 2, marginBottom: 4 }}>HUNTER:</div>
                                        <div style={{ fontSize: 13, color: "#c8e8ff" }}>{aiChat.question}</div>
                                    </div>
                                    <div style={{ padding: "14px 16px", background: "rgba(0,40,90,0.5)", border: "1px solid rgba(0,168,255,0.3)", position: "relative" }}>
                                        <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: "linear-gradient(180deg,#00a8ff,#7b2fff)", boxShadow: "0 0 8px #00a8ff" }} />
                                        <div style={{ fontSize: 10, color: "#00a8ff", letterSpacing: 2, marginBottom: 6, fontFamily: "'Orbitron',monospace" }}>SYSTEM:</div>
                                        <div style={{ fontSize: 13, color: "#c8e8ff", lineHeight: 1.6, paddingLeft: 8 }}>{aiChat.answer}</div>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askSystem()} placeholder="Ask the System anything..." style={{ flex: 1, background: "rgba(0,168,255,0.04)", border: "1px solid #0d2d47", color: "#c8e8ff", padding: "10px 14px", fontFamily: "'Rajdhani',sans-serif", fontSize: 13, outline: "none" }} disabled={aiLoading} />
                                <button className="btn btn-blue clip-sm" onClick={askSystem} disabled={aiLoading || !chatInput.trim()}>{aiLoading ? <span className="spin">⚙</span> : "ASK"}</button>
                            </div>
                            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {["How do I rank up faster?", "Motivate me", "What quests should I add?", "Analyze my stats"].map(q => (
                                    <button key={q} onClick={() => setChatInput(q)} className="btn" style={{ fontSize: 9, padding: "5px 10px", borderColor: "#0d2d47", color: "#4a7a9b", letterSpacing: 1 }}>{q}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LOG */}
                    {tab === "log" && (
                        <div className="panel clip" style={{ flex: 1, maxHeight: 500, overflowY: "auto" }}>
                            <div className="panel-title">📋 SYSTEM LOG</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {state.systemLog.map(entry => (
                                    <div key={entry.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "slide-in 0.2s ease-out", padding: "6px 10px", background: "rgba(0,168,255,0.02)", borderLeft: `2px solid ${entry.type === "complete" ? "#00a8ff" : entry.type === "levelup" || entry.type === "rankup" ? "#ffd700" : entry.type === "shadow" ? "#c084fc" : entry.type === "ai" ? "#7b2fff" : "#0d2d47"}` }}>
                                        <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, color: "#1e3a52", flexShrink: 0, marginTop: 2 }}>{new Date(entry.time).toLocaleTimeString()}</span>
                                        <span style={{ fontSize: 12, color: entry.type === "complete" ? "#c8e8ff" : entry.type === "levelup" || entry.type === "rankup" ? "#ffd700" : entry.type === "shadow" ? "#c084fc" : "#4a7a9b" }}>{entry.msg}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
