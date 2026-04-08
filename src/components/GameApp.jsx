import { useState, useEffect, useCallback, useRef } from "react";
import { STORAGE_KEY, RANKS, RANK_COLORS, TITLES, DUNGEONS, DEFAULT_GAME_STATE } from "../constants.js";
import { callClaude } from "../utils.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";

export default function GameApp({ session, onLogout }) {
    const [state, setState] = useState(null);
    const [tab, setTab] = useState("quests");
    const [toast, setToast] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiChat, setAiChat] = useState(null);
    const [chatInput, setChatInput] = useState("");
    const [dungeonTimer, setDungeonTimer] = useState(null);
    const [newQuestName, setNewQuestName] = useState("");
    const [newQuestType, setNewQuestType] = useState("bonus");
    const [newQuestStat, setNewQuestStat] = useState("STR");
    const timerRef = useRef(null);

    const SK = STORAGE_KEY(session.uid);

    useEffect(() => {
        (async () => {
            try {
                const docRef = doc(db, "hunters", session.uid);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const loaded = snap.data();
                    const today = new Date().toDateString();
                    if (loaded.lastQuestReset !== today) {
                        loaded.quests = loaded.quests.map(q => ({ ...q, done: false }));
                        loaded.lastQuestReset = today;
                        const lastLogin = loaded.player.lastLoginDate;
                        const yesterday = new Date(Date.now() - 86400000).toDateString();
                        loaded.player.streak =
                            lastLogin === yesterday ? loaded.player.streak + 1 :
                                lastLogin === today ? loaded.player.streak : 0;
                        loaded.player.lastLoginDate = today;
                    }
                    setState(loaded);
                } else {
                    setState(DEFAULT_GAME_STATE(session.uid, session.username));
                }
            } catch {
                setState(DEFAULT_GAME_STATE(session.uid, session.username));
            }
        })();
    }, [session.uid]);

    const save = useCallback(async (s) => {
        try { await setDoc(doc(db, "hunters", session.uid), s); } catch { }
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

    const enterDungeon = () => {
        update(prev => {
            const dungeon = DUNGEONS[Math.min(RANKS.indexOf(prev.player.rank), DUNGEONS.length - 1)];
            let s = { ...prev, dungeon: { active: true, bossName: dungeon.boss, bossEmoji: dungeon.emoji, bossHpMax: 100, bossHp: 100, blocks: 0, blocksNeeded: dungeon.blocksNeeded } };
            return addLog(s, `Gate opened! Boss: ${dungeon.boss}`, "system");
        });
        startFocusBlock();
    };

    const startFocusBlock = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setDungeonTimer(25 * 60);
        timerRef.current = setInterval(() => {
            setDungeonTimer(t => {
                if (t <= 1) { clearInterval(timerRef.current); completeFocusBlock(); return null; }
                return t - 1;
            });
        }, 1000);
    };

    const completeFocusBlock = () => {
        update(prev => {
            if (!prev.dungeon.active) return prev;
            const blocks = prev.dungeon.blocks + 1;
            const dmg = Math.floor(100 / prev.dungeon.blocksNeeded);
            const newHp = Math.max(0, prev.dungeon.bossHp - dmg);
            const defeated = blocks >= prev.dungeon.blocksNeeded;
            let s = { ...prev, dungeon: { ...prev.dungeon, blocks, bossHp: newHp, active: !defeated } };
            s.player = { ...s.player, xp: s.player.xp + (defeated ? 3000 : 500) };
            s = addLog(s, defeated ? `Boss defeated! +3000 XP!` : `Block complete! +500 XP`, defeated ? "complete" : "info");
            if (defeated) setTimeout(() => setToast({ type: "dungeon", data: prev.dungeon.bossName }), 100);
            return s;
        });
        setDungeonTimer(null);
    };

    const retreatDungeon = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setDungeonTimer(null);
        update(prev => addLog({ ...prev, dungeon: { ...prev.dungeon, active: false } }, "Retreated from dungeon.", "system"));
    };

    const askSystem = async () => {
        if (!chatInput.trim() || aiLoading || !state) return;
        const q = chatInput.trim(); setChatInput(""); setAiLoading(true);
        const sysPmt = `You are the mysterious System from Solo Leveling — an all-knowing AI guiding a Hunter. Speak in short, dramatic, cryptic, motivational messages. Use [SYSTEM] or [ALERT] tags occasionally. Under 80 words. Be intense. Player: Level ${state.player.level}, Rank ${state.player.rank}, ${state.player.streak} day streak. Completed: ${state.quests.filter(q => q.done).length}/${state.quests.length} quests today.`;
        try {
            const ans = await callClaude([{ role: "user", content: q }], sysPmt);
            setAiChat({ question: q, answer: ans });
        } catch {
            setAiChat({ question: q, answer: "[SYSTEM ERROR] The void is silent. Try again." });
        }
        setAiLoading(false);
    };

    const generateQuests = async () => {
        if (aiLoading || !state) return;
        setAiLoading(true);
        const sysPmt = `You are the System from Solo Leveling. Generate exactly 3 new daily quest suggestions. Return ONLY valid JSON array — no markdown, no explanation: [{"name":"quest name","type":"mandatory|bonus","stat":"STR|INT|VIT|AGI|SEN","emoji":"single emoji"}] Stat guide: STR=physical, INT=mental, VIT=health/sleep, AGI=movement, SEN=mindfulness. Hunter rank: ${state.player.rank}. Make quests realistic habits at that level.`;
        try {
            const raw = await callClaude([{ role: "user", content: "Generate 3 quests" }], sysPmt);
            const quests = JSON.parse(raw.replace(/```json|```/g, "").trim());
            update(prev => {
                const nq = quests.map((q, i) => ({ id: `ai-q-${Date.now()}-${i}`, name: q.name, type: q.type || "bonus", stat: q.stat || "INT", xp: q.type === "mandatory" ? 800 : 500, done: false, streak: 0, emoji: q.emoji || "⭐" }));
                return addLog({ ...prev, quests: [...prev.quests, ...nq] }, `System generated ${nq.length} new quests.`, "ai");
            });
        } catch { update(prev => addLog(prev, "Failed to generate quests. Insufficient mana.", "system")); }
        setAiLoading(false);
    };

    const formatTimer = s => { if (!s) return null; const m = Math.floor(s / 60), sec = s % 60; return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; };

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
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: 20 }}>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid #0d2d47", position: "relative" }}>
                <div style={{ position: "absolute", bottom: -1, left: 0, width: 200, height: 1, background: "linear-gradient(90deg,#00a8ff,transparent)", boxShadow: "0 0 8px #00a8ff" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div className="clip" style={{ width: 48, height: 48, border: "1.5px solid #00a8ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: "#071525", boxShadow: "0 0 20px rgba(0,168,255,0.3)", animation: "glow-pulse 3s ease-in-out infinite" }}>⚔</div>
                    <div>
                        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, letterSpacing: 4, color: "#00a8ff", textShadow: "0 0 10px #00a8ff" }}>SHADOW SYSTEM</div>
                        <div style={{ fontSize: 11, color: "#4a7a9b", letterSpacing: 2, marginTop: 2 }}>HUNTER INTERFACE v3.0</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, letterSpacing: 2, color: "#4a7a9b", padding: "6px 12px", border: "1px solid #0d2d47" }}>{new Date().toDateString().toUpperCase()}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid #0d2d47" }}>
                        <span style={{ fontSize: 11 }}>🔥</span>
                        <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, color: "#ffd700" }}>{state.player.streak}D</span>
                    </div>
                    <button className="btn btn-red clip-sm" style={{ fontSize: 8, padding: "7px 12px" }} onClick={onLogout}>⏻ LOGOUT</button>
                </div>
            </div>

            {/* Main layout */}
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18, marginBottom: 18 }}>

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
                    <div style={{ display: "flex", borderBottom: "1px solid #0d2d47" }}>
                        {["quests", "dungeon", "shadows", "system", "log"].map(t => (
                            <div key={t} className={`nav-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                                {t === "quests" ? "⬡ QUESTS" : t === "dungeon" ? "⚔ DUNGEON" : t === "shadows" ? "👥 SHADOWS" : t === "system" ? "🤖 AI" : "📋 LOG"}
                            </div>
                        ))}
                    </div>

                    {/* QUESTS */}
                    {tab === "quests" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: "rgba(0,168,255,0.04)", border: "1px solid #0d2d47" }}>
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

                            {state.quests.map(q => (
                                <div key={q.id} className="clip-sm" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: q.done ? "rgba(0,168,255,0.02)" : "rgba(0,168,255,0.06)", border: `1px solid ${q.done ? "#0d2d47" : q.type === "mandatory" ? "rgba(255,34,68,0.25)" : "#0d2d47"}`, opacity: q.done ? 0.5 : 1, animation: !q.done && q.type === "mandatory" ? "urgent-pulse 2.5s ease-in-out infinite" : "none", transition: "all 0.2s" }}>
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
                                    <button onClick={() => deleteQuest(q.id)} style={{ background: "none", border: "none", color: "#1e3a52", cursor: "pointer", fontSize: 14, flexShrink: 0, transition: "color 0.2s" }}
                                        onMouseEnter={e => e.target.style.color = "#ff2244"}
                                        onMouseLeave={e => e.target.style.color = "#1e3a52"}>✕</button>
                                </div>
                            ))}

                            <div style={{ display: "flex", gap: 8, marginTop: 4, padding: "12px 14px", background: "rgba(0,168,255,0.02)", border: "1px dashed #0d2d47" }}>
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

                    {/* DUNGEON */}
                    {tab === "dungeon" && (
                        <div className="panel clip" style={{ flex: 1 }}>
                            <div className="panel-title">⚔ DUNGEON GATE — {state.player.rank}-RANK</div>
                            {!state.dungeon.active ? (
                                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                                    <div style={{ fontSize: 64, animation: "float 3s ease-in-out infinite", marginBottom: 16 }}>🚪</div>
                                    <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, letterSpacing: 3, color: "#4a7a9b", marginBottom: 8 }}>NO GATE OPEN</div>
                                    <div style={{ fontSize: 13, color: "#4a7a9b", marginBottom: 24 }}>Each 25-min focus block damages the boss. Defeat it for massive XP.</div>
                                    <button className="btn btn-blue clip" style={{ padding: "12px 32px", fontSize: 10 }} onClick={enterDungeon}>▶ OPEN GATE</button>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ textAlign: "center", padding: "20px 0 16px" }}>
                                        <div style={{ fontSize: 64, animation: "float 3s ease-in-out infinite", filter: "drop-shadow(0 0 20px rgba(255,34,68,0.5))" }}>{state.dungeon.bossEmoji || "👹"}</div>
                                        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, letterSpacing: 3, color: "#ff2244", marginTop: 8, textShadow: "0 0 10px rgba(255,34,68,0.5)" }}>{state.dungeon.bossName}</div>
                                    </div>
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4a7a9b", letterSpacing: 1.5, marginBottom: 6 }}>
                                            <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9 }}>BOSS HP</span>
                                            <span style={{ color: "#ff2244" }}>{state.dungeon.bossHp}%</span>
                                        </div>
                                        <div className="bar-track" style={{ height: 12 }}>
                                            <div className="bar-fill bar-red" style={{ width: `${state.dungeon.bossHp}%` }} />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: 20, fontSize: 13, color: "#4a7a9b" }}>Blocks: <span style={{ color: "#00a8ff", fontFamily: "'Orbitron',monospace" }}>{state.dungeon.blocks} / {state.dungeon.blocksNeeded}</span></div>
                                    {dungeonTimer !== null ? (
                                        <div style={{ textAlign: "center", marginBottom: 20 }}>
                                            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 48, color: "#00a8ff", textShadow: "0 0 20px rgba(0,168,255,0.5)" }}>{formatTimer(dungeonTimer)}</div>
                                            <div style={{ fontSize: 11, color: "#4a7a9b", letterSpacing: 2, marginTop: 4 }}>FOCUS BLOCK ACTIVE</div>
                                            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
                                                <button className="btn btn-blue clip-sm" onClick={completeFocusBlock}>⚡ COMPLETE</button>
                                                <button className="btn btn-red clip-sm" onClick={retreatDungeon}>✕ RETREAT</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", gap: 10 }}>
                                            <button className="btn btn-blue clip-sm" style={{ flex: 1 }} onClick={startFocusBlock}>▶ START BLOCK</button>
                                            <button className="btn btn-red clip-sm" onClick={retreatDungeon}>✕ RETREAT</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
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
