// =============================================================================
// 🗡️  useDungeonStore.js — Zustand store for Dungeon/Focus session state
// =============================================================================
//
// 📖 WHY SEPARATE DUNGEON STATE?
//
// The dungeon has a live countdown timer that ticks every second.
// If dungeon state lived in the main GameApp useState, the entire app
// would re-render EVERY SECOND (because React re-renders everything
// whenever state changes).
//
// With its own store, only the <DungeonPanel /> re-renders every second.
// The quest panel, player card, shadows panel — completely unaffected!
//
// This is a HUGE performance win for the dungeon feature.
//
// =============================================================================

import { create } from "zustand";

export const useDungeonStore = create((set, get) => ({
    // ── State ─────────────────────────────────────────────────────────────
    dungeon: {
        active: false,
        bossName: "",
        bossEmoji: "",
        bossHpMax: 100,
        bossHp: 100,
        blocks: 0,
        blocksNeeded: 4,
    },

    // Timer state lives HERE, not in GameApp
    // This means the timer tick only re-renders DungeonPanel
    dungeonTimer: null,
    _timerInterval: null, // private — stores the setInterval reference

    // 📖 B-01 FIX: Real-world timestamp (ms) when the current focus block started.
    // Persisted to Firestore via GameApp so the remaining time can be
    // reconstructed after a page refresh: remaining = 25*60 - elapsed seconds.
    dungeonStartedAt: null,

    // 📖 AUTO-COMPLETE CALLBACK
    // When the 25-min timer hits zero, the store calls this registered function
    // so the overlay can award XP and fire victory effects.
    // DungeonFocusOverlay registers this via setAutoCompleteCallback().
    _onAutoComplete: null,

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Register the callback to invoke when timer hits zero.
     * Called by DungeonFocusOverlay on mount.
     */
    setAutoCompleteCallback: (cb) => set({ _onAutoComplete: cb }),

    /**
     * Set dungeon state from Firestore data
     */
    setDungeon: (dungeonData) => set({ dungeon: dungeonData }),

    /**
     * Open a dungeon gate (activate the dungeon)
     */
    openDungeon: (dungeonConfig) => set({
        dungeon: {
            active: true,
            bossName: dungeonConfig.boss,
            bossEmoji: dungeonConfig.emoji,
            bossHpMax: 100,
            bossHp: 100,
            blocks: 0,
            blocksNeeded: dungeonConfig.blocksNeeded,
        }
    }),

    /**
     * Start the 25-minute focus timer.
     * Records dungeonStartedAt so the timer can survive a page refresh.
     */
    startTimer: () => {
        const { _timerInterval } = get();

        // Clear any existing timer first
        if (_timerInterval) clearInterval(_timerInterval);

        const startedAt = Date.now();
        const totalSeconds = 25 * 60;

        const interval = setInterval(() => {
            const { dungeonTimer: currentTime } = get();
            if (currentTime === null || currentTime <= 0) {
                // Timer hit zero — stop the interval
                clearInterval(get()._timerInterval);
                set({ _timerInterval: null, dungeonTimer: null, dungeonStartedAt: null });

                // 📖 FIX: Call completeFocusBlock and pass the result back to the
                // overlay via the registered callback. Without this, XP was never
                // awarded when the 25-min timer ran out naturally.
                const { completeFocusBlock, _onAutoComplete } = get();
                const result = completeFocusBlock();
                if (_onAutoComplete) _onAutoComplete(result);
                return;
            }
            set({ dungeonTimer: currentTime - 1 });
        }, 1000);

        set({ dungeonTimer: totalSeconds, _timerInterval: interval, dungeonStartedAt: startedAt });
    },

    /**
     * 📖 B-01 FIX: Restore a running timer after a page refresh.
     * Called by GameApp when Firestore data loads and dungeon.active is true
     * AND dungeonStartedAt is set.
     *
     * How it works:
     *   1. We know when the block started (dungeonStartedAt, saved in Firestore).
     *   2. We compute elapsed = now - startedAt.
     *   3. remaining = 25*60 - elapsed.
     *   4. If remaining > 0  → resume the timer from that point.
     *   5. If remaining <= 0 → the block already finished while offline;
     *      auto-complete it immediately (award XP, fire callback).
     */
    restoreTimer: (startedAt) => {
        const { _timerInterval } = get();
        if (_timerInterval) clearInterval(_timerInterval); // safety

        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = 25 * 60 - elapsed;

        if (remaining <= 0) {
            // Block expired while the tab was closed — complete it now
            set({ dungeonStartedAt: null, dungeonTimer: null, _timerInterval: null });
            const { completeFocusBlock, _onAutoComplete } = get();
            const result = completeFocusBlock();
            if (_onAutoComplete) _onAutoComplete(result);
            return;
        }

        // Resume counting down from the correct remaining seconds
        const interval = setInterval(() => {
            const { dungeonTimer: currentTime } = get();
            if (currentTime === null || currentTime <= 0) {
                clearInterval(get()._timerInterval);
                set({ _timerInterval: null, dungeonTimer: null, dungeonStartedAt: null });
                const { completeFocusBlock, _onAutoComplete } = get();
                const result = completeFocusBlock();
                if (_onAutoComplete) _onAutoComplete(result);
                return;
            }
            set({ dungeonTimer: currentTime - 1 });
        }, 1000);

        set({ dungeonTimer: remaining, _timerInterval: interval, dungeonStartedAt: startedAt });
    },

    /**
     * Complete a focus block: damage the boss
     * Returns: { defeated: boolean, xpEarned: number }
     */
    completeFocusBlock: () => {
        const { dungeon, _timerInterval } = get();
        if (!dungeon.active) return { defeated: false, xpEarned: 0 };

        if (_timerInterval) clearInterval(_timerInterval);

        const blocks = dungeon.blocks + 1;
        const dmg = Math.floor(100 / dungeon.blocksNeeded);
        const newHp = Math.max(0, dungeon.bossHp - dmg);
        const defeated = blocks >= dungeon.blocksNeeded;

        set({
            dungeon: { ...dungeon, blocks, bossHp: newHp, active: !defeated },
            dungeonTimer: null,
            _timerInterval: null,
            dungeonStartedAt: null, // clear persisted start time on block completion
        });

        return {
            defeated,
            xpEarned: defeated ? 3000 : 500,
        };
    },

    /**
     * Retreat from dungeon (give up)
     */
    retreat: () => {
        const { _timerInterval, dungeon } = get();
        if (_timerInterval) clearInterval(_timerInterval);

        set({
            dungeon: { ...dungeon, active: false },
            dungeonTimer: null,
            _timerInterval: null,
            dungeonStartedAt: null, // clear start time on retreat
        });
    },

    /**
     * Reset on logout
     */
    reset: () => {
        const { _timerInterval } = get();
        if (_timerInterval) clearInterval(_timerInterval);
        set({
            dungeon: { active: false, bossName: "", bossEmoji: "", bossHpMax: 100, bossHp: 100, blocks: 0, blocksNeeded: 4 },
            dungeonTimer: null,
            _timerInterval: null,
            _onAutoComplete: null,
            dungeonStartedAt: null,
        });
    },
}));
