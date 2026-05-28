// =============================================================================
// 🗡️  useQuestStore.js — Zustand store for Quest management
// =============================================================================
//
// 📖 WHY A SEPARATE QUEST STORE?
//
// Quests and player data change independently:
//   - Completing a quest: changes quest.done AND player.xp AND player.stats
//   - Adding a quest: ONLY changes the quests array
//   - Deleting a quest: ONLY changes the quests array
//
// With one big useState, even "add quest" would re-render the player card,
// dungeon panel, shadows panel, etc. — wasteful!
//
// With a quest store, only the quest panel re-renders when quests change.
//
// =============================================================================

import { create } from "zustand";

export const useQuestStore = create((set, get) => ({
    // ── State ─────────────────────────────────────────────────────────────
    quests: [],

    // ── Actions ───────────────────────────────────────────────────────────

    /**
     * Replace entire quest list (used when loading from Firestore)
     */
    setQuests: (quests) => set({ quests }),

    /**
     * Mark a quest as done (returns the quest object so caller can add XP)
     */
    completeQuest: (questId) => {
        const { quests } = get();
        const quest = quests.find(q => q.id === questId);
        if (!quest || quest.done) return null;

        set({
            quests: quests.map(q =>
                q.id === questId
                    ? { ...q, done: true, streak: q.streak + 1 }
                    : q
            ),
        });

        return quest; // Return quest so GameApp can add XP to player
    },

    /**
     * Mark a quest as not done (returns the quest so caller can remove XP)
     */
    uncompleteQuest: (questId) => {
        const { quests } = get();
        const quest = quests.find(q => q.id === questId);
        if (!quest || !quest.done) return null;

        set({
            quests: quests.map(q =>
                q.id === questId
                    ? { ...q, done: false, streak: Math.max(0, q.streak - 1) }
                    : q
            ),
        });

        return quest;
    },

    /**
     * Add a new quest
     */
    addQuest: (quest) => set(state => ({
        quests: [...state.quests, quest]
    })),

    /**
     * Add multiple quests at once (AI-generated)
     */
    addQuests: (newQuests) => set(state => ({
        quests: [...state.quests, ...newQuests]
    })),

    /**
     * Delete a quest by ID
     */
    deleteQuest: (questId) => set(state => ({
        quests: state.quests.filter(q => q.id !== questId)
    })),

    /**
     * Reset all quests (daily reset)
     */
    resetDailyQuests: () => set(state => ({
        quests: state.quests.map(q => ({ ...q, done: false }))
    })),

    /**
     * Reset store on logout
     */
    reset: () => set({ quests: [] }),
}));
