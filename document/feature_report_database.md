# 🗡️ Solo Leveling — Feature Report: Database & Backend Integration

> **Document Type:** Feature Report  
> **Project:** Solo Leveling Habit Tracker  
> **Current Stack:** React + Vite + Firebase (Firestore)  
> **Proposed Upgrade:** PostgreSQL + REST API + User Authentication + Social Features  
> **Prepared:** 2026-08-12

---

## 1. Executive Summary

The current Solo Leveling app stores all user data in **localStorage** — a browser-only storage system. This means every habit, XP point, and streak is locked to a single browser on a single device. If a user opens the app on their phone, their data is gone. If they clear browser cache, everything is wiped.

This report proposes migrating to a **full-stack architecture** with:
- A **PostgreSQL database** for persistent, cross-device data storage
- A **REST API** (FastAPI or Node.js/Express) for secure data access
- **Email/password authentication** so users own their data
- A **social leaderboard** so users can compete with friends

---

## 2. Problem Statement

### 2.1 Current Limitations

| Problem | Impact | Severity |
|---|---|---|
| Data tied to one browser | Can't switch devices | 🔴 Critical |
| localStorage can be cleared | All progress lost permanently | 🔴 Critical |
| No user accounts | No identity, no social features | 🟠 High |
| No social features | App is purely solo, lower motivation | 🟡 Medium |
| No cross-device sync | Can't track habits on phone + laptop | 🔴 Critical |

### 2.2 User Pain Points

- **"I got a new phone and lost 3 months of XP and streaks."**
- **"I can't log habits during the day on my phone and review progress on my laptop."**
- **"There's no way to share my rank with friends — it's lonely."**

---

## 3. Proposed Features

### 3.1 Feature 1 — User Authentication (Email + Password)

**What it does:**  
Users create an account with their email and password. Their data is linked to that account — not to a browser.

**User Flow:**
```
1. User visits the app for the first time
2. Clicks "Create Account"
3. Enters email + password
4. Data is stored under their unique user ID in PostgreSQL
5. On any device: Login → see all their habits, XP, and rank
```

**User Benefits:**
- ✅ Data survives clearing cache, switching phones, or reinstalling the browser
- ✅ Secure — passwords are hashed (bcrypt), never stored in plain text
- ✅ One account = one identity across all devices

**Priority:** 🔴 P0 — Foundation for everything else

---

### 3.2 Feature 2 — Persistent Habit & XP Storage (PostgreSQL)

**What it does:**  
All habits (quests), XP, level, stats, dungeon progress, and streaks are stored in a PostgreSQL database in the cloud — not in the browser.

**Data that moves to the database:**
| Data | Current Storage | New Storage |
|---|---|---|
| Habits / Quests | localStorage | PostgreSQL `quests` table |
| XP & Level | localStorage | PostgreSQL `players` table |
| Daily Streaks | localStorage | PostgreSQL `quests` table |
| Dungeon Progress | localStorage + Firestore | PostgreSQL `dungeons` table |
| Player Stats (STR, AGI…) | localStorage | PostgreSQL `players` table |

**User Benefits:**
- ✅ Data never lost — even if the phone breaks
- ✅ Access from any device, any browser
- ✅ Historical data — track progress over months/years

**Priority:** 🔴 P0 — Core database feature

---

### 3.3 Feature 3 — REST API (CRUD Endpoints)

**What it does:**  
A set of server-side API endpoints that the frontend calls to create, read, update, and delete data. No data is modified directly in the database from the browser.

**API Endpoints:**

| Method | Endpoint | Action |
|---|---|---|
| `POST` | `/api/auth/register` | Create new user account |
| `POST` | `/api/auth/login` | Login and receive JWT token |
| `GET` | `/api/habits` | Get all habits for logged-in user |
| `POST` | `/api/habits` | Create a new habit |
| `PATCH` | `/api/habits/:id` | Mark habit done/undone |
| `DELETE` | `/api/habits/:id` | Delete a habit |
| `GET` | `/api/player` | Get player stats (XP, level, rank) |
| `PATCH` | `/api/player/xp` | Add XP after completing a quest |
| `GET` | `/api/leaderboard` | Get friends leaderboard |
| `POST` | `/api/friends/add` | Send friend request |

**User Benefits:**
- ✅ Data changes are validated server-side (can't cheat XP in DevTools)
- ✅ Clear, predictable data access model
- ✅ Foundation for mobile app or third-party integrations later

**Priority:** 🔴 P0 — Required for any backend feature

---

### 3.4 Feature 4 — Social Leaderboard & Friends

**What it does:**  
Users can add friends by username or email. They see a ranked leaderboard showing all their friends' current XP and rank title.

**User Flow:**
```
1. User taps "Add Friend"
2. Enters friend's username or email
3. Friend receives a notification (or sees pending request)
4. Once accepted, both see each other on the leaderboard
5. Leaderboard shows: Rank | Avatar | Username | Level | XP | Rank Title
```

**Leaderboard Example:**

| # | Hunter | Level | XP | Rank |
|---|---|---|---|---|
| 🥇 1 | ShadowKing | 42 | 128,500 | S-Rank |
| 🥈 2 | You | 38 | 95,200 | A-Rank |
| 🥉 3 | IronFist | 31 | 67,000 | B-Rank |

**User Benefits:**
- ✅ Social accountability — you can see if your friends are leveling up faster
- ✅ Competitive motivation — trying to move up the leaderboard
- ✅ Transforms a solo app into a small community

**Priority:** 🟠 P1 — Significant motivation multiplier

---

### 3.5 Feature 5 — Daily Reset (Server-Side)

**What it does:**  
Currently, daily habit resets are done on the client (browser). This means if a user doesn't open the app, the reset never fires and their streak might carry over incorrectly.

With a backend, a **scheduled server job** runs every day at midnight and resets all daily habits — whether the app is open or not.

**Priority:** 🟡 P2 — Correctness improvement

---

## 4. What Stays the Same

The following features are **not changing** in this upgrade:

- ✅ Solo Leveling visual theme (ranks, XP, boss fights)
- ✅ AI-generated quest names
- ✅ Dungeon focus timer (25-min Pomodoro)
- ✅ Player stat system (STR, AGI, INT, etc.)
- ✅ Daily quest reset cycle

---

## 5. Migration Strategy

### Phase A — Foundation (Week 1–2)
1. Set up PostgreSQL database (local Docker → cloud)
2. Build authentication API (register, login, JWT)
3. Migrate player data endpoints

### Phase B — Habit Data (Week 2–3)
4. Migrate quest/habit CRUD endpoints
5. Update frontend to call API instead of localStorage
6. Test cross-device sync

### Phase C — Social (Week 3–4)
7. Build friends system and leaderboard endpoint
8. Add friend search and request UI
9. Build leaderboard panel in the app

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Users lose localStorage data during migration | Add one-time data export tool before launch |
| API security (unauthorized access) | JWT authentication on every protected endpoint |
| Database downtime | Use a managed PostgreSQL service (Supabase / Neon / Railway) |
| Slow API responses | Add database indexes on `user_id`, `created_at` |
| Friend feature abuse (spam) | Rate limit friend requests; require mutual acceptance |

---

## 7. Success Metrics

| Metric | Goal |
|---|---|
| Cross-device sync works | Data appears on Phone AND Laptop in < 1s |
| Auth security | 0 plaintext passwords stored |
| API response time | < 200ms for all habit endpoints |
| Leaderboard loads | < 500ms for up to 50 friends |
| Data durability | 0 data loss events per month |

---

## 8. Summary

| Feature | Priority | Effort |
|---|---|---|
| Email/Password Auth | 🔴 P0 | Medium |
| PostgreSQL Storage | 🔴 P0 | Medium |
| REST API (CRUD) | 🔴 P0 | Medium–High |
| Social Leaderboard | 🟠 P1 | High |
| Server-side Daily Reset | 🟡 P2 | Low |

The database upgrade is the single most impactful improvement this project can make. Without it, the app cannot grow beyond a single-device personal tool.
