// =============================================================================
// ⚔️  DungeonFocusOverlay.jsx
// =============================================================================
//
// 📖 WHAT IS THIS FILE?
//
// This is a component extracted from GameApp.jsx. Previously, the dungeon UI
// and timer logic all lived inside GameApp.jsx (610 lines!). Now:
//
//   GameApp.jsx         → orchestrates everything
//   DungeonFocusOverlay → owns ALL dungeon UI and renders it
//
// 📖 WHY EXTRACT COMPONENTS?
//
// Single Responsibility Principle: one component should do ONE thing.
// - GameApp: load data, save data, handle routing
// - DungeonFocusOverlay: show dungeon UI, manage the focus timer display
//
// 📖 WHAT IS Framer Motion?
//
// Framer Motion lets us animate elements entering and leaving the screen:
//   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
//            ↑ starts invisible            ↑ animates to visible
//
// <AnimatePresence> is the magic wrapper that animates elements when they
// are REMOVED from the DOM (impossible with plain CSS).
//
// 📖 WHAT IS useDungeonStore?
//
// Instead of passing dungeon state as props from GameApp, this component
// reads directly from the Zustand store. No prop drilling needed!
//
// =============================================================================

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDungeonStore } from "../store/useDungeonStore.js";
import { RANKS, DUNGEONS } from "../constants.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTimer = (seconds) => {
    if (seconds == null) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// =============================================================================
// 📦 DungeonFocusOverlay component
//
// Props:
//   playerRank     — current player rank (e.g. "E", "D", "S")
//   onBlockComplete(xpEarned, defeated) — called when a focus block finishes
//   onLogMessage(msg, type) — called to add a line to the system log
//   onToast(type, data)     — called to trigger a toast notification
// =============================================================================
export default function DungeonFocusOverlay({
    playerRank,
    onBlockComplete,
    onLogMessage,
}) {
    // ── Read dungeon state from Zustand store ─────────────────────────────────
    // 📖 useStore(selector) — only re-renders when the SELECTED data changes.
    // This component doesn't re-render when player XP changes, only when
    // dungeon state changes. That's the Zustand performance win.
    const dungeon       = useDungeonStore(s => s.dungeon);
    const dungeonTimer  = useDungeonStore(s => s.dungeonTimer);
    const openDungeon   = useDungeonStore(s => s.openDungeon);
    const startTimer    = useDungeonStore(s => s.startTimer);
    const completeFocus = useDungeonStore(s => s.completeFocusBlock);
    const retreat       = useDungeonStore(s => s.retreat);

    // ── Enter dungeon: open gate + start first focus timer ────────────────────
    const handleEnterDungeon = () => {
        const dungeonConfig = DUNGEONS[Math.min(RANKS.indexOf(playerRank), DUNGEONS.length - 1)];
        openDungeon(dungeonConfig);
        onLogMessage(`Gate opened! Boss: ${dungeonConfig.boss}`, "system");
        startTimer(); // start the 25-min countdown
    };

    // ── Complete a focus block: deal damage to boss ───────────────────────────
    const handleCompleteBlock = () => {
        const { defeated, xpEarned } = completeFocus();
        if (defeated) {
            onLogMessage(`Boss defeated! +${xpEarned} XP! VICTORY!`, "complete");
        } else {
            onLogMessage(`Focus block complete! +${xpEarned} XP. Boss damaged!`, "info");
        }
        onBlockComplete(xpEarned, defeated); // tell GameApp to update player XP
    };

    // ── Retreat: give up ──────────────────────────────────────────────────────
    const handleRetreat = () => {
        retreat();
        onLogMessage("Retreated from dungeon.", "system");
    };

    // ── HP bar color: changes from green → orange → red as boss is damaged ────
    const hpPercent = dungeon.bossHp;
    const hpColor = hpPercent > 60 ? "#ff2244"
                  : hpPercent > 30 ? "#FF9800"
                  : "#ffd700";

    // ==========================================================================
    // 📖 FRAMER MOTION EXPLAINED — line by line
    //
    // <AnimatePresence> watches for children being added/removed.
    // Without it, removed children just disappear instantly.
    // With it, children play their `exit` animation before being removed.
    //
    // <motion.div
    //   initial={{ opacity: 0, y: 20 }}   ← START: invisible, 20px below
    //   animate={{ opacity: 1, y: 0 }}    ← END: visible, normal position
    //   exit={{ opacity: 0, y: -20 }}     ← EXIT: fade out, slide up
    //   transition={{ duration: 0.35 }}   ← how long the animation takes
    // >
    // ==========================================================================
    return (
        <div className="panel clip" style={{ flex: 1 }}>
            <div className="panel-title">⚔ DUNGEON GATE — {playerRank}-RANK</div>

            <AnimatePresence mode="wait">
                {!dungeon.active ? (
                    /* ── Idle state: no gate open ── */
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.25 }}
                        style={{ textAlign: "center", padding: "40px 20px" }}
                    >
                        {/* Floating gate emoji */}
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            style={{ fontSize: 64, marginBottom: 16 }}
                        >
                            🚪
                        </motion.div>
                        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, letterSpacing: 3, color: "#4a7a9b", marginBottom: 8 }}>
                            NO GATE OPEN
                        </div>
                        <div style={{ fontSize: 13, color: "#4a7a9b", marginBottom: 24 }}>
                            Each 25-min focus block damages the boss. Defeat it for massive XP.
                        </div>
                        <motion.button
                            className="btn btn-blue clip"
                            style={{ padding: "12px 32px", fontSize: 10 }}
                            onClick={handleEnterDungeon}
                            whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(0,168,255,0.4)" }}
                            whileTap={{ scale: 0.97 }}
                        >
                            ▶ OPEN GATE
                        </motion.button>
                    </motion.div>
                ) : (
                    /* ── Active dungeon state ── */
                    <motion.div
                        key="active"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Boss display */}
                        <div style={{ textAlign: "center", padding: "20px 0 16px" }}>
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                style={{
                                    fontSize: 64,
                                    filter: "drop-shadow(0 0 20px rgba(255,34,68,0.5))",
                                }}
                            >
                                {dungeon.bossEmoji || "👹"}
                            </motion.div>
                            <div style={{
                                fontFamily: "'Orbitron',monospace",
                                fontSize: 13,
                                letterSpacing: 3,
                                color: "#ff2244",
                                marginTop: 8,
                                textShadow: "0 0 10px rgba(255,34,68,0.5)",
                            }}>
                                {dungeon.bossName}
                            </div>
                        </div>

                        {/* Boss HP bar — animates width as HP decreases */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#4a7a9b", letterSpacing: 1.5, marginBottom: 6 }}>
                                <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 9 }}>BOSS HP</span>
                                <span style={{ color: hpColor, fontFamily: "'Orbitron',monospace" }}>
                                    {dungeon.bossHp}%
                                </span>
                            </div>
                            <div className="bar-track" style={{ height: 12 }}>
                                <motion.div
                                    className="bar-fill"
                                    style={{ background: hpColor, height: "100%", boxShadow: `0 0 6px ${hpColor}66` }}
                                    animate={{ width: `${dungeon.bossHp}%` }}
                                    transition={{ duration: 0.6, ease: "easeOut" }}
                                />
                            </div>
                        </div>

                        {/* Blocks progress */}
                        <div style={{ marginBottom: 20, fontSize: 13, color: "#4a7a9b" }}>
                            Focus Blocks:{" "}
                            <span style={{ color: "#00a8ff", fontFamily: "'Orbitron',monospace" }}>
                                {dungeon.blocks} / {dungeon.blocksNeeded}
                            </span>
                        </div>

                        {/* Timer section */}
                        <AnimatePresence mode="wait">
                            {dungeonTimer !== null ? (
                                /* Timer is running */
                                <motion.div
                                    key="timer-running"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ textAlign: "center", marginBottom: 20 }}
                                >
                                    {/* Pulsing timer display */}
                                    <motion.div
                                        animate={{ opacity: [1, 0.7, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        style={{
                                            fontFamily: "'Orbitron',monospace",
                                            fontSize: 48,
                                            color: "#00a8ff",
                                            textShadow: "0 0 20px rgba(0,168,255,0.5)",
                                        }}
                                    >
                                        {formatTimer(dungeonTimer)}
                                    </motion.div>
                                    <div style={{ fontSize: 11, color: "#4a7a9b", letterSpacing: 2, marginTop: 4 }}>
                                        FOCUS BLOCK ACTIVE — STAY FOCUSED
                                    </div>
                                    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
                                        <motion.button
                                            className="btn btn-blue clip-sm"
                                            onClick={handleCompleteBlock}
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                        >
                                            ⚡ COMPLETE BLOCK
                                        </motion.button>
                                        <motion.button
                                            className="btn btn-red clip-sm"
                                            onClick={handleRetreat}
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                        >
                                            ✕ RETREAT
                                        </motion.button>
                                    </div>
                                </motion.div>
                            ) : (
                                /* Timer not running — ready to start next block */
                                <motion.div
                                    key="timer-idle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ display: "flex", gap: 10 }}
                                >
                                    <motion.button
                                        className="btn btn-blue clip-sm"
                                        style={{ flex: 1 }}
                                        onClick={startTimer}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        ▶ START FOCUS BLOCK
                                    </motion.button>
                                    <motion.button
                                        className="btn btn-red clip-sm"
                                        onClick={handleRetreat}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        ✕ RETREAT
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
