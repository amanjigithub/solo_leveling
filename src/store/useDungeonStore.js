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

    // ── Actions ───────────────────────────────────────────────────────────

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
     * Start the 25-minute focus timer
     */
    startTimer: () => {
        const { _timerInterval, dungeonTimer } = get();

        // Clear any existing timer first
        if (_timerInterval) clearInterval(_timerInterval);

        const interval = setInterval(() => {
            const { dungeonTimer: currentTime, completeFocusBlock } = get();
            if (currentTime === null || currentTime <= 0) {
                clearInterval(get()._timerInterval);
                set({ _timerInterval: null, dungeonTimer: null });
                completeFocusBlock(); // Auto-complete when timer hits zero
                return;
            }
            set({ dungeonTimer: currentTime - 1 });
        }, 1000);

        set({ dungeonTimer: 25 * 60, _timerInterval: interval });
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
        });
    },
}));
