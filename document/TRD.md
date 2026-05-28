# Technical Requirements Document (TRD)
## Shadow System: Solo Leveling Habit Tracker

**Version:** 1.0
**Project Name:** Shadow System — Solo Leveling Habit Tracker
**Prepared By:** Engineering Team
**Date:** May 2026
**Live URL:** [sololevelinghabittracker.netlify.app](https://sololevelinghabittracker.netlify.app/)
**Repository:** [github.com/amanjigithub/solo_leveling](https://github.com/amanjigithub/solo_leveling)

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Project Structure](#2-project-structure)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Architecture](#4-architecture)
5. [Core Modules](#5-core-modules)
6. [Data Models](#6-data-models)
7. [Game Logic & Algorithms](#7-game-logic--algorithms)
8. [AI Integration](#8-ai-integration)
9. [Authentication Flow](#9-authentication-flow)
10. [Firebase Integration](#10-firebase-integration)
11. [Build & Deployment Pipeline](#11-build--deployment-pipeline)
12. [Security Requirements](#12-security-requirements)
13. [Environment Variables](#13-environment-variables)
14. [Known Constraints & Tech Debt](#14-known-constraints--tech-debt)

---

## 1. System Overview

The Shadow System is a **single-page React application (SPA)** that gamifies daily habit tracking. It uses **Firebase** for authentication and real-time data persistence, and is deployed continuously to **Netlify**. The client-side code is obfuscated at build time to protect game logic.

**Key Flows:**
1. User lands on the app → Firebase checks auth state.
2. If unauthenticated → `AuthPage` handles Google Sign-In.
3. If authenticated → `GameApp` loads the player's state from Firestore.
4. User manages quests, earns XP, levels up, enters dungeons, and generates AI quests.

---

## 2. Project Structure

```
sololeveling/
├── index.html              # Vite entry HTML
├── vite.config.js          # Vite + obfuscator configuration
├── netlify.toml            # Netlify deployment rules (SPA redirect)
├── package.json            # Dependencies & scripts
├── document/               # Project documentation
│   ├── PRD.md              # Product Requirements Document
│   └── TRD.md              # This document
└── src/
    ├── main.jsx            # ReactDOM entry point
    ├── App.jsx             # Root component — auth state gating
    ├── firebase.js         # Firebase init, exports: auth, db, googleProvider
    ├── constants.js        # Game constants, rank config, default state factory
    ├── utils.js            # Pure helper functions: AI call, password utils
    ├── components/
    │   ├── AuthPage.jsx    # Full login / registration UI
    │   └── GameApp.jsx     # Core game engine component (~39KB)
    └── styles/             # CSS files (Vanilla CSS)
```

---

## 3. Tech Stack & Dependencies

### Runtime Dependencies
| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM renderer |
| `firebase` | ^12.11.0 | Auth + Firestore database |
| `@react-oauth/google` | ^0.13.4 | Google OAuth token handling |
| `jwt-decode` | ^4.0.0 | Decode Google JWT for user info |

### Dev Dependencies
| Package | Version | Purpose |
|---|---|---|
| `vite` | ^5.4.2 | Build tool & dev server |
| `@vitejs/plugin-react` | ^4.3.1 | React JSX transform for Vite |
| `javascript-obfuscator` | ^5.4.1 | JS code obfuscation engine |
| `vite-plugin-javascript-obfuscator` | ^3.1.0 | Integrates obfuscator into Vite build |
| `gh-pages` | ^6.3.0 | GitHub Pages deployment helper |

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      BROWSER (SPA)                       │
│                                                          │
│  ┌──────────┐     auth state     ┌──────────────────┐   │
│  │  App.jsx │◄──────────────────►│  Firebase Auth   │   │
│  └──────────┘                    └──────────────────┘   │
│       │                                   │              │
│  unauthenticated    authenticated          │              │
│       │                  │                │              │
│  ┌────▼────┐      ┌──────▼──────┐         │              │
│  │AuthPage │      │  GameApp   │          │              │
│  └─────────┘      └─────┬──────┘         │              │
│                          │                │              │
│                    ┌─────▼──────┐         │              │
│                    │ Firestore  │◄────────┘              │
│                    │ (per-user) │                        │
│                    └────────────┘                        │
│                          │                               │
│                    ┌─────▼──────┐                        │
│                    │ Pollinations│                        │
│                    │  AI API    │                        │
│                    └────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

**Data flow:** `App.jsx` subscribes to Firebase's `onAuthStateChanged` listener. On authenticated state, it passes the user's `uid` and `username` as a `session` prop to `GameApp`. `GameApp` performs all Firestore reads/writes scoped to that `uid`.

---

## 5. Core Modules

### 5.1 `src/main.jsx` — Entry Point
- Mounts the React app into `#root` via `ReactDOM.createRoot`.
- Wraps app in any top-level providers if needed.

### 5.2 `src/App.jsx` — Root Component
**Responsibilities:**
- Reads `isFirebaseConfigured` flag to show a "System Offline" screen if env vars are missing.
- Uses `useEffect` + `onAuthStateChanged` to subscribe to Firebase auth state on mount.
- Stores session as `{ uid, username }` in local React state.
- Renders `<AuthPage />` when unauthenticated or `<GameApp session={...} onLogout={...} />` when authenticated.
- Handles `signOut(auth)` via `handleLogout`.
- Shows a loading spinner ("Connecting to Secure Cloud...") while auth state is being resolved.

### 5.3 `src/firebase.js` — Firebase Initialization
**Exports:**
- `isFirebaseConfigured` — Boolean guard. `true` only if `VITE_FIREBASE_API_KEY` is not `"YOUR_API_KEY"`.
- `auth` — Firebase Auth instance.
- `googleProvider` — `GoogleAuthProvider` instance.
- `db` — Firestore database instance.

**Pattern:** All four exports are `undefined` if Firebase is not configured, preventing SDK crashes.

### 5.4 `src/constants.js` — Game Constants
Defines all static game configuration:
- `RANKS` — Ordered array: `["E", "D", "C", "B", "A", "S", "National"]`
- `RANK_COLORS` — Maps rank to hex color for UI theming.
- `TITLES` — Maps rank to in-world title string.
- `DUNGEONS` — Array of dungeon configs with `rank`, `boss`, `emoji`, `blocksNeeded`.
- `DEFAULT_GAME_STATE(uid, username)` — Factory function returning a full initial game state object for a new player.

### 5.5 `src/utils.js` — Utility Functions
- **`hashPassword(password)`** — A non-cryptographic djb2-style hash. Used for local auth demo purposes only. Returns a string with a `SYS` suffix.
  > ⚠️ **Not suitable for production password storage.** Firebase Auth is the primary auth mechanism.
- **`analyzePassword(pw)`** — Returns a strength analysis object with `checks[]`, `score`, `strength` label, and `strengthColor`.
- **`callClaude(messages, systemPrompt)`** — Async function that POSTs to the Pollinations AI proxy endpoint (`https://text.pollinations.ai/openai`) with an OpenAI-compatible payload. Post-processes response to strip injected Pollinations watermark text. Extracts a JSON array from the response if the system prompt contains `"JSON"`.

### 5.6 `src/components/AuthPage.jsx` — Authentication UI
- Full-screen authentication interface.
- Handles Google Sign-In flow using `googleProvider` from Firebase.
- Includes a local registration/login form (uses `hashPassword` for demo purposes).
- Shows password strength analysis in real time using `analyzePassword`.

### 5.7 `src/components/GameApp.jsx` — Core Game Engine (~39KB)
The largest and most complex module. Contains all gameplay logic:
- Loads and saves player state to Firestore.
- Quest management (add, complete, remove, reset daily quests).
- XP and leveling system.
- Stat progression engine.
- Dungeon battle system.
- Shadow army management.
- System Log rendering.
- AI Quest Generation panel (calls `callClaude`).

---

## 6. Data Models

### 6.1 Player Object
```js
{
  uid: string,              // Firebase Auth UID
  name: string,             // Uppercased display name
  title: string,            // e.g., "E-Rank Hunter"
  rank: string,             // "E" | "D" | "C" | "B" | "A" | "S" | "National"
  level: number,            // Current player level (starts at 1)
  xp: number,               // Current XP
  xpToNext: number,         // XP required to reach next level (starts at 1000)
  stats: {
    STR: number,            // Strength
    INT: number,            // Intelligence
    VIT: number,            // Vitality
    AGI: number,            // Agility
    SEN: number,            // Sense
  },
  totalCompleted: number,   // Lifetime quest completion count
  streak: number,           // Current day streak
  lastLoginDate: string,    // Date string for daily reset logic
}
```

### 6.2 Quest Object
```js
{
  id: string,               // Unique quest ID (e.g., "q1", or UUID for custom)
  name: string,             // Quest display name
  type: "mandatory" | "bonus",
  stat: "STR" | "INT" | "VIT" | "AGI" | "SEN", // Stat rewarded on completion
  xp: number,               // XP granted on completion
  done: boolean,            // Completion state for today
  streak: number,           // Consecutive days completed
  emoji: string,            // Display emoji
}
```

### 6.3 Dungeon Object
```js
{
  active: boolean,          // Whether a dungeon encounter is live
  bossName: string,
  bossEmoji: string,
  bossHpMax: number,
  bossHp: number,           // Current HP
  blocks: number,           // Quest completions accumulated toward dungeon unlock
  blocksNeeded: number,     // Threshold to trigger next dungeon
}
```

### 6.4 Full Game State (Firestore Document)
```js
{
  player: PlayerObject,
  quests: Quest[],
  shadows: Shadow[],         // Shadow army members
  systemLog: LogEntry[],     // In-game notification log
  dungeon: DungeonObject,
  lastQuestReset: string,    // Date string to determine when to reset quests
}
```

### 6.5 Firestore Document Path
```
/users/{uid}/gameState  (single document per user)
```

---

## 7. Game Logic & Algorithms

### 7.1 XP & Leveling
- On quest completion: `player.xp += quest.xp`
- If `player.xp >= player.xpToNext`:
  - `player.level += 1`
  - `player.xp -= player.xpToNext`
  - `player.xpToNext = Math.floor(player.xpToNext * 1.25)` (25% growth per level)
- On quest undo: XP is subtracted and level-downs are recalculated accurately.

### 7.2 Stat Growth
- On quest completion: `player.stats[quest.stat] += 1`
- Rank progression is derived from overall level thresholds defined in `constants.js`.

### 7.3 Daily Quest Reset
- On app load: compare `lastQuestReset` to `new Date().toDateString()`.
- If different, all quests have `done` reset to `false` and `lastQuestReset` is updated.

### 7.4 Dungeon System
- Every quest completion increments `dungeon.blocks`.
- When `dungeon.blocks >= dungeon.blocksNeeded`, a dungeon encounter is activated.
- Boss HP is reduced through in-game "attacks" (likely time-gated or action-based).
- Upon boss defeat, rewards are issued and the next dungeon tier is unlocked.

---

## 8. AI Integration

**Endpoint:** `https://text.pollinations.ai/openai` (OpenAI-compatible proxy)
**Model:** `openai` (default model on Pollinations)

**Function:** `callClaude(messages, systemPrompt)` in `src/utils.js`

**Usage in GameApp:** The AI Generation panel sends a system prompt instructing the AI to return a JSON array of quest objects. The response is cleaned of any Pollinations watermark injection before being parsed.

**Expected AI Response Format:**
```json
[
  { "name": "Do 50 Push-ups", "stat": "STR", "xp": 700, "emoji": "💪", "type": "mandatory" },
  { "name": "Journal for 10 min", "stat": "SEN", "xp": 400, "emoji": "📓", "type": "bonus" }
]
```

**Error Handling:** If the response is malformed or the JSON match fails, the raw text is returned (graceful degradation).

---

## 9. Authentication Flow

```
User Clicks "Sign in with Google"
        │
        ▼
GoogleAuthProvider.signInWithPopup(auth, googleProvider)
        │
        ▼
Firebase Auth resolves → onAuthStateChanged fires in App.jsx
        │
        ▼
session = { uid: user.uid, username: user.displayName }
        │
        ▼
GameApp mounts → loads state from Firestore doc /users/{uid}/gameState
        │
   State found?
   ┌────┴────┐
  YES       NO
   │         │
   ▼         ▼
Load state  Create DEFAULT_GAME_STATE(uid, username)
   │         │
   └────┬────┘
        ▼
    Render Dashboard
```

---

## 10. Firebase Integration

### Services Used
| Service | Usage |
|---|---|
| Firebase Authentication | Google Sign-In, session management |
| Cloud Firestore | Player state persistence (NoSQL) |

### Firestore Read/Write Pattern
- **Read:** On `GameApp` mount, fetch the document at `/users/{uid}/gameState`.
- **Write:** On any state-changing action (quest completion, dungeon progress, etc.), the entire `gameState` object is written back via `setDoc` or `updateDoc`.
- **Auth Guard:** Firestore Security Rules must be configured to only allow read/write access to documents where `request.auth.uid == userId`.

### Required Firebase Setup
1. Enable **Authentication** → Google provider.
2. Enable **Firestore Database** in production mode.
3. Add Firestore Security Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 11. Build & Deployment Pipeline

### Local Development
```bash
npm install
npm run dev   # Vite dev server at http://localhost:5173
```

### Production Build
```bash
npm run build  # Output to /dist
```

**Obfuscation at build time** (via `vite-plugin-javascript-obfuscator`):
- Applies to all `.js` and `.jsx` files under `src/`.
- Options: `controlFlowFlattening`, `deadCodeInjection`, `stringArray` with `base64` encoding, `transformObjectKeys`.
- Does **not** apply during `dev` mode (`apply: 'build'`).
- Source maps are disabled (`sourcemap: false`) to prevent code exposure.

### Netlify Deployment
Configured via `netlify.toml`. Continuous deployment is triggered on pushes to the configured branch (e.g., `main` or `testing`).

**SPA Redirect Rule** (required for client-side routing):
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Environment Variables (Netlify)
Set the following in Netlify → Site Settings → Environment Variables:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

---

## 12. Security Requirements

| Area | Requirement |
|---|---|
| Auth | All users must authenticate via Firebase before accessing any game data |
| Firestore | Security rules must enforce that users can only access their own `/users/{uid}` documents |
| Code Obfuscation | Production builds must obfuscate all source JS/JSX to protect game logic |
| Source Maps | Source maps must be disabled (`sourcemap: false`) in production |
| Dependencies | Run `npm audit` regularly; patch critical vulnerabilities (e.g., previous `protobufjs` prototype pollution) |
| Secrets | Firebase credentials must only be stored in environment variables, never hardcoded |
| Password Hashing | The local `hashPassword` utility is NOT cryptographic; it is used only for local demo auth, never for real user credential storage |

---

## 13. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | ✅ Yes | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ Yes | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ Yes | Firestore project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ Yes | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ Yes | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ Yes | Firebase App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | ⚠️ Optional | Firebase Analytics measurement ID |

> All variables must be prefixed with `VITE_` to be exposed to the Vite client bundle.

---

## 14. Known Constraints & Tech Debt

| Item | Description | Priority |
|---|---|---|
| `hashPassword` is not cryptographic | The utility in `utils.js` is a djb2-style hash, not bcrypt/argon2. It should not be used for real password storage. Firebase Auth is the authoritative auth mechanism. | Medium |
| `GameApp.jsx` is monolithic | At ~39KB, the core game component handles too many responsibilities. It should be refactored into smaller, focused sub-components (e.g., `QuestPanel`, `StatsPanel`, `DungeonPanel`). | Medium |
| AI Proxy Dependency | `callClaude` uses the third-party Pollinations AI proxy. This is not officially supported and may inject watermarks or change its API. Should be migrated to an official OpenAI or Anthropic API key. | High |
| Obfuscation Performance | `controlFlowFlattening` and `deadCodeInjection` significantly increase bundle size and can slow cold-start performance. Thresholds should be tuned for an optimal security/performance balance. | Medium |
| Prototype Pollution Vulnerability | Historical `protobufjs` vulnerability was patched via `package.json` overrides. Must continue monitoring via `npm audit`. | High |
