# 🗄️ Learn: Databases & Firestore Real-Time Listeners

> **What we changed:** Upgraded from `getDoc()` (one-shot) to `onSnapshot()` (live/real-time)  
> **Why:** So the app syncs instantly across all your devices

---

## 1. What is a Database?

A **database** is a place where your app stores data permanently. Without a database:
- Every time you close the app, all your quests, XP, and progress disappear
- Multiple devices can't share the same data

Think of it like this:

```
WITHOUT a database:        WITH a database:
Your RAM (app memory)      Your hard drive / cloud server
   ↕                           ↕
Data disappears             Data lives forever
when you close app          across any device
```

---

## 2. What Kind of Database Does This App Use?

This app uses **Cloud Firestore** — a database made by Google/Firebase.

Firestore is a **NoSQL database**. Let's understand what that means:

### SQL Database (like MySQL, PostgreSQL)
- Data stored in tables (like Excel spreadsheets)
- Every row has the same columns
- Very structured and strict

```
┌────────────┬───────────┬───────┬───────────┐
│ user_id    │ name      │ level │ xp        │
├────────────┼───────────┼───────┼───────────┤
│ uid_123    │ AMAN      │ 5     │ 2400      │
│ uid_456    │ ROHAN     │ 12    │ 8900      │
└────────────┴───────────┴───────┴───────────┘
```

### NoSQL Database (like Firestore — what we use)
- Data stored as **documents** (like JSON files)
- Each document can have different fields
- Very flexible — perfect for game state

```
// Firestore — document stored at path: /hunters/uid_123
{
  player: {
    name: "AMAN",
    level: 5,
    xp: 2400,
    rank: "E",
    stats: { STR: 15, INT: 12, VIT: 10, AGI: 11, SEN: 13 }
  },
  quests: [
    { id: "q1", name: "Morning Exercise", done: false, xp: 800 },
    { id: "q2", name: "Read 30 Pages", done: true, xp: 600 }
  ],
  dungeon: { active: false, bossHp: 100 },
  systemLog: [...]
}
```

---

## 3. What is a "Document" in Firestore?

Firestore organizes data like this:

```
Firestore Database
│
├── hunters/           ← Collection (like a folder)
│   ├── uid_123        ← Document (your game save file)
│   │   └── { player, quests, dungeon, systemLog }
│   │
│   └── uid_456        ← Document (another user's game save)
│       └── { player, quests, dungeon, systemLog }
│
└── (other collections...)
```

**Key terms:**
- **Collection** = a folder that holds documents
- **Document** = one JSON object (your entire game state)
- **Path** = how you address a document: `"hunters"` + your `uid`

In our app's code:
```js
// This creates a "reference" to your document
const docRef = doc(db, "hunters", uid);
//                       ↑          ↑
//                   collection   document ID (your unique user ID)
```

---

## 4. The Old Way: `getDoc()` — One-Shot Fetch

Before this upgrade, the app used `getDoc()`:

```js
// OLD CODE — runs once, then stops listening
const snap = await getDoc(docRef);
const data = snap.data();
setState(data);
```

**The problem with this:**

```
App starts
   │
   ↓ getDoc() — fetches data once
   │
   ↓ Done. No more connection.
   │
   ↓ [User completes quest on phone]
   │
   ❌ Laptop doesn't know! It still shows the old data.
   
   User has to REFRESH the page to see updates.
```

---

## 5. The New Way: `onSnapshot()` — Live Connection

After this upgrade, the app uses `onSnapshot()`:

```js
// NEW CODE — keeps listening forever until you unsubscribe
const unsubscribe = onSnapshot(docRef, (snap) => {
  const data = snap.data();
  setState(data);
});
```

**How this works:**

```
App starts
   │
   ↓ onSnapshot() — fetches data AND opens a live connection
   │
   ↓ [Any time Firestore data changes]
   │
   ↓ Firebase PUSHES the new data to the app automatically
   │
   ✅ App updates instantly — no refresh needed!

Phone updates quest → Laptop sees it in < 1 second ✨
```

The callback function `(snap) => { setState(data) }` runs **every time** the data changes in Firestore — whether from this device or any other device logged in as the same user.

---

## 6. What is "Unsubscribe"?

When you use `onSnapshot()`, Firebase keeps a **WebSocket connection** open to the server (a permanent two-way tunnel). This uses memory and bandwidth.

When the component unmounts (user logs out, closes tab), you must **close this tunnel**. That's what `unsubscribe` does:

```js
useEffect(() => {
  // Start listening
  const unsubscribe = onSnapshot(docRef, (snap) => {
    setState(snap.data());
  });

  // Return cleanup function
  // React calls this automatically when component unmounts
  return () => {
    unsubscribe(); // ← Close the connection. Stop listening.
  };
}, [uid]);
```

Without `unsubscribe`, you'd have **memory leaks** — open connections piling up that are never closed. This is like leaving hundreds of phone calls on hold.

---

## 7. What About Offline? (localStorage Cache)

The app uses a two-layer strategy:

```
Layer 1: localStorage (instant, works offline)
   → Shows data immediately with no loading spinner
   → Works even with no internet

Layer 2: Firestore onSnapshot (syncs with cloud)
   → Updates data from the server
   → Detects changes from other devices
```

This pattern is called **"Cache-First, Network-Sync"**:
1. Show what we have locally → user sees app instantly
2. Sync with server → update if server has newer data

---

## 8. WebSocket — How Real-Time Works Under the Hood

Firebase's real-time magic uses a **WebSocket** — a permanent open connection between your browser and Google's servers.

```
Your Browser ←——————— WebSocket Tunnel ——————————→ Firebase Servers
               (data flows both ways, instantly)

Normal HTTP:    Browser asks → Server answers → Connection closes
WebSocket:      Connection stays OPEN. Firebase can push data at any time.
```

This is how apps like Slack, Google Docs, and Discord work — they all maintain open WebSocket connections so messages appear in real-time without you pressing refresh.

---

## 9. Summary of Changes Made

| What | Before | After |
|------|--------|-------|
| Data loading | `getDoc()` — fetches once | `onSnapshot()` — listens forever |
| Multi-device sync | ❌ No sync | ✅ Real-time sync |
| Memory cleanup | N/A | `unsubscribe()` on unmount |
| Daily reset logic | Duplicated in two places | Consolidated to one place |

---

## 10. Key Terms Glossary

| Term | Simple Meaning |
|------|---------------|
| **Database** | Permanent storage for your app's data |
| **NoSQL** | Database that stores flexible JSON-like documents (not tables) |
| **Collection** | A folder in Firestore that holds documents |
| **Document** | One JSON object in Firestore (our entire game state) |
| **getDoc()** | Fetch data once and stop |
| **onSnapshot()** | Fetch data AND keep listening for future changes |
| **unsubscribe** | A function to stop listening and close the connection |
| **WebSocket** | A permanent two-way connection between browser and server |
| **Memory leak** | When connections or resources are never cleaned up |
| **Cache-First** | Show local data immediately, then update from server |
