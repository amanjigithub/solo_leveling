# 🗡️ Solo Leveling — Tech Upgrade Implementation Plan

## What We're Doing & Why

Your app is a **React + Vite + Firebase** Solo Leveling habit tracker. Based on the `tech_upgrade_roadmap.md`, we are going to implement the upgrades in the order you asked: **Database → Backend → Frontend**.

You said you're learning, so every step will have a detailed explanation saved to `document/`.

---

## ⚠️ User Review Required

> [!IMPORTANT]
> This plan follows your requested order: Database first, then Backend/Server, then Frontend.
> We are NOT migrating to Next.js yet — that's a big jump. We'll modernize within your current Vite setup first.

> [!WARNING]
> Your **OpenRouter API key** (`VITE_OPENROUTER_API_KEY`) is currently exposed in the browser. Anyone who opens DevTools can steal it. The Firebase Cloud Functions step (Phase 2) fixes this.

---

## Open Questions

> [!IMPORTANT]
> 1. Should we implement all phases at once, or phase-by-phase with your review in between?
> 2. Do you want to keep the **local demo auth** (email/password hash) or go **Google-only**?

---

## The 3 Phases

```
Phase 1 — DATABASE    (Firestore improvements)
Phase 2 — BACKEND     (Firebase Cloud Functions — API key security)
Phase 3 — FRONTEND    (Zustand + React Query + Framer Motion + TypeScript)
```

---

## Phase 1 — 🗄️ DATABASE (Firestore Real-time + Security)

**What you have now:** A single `getDoc()` call that loads data once when the app starts. If you're logged in on two devices, they don't stay in sync.

**What we're upgrading to:** `onSnapshot()` — a live listener that pushes updates to your app the instant Firestore data changes. Open the app on your phone AND laptop — complete a quest on one, see it update on the other in real time.

### Files Changing

#### [MODIFY] [firebase.js](file:///Users/amansingh/sololeveling/src/firebase.js)
- Add `onSnapshot`, `doc`, `setDoc` exports from Firestore SDK

#### [MODIFY] [GameApp.jsx](file:///Users/amansingh/sololeveling/src/components/GameApp.jsx)
- Replace the one-shot `getDoc()` on mount with `onSnapshot()` listener
- Add cleanup: `useEffect` returns the `unsubscribe` function so the listener stops when component unmounts
- Add write debouncing: don't write to Firestore on every keystroke — wait 500ms

#### [NEW] `document/learn_database.md`
- Full explanation of: what is a database, what is Firestore, what is NoSQL, what is a real-time listener, why `onSnapshot` is better than `getDoc`

---

## Phase 2 — ⚙️ BACKEND (Firebase Cloud Functions)

**What you have now:** Your OpenRouter API key is in the browser. Anyone can open DevTools → Network tab and steal it to make free AI calls on your bill.

**What we're adding:** A **Firebase Cloud Function** — a tiny server that lives in Google's cloud. The frontend calls your function, the function calls OpenRouter with the real API key, and returns the result. The key never touches the browser.

### New Architecture
```
Browser → calls → your Firebase Function → calls → OpenRouter AI
                 (key is safe here ^)
```

### Files Changing

#### [NEW] `functions/` directory
- `functions/index.js` — The server-side function: receives quest generation requests, calls OpenRouter, returns results
- `functions/package.json` — Node.js dependencies for the function

#### [MODIFY] [utils.js](file:///Users/amansingh/sololeveling/src/utils.js)
- Change `callClaude()` to call your Cloud Function URL instead of OpenRouter directly
- API key removed from frontend entirely

#### [NEW] `document/learn_backend.md`
- Full explanation of: what is a server, what is serverless, what are Cloud Functions, what is an API key, why keys must be secret, how HTTP requests work

---

## Phase 3 — 🎨 FRONTEND (Zustand + React Query + Framer Motion)

**What you have now:** All state lives in one giant `useState` in `GameApp.jsx` (~39KB file). It's hard to read and hard to extend.

**What we're upgrading to:**
1. **Zustand** — A global state store. Instead of passing props everywhere, any component can read/write state directly. Think of it like a shared notebook everyone can read.
2. **React Query** — Handles all the "loading, error, success" states for Firestore automatically. No more manual loading spinners.
3. **Framer Motion** — Smooth animations: quest cards slide out, XP counter animates up, level-up is cinematic.

### Files Changing

#### [NEW] `src/store/` directory
- `src/store/usePlayerStore.js` — Player stats, level, XP
- `src/store/useQuestStore.js` — Quest list management
- `src/store/useDungeonStore.js` — Dungeon state

#### [MODIFY] [GameApp.jsx](file:///Users/amansingh/sololeveling/src/components/GameApp.jsx)
- Refactored into smaller sub-components using the new stores
- Animations added with Framer Motion

#### [NEW] `document/learn_frontend.md`
- Full explanation of: what is state management, why Zustand, what is React Query, what are animations, why we split components

---

## Verification Plan

### After Phase 1
- Open app on two browser tabs — complete a quest in one, it should appear done in the other within 1 second
- Check Firestore console — data should update in real time

### After Phase 2
- Open DevTools → Network tab → generate AI quests → the API key should NOT be visible in any request
- Cloud Function logs should show successful calls

### After Phase 3
- Quest completion should have a smooth slide-out animation
- State changes in one "panel" should not cause unrelated panels to re-render
- App should feel faster and smoother

---

## Learning Documents Created

| File | Teaches |
|------|---------|
| `document/learn_database.md` | Databases, Firestore, NoSQL, real-time listeners |
| `document/learn_backend.md` | Servers, serverless, Cloud Functions, API key security |
| `document/learn_frontend.md` | State management, Zustand, React Query, animations |
