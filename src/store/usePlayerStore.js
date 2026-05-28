// =============================================================================
// 🗡️  usePlayerStore.js — Zustand store for Player stats
// =============================================================================
//
// 📖 WHAT IS ZUSTAND?
//
// Zustand is a "global state manager." Think of it like a shared notebook
// that any component in your app can read from or write to — without needing
// to pass data through props.
//
// BEFORE Zustand (the problem):
//   GameApp.jsx had ONE massive useState with ALL the data:
//   const [state, setState] = useState({ player, quests, dungeon, shadows, systemLog });
//   └─ Changing ONE thing (e.g., player XP) caused ALL panels to re-render
//
// AFTER Zustand (the solution):
//   Each "domain" gets its own store
//   └─ Player store: only re-renders components that use player data
//   └─ Quest store: only re-renders components that use quest data
//   └─ etc.
//
// HOW TO USE A STORE:
//   import { usePlayerStore } from './store/usePlayerStore';
//
//   function PlayerCard() {
//     const player = usePlayerStore(state => state.player);   // read
//     const addXP  = usePlayerStore(state => state.addXP);    // action
//     return <div>{player.name} — Level {player.level}</div>;
//   }
//
// =============================================================================

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { RANKS, TITLES } from "../constants.js";

export const usePlayerStore = create(
    subscribeWithSelector((set, get) => ({
        // ── State ─────────────────────────────────────────────────────────────
        player: null,    // Will be populated when user logs in

        // ── Actions (functions that update state) ─────────────────────────────

        /**
         * Set the player object from Firestore or local cache
         * Called when the onSnapshot listener fires in GameApp
         */
        setPlayer: (playerData) => set({ player: playerData }),

        /**
         * Add XP to player, handle level-up logic
         * Returns: { leveledUp: boolean, rankedUp: boolean }
         */
        addXP: (amount) => {
            const { player } = get();
            if (!player) return { leveledUp: false, rankedUp: false };

            let p = { ...player };
            p.xp += amount;

            let leveledUp = false;
            // Keep leveling up as long as XP overflows
            while (p.xp >= p.xpToNext) {
                p.xp -= p.xpToNext;
                p.level += 1;
                p.xpToNext = Math.floor(p.xpToNext * 1.4); // each level needs 40% more XP
                leveledUp = true;
            }

            // Check rank change
            let rankedUp = false;
            const rankIdx = Math.min(Math.floor((p.level - 1) / 10), RANKS.length - 1);
            const newRank = RANKS[rankIdx];
            if (newRank !== p.rank) {
                p.rank = newRank;
                p.title = TITLES[newRank];
                rankedUp = true;
            }

            set({ player: p });
            return { leveledUp, rankedUp };
        },

        /**
         * Remove XP (for uncompleting a quest)
         */
        removeXP: (amount) => {
            const { player } = get();
            if (!player) return;

            let p = { ...player };
            p.xp -= amount;
            p.totalCompleted = Math.max(0, p.totalCompleted - 1);

            // Handle level-down when XP goes negative
            while (p.xp < 0 && p.level > 1) {
                p.level -= 1;
                let targetXp = 1000;
                for (let i = 1; i < p.level; i++) targetXp = Math.floor(targetXp * 1.4);
                p.xpToNext = targetXp;
                p.xp += p.xpToNext;
            }
            if (p.xp < 0 && p.level === 1) p.xp = 0;

            // Recalculate rank
            const rankIdx = Math.min(Math.floor((p.level - 1) / 10), RANKS.length - 1);
            p.rank = RANKS[rankIdx];
            p.title = TITLES[p.rank];

            set({ player: p });
        },

        /**
         * Increase a specific stat (STR, INT, VIT, AGI, SEN)
         */
        incrementStat: (stat) => {
            const { player } = get();
            if (!player) return;
            set({
                player: {
                    ...player,
                    stats: { ...player.stats, [stat]: (player.stats[stat] || 10) + 1 },
                    totalCompleted: player.totalCompleted + 1,
                }
            });
        },

        /**
         * Decrease a stat (for uncompleting a quest)
         */
        decrementStat: (stat) => {
            const { player } = get();
            if (!player) return;
            set({
                player: {
                    ...player,
                    stats: { ...player.stats, [stat]: Math.max(10, (player.stats[stat] || 10) - 1) },
                }
            });
        },

        /**
         * Add dungeon boss XP
         */
        addDungeonXP: (amount) => {
            const { player } = get();
            if (!player) return;
            set({ player: { ...player, xp: player.xp + amount } });
        },

        /**
         * Reset player to null (on logout)
         */
        reset: () => set({ player: null }),
    }))
);
