// ─────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────
export const USERS_KEY = "shadow-system-users";
export const SESSION_KEY = "shadow-system-session";
export const STORAGE_KEY = (uid) => `shadow-system-state-${uid}`;

export const RANKS = ["E", "D", "C", "B", "A", "S", "National"];

export const RANK_COLORS = {
    E: "#aaaaaa",
    D: "#4CAF50",
    C: "#2196F3",
    B: "#9C27B0",
    A: "#FF9800",
    S: "#FFD700",
    National: "#ff2244",
};

export const TITLES = {
    E: "Weakest Hunter",
    D: "Novice Hunter",
    C: "Capable Hunter",
    B: "Elite Hunter",
    A: "Master Hunter",
    S: "Shadow Sovereign",
    National: "Monarch of Shadows",
};

export const DUNGEONS = [
    { rank: "E", boss: "Goblin Shaman", emoji: "👺", blocksNeeded: 3 },
    { rank: "D", boss: "Orc Warlord", emoji: "🗡️", blocksNeeded: 4 },
    { rank: "C", boss: "Stone Golem", emoji: "🪨", blocksNeeded: 5 },
    { rank: "B", boss: "Iron Overlord", emoji: "👹", blocksNeeded: 6 },
    { rank: "A", boss: "Shadow Monarch", emoji: "💀", blocksNeeded: 8 },
];

export const DEFAULT_GAME_STATE = (uid, username) => ({
    player: {
        uid,
        name: username.toUpperCase(),
        title: "E-Rank Hunter",
        rank: "E",
        level: 1,
        xp: 0,
        xpToNext: 1000,
        stats: { STR: 10, INT: 10, VIT: 10, AGI: 10, SEN: 10 },
        totalCompleted: 0,
        streak: 0,
        lastLoginDate: new Date().toDateString(),
    },
    quests: [
        { id: "q1", name: "Morning Exercise", type: "mandatory", stat: "STR", xp: 800, done: false, streak: 0, emoji: "💪" },
        { id: "q2", name: "Read 30 Pages", type: "mandatory", stat: "INT", xp: 600, done: false, streak: 0, emoji: "📚" },
        { id: "q3", name: "Drink 2L Water", type: "mandatory", stat: "VIT", xp: 400, done: false, streak: 0, emoji: "💧" },
        { id: "q4", name: "Meditate 15min", type: "bonus", stat: "SEN", xp: 500, done: false, streak: 0, emoji: "🧘" },
        { id: "q5", name: "Study 1 Hour", type: "bonus", stat: "INT", xp: 900, done: false, streak: 0, emoji: "🎯" },
    ],
    shadows: [],
    systemLog: [
        { id: 1, msg: `Welcome, ${username.toUpperCase()}. The System has chosen you.`, type: "system", time: Date.now() },
        { id: 2, msg: "Complete daily quests to grow stronger.", type: "info", time: Date.now() - 1000 },
    ],
    dungeon: {
        active: false,
        bossName: "Goblin King",
        bossEmoji: "👺",
        bossHpMax: 100,
        bossHp: 100,
        blocks: 0,
        blocksNeeded: 4,
    },
    lastQuestReset: new Date().toDateString(),
});
